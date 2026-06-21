"""Study plans router — AI generation, CRUD, and progress tracking."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from bson import ObjectId
from app.database import study_plans_collection, subjects_collection
from app.models.study_plan import create_study_plan_document
from app.schemas.study_plan import StudyPlanGenerate, StudyPlanProgressUpdate
from app.ai_engine import generate_study_plan
from app.middleware.auth import get_current_user_optional

router = APIRouter(prefix="/api/study-plans", tags=["Study Plans"])


def serialize_doc(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ── POST /api/study-plans/generate ───────────────────────

@router.post("/generate")
async def generate_plan(
    request: StudyPlanGenerate,
    user: dict = Depends(get_current_user_optional),
):
    """Generate an AI-powered day-wise study plan."""
    if not request.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")

    user_id = user["_id"] if user else "anonymous"

    # AI generates the topic schedule
    topics_raw = generate_study_plan(
        request.description,
        request.subject_name,
        request.deadline,
        request.daily_minutes,
    )

    if topics_raw is None:
        topics_raw = []

    # Add completed flag to each topic
    topics = []
    for t in topics_raw:
        if isinstance(t, dict):
            t["completed"] = False
            topics.append(t)

    # Persist plan
    plan_doc = create_study_plan_document(
        user_id=user_id,
        subject_name=request.subject_name,
        description=request.description,
        deadline=request.deadline,
        daily_minutes=request.daily_minutes,
        topics=topics,
    )
    now = datetime.now(timezone.utc).isoformat()
    plan_doc["created_at"] = now
    plan_doc["updated_at"] = now

    try:
        result = await study_plans_collection.insert_one(plan_doc)
        plan_id = str(result.inserted_id)
    except Exception:
        plan_id = "offline"

    return {
        "status": "success",
        "plan_id": plan_id,
        "subject_name": request.subject_name,
        "topics": topics,
        "overall_progress": 0,
        "deadline": request.deadline,
    }


# ── GET /api/study-plans/ ────────────────────────────────

@router.get("/")
async def list_plans(user: dict = Depends(get_current_user_optional)):
    """List all study plans for the current user, auto-generating if missing."""
    user_id = user["_id"] if user else "anonymous"

    try:
        # Fetch all plans
        plans = []
        async for doc in study_plans_collection.find({"user_id": user_id}).sort("created_at", -1):
            plans.append(serialize_doc(doc))

        # Check for subjects that don't have study plans (or have empty plans)
        subjects = []
        async for sub in subjects_collection.find({"user_id": user_id}):
            subjects.append(sub)

        plans_by_subject = {p.get("subject_name", "").lower(): p for p in plans}
        
        updated_plans = False
        for sub in subjects:
            sub_name = sub.get("name", "")
            sub_lower = sub_name.lower()
            existing_plan = plans_by_subject.get(sub_lower)
            
            # If no plan exists, or if it exists but has 0 topics
            if not existing_plan or not existing_plan.get("topics"):
                print(f"[AUTO-GEN] Generating study plan for subject: {sub_name}")
                plan_desc = sub.get("description", f"Learning schedule for {sub_name}")
                plan_deadline = sub.get("deadline") or datetime.now(timezone.utc).isoformat().split('T')[0]
                daily_minutes = sub.get("daily_study_minutes") or 45
                
                # Trigger AI generation
                topics_raw = generate_study_plan(
                    plan_desc,
                    sub_name,
                    plan_deadline,
                    daily_minutes,
                )
                
                if topics_raw is None:
                    topics_raw = []
                
                # Add completed flag to each topic
                topics = []
                for t in topics_raw:
                    if isinstance(t, dict):
                        t["completed"] = False
                        topics.append(t)
                
                # Build plan document
                plan_doc = create_study_plan_document(
                    user_id=user_id,
                    subject_name=sub_name,
                    description=plan_desc,
                    deadline=plan_deadline,
                    daily_minutes=daily_minutes,
                    topics=topics,
                )
                now = datetime.now(timezone.utc).isoformat()
                plan_doc["created_at"] = now
                plan_doc["updated_at"] = now
                
                if existing_plan:
                    # Update the existing empty plan
                    await study_plans_collection.update_one(
                        {"_id": ObjectId(existing_plan["_id"])},
                        {"$set": {
                            "topics": topics,
                            "deadline": plan_deadline,
                            "daily_minutes": daily_minutes,
                            "updated_at": now
                        }}
                    )
                else:
                    # Insert new plan
                    await study_plans_collection.insert_one(plan_doc)
                
                updated_plans = True

        if updated_plans:
            # Re-fetch plans to return updated data
            plans = []
            async for doc in study_plans_collection.find({"user_id": user_id}).sort("created_at", -1):
                plans.append(serialize_doc(doc))

        return {"status": "success", "plans": plans}
    except Exception as e:
        print(f"[ERROR] list_plans error: {e}")
        return {"status": "offline", "plans": []}


# ── GET /api/study-plans/{plan_id} ───────────────────────

@router.get("/{plan_id}")
async def get_plan(plan_id: str):
    """Get a single study plan."""
    try:
        doc = await study_plans_collection.find_one({"_id": ObjectId(plan_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Study plan not found")
        return {"status": "success", "plan": serialize_doc(doc)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── PUT /api/study-plans/{plan_id}/progress ──────────────

@router.put("/{plan_id}/progress")
async def update_progress(plan_id: str, update: StudyPlanProgressUpdate):
    """Mark a specific topic as complete/incomplete and recalculate progress."""
    try:
        doc = await study_plans_collection.find_one({"_id": ObjectId(plan_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Study plan not found")

        topics = doc.get("topics", [])
        if update.topic_index < 0 or update.topic_index >= len(topics):
            raise HTTPException(status_code=400, detail="Invalid topic index")

        # Update topic completion
        topics[update.topic_index]["completed"] = update.completed

        # Recalculate overall progress
        completed_count = sum(1 for t in topics if t.get("completed"))
        overall_progress = int((completed_count / len(topics)) * 100) if topics else 0

        await study_plans_collection.update_one(
            {"_id": ObjectId(plan_id)},
            {
                "$set": {
                    "topics": topics,
                    "overall_progress": overall_progress,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

        return {
            "status": "success",
            "overall_progress": overall_progress,
            "completed_topics": completed_count,
            "total_topics": len(topics),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── DELETE /api/study-plans/{plan_id} ────────────────────

@router.delete("/{plan_id}")
async def delete_plan(plan_id: str):
    """Delete a study plan."""
    try:
        result = await study_plans_collection.delete_one({"_id": ObjectId(plan_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Study plan not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception:
        return {"status": "offline_success"}
