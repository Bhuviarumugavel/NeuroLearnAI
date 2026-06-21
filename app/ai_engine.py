"""
AI Engine — OpenRouter-powered AI functions for NeurolearnAI.

All functions use OpenRouter's API (via the openai client) with
google/gemini-3.5-flash model. Each function includes a mock
fallback for offline resilience.
"""
from openai import OpenAI
from app.config import OPENAI_API_KEY, OPENROUTER_BASE_URL
import json

# Initialize the client with OpenRouter's URL and your key
client = OpenAI(
    base_url=OPENROUTER_BASE_URL,
    api_key=OPENAI_API_KEY,
)

MODEL = "google/gemini-2.5-flash"


def _parse_json_response(content: str):
    """Robustly parse JSON from AI response, handling markdown code blocks."""
    # Direct parse
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Try extracting from ```json ... ``` blocks
    if "```json" in content:
        try:
            json_str = content.split("```json")[1].split("```")[0].strip()
            return json.loads(json_str)
        except (json.JSONDecodeError, IndexError):
            pass

    # Try extracting from generic ``` ... ``` blocks
    if "```" in content:
        try:
            json_str = content.split("```")[1].split("```")[0].strip()
            return json.loads(json_str)
        except (json.JSONDecodeError, IndexError):
            pass

    # Try finding JSON array or object in content
    for start_char, end_char in [("[", "]"), ("{", "}")]:
        start_idx = content.find(start_char)
        end_idx = content.rfind(end_char)
        if start_idx != -1 and end_idx > start_idx:
            try:
                return json.loads(content[start_idx:end_idx + 1])
            except json.JSONDecodeError:
                pass

    return None


# ─────────────────────────────────────────────────────────
# 1. Note Summarization
# ─────────────────────────────────────────────────────────

def summarize_notes(raw_text: str) -> str:
    """Raw text -> Bullets / Flashcards / Study Guide / Practice Quiz"""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are a study assistant. Summarize notes into clear, bulleted, efficient study points."},
                {"role": "user", "content": raw_text}
            ],
            max_tokens=1500
        )
        return response.choices[0].message.content
    except Exception as e:
        # Offline mock fallback
        return f"Offline Mock Summary for: {raw_text[:30]}...\n- Key Concept 1\n- Key Concept 2"


def summarize_image(base64_image: str, mime_type: str) -> str:
    """Multimodal Image -> Bullets / Flashcards / Study Guide / Practice Quiz"""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract all study notes, definitions, explanations, formulas, diagrams and text from this image and structure them into a comprehensive, clear, bulleted study guide."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        # Offline mock fallback
        return f"Offline Mock Summary for Image (Could not connect to multimodal AI): {str(e)}"



# ─────────────────────────────────────────────────────────
# 2. Quiz Generation
# ─────────────────────────────────────────────────────────

def generate_structured_quiz(raw_text: str, num_questions: int = 5) -> list:
    """Text -> N-question MCQ (JSON array)"""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a quiz generator. Generate {num_questions} multiple choice questions "
                        "from the given text. Return a JSON array where each item has: "
                        "question, options (array of 4), answer (the correct option text)."
                    ),
                },
                {"role": "user", "content": raw_text},
            ],
            max_tokens=1500
        )
        content = response.choices[0].message.content
        result = _parse_json_response(content)
        if result:
            return result
        return [{"question": "Could not parse quiz", "options": ["A", "B", "C", "D"], "answer": "A"}]
    except Exception:
        return [{"question": "Offline Mock Question?", "options": ["A", "B", "C", "D"], "answer": "A"}]


# ─────────────────────────────────────────────────────────
# 3. Automatic Notes Generation
# ─────────────────────────────────────────────────────────

def generate_automatic_notes(description: str) -> str:
    """Subject description -> Full comprehensive study notes via AI"""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert academic study assistant. Generate comprehensive, well-structured study notes "
                        "based on the subject description provided. Format the notes with clear headings, subheadings, "
                        "bullet points, key definitions, important formulas (if applicable), and example problems. "
                        "Make the notes exam-ready and suitable for self-study. Use markdown formatting."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Generate detailed study notes for the following subject:\n\n{description}",
                },
            ],
            max_tokens=2500
        )
        return response.choices[0].message.content
    except Exception:
        return (
            f"# Study Notes: {description[:60]}...\n\n"
            "## Key Concepts\n"
            "- **Concept 1**: Important foundational idea\n"
            "- **Concept 2**: Building on the fundamentals\n"
            "- **Concept 3**: Advanced application\n\n"
            "## Summary\n"
            "These are offline-generated placeholder notes. Connect to the AI service for comprehensive notes.\n\n"
            "## Practice Questions\n"
            "1. What are the key differences between the main concepts?\n"
            "2. How do these concepts apply in real-world scenarios?\n"
            "3. Explain the relationship between Concept 1 and Concept 3."
        )


# ─────────────────────────────────────────────────────────
# 4. Study Plan Generation
# ─────────────────────────────────────────────────────────

def generate_study_plan(description: str, subject_name: str, deadline: str, daily_minutes: int) -> list | None:
    """Generate AI-powered day-wise study plan from subject description"""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a study planner AI. Create a detailed day-wise study plan based on the subject description. "
                        "Return ONLY a valid JSON array of objects, each with: "
                        '{"name": "Topic Name", "day": 1, "duration": 60}. '
                        "Distribute topics logically, include a revision day at the end. "
                        "Do not include any text outside the JSON array."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Subject: {subject_name}\n"
                        f"Description: {description}\n"
                        f"Deadline: {deadline}\n"
                        f"Daily study time: {daily_minutes} minutes\n\n"
                        "Generate a JSON array of study topics."
                    ),
                },
            ],
            max_tokens=1500
        )
        content = response.choices[0].message.content
        parsed = _parse_json_response(content)
        if parsed and isinstance(parsed, list) and len(parsed) > 0:
            return parsed
        raise ValueError("Empty or invalid AI study plan JSON array")
    except Exception as e:
        print(f"[generate_study_plan] OpenRouter call failed or returned invalid JSON ({e}). Compiling dynamic dietician/study schedule fallback.")
        # Programmatic day-wise study plan fallback based on the deadline
        from datetime import datetime
        try:
            deadline_str = deadline.split('T')[0] if deadline else ""
            deadline_date = datetime.strptime(deadline_str, "%Y-%m-%d")
            delta = deadline_date - datetime.now()
            days = max(1, min(30, delta.days))
        except Exception:
            days = 7

        fallback_topics = []
        # Basic list of key topics to cover
        core_topics = [
            "Introduction and Fundamental Terminology",
            "Core Concepts, Principles & Methodologies",
            "Practical Implementations & Lab Demonstrations",
            "Advanced Case Studies & Multi-domain Integration",
            "Troubleshooting, Edge Cases & Performance Tuning",
            "Practice Problems, Assessments & Active Recall Quiz",
            "Comprehensive Final Revision & Practice Exam"
        ]

        for d in range(1, days + 1):
            if d == days:
                topic_name = f"Final Review & Comprehensive Study Session for {subject_name}"
            else:
                topic_idx = (d - 1) % len(core_topics)
                topic_name = f"{core_topics[topic_idx]} ({subject_name})"
            fallback_topics.append({
                "name": topic_name,
                "day": d,
                "duration": daily_minutes or 45
            })
        return fallback_topics


# ─────────────────────────────────────────────────────────
# 5. AI Recommendations (NEW)
# ─────────────────────────────────────────────────────────

def generate_recommendations(context: str) -> str:
    """Generate personalized study recommendations based on user data."""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a study advisor AI. Based on the student's current subjects, progress, "
                        "deadlines, and difficulty levels, provide 3-5 actionable study recommendations. "
                        "Be specific and encouraging. Use markdown formatting with bullet points."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Here is my current study data:\n\n{context}\n\nGive me personalized study recommendations.",
                },
            ],
            max_tokens=1500
        )
        return response.choices[0].message.content
    except Exception:
        return (
            "📚 **Study Recommendations**\n\n"
            "- Focus on subjects closest to their deadlines first\n"
            "- Try breaking difficult topics into smaller chunks\n"
            "- Review completed topics periodically to maintain retention\n"
            "- Take short breaks between study sessions for better focus\n\n"
            "*(Connect to AI service for personalized recommendations)*"
        )


# ─────────────────────────────────────────────────────────
# 6. Flashcard Generation (NEW)
# ─────────────────────────────────────────────────────────

def generate_flashcards(text: str, num_cards: int = 10) -> list:
    """Generate flashcards (Q&A pairs) from source text."""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a flashcard generator. Create {num_cards} flashcards from the given text. "
                        "Return a JSON array where each item has: "
                        '"front" (question/term) and "back" (answer/definition). '
                        "Focus on key concepts, definitions, and important facts."
                    ),
                },
                {"role": "user", "content": text},
            ],
            max_tokens=1500
        )
        content = response.choices[0].message.content
        result = _parse_json_response(content)
        if result:
            return result
        return [{"front": "Could not generate flashcards", "back": "Please try again"}]
    except Exception:
        return [{"front": "Offline Mock Flashcard", "back": "Connect to AI for real flashcards"}]