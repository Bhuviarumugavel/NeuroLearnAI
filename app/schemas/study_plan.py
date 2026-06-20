"""Study plan request/response schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List


# ── Requests ──────────────────────────────────────────────

class StudyPlanGenerate(BaseModel):
    description: str = Field(..., description="Subject/topic description")
    subject_name: str
    deadline: str
    daily_minutes: int = 45


class StudyPlanProgressUpdate(BaseModel):
    topic_index: int = Field(..., description="Index of the topic to mark as complete")
    completed: bool = True


# ── Responses ─────────────────────────────────────────────

class StudyPlanResponse(BaseModel):
    status: str
    plan_id: str
    subject_name: str
    topics: list
    overall_progress: int
    deadline: str
