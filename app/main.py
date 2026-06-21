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


# ── Lifespan: startup / shutdown ──────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler — runs on startup and shutdown."""
    # ── Startup ──
    print("[STARTUP] NeurolearnAI API starting up...")
    try:
        await create_indexes()
        print("[OK] MongoDB indexes created")
    except Exception as e:
        print(f"[WARN] MongoDB index creation skipped (DB may be offline): {e}")

    yield  # App runs here

    # ── Shutdown ──
    print("[SHUTDOWN] NeurolearnAI API shutting down...")


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