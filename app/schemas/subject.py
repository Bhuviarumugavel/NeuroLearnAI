"""Subject request/response schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List


# ── Requests ──────────────────────────────────────────────

class SubjectCreate(BaseModel):
    name: str
    priority: str = "Medium"
    level: str = "Intermediate"
    deadline: Optional[str] = None
    difficulty: str = "Moderate"
    color: str = "#4F46E5"
    description: str = ""
    daily_study_minutes: int = 45
    progress: int = 0


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    priority: Optional[str] = None
    level: Optional[str] = None
    deadline: Optional[str] = None
    difficulty: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    daily_study_minutes: Optional[int] = None
    progress: Optional[int] = None


class TopicCreate(BaseModel):
    name: str
    day: int = 1
    duration: int = 60


class TopicUpdate(BaseModel):
    completed: bool = True
