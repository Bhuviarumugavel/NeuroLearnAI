"""Quiz request/response schemas."""
from pydantic import BaseModel, Field
from typing import Optional, List


# ── Requests ──────────────────────────────────────────────

class QuizGenerateRequest(BaseModel):
    text: str = Field(..., description="Source text to generate quiz from")
    subject: str = Field(default="General", description="Subject tag")
    num_questions: int = Field(default=5, ge=1, le=20, description="Number of questions")
    topic: Optional[str] = ""


class QuizSubmitRequest(BaseModel):
    quiz_id: str
    answers: List[str] = Field(..., description="List of selected answers")


# ── Responses ─────────────────────────────────────────────

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    answer: str


class QuizResponse(BaseModel):
    status: str
    quiz_id: str
    questions: list


class QuizResultResponse(BaseModel):
    status: str
    score: int
    total: int
    percentage: float
    results: list  # Per-question breakdown
