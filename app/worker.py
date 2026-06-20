"""
Celery worker — background task processing via Redis.

Tasks:
- trigger_study_reminder: Send push notification / reminder
- process_bulk_notes: Summarize multiple notes in batch
- generate_daily_digest: Generate a daily study summary
"""
from celery import Celery
from app.config import REDIS_URL

# Initialize Celery with your Redis connection
celery_app = Celery(
    "neurolearn_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
)


@celery_app.task(name="trigger_study_reminder")
def trigger_study_reminder(user_id: str, message: str):
    """Send a study reminder notification."""
    print(f"[REMINDER] Reminder sent to {user_id}: {message}")
    return {"status": "Reminder triggered", "user_id": user_id}


@celery_app.task(name="process_bulk_notes")
def process_bulk_notes(user_id: str, notes: list):
    """Process and summarize multiple notes in the background."""
    from app.ai_engine import summarize_notes

    results = []
    for note_text in notes:
        summary = summarize_notes(note_text)
        results.append({"text": note_text[:100], "summary": summary})

    print(f"[NOTES] Processed {len(results)} notes for user {user_id}")
    return {"status": "completed", "processed": len(results), "results": results}


@celery_app.task(name="generate_daily_digest")
def generate_daily_digest(user_id: str, subjects_context: str):
    """Generate a daily study digest/summary using AI."""
    from app.ai_engine import generate_recommendations

    digest = generate_recommendations(subjects_context)
    print(f"[DIGEST] Daily digest generated for user {user_id}")
    return {"status": "completed", "digest": digest}