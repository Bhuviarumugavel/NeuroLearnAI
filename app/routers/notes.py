"""Notes router — full CRUD with AI summarization."""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from bson import ObjectId
from app.database import notes_collection
from app.models.note import create_note_document
from app.schemas.note import NoteCreate, NoteUpdate, AutoNotesRequest
from app.ai_engine import summarize_notes, generate_automatic_notes
from app.middleware.auth import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/notes", tags=["Notes"])


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB ObjectId to string."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ── POST /api/notes/ ─────────────────────────────────────

@router.post("/")
async def create_note(
    request: NoteCreate,
    user: dict = Depends(get_current_user_optional),
):
    """Add a note with AI-powered summarization."""
    user_id = user["_id"] if user else "anonymous"

    # AI summarization
    summary = summarize_notes(request.text)

    # Build document
    note_doc = create_note_document(
        user_id=user_id,
        subject_tag=request.subject_tag,
        original_text=request.text,
        summary=summary,
        note_type="manual",
    )
    now = datetime.now(timezone.utc).isoformat()
    note_doc["created_at"] = now
    note_doc["updated_at"] = now

    try:
        result = await notes_collection.insert_one(note_doc)
        return {
            "status": "success",
            "note_id": str(result.inserted_id),
            "summary": summary,
        }
    except Exception as e:
        return {"status": "offline_success", "summary": summary, "error": str(e)}


# ── GET /api/notes/ ──────────────────────────────────────

@router.get("/")
async def list_notes(
    user: dict = Depends(get_current_user_optional),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject: str = Query(None, description="Filter by subject tag"),
    search: str = Query(None, description="Full-text search"),
):
    """List notes with pagination and filtering."""
    user_id = user["_id"] if user else "anonymous"
    query = {"user_id": user_id}

    if subject:
        query["subject"] = subject
    if search:
        query["$text"] = {"$search": search}

    try:
        total = await notes_collection.count_documents(query)
        skip = (page - 1) * page_size
        cursor = notes_collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)

        notes = []
        async for doc in cursor:
            notes.append(serialize_doc(doc))

        return {
            "status": "success",
            "notes": notes,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception:
        return {"status": "offline", "notes": [], "total": 0, "page": page, "page_size": page_size}


# ── GET /api/notes/{note_id} ─────────────────────────────

@router.get("/{note_id}")
async def get_note(note_id: str):
    """Get a single note by ID."""
    try:
        doc = await notes_collection.find_one({"_id": ObjectId(note_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"status": "success", "note": serialize_doc(doc)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── PUT /api/notes/{note_id} ─────────────────────────────

@router.put("/{note_id}")
async def update_note(note_id: str, updates: NoteUpdate):
    """Update a note. Re-summarizes if text is changed."""
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Re-summarize if text changed
    if "text" in update_data:
        update_data["original_text"] = update_data.pop("text")
        update_data["summary"] = summarize_notes(update_data["original_text"])

    if "subject_tag" in update_data:
        update_data["subject"] = update_data.pop("subject_tag")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = await notes_collection.update_one(
            {"_id": ObjectId(note_id)},
            {"$set": update_data},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"status": "success", "modified": result.modified_count}
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "offline_success"}


# ── DELETE /api/notes/{note_id} ──────────────────────────

@router.delete("/{note_id}")
async def delete_note(note_id: str):
    """Delete a note."""
    try:
        result = await notes_collection.delete_one({"_id": ObjectId(note_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "offline_success"}


# ── POST /api/notes/generate-auto ────────────────────────

@router.post("/generate-auto")
async def auto_generate_notes(
    request: AutoNotesRequest,
    user: dict = Depends(get_current_user_optional),
):
    """Generate comprehensive study notes from a description using AI."""
    if not request.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")

    user_id = user["_id"] if user else "anonymous"
    notes = generate_automatic_notes(request.description)

    # Persist to MongoDB
    try:
        note_doc = create_note_document(
            user_id=user_id,
            subject_tag=request.subject_name or "General",
            original_text="",
            summary="",
            note_type="auto_generated",
            subject_name=request.subject_name,
            description=request.description,
            generated_notes=notes,
        )
        note_doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await notes_collection.insert_one(note_doc)
    except Exception:
        pass  # Graceful degradation

    return {"status": "success", "notes": notes}
