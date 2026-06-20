"""Dashboard response schemas."""
from pydantic import BaseModel
from typing import List, Optional


class SubjectSummary(BaseModel):
    id: str
    name: str
    color: str
    progress: int
    total_topics: int
    completed_topics: int
    deadline: Optional[str] = None
    daily_minutes: int


class ActivityItem(BaseModel):
    type: str  # "note_added", "quiz_completed", "plan_created", etc.
    description: str
    timestamp: str


class DashboardSummaryResponse(BaseModel):
    status: str
    total_subjects: int
    total_notes: int
    total_quizzes: int
    active_plans: int
    overall_progress: float
    subjects: List[dict]
    streak_days: int
    total_study_minutes: int
