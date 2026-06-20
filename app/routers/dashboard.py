"""Dashboard router — aggregated analytics and AI recommendations."""
from fastapi import APIRouter, Depends
from app.database import (
    subjects_collection,
    notes_collection,
    quizzes_collection,
    study_plans_collection,
)
from app.ai_engine import generate_recommendations
from app.middleware.auth import get_current_user_optional

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


# ── GET /api/dashboard/summary ───────────────────────────

@router.get("/summary")
async def dashboard_summary(user: dict = Depends(get_current_user_optional)):
    """Aggregated dashboard stats across all modules."""
    user_id = user["_id"] if user else "anonymous"
    query = {"user_id": user_id}

    try:
        # Count documents
        total_subjects = await subjects_collection.count_documents(query)
        total_notes = await notes_collection.count_documents(query)
        total_quizzes = await quizzes_collection.count_documents(query)
        active_plans = await study_plans_collection.count_documents(
            {**query, "is_active": True}
        )

        # Subject details with progress
        subjects = []
        total_progress = 0
        async for doc in subjects_collection.find(query):
            topics = doc.get("topics", [])
            completed = sum(1 for t in topics if t.get("completed", False))
            progress = doc.get("progress", 0)
            total_progress += progress
            subjects.append({
                "id": str(doc["_id"]),
                "name": doc.get("name"),
                "color": doc.get("color"),
                "progress": progress,
                "total_topics": len(topics),
                "completed_topics": completed,
                "deadline": doc.get("deadline"),
                "daily_minutes": doc.get("daily_study_minutes", 45),
            })

        overall_progress = round(total_progress / total_subjects, 1) if total_subjects > 0 else 0

        # User stats
        streak_days = user.get("streak_days", 0) if user else 0
        total_study_minutes = user.get("total_study_minutes", 0) if user else 0

        return {
            "status": "success",
            "total_subjects": total_subjects,
            "total_notes": total_notes,
            "total_quizzes": total_quizzes,
            "active_plans": active_plans,
            "overall_progress": overall_progress,
            "subjects": subjects,
            "streak_days": streak_days,
            "total_study_minutes": total_study_minutes,
        }
    except Exception:
        return {
            "status": "offline",
            "total_subjects": 0,
            "total_notes": 0,
            "total_quizzes": 0,
            "active_plans": 0,
            "overall_progress": 0,
            "subjects": [],
            "streak_days": 0,
            "total_study_minutes": 0,
        }


# ── GET /api/dashboard/activity ──────────────────────────

@router.get("/activity")
async def recent_activity(user: dict = Depends(get_current_user_optional)):
    """Get recent activity feed — latest notes, quizzes, plans."""
    user_id = user["_id"] if user else "anonymous"
    query = {"user_id": user_id}
    activities = []

    try:
        # Recent notes
        async for doc in notes_collection.find(query).sort("created_at", -1).limit(5):
            activities.append({
                "type": "note_added",
                "description": f"Added note in {doc.get('subject', 'General')}",
                "timestamp": doc.get("created_at", ""),
            })

        # Recent quizzes
        async for doc in quizzes_collection.find(query).sort("created_at", -1).limit(5):
            attempts = doc.get("attempts", [])
            last_score = attempts[-1].get("score", 0) if attempts else 0
            activities.append({
                "type": "quiz_completed",
                "description": f"Quiz on {doc.get('subject', 'General')} — Score: {last_score}",
                "timestamp": doc.get("created_at", ""),
            })

        # Recent plans
        async for doc in study_plans_collection.find(query).sort("created_at", -1).limit(3):
            activities.append({
                "type": "plan_created",
                "description": f"Study plan for {doc.get('subject_name', 'Unknown')}",
                "timestamp": doc.get("created_at", ""),
            })

        # Sort all by timestamp descending
        activities.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        return {"status": "success", "activities": activities[:15]}
    except Exception:
        return {"status": "offline", "activities": []}


# ── GET /api/dashboard/recommendations ───────────────────

@router.get("/recommendations")
async def get_recommendations(user: dict = Depends(get_current_user_optional)):
    """Get AI-powered study recommendations based on user data."""
    user_id = user["_id"] if user else "anonymous"

    try:
        # Gather context for AI
        subjects_data = []
        async for doc in subjects_collection.find({"user_id": user_id}):
            subjects_data.append({
                "name": doc.get("name"),
                "progress": doc.get("progress", 0),
                "deadline": doc.get("deadline"),
                "difficulty": doc.get("difficulty"),
            })

        if not subjects_data:
            return {
                "status": "success",
                "recommendations": "Start by adding subjects to get personalized recommendations!",
            }

        # Build context string
        context = "User's current subjects:\n"
        for s in subjects_data:
            context += f"- {s['name']}: {s['progress']}% complete, deadline: {s['deadline']}, difficulty: {s['difficulty']}\n"

        recommendations = generate_recommendations(context)
        return {"status": "success", "recommendations": recommendations}
    except Exception:
        return {
            "status": "offline",
            "recommendations": "Unable to generate recommendations right now. Please try again later.",
        }
