"""Authentication request/response schemas."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List


# ── Requests ──────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    full_name: str = Field(default="", description="Full display name")


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    daily_goal_minutes: Optional[int] = None
    preferred_subjects: Optional[List[str]] = None
    notification_enabled: Optional[bool] = None


# ── Responses ─────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: str
    study_preferences: dict
    streak_days: int
    total_study_minutes: int
    created_at: Optional[str] = None
