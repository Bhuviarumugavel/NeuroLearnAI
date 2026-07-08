"""
NeurolearnAI — FastAPI Backend
================================
Production-grade study planner API with:
- JWT Authentication
- MongoDB (Motor async)
- OpenRouter AI Engine
- Celery + Redis task queue
- Modular router architecture
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_indexes

# ── Import Routers ────────────────────────────────────────
from app.routers import auth, notes, subjects, quiz, study_plans, dashboard, reminders, uipath

import asyncio
from datetime import datetime, timezone
from app.database import reminders_collection, users_collection
from app.utils.email import send_email_notification
from bson import ObjectId

async def check_due_reminders_loop():
    """Background loop to check for due study reminders and trigger email notifications."""
    print("[STARTUP] Starting background reminders check loop...")
    await asyncio.sleep(5.0) # wait a few seconds before loop starts
    while True:
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            # Find all pending reminders where remind_at is <= now
            cursor = reminders_collection.find({
                "status": "pending",
                "remind_at": {"$lte": now_iso}
            })
            async for reminder in cursor:
                reminder_id = reminder["_id"]
                user_id = reminder.get("user_id", "")
                message = reminder.get("message", "")
                
                # Fetch user's email
                user_email = ""
                if user_id and user_id != "anonymous":
                    try:
                        user_doc = await users_collection.find_one({"_id": ObjectId(user_id)})
                        if user_doc:
                            user_email = user_doc.get("email", "")
                    except Exception:
                        pass
                
                if not user_email:
                    from app.config import DEFAULT_EMAIL
                    user_email = DEFAULT_EMAIL or "bhuvaneshwari23ad006@gmail.com"
                
                # Dispatch Email
                subject = "📚 Study Alert from NeurolearnAI!"
                body = (
                    f"Hello Student,<br/><br/>"
                    f"This is a study reminder for your subject:<br/>"
                    f"<h3>{message}</h3><br/>"
                    f"Time to focus and study hard!<br/><br/>"
                    f"Best regards,<br/>"
                    f"NeurolearnAI Assistant"
                )
                
                # Send email in a separate thread so it doesn't block the FastAPI event loop
                await asyncio.to_thread(send_email_notification, user_email, subject, body)
                
                # Update reminder status to fired
                await reminders_collection.update_one(
                    {"_id": reminder_id},
                    {"$set": {"status": "fired", "fired_at": now_iso}}
                )
        except Exception as e:
            print(f"[REMINDER-LOOP-ERROR] {e}")
        
        await asyncio.sleep(8.0) # Check every 8 seconds


# ── Lifespan: startup / shutdown ──────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler — runs on startup and shutdown."""
    # ── Startup ──
    print("[STARTUP] NeurolearnAI API starting up...")
    loop_task = None
    try:
        await create_indexes()
        print("[OK] MongoDB indexes created")
        loop_task = asyncio.create_task(check_due_reminders_loop())
    except Exception as e:
        print(f"[WARN] MongoDB index creation skipped (DB may be offline): {e}")
        loop_task = asyncio.create_task(check_due_reminders_loop())

    yield  # App runs here

    # ── Shutdown ──
    print("[SHUTDOWN] NeurolearnAI API shutting down...")
    if loop_task:
        loop_task.cancel()


# ── Create FastAPI App ────────────────────────────────────

app = FastAPI(
    title="NeurolearnAI API",
    description="AI-powered study planner with notes, quizzes, study plans, and analytics",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS Middleware ───────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "https://neuro-learn-ai-ivory.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ─────────────────────────────────────
app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(subjects.router)
app.include_router(quiz.router)
app.include_router(study_plans.router)
app.include_router(dashboard.router)
app.include_router(reminders.router)
app.include_router(uipath.router)


# ── Health Check ──────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "online",
        "app": "NeurolearnAI API",
        "version": "2.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring."""
    from app.database import client as mongo_client

    # Check MongoDB connection
    try:
        await mongo_client.admin.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "status": "healthy",
        "database": db_status,
        "version": "2.0.0",
    }