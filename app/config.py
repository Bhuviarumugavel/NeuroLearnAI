import os
from dotenv import load_dotenv

# Load variables from the .env file
load_dotenv()

# ── Database ──────────────────────────────────────────────
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/study_planner_db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ── OpenRouter AI ─────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

# ── JWT Authentication ────────────────────────────────────
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "neurolearn-ai-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# ── UiPath Orchestrator ──────────────────────────────────
UIPATH_CLIENT_ID = os.getenv("UIPATH_CLIENT_ID", "")
UIPATH_CLIENT_SECRET = os.getenv("UIPATH_CLIENT_SECRET", "")
UIPATH_ORG_NAME = os.getenv("UIPATH_ORG_NAME", "")
UIPATH_TENANT_NAME = os.getenv("UIPATH_TENANT_NAME", "DefaultTenant")
UIPATH_FOLDER_ID = os.getenv("UIPATH_FOLDER_ID", "")
UIPATH_BASE_URL = os.getenv("UIPATH_BASE_URL", "https://cloud.uipath.com")