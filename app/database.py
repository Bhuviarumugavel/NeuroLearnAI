from motor.motor_asyncio import AsyncIOMotorClient
from .config import MONGODB_URL
import asyncio

# ── MongoDB Client ────────────────────────────────────────
# serverSelectionTimeoutMS=5000 prevents hanging if MongoDB is offline
client = AsyncIOMotorClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=10000,
)
db = client.study_planner_db

# ── Collections ───────────────────────────────────────────
users_collection = db.get_collection("users")
notes_collection = db.get_collection("notes")
subjects_collection = db.get_collection("subjects")
quizzes_collection = db.get_collection("quizzes")
study_plans_collection = db.get_collection("study_plans")
profiles_collection = db.get_collection("profiles")
reminders_collection = db.get_collection("reminders")


async def create_indexes():
    """Create MongoDB indexes for performance and uniqueness constraints.
    
    Times out after 6 seconds if MongoDB is unreachable — server will still
    start, just without optimal indexes.
    """
    try:
        # Quick ping first to confirm connection
        await asyncio.wait_for(
            client.admin.command("ping"),
            timeout=5.0
        )
    except (asyncio.TimeoutError, Exception) as e:
        raise RuntimeError(f"MongoDB ping failed: {e}")

    # Unique email index for users
    await users_collection.create_index("email", unique=True)
    # Text index on notes for full-text search
    await notes_collection.create_index([("original_text", "text"), ("summary", "text")])
    # User-based lookups
    await notes_collection.create_index("user_id")
    await subjects_collection.create_index("user_id")
    await quizzes_collection.create_index("user_id")
    await study_plans_collection.create_index("user_id")
    await reminders_collection.create_index("user_id")