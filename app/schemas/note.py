"""Note request/response schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List


# ── Requests ──────────────────────────────────────────────

class NoteCreate(BaseModel):
    text: str = Field(..., description="Raw note text content")
    subject_tag: str = Field(..., description="Subject tag for the note")
    summary_type: Optional[str] = "general"
    description: Optional[str] = ""


class NoteUpdate(BaseModel):
    text: Optional[str] = None
    subject_tag: Optional[str] = None
    is_favorite: Optional[bool] = None
    tags: Optional[List[str]] = None


class AutoNotesRequest(BaseModel):
    description: str = Field(..., description="Subject description for AI note generation")
    subject_name: Optional[str] = ""


# ── Responses ─────────────────────────────────────────────

class NoteResponse(BaseModel):
    id: str
    user_id: str
    subject: str
    original_text: str
    summary: str
    type: str
    is_favorite: bool = False
    tags: List[str] = []
    created_at: Optional[str] = None


class NotesListResponse(BaseModel):
    status: str
    notes: List[dict]
    total: int
    page: int
    page_size: int
