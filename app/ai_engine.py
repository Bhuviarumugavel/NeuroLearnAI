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
    timeout=60.0,
)

MODEL = "openrouter/free"


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
    """Raw text -> High-accuracy synthesized study guide."""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system", 
                    "content": (
                        "You are an expert academic tutor and study researcher. Your goal is to synthesize the provided study text with maximum factual accuracy, conceptual depth, and clarity. "
                        "Do not omit core technical terms, formulas, key dates, or logical arguments. "
                        "Structure the output into: \n"
                        "1. **Core Synopsis**: A clear, high-level summary of the entire note.\n"
                        "2. **Key Concepts & Definitions**: Elaborate on all major terminologies and concepts in the notes.\n"
                        "3. **Critical Takeaways**: A structured bullet list of the most important points to remember."
                    )
                },
                {"role": "user", "content": raw_text}
            ],
            max_tokens=1800
        )
        return response.choices[0].message.content
    except Exception as e:
        # Offline mock fallback
        return f"Offline Mock Summary for: {raw_text[:30]}...\n- Key Concept 1\n- Key Concept 2"


def summarize_notes_time_management(raw_text: str) -> str:
    """Summarize text specifically focusing on key concepts, difficulty, and study time management estimation."""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an elite study strategist and time management coach. Analyze the provided study text and build a highly structured, accurate, and actionable time management study guide.\n\n"
                        "First, output a clean markdown table matching this format exactly:\n"
                        "| Core Topic | Key Concept | Difficulty (Low/Medium/Hard) | Estimated Study Time (minutes) | Recommended Technique (e.g. Active Recall, Spaced Repetition, Pomodoro cycles) |\n"
                        "| --- | --- | --- | --- | --- |\n\n"
                        "Below the table, provide:\n"
                        "1. **Detailed Topic Breakdown**: Explaining each core topic clearly and concisely.\n"
                        "2. **Time Allocation Strategy**: Explaining why certain topics require more time.\n"
                        "3. **Actionable Study Roadmap**: A step-by-step recommendation on how to distribute study sessions across the week."
                    ),
                },
                {"role": "user", "content": raw_text}
            ],
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        # Offline mock fallback
        return (
            f"⏱️ **Time Management Summary** (Offline Fallback)\n\n"
            f"### Key Concepts & Time Estimates\n"
            f"| Concept | Difficulty | Est. Study Time | Recommended Technique |\n"
            f"| --- | --- | --- | --- |\n"
            f"| Foundational Principles | Low | 20 mins | Pomodoro (1 Session) |\n"
            f"| Advanced Methodologies | Medium | 45 mins | Active Recall Quiz |\n"
            f"| Practical Exercises | Hard | 60 mins | Spaced Repetition / Practice problems |\n\n"
            f"**Total Recommended Study Duration:** 2 Hours 5 Minutes."
        )


