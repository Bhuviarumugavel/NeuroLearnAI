"""Authentication router — register, login, profile management."""
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from bson import ObjectId
import asyncio
from app.database import users_collection
from app.models.user import create_user_document
from app.schemas.auth import RegisterRequest, LoginRequest, ProfileUpdate, TokenResponse
from app.services.auth_service import hash_password, verify_password, create_access_token
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

DB_TIMEOUT = 8  # seconds before giving up on MongoDB


async def _db_find_one(collection, query):
    """Wrapper: find_one with timeout — raises 503 if MongoDB unreachable."""
    try:
        return await asyncio.wait_for(collection.find_one(query), timeout=DB_TIMEOUT)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unreachable. Please ensure MongoDB is running.",
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")


async def _db_insert_one(collection, document):
    """Wrapper: insert_one with timeout — raises 503 if MongoDB unreachable."""
    try:
        return await asyncio.wait_for(collection.insert_one(document), timeout=DB_TIMEOUT)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unreachable. Please ensure MongoDB is running.",
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")


async def _db_update_one(collection, query, update):
    """Wrapper: update_one with timeout — raises 503 if MongoDB unreachable."""
    try:
        return await asyncio.wait_for(collection.update_one(query, update), timeout=DB_TIMEOUT)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unreachable. Please ensure MongoDB is running.",
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")


def serialize_user(user: dict) -> dict:
    """Serialize user document for API response (strip password)."""
    return {
        "id": str(user["_id"]) if isinstance(user["_id"], ObjectId) else user["_id"],
        "email": user["email"],
        "full_name": user.get("full_name", ""),
        "avatar_url": user.get("avatar_url", ""),
        "study_preferences": user.get("study_preferences", {}),
        "streak_days": user.get("streak_days", 0),
        "total_study_minutes": user.get("total_study_minutes", 0),
        "created_at": user.get("created_at"),
    }


# ── POST /api/auth/register ──────────────────────────────

@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    """Register a new user account."""
    # Check if email already exists
    existing = await users_collection.find_one({"email": request.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Create user document
    user_doc = create_user_document(
        email=request.email.lower(),
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
    )
    now = datetime.now(timezone.utc).isoformat()
    user_doc["created_at"] = now
    user_doc["updated_at"] = now

    result = await users_collection.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    # Generate JWT token
    token = create_access_token(data={"sub": str(result.inserted_id)})

    return TokenResponse(
        access_token=token,
        user=serialize_user(user_doc),
    )


# ── POST /api/auth/login ─────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate and return a JWT token."""
    user = await users_collection.find_one({"email": request.email.lower()})
    if not user or not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(data={"sub": str(user["_id"])})

    return TokenResponse(
        access_token=token,
        user=serialize_user(user),
    )


# ── GET /api/auth/me ──────────────────────────────────────

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return {"status": "success", "user": serialize_user(user)}


# ── PUT /api/auth/profile ────────────────────────────────

@router.put("/profile")
async def update_profile(
    updates: ProfileUpdate,
    user: dict = Depends(get_current_user),
):
    """Update the authenticated user's profile."""
    update_data = {}

    if updates.full_name is not None:
        update_data["full_name"] = updates.full_name
    if updates.avatar_url is not None:
        update_data["avatar_url"] = updates.avatar_url
    if updates.daily_goal_minutes is not None:
        update_data["study_preferences.daily_goal_minutes"] = updates.daily_goal_minutes
    if updates.preferred_subjects is not None:
        update_data["study_preferences.preferred_subjects"] = updates.preferred_subjects
    if updates.notification_enabled is not None:
        update_data["study_preferences.notification_enabled"] = updates.notification_enabled

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await users_collection.update_one(
        {"_id": ObjectId(user["_id"])},
        {"$set": update_data},
    )

    # Fetch and return updated user
    updated = await users_collection.find_one({"_id": ObjectId(user["_id"])})
    return {"status": "success", "user": serialize_user(updated)}
