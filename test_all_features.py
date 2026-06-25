import httpx
import sys

BASE_URL = "http://localhost:8000"
TIMEOUT = 25.0

def log_test(name, success, message=""):
    status = "[PASS]" if success else "[FAIL]"
    msg = f": {message}" if message else ""
    print(f"{status} {name}{msg}")
    sys.stdout.flush()

def test_api():
    print("=" * 60)
    sys.stdout.flush()
    # 1. Health check
    try:
        r = httpx.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        if r.status_code == 200:
            log_test("Backend Health Check", True, f"MongoDB: {r.json().get('database')}")
        else:
            log_test("Backend Health Check", False, f"HTTP Status {r.status_code}")
            return
    except Exception as e:
        log_test("Backend Health Check", False, f"Could not reach backend: {e}")
        return

    # 2. Auth tests
    email = "testuser_smoke@example.com"
    password = "password123"
    
    token = None
    try:
        r = httpx.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=TIMEOUT)
        if r.status_code == 200:
            token = r.json().get("access_token")
            log_test("Auth - Login existing user", True)
        else:
            r = httpx.post(f"{BASE_URL}/api/auth/register", json={
                "email": email,
                "password": password,
                "full_name": "Smoke Test User"
            }, timeout=TIMEOUT)
            if r.status_code == 200:
                token = r.json().get("access_token")
                log_test("Auth - Register new user", True)
            else:
                log_test("Auth - Register new user", False, f"Status {r.status_code}: {r.text}")
                return
    except Exception as e:
        log_test("Auth - Login/Register", False, f"Exception: {e}")
        return

    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get profile
    try:
        r = httpx.get(f"{BASE_URL}/api/auth/me", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200:
            log_test("Auth - Get profile (/me)", True, f"User email: {r.json().get('user', {}).get('email')}")
        else:
            log_test("Auth - Get profile (/me)", False, f"Status {r.status_code}")
    except Exception as e:
        log_test("Auth - Get profile (/me)", False, str(e))

    # 4. Subjects
    subject_name = "Neuroscience Smoke Test"
    try:
        r = httpx.post(f"{BASE_URL}/api/subjects/", headers=headers, json={
            "name": subject_name,
            "description": "Study of the nervous system and brain"
        }, timeout=TIMEOUT)
        if r.status_code in [200, 201]:
            log_test("Subjects - Create subject", True)
        else:
            log_test("Subjects - Create subject", False, f"Status {r.status_code}: {r.text}")
            
        r = httpx.get(f"{BASE_URL}/api/subjects/", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200:
            subjects = r.json().get("subjects", [])
            log_test("Subjects - List subjects", True, f"Found {len(subjects)} subjects")
        else:
            log_test("Subjects - List subjects", False, f"Status {r.status_code}")
    except Exception as e:
        log_test("Subjects test failed", False, str(e))

    # 5. Notes
    try:
        r = httpx.post(f"{BASE_URL}/api/notes/", headers=headers, json={
            "text": "A synapse is a structure that permits a neuron to pass an electrical or chemical signal to another neuron.",
            "subject_tag": subject_name
        }, timeout=TIMEOUT)
        if r.status_code == 200:
            note_id = r.json().get("note_id")
            log_test("Notes - Create note", True, f"Created Note ID: {note_id}")
        else:
            log_test("Notes - Create note", False, f"Status {r.status_code}: {r.text}")
            
        r = httpx.get(f"{BASE_URL}/api/notes/", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200:
            notes = r.json().get("notes", [])
            log_test("Notes - List notes", True, f"Found {len(notes)} notes")
        else:
            log_test("Notes - List notes", False, f"Status {r.status_code}")
    except Exception as e:
        log_test("Notes test failed", False, str(e))

    # 6. Quiz
    quiz_id = None
    try:
        r = httpx.post(f"{BASE_URL}/api/quiz/generate", headers=headers, json={
            "text": "The human brain has about 86 billion neurons. Neurons communicate via synapses.",
            "num_questions": 3,
            "subject": subject_name
        }, timeout=TIMEOUT)
        if r.status_code == 200:
            quiz_id = r.json().get("quiz_id")
            questions = r.json().get("questions", [])
            log_test("Quiz - Generate quiz (AI or fallback)", True, f"Quiz ID: {quiz_id}, {len(questions)} questions")
        else:
            log_test("Quiz - Generate quiz", False, f"Status {r.status_code}: {r.text}")
            
        if quiz_id:
            r = httpx.post(f"{BASE_URL}/api/quiz/submit", headers=headers, json={
                "quiz_id": quiz_id,
                "answers": ["A", "B", "C"]
            }, timeout=TIMEOUT)
            if r.status_code == 200:
                log_test("Quiz - Submit quiz answers", True, f"Score: {r.json().get('score')}/{r.json().get('total')}")
            else:
                log_test("Quiz - Submit quiz answers", False, f"Status {r.status_code}: {r.text}")
    except Exception as e:
        log_test("Quiz test failed", False, str(e))

    # 7. Study Plans
    try:
        r = httpx.post(f"{BASE_URL}/api/study-plans/generate", headers=headers, json={
            "subject_name": subject_name,
            "description": "Learn basic neural structures and pathways",
            "deadline": "2026-07-01T00:00:00Z",
            "daily_minutes": 30
        }, timeout=TIMEOUT)
        if r.status_code == 200:
            log_test("Study Plans - Generate study plan (AI or fallback)", True)
        else:
            log_test("Study Plans - Generate study plan", False, f"Status {r.status_code}: {r.text}")
            
        r = httpx.get(f"{BASE_URL}/api/study-plans/", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200:
            plans = r.json().get("plans", [])
            log_test("Study Plans - List study plans", True, f"Found {len(plans)} plans")
        else:
            log_test("Study Plans - List study plans", False, f"Status {r.status_code}")
    except Exception as e:
        log_test("Study Plans test failed", False, str(e))

    # 8. Reminders
    try:
        r = httpx.post(f"{BASE_URL}/api/reminders/trigger", headers=headers, json={
            "message": "Time to study Neuroscience synapses!",
            "remind_at": "2026-06-24T10:00:00Z"
        }, timeout=TIMEOUT)
        if r.status_code == 200:
            log_test("Reminders - Schedule reminder (Celery/Local fallback)", True, f"Method: {r.json().get('method')}")
        else:
            log_test("Reminders - Schedule reminder", False, f"Status {r.status_code}: {r.text}")
            
        r = httpx.get(f"{BASE_URL}/api/reminders/", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200:
            reminders = r.json().get("reminders", [])
            log_test("Reminders - List reminders", True, f"Found {len(reminders)} reminders")
        else:
            log_test("Reminders - List reminders", False, f"Status {r.status_code}")
    except Exception as e:
        log_test("Reminders test failed", False, str(e))

    # 9. Dashboard
    try:
        r = httpx.get(f"{BASE_URL}/api/dashboard/summary", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200:
            log_test("Dashboard - Get summary status", True)
        else:
            log_test("Dashboard - Get summary status", False, f"Status {r.status_code}")
    except Exception as e:
        log_test("Dashboard test failed", False, str(e))

    # 10. UiPath status
    try:
        r = httpx.get(f"{BASE_URL}/api/uipath/health", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200:
            log_test("UiPath - Check Orchestrator Connection", True, f"Status: {r.json().get('orchestrator_connection')}")
        else:
            log_test("UiPath - Check Orchestrator Connection", False, f"Status {r.status_code}: {r.text}")
    except Exception as e:
        log_test("UiPath status check failed", False, str(e))
        
    print("=" * 60)
    sys.stdout.flush()

if __name__ == "__main__":
    test_api()
