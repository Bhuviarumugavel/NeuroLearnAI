import asyncio
import httpx
import redis
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load variables from the .env file
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/study_planner_db")
if MONGODB_URL:
    MONGODB_URL = MONGODB_URL.replace("<", "").replace(">", "")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
UIPATH_CLIENT_ID = os.getenv("UIPATH_CLIENT_ID", "")
UIPATH_CLIENT_SECRET = os.getenv("UIPATH_CLIENT_SECRET", "")
UIPATH_ORG_NAME = os.getenv("UIPATH_ORG_NAME", "")
UIPATH_TENANT_NAME = os.getenv("UIPATH_TENANT_NAME", "DefaultTenant")
UIPATH_FOLDER_ID = os.getenv("UIPATH_FOLDER_ID", "")
UIPATH_BASE_URL = os.getenv("UIPATH_BASE_URL", "https://cloud.uipath.com")

async def check_mongodb():
    print("Checking MongoDB connection...")
    try:
        client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=2000)
        # Ping the admin database
        await client.admin.command('ping')
        print("[OK] MongoDB is running and connected successfully!")
        return True, "Connected"
    except Exception as e:
        print(f"[FAIL] MongoDB connection failed: {e}")
        return False, str(e)

def check_redis():
    print("Checking Redis connection...")
    try:
        r = redis.Redis.from_url(REDIS_URL, socket_timeout=2)
        r.ping()
        print("[OK] Redis is running and connected successfully!")
        return True, "Connected"
    except Exception as e:
        print(f"[FAIL] Redis connection failed: {e}")
        return False, str(e)

async def check_uipath():
    print("Checking UiPath Orchestrator credentials & connection...")
    if not UIPATH_CLIENT_ID or not UIPATH_CLIENT_SECRET:
        print("[FAIL] UiPath credentials not configured in .env")
        return False, "Missing credentials in .env"
    
    TOKEN_URL = "https://cloud.uipath.com/identity_/connect/token"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": UIPATH_CLIENT_ID,
                    "client_secret": UIPATH_CLIENT_SECRET,
                    "scope": (
                        "OR.Jobs OR.Jobs.Read OR.Jobs.Write "
                        "OR.Execution OR.Execution.Read OR.Execution.Write "
                        "OR.Folders OR.Folders.Read "
                        "OR.Robots OR.Robots.Read"
                    ),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if response.status_code == 200:
                print("[OK] UiPath token fetched successfully! Connection works.")
                return True, "Connected (Token generated successfully)"
            else:
                print(f"[FAIL] UiPath Orchestrator returned status {response.status_code}: {response.text}")
                return False, f"HTTP {response.status_code}: {response.text}"
    except Exception as e:
        print(f"[FAIL] UiPath Orchestrator connection failed: {e}")
        return False, str(e)

async def check_web_service(url, name):
    print(f"Checking if {name} service is running at {url}...")
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(url)
            print(f"[OK] {name} is running! Status code: {response.status_code}")
            return True, f"Running (Status {response.status_code})"
    except Exception as e:
        print(f"[FAIL] {name} is offline/unreachable: {e}")
        return False, f"Offline/Unreachable ({type(e).__name__})"

async def main():
    print("="*60)
    print("NEUROLEARN AI SYSTEM CHECK")
    print("="*60)
    
    mongo_ok, mongo_msg = await check_mongodb()
    redis_ok, redis_msg = check_redis()
    uipath_ok, uipath_msg = await check_uipath()
    frontend_ok, frontend_msg = await check_web_service("http://localhost:5173", "Frontend (Vite)")
    backend_ok, backend_msg = await check_web_service("http://localhost:8000/health", "Backend (FastAPI)")
    
    print("\n" + "="*60)
    print("DIAGNOSTICS SUMMARY CHECKLIST")
    print("="*60)
    print(f"[{'X' if frontend_ok else ' '}] Frontend (Vite on :5173): {frontend_msg}")
    print(f"[{'X' if backend_ok else ' '}] Backend (FastAPI on :8000): {backend_msg}")
    print(f"[{'X' if mongo_ok else ' '}] MongoDB Storage (on :27017): {mongo_msg}")
    print(f"[{'X' if redis_ok else ' '}] Redis Cache/Queue (on :6379): {redis_msg}")
    print(f"[{'X' if uipath_ok else ' '}] UiPath Automation: {uipath_msg}")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