def summarize_image(base64_image: str, mime_type: str, summary_type: str = "general") -> str:
    """Multimodal Image -> Bullets / Flashcards / Study Guide / Practice Quiz / Time Management Summary"""
    system_prompt = (
        "Extract all study notes, definitions, explanations, formulas, diagrams and text from this image and structure them into a comprehensive, clear, bulleted study guide."
        if summary_type != "time_management" else
        "Extract all study notes and concepts from this image and summarize them into a time management study guide. Focus on: 1. Key Concepts, 2. Difficulty Rating (Low/Medium/Hard), 3. Estimated Study Time (in minutes) to master each topic, 4. Recommended Study Techniques. Format as a clean markdown table or structured checklist."
    )
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": system_prompt
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
                        "You are a professional study planner AI and curriculum developer. Create a detailed day-wise study plan based on the subject description.\n"
                        "Break the syllabus down logically into sequential study topics.\n"
                        "Avoid generic placeholders. Instead, extract real sub-topics and concepts relevant to the subject.\n"
                        "Return ONLY a valid JSON array of objects (no markdown blocks, no backticks, no comments), each matching this schema exactly:\n"
                        '{"name": "Specific Topic Name", "day": 1, "duration": 60}'
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Subject: {subject_name}\n"
                        f"Description: {description}\n"
                        f"Deadline: {deadline}\n"
                        f"Daily study target time: {daily_minutes} minutes\n\n"
                        "Generate study plan JSON array."
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
        # Dynamic fallback topics based on subject name and description
        desc_parts = [p.strip() for p in description.replace(",", ".").split(".") if len(p.strip()) > 5]
        
        core_topics = []
        if len(desc_parts) >= 3:
            core_topics = [
                f"Introduction to {subject_name} Foundations",
                f"Core Study: {desc_parts[0]}",
                f"Deep Dive: {desc_parts[1]}",
                f"Practical Application: {desc_parts[2]}",
                f"Advanced Integration of {subject_name} concepts",
                f"Active Recall, Flashcards & Practice Quiz",
                f"Final Revision and Mock Testing for {subject_name}"
            ]
        else:
            core_topics = [
                f"Introduction and Fundamental Vocabulary in {subject_name}",
                f"Core Theories & Methodologies of {subject_name}",
                f"Practical Lab Demonstrations & Implementations",
                f"Advanced Case Studies and Concept Synthesis",
                f"Edge Cases, Troubleshooting & Optimization",
                f"Active Recall Quiz & Self Assessment",
                f"Final Study Plan Revision & Exam Prep"
            ]

        for d in range(1, days + 1):
            if d == days:
                topic_name = f"Final Review & Comprehensive Study Session for {subject_name}"
            else:
                topic_idx = (d - 1) % len(core_topics)
                topic_name = core_topics[topic_idx]
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


# ─────────────────────────────────────────────────────────
# 7. Topic-Based Study Notes & Web Search
# ─────────────────────────────────────────────────────────

import httpx

async def search_duckduckgo_snippets(query: str, email: str = "anonymous@example.com") -> str:
    """Perform a web search query on DuckDuckGo HTML and extract snippets, setting the default contact email."""
    headers = {
        "User-Agent": f"NeurolearnAI/1.0 (contact: {email})"
    }
    try:
        async with httpx.AsyncClient(timeout=6.0) as async_client:
            resp = await async_client.get(f"https://html.duckduckgo.com/html/?q={query}", headers=headers)
            if resp.status_code == 200:
                html = resp.text
                snippets = []
                parts = html.split('<a class="result__snippet"')
                for part in parts[1:5]:  # top 4 results
                    snippet_content = part.split('</a>')[0]
                    # Simple HTML tag stripping
                    clean_snippet = ""
                    in_tag = False
                    for char in snippet_content:
                        if char == '<':
                            in_tag = True
                        elif char == '>':
                            in_tag = False
                        elif not in_tag:
                            clean_snippet += char
                    clean_snippet = clean_snippet.replace("&amp;", "&").replace("&quot;", '"').replace("&#x27;", "'")
                    snippets.append(clean_snippet.strip())
                return "\n".join(snippets)
    except Exception as e:
        print(f"DuckDuckGo web search failed: {e}")
    return ""


def generate_notes_for_topic(topic_name: str, subject_name: str, web_context: str = "") -> str:
    """Generate detailed, comprehensive study notes for a specific topic, utilizing web context if available."""
    try:
        system_content = (
            "You are a world-class academic tutor. Your goal is to write comprehensive, detailed, "
            "and academically rigorous study notes on the requested topic. Explain core principles, "
            "include definitions, and summarize primary formulas or logical arguments. "
            "Use clear headings, markdown styling, bullet points, and highlight important vocabulary."
        )
        user_content = f"Generate complete study notes for the topic '{topic_name}' in the subject '{subject_name}'."
        if web_context:
            user_content += f"\n\nUse the following gathered web information as additional reference:\n{web_context}"
            
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content}
            ],
            max_tokens=2000
        )
        return response.choices[0].message.content
    except Exception as e:
        return (
            f"### Study Notes: {topic_name}\n\n"
            f"**Subject:** {subject_name}\n\n"
            f"**Core Summary:**\n"
            f"Detailed overview of {topic_name} covering foundational principles, standard methodologies, "
            f"and practical applications. Read relevant textbook chapters for detailed equations and examples.\n\n"
            f"*(Generated in offline mode)*"
        )