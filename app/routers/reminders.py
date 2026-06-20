"""Reminders router — schedule and list study reminders."""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel
from app.database import reminders_collection
from app.worker import trigger_study_reminder
from app.middleware.auth import get_current_user_optional

router = APIRouter(prefix="/api/reminders", tags=["Reminders"])


class ReminderRequest(BaseModel):
    message: str
    remind_at: str = ""  # ISO datetime string (optional for immediate)


def serialize_doc(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ── POST /api/reminders/trigger ──────────────────────────

@router.post("/trigger")
async def schedule_reminder(
    request: ReminderRequest,
    bg_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user_optional),
):
    """Schedule a study reminder via Celery/Redis or local fallback."""
    user_id = user["_id"] if user else "anonymous"

    # Save to MongoDB
    reminder_doc = {
        "user_id": user_id,
        "message": request.message,
        "remind_at": request.remind_at or datetime.now(timezone.utc).isoformat(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = await reminders_collection.insert_one(reminder_doc)
        reminder_id = str(result.inserted_id)
    except Exception:
        reminder_id = "offline"

    # Attempt Celery task, fallback to local
    try:
        trigger_study_reminder.delay(user_id, request.message)
        method = "celery_redis"
    except Exception:
        bg_tasks.add_task(print, f"Local Reminder: {request.message}")
        method = "local_background_tasks"

    return {
        "status": "success",
        "reminder_id": reminder_id,
        "method": method,
    }


# ── GET /api/reminders/ ──────────────────────────────────

@router.get("/")
async def list_reminders(user: dict = Depends(get_current_user_optional)):
    """List all reminders for the current user."""
    user_id = user["_id"] if user else "anonymous"

    try:
        reminders = []
        async for doc in reminders_collection.find({"user_id": user_id}).sort("created_at", -1):
            reminders.append(serialize_doc(doc))
        return {"status": "success", "reminders": reminders}
    except Exception:
        return {"status": "offline", "reminders": []}


# ── DELETE /api/reminders/{reminder_id} ──────────────────

@router.delete("/{reminder_id}")
async def delete_reminder(reminder_id: str):
    """Delete a reminder."""
    try:
        result = await reminders_collection.delete_one({"_id": ObjectId(reminder_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception:
        return {"status": "offline_success"}
