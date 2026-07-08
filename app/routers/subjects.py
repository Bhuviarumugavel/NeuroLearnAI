"""Subjects router — CRUD with topic management."""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from bson import ObjectId
import uuid
from app.database import subjects_collection
from app.models.subject import create_subject_document
from app.schemas.subject import SubjectCreate, SubjectUpdate, TopicCreate, TopicUpdate
from app.middleware.auth import get_current_user_optional

router = APIRouter(prefix="/api/subjects", tags=["Subjects"])


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB ObjectId to string."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ── POST /api/subjects ──────────────────────────────────

@router.post("/")
async def create_subject(
    subject: SubjectCreate,
    user: dict = Depends(get_current_user_optional),
):
    """Create a new subject."""
    user_id = user["_id"] if user else "anonymous"

    doc = create_subject_document(
        user_id=user_id,
        name=subject.name,
        priority=subject.priority,
        level=subject.level,
        deadline=subject.deadline,
        difficulty=subject.difficulty,
        color=subject.color,
        description=subject.description,
        daily_study_minutes=subject.daily_study_minutes,
        progress=subject.progress,
    )
    now = datetime.now(timezone.utc).isoformat()
    doc["created_at"] = now
    doc["updated_at"] = now

    try:
        result = await subjects_collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return {"status": "success", "subject": doc}
    except Exception:
        return {"status": "offline_success", "subject": doc}


# ── GET /api/subjects ────────────────────────────────────

@router.get("/")
async def list_subjects(user: dict = Depends(get_current_user_optional)):
    """Get all subjects for the current user."""
    user_id = user["_id"] if user else "anonymous"
    try:
        subjects = []
        async for doc in subjects_collection.find({"user_id": user_id}):
            subjects.append(serialize_doc(doc))
        return {"status": "success", "subjects": subjects}
    except Exception:
        return {"status": "offline", "subjects": []}


# ── GET /api/subjects/{subject_id} ───────────────────────

@router.get("/{subject_id}")
async def get_subject(subject_id: str):
    """Get a single subject by ID."""
    try:
        doc = await subjects_collection.find_one({"_id": ObjectId(subject_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Subject not found")
        return {"status": "success", "subject": serialize_doc(doc)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── PUT /api/subjects/{subject_id} ───────────────────────

@router.put("/{subject_id}")
async def update_subject(subject_id: str, subject: SubjectUpdate):
    """Update a subject."""
    update_data = {k: v for k, v in subject.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = await subjects_collection.update_one(
            {"_id": ObjectId(subject_id)},
            {"$set": update_data},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Subject not found")

        # If exam deadline was changed, trigger AI study plan topic rescheduling
        if "deadline" in update_data:
            subject_doc = await subjects_collection.find_one({"_id": ObjectId(subject_id)})
            if subject_doc:
                sub_name = subject_doc.get("name")
                user_id = subject_doc.get("user_id", "anonymous")
                from app.database import study_plans_collection
                plan = await study_plans_collection.find_one({"user_id": user_id, "subject_name": sub_name})
                if plan:
                    from app.ai_engine import generate_study_plan
                    new_topics = generate_study_plan(
                        description=subject_doc.get("description", ""),
                        subject_name=sub_name,
                        deadline=update_data["deadline"],
                        daily_minutes=subject_doc.get("daily_study_minutes", 45)
                    )
                    if new_topics:
                        await study_plans_collection.update_one(
                            {"_id": plan["_id"]},
                            {
                                "$set": {
                                    "topics": new_topics,
                                    "deadline": update_data["deadline"],
                                    "updated_at": datetime.now(timezone.utc).isoformat()
                                }
                            }
                        )

        return {"status": "success", "modified": result.modified_count}
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "offline_success", "error": str(e)}


# ── DELETE /api/subjects/{subject_id} ────────────────────

@router.delete("/{subject_id}")
async def delete_subject(subject_id: str):
    """Delete a subject and all associated study plans, notes, and quizzes."""
    try:
        subject_doc = await subjects_collection.find_one({"_id": ObjectId(subject_id)})
        if not subject_doc:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        subject_name = subject_doc.get("name")
        user_id = subject_doc.get("user_id", "anonymous")

        # Delete the subject document
        result = await subjects_collection.delete_one({"_id": ObjectId(subject_id)})
        
        # Cascade delete study plans, notes, and quizzes matching this user and subject name
        from app.database import study_plans_collection, notes_collection, quizzes_collection
        
        if subject_name:
            await study_plans_collection.delete_many({"user_id": user_id, "subject_name": subject_name})
            await notes_collection.delete_many({"user_id": user_id, "subject": subject_name})
            await quizzes_collection.delete_many({"user_id": user_id, "subject": subject_name})

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "offline_success", "error": str(e)}


# ── POST /api/subjects/{subject_id}/topics ───────────────

@router.post("/{subject_id}/topics")
async def add_topic(subject_id: str, topic: TopicCreate):
    """Add a topic to a subject."""
    topic_doc = {
        "id": str(uuid.uuid4()),
        "name": topic.name,
        "day": topic.day,
        "duration": topic.duration,
        "completed": False,
    }

    try:
        result = await subjects_collection.update_one(
            {"_id": ObjectId(subject_id)},
            {"$push": {"topics": topic_doc}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Subject not found")
        return {"status": "success", "topic": topic_doc}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── PUT /api/subjects/{subject_id}/topics/{topic_id} ────

@router.put("/{subject_id}/topics/{topic_id}")
async def update_topic(subject_id: str, topic_id: str, update: TopicUpdate):
    """Mark a topic as complete/incomplete."""
    try:
        result = await subjects_collection.update_one(
            {"_id": ObjectId(subject_id), "topics.id": topic_id},
            {"$set": {"topics.$.completed": update.completed}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Subject or topic not found")

        # Recalculate progress
        doc = await subjects_collection.find_one({"_id": ObjectId(subject_id)})
        topics = doc.get("topics", [])
        if topics:
            completed = sum(1 for t in topics if t.get("completed"))
            progress = int((completed / len(topics)) * 100)
            await subjects_collection.update_one(
                {"_id": ObjectId(subject_id)},
                {"$set": {"progress": progress}},
            )

        return {"status": "success", "completed": update.completed}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── DELETE /api/subjects/{subject_id}/topics/{topic_id} ─

@router.delete("/{subject_id}/topics/{topic_id}")
async def delete_topic(subject_id: str, topic_id: str):
    """Remove a topic from a subject."""
    try:
        result = await subjects_collection.update_one(
            {"_id": ObjectId(subject_id)},
            {"$pull": {"topics": {"id": topic_id}}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Subject not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── POST /api/subjects/{subject_id}/track-time ──────────

@router.post("/{subject_id}/track-time")
async def track_study_time(subject_id: str, payload: dict):
    """Increment total study time for a subject."""
    seconds = payload.get("seconds", 0)
    try:
        result = await subjects_collection.update_one(
            {"_id": ObjectId(subject_id)},
            {"$inc": {"study_time_seconds": seconds}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Subject not found")
        return {"status": "success", "incremented": seconds}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
