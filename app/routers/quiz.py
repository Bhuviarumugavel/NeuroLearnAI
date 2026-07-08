"""Quiz router — generate, submit, and history."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from bson import ObjectId
from app.database import quizzes_collection
from app.models.quiz import create_quiz_document, create_quiz_attempt
from app.schemas.quiz import QuizGenerateRequest, QuizSubmitRequest
from app.ai_engine import generate_structured_quiz
from app.middleware.auth import get_current_user_optional

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


def serialize_doc(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ── POST /api/quiz/generate ──────────────────────────────

@router.post("/generate")
async def generate_quiz(
    request: QuizGenerateRequest,
    user: dict = Depends(get_current_user_optional),
):
    """Generate an AI-powered quiz from source text enriched by uploaded notes and user profile ability."""
    user_id = user["_id"] if user else "anonymous"

    # 1. Enrich source text using manually uploaded notes for this subject
    enriched_text = request.text
    try:
        from app.database import notes_collection
        cursor = notes_collection.find({
            "user_id": user_id,
            "subject": request.subject,
            "type": "manual"
        })
        manual_texts = []
        async for doc in cursor:
            t = doc.get("original_text", "") or doc.get("summary", "")
            if t:
                manual_texts.append(t[:1200])
        
        if manual_texts:
            enriched_text = f"{enriched_text}\n\n=== Additional Uploaded Reference Materials ===\n" + "\n".join(manual_texts)
    except Exception as ex:
        print(f"[QUIZ-GEN] Failed enriching quiz source text: {ex}")

    # 2. Get user academic ability level from profile settings
    user_ability = "Medium"
    if user:
        study_prefs = user.get("study_preferences", {})
        user_ability = study_prefs.get("education_status") or "Medium"

    import asyncio
    quiz_data = await asyncio.to_thread(generate_structured_quiz, enriched_text, request.num_questions, user_ability, request.topic)

    # Persist quiz to MongoDB
    quiz_doc = create_quiz_document(
        user_id=user_id,
        subject=request.subject,
        source_text=request.text,
        questions=quiz_data,
        topic=request.topic,
    )
    quiz_doc["created_at"] = datetime.now(timezone.utc).isoformat()
 
    try:
        result = await quizzes_collection.insert_one(quiz_doc)
        quiz_id = str(result.inserted_id)
    except Exception:
        quiz_id = "offline"

    # Automatically schedule Calendar reminders for Quiz and Revision
    try:
        from app.database import reminders_collection
        from datetime import timedelta
        from app.routers.reminders import get_user_preferred_notification_hour

        # Fetch user study availability routines
        availability = "Evening"
        if user and "study_preferences" in user:
            availability = user["study_preferences"].get("availability", "Evening")
        target_hour = get_user_preferred_notification_hour(availability)

        # Set reminder time based on preferences
        remind_time = datetime.now(timezone.utc).replace(hour=target_hour, minute=0, second=0, microsecond=0)
        if remind_time < datetime.now(timezone.utc):
            remind_time += timedelta(days=1)

        # 1. Calendar entry: Quiz attempted today scheduled at preferred slot
        quiz_reminder = {
            "user_id": user_id,
            "message": f"Quiz: {request.subject} (Topic: {request.topic or 'General'})",
            "remind_at": remind_time.isoformat(),
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await reminders_collection.insert_one(quiz_reminder)
        
        # 2. Reframe future revision topics (spaced repetition in 3 days) at preferred slot
        rev_time = (datetime.now(timezone.utc) + timedelta(days=3)).replace(hour=target_hour, minute=0, second=0, microsecond=0)
        rev_reminder = {
            "user_id": user_id,
            "message": f"Revision Reminder: Re-evaluate {request.subject} (Topic: {request.topic or 'General'})",
            "remind_at": rev_time.isoformat(),
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await reminders_collection.insert_one(rev_reminder)
    except Exception as rem_ex:
        print(f"[QUIZ-GEN] Failed scheduling reminders: {rem_ex}")
 
    return {
        "status": "success",
        "quiz_id": quiz_id,
        "questions": quiz_data,
    }


# ── POST /api/quiz/submit ────────────────────────────────

@router.post("/submit")
async def submit_quiz(request: QuizSubmitRequest):
    """Submit quiz answers and get scored results."""
    try:
        quiz = await quizzes_collection.find_one({"_id": ObjectId(request.quiz_id)})
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")

        questions = quiz.get("questions", [])
        if not questions:
            raise HTTPException(status_code=400, detail="Quiz has no questions")

        # Score the quiz
        total = len(questions)
        score = 0
        results = []

        for i, q in enumerate(questions):
            user_answer = request.answers[i] if i < len(request.answers) else ""
            correct = q.get("answer", "")
            is_correct = user_answer.strip().lower() == correct.strip().lower()
            if is_correct:
                score += 1
            results.append({
                "question": q.get("question"),
                "your_answer": user_answer,
                "correct_answer": correct,
                "is_correct": is_correct,
            })

        # Save attempt
        attempt = create_quiz_attempt(score=score, total=total, answers=request.answers)
        attempt["attempted_at"] = datetime.now(timezone.utc).isoformat()

        await quizzes_collection.update_one(
            {"_id": ObjectId(request.quiz_id)},
            {"$push": {"attempts": attempt}},
        )

        # Recalculate progress or completion of the subject
        subject_name = quiz.get("subject", "General")
        user_id = quiz.get("user_id", "anonymous")
        percentage = round((score / total) * 100, 1) if total > 0 else 0

        # Update subject completion status
        is_completed = percentage >= 80.0
        needs_retest = percentage < 80.0

        from app.database import subjects_collection
        await subjects_collection.update_one(
            {"user_id": user_id, "name": subject_name},
            {"$set": {"completed": is_completed, "needs_retest": needs_retest}}
        )

        return {
            "status": "success",
            "score": score,
            "total": total,
            "percentage": percentage,
            "results": results,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── GET /api/quiz/history ────────────────────────────────

@router.get("/history")
async def quiz_history(user: dict = Depends(get_current_user_optional)):
    """Get all past quizzes and their attempts for the user."""
    user_id = user["_id"] if user else "anonymous"

    try:
        quizzes = []
        async for doc in quizzes_collection.find({"user_id": user_id}).sort("created_at", -1):
            serialized = serialize_doc(doc)
            # Add computed stats
            attempts = serialized.get("attempts", [])
            if attempts:
                last = attempts[-1]
                serialized["last_score"] = last.get("score", 0)
                serialized["last_total"] = last.get("total", 0)
                serialized["attempt_count"] = len(attempts)
            quizzes.append(serialized)

        return {"status": "success", "quizzes": quizzes}
    except Exception:
        return {"status": "offline", "quizzes": []}


# ── GET /api/quiz/{quiz_id} ──────────────────────────────

@router.get("/{quiz_id}")
async def get_quiz(quiz_id: str):
    """Get a single quiz by ID."""
    try:
        doc = await quizzes_collection.find_one({"_id": ObjectId(quiz_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Quiz not found")
        return {"status": "success", "quiz": serialize_doc(doc)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
