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


import re
from datetime import timedelta

def get_user_preferred_notification_hour(availability: str) -> int:
    """Parse user's preferred study availability slot and determine target hour.
    If slot contains range like '5-9', set to 5 (or 17:00 PM for standard Evening fallback).
    """
    if not availability:
        return 17  # Default to 5 PM fallback
    
    # Try finding patterns like "5-9" or "6-12"
    match = re.search(r'(\d+)\s*-\s*(\d+)', availability)
    if match:
        first_num = int(match.group(1))
        if first_num <= 12:
            # Evening or PM availability mapping
            if "pm" in availability.lower() or "evening" in availability.lower() or first_num in [5, 6, 7, 8, 9]:
                return first_num + 12
            return first_num
        return first_num

    avail_lower = availability.lower()
    if "morning" in avail_lower:
        return 6
    elif "afternoon" in avail_lower:
        return 12
    elif "evening" in avail_lower:
        return 17  # 5 PM
    elif "night" in avail_lower:
        return 22  # 10 PM
    elif "weekend" in avail_lower:
        return 9
    return 17  # Fallback to 5 PM

# ── POST /api/reminders/trigger ──────────────────────────

@router.post("/trigger")
async def schedule_reminder(
    request: ReminderRequest,
    bg_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user_optional),
):
    """Schedule a study reminder via Celery/Redis or local fallback, matching user preference time."""
    user_id = user["_id"] if user else "anonymous"

    # Fetch user availability routine
    availability = "Evening"
    if user and "study_preferences" in user:
        availability = user["study_preferences"].get("availability", "Evening")

    target_hour = get_user_preferred_notification_hour(availability)

    # Calculate target reminder time
    remind_time = None
    if request.remind_at:
        try:
            # Parse requested date
            remind_time = datetime.fromisoformat(request.remind_at.replace('Z', '+00:00'))
        except Exception:
            pass

    if not remind_time:
        remind_time = datetime.now(timezone.utc).replace(hour=target_hour, minute=0, second=0, microsecond=0)
        # Shift to tomorrow if scheduled target hour has already elapsed today
        if remind_time < datetime.now(timezone.utc):
            remind_time += timedelta(days=1)

    reminder_doc = {
        "user_id": user_id,
        "message": request.message,
        "remind_at": remind_time.isoformat(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        result = await reminders_collection.insert_one(reminder_doc)
        reminder_id = str(result.inserted_id)
    except Exception:
        reminder_id = "offline"

    # Attempt Celery task, fallback to local background tasks
    try:
        import redis
        from app.config import REDIS_URL
        r_client = redis.Redis.from_url(REDIS_URL, socket_timeout=1.0, socket_connect_timeout=1.0)
        r_client.ping()

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
