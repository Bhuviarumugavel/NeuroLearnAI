"""
AI Engine — OpenRouter-powered AI functions for NeurolearnAI.

All functions use OpenRouter's API (via the openai client) with
google/gemini-3.5-flash model. Each function includes a mock
fallback for offline resilience.
"""
from openai import OpenAI
from app.config import OPENROUTER_BASE_URL, API_KEYS
import json
import logging
import time
import re

# Set up logging for the AI Engine
logger = logging.getLogger("neurolearn.ai_engine")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# Initialize default client using first key for backward compatibility
client = OpenAI(
    base_url=OPENROUTER_BASE_URL,
    api_key=API_KEYS[0] if API_KEYS else None,
    timeout=15.0,
)


MODEL = "google/gemini-2.5-flash"


def _execute_completion_with_rotation(model: str, messages: list, max_tokens: int, temperature: float = 0.7, timeout: float = 15.0) -> str:
    """
    Execute chat completion with dynamic rotation over available API keys.
    If a key fails due to credit token reservation (HTTP 402), it dynamically reduces max_tokens to the affordable limit and retries.
    If a key is completely out of credits or has other failures, it rotates to the next key.
    For rate limits (HTTP 429), it sleeps/backs off or rotates keys.
    """
    last_exception = None
    retries_per_key = 2
    initial_delay = 1.0
    backoff_factor = 2.0
    
    current_max_tokens = max_tokens

    for idx, key in enumerate(API_KEYS):
        try:
            temp_client = OpenAI(
                base_url=OPENROUTER_BASE_URL,
                api_key=key,
                timeout=timeout,
                max_retries=0,
            )
            for attempt in range(1, retries_per_key + 1):
                try:
                    logger.info(f"LLM Call: Model '{model}' using key {idx+1}/{len(API_KEYS)} (Attempt {attempt}/{retries_per_key}, max_tokens={current_max_tokens})")
                    response = temp_client.chat.completions.create(
                        model=model,
                        messages=messages,
                        max_tokens=current_max_tokens,
                        temperature=temperature
                    )
                    if response.choices and len(response.choices) > 0:
                        content = response.choices[0].message.content
                        if content:
                            return content
                    raise ValueError("Empty response from model")
                except Exception as e:
                    status_code = getattr(e, "status_code", None)
                    err_msg = str(e)
                    logger.warning(
                        f"LLM Call failed with key {idx+1}/{len(API_KEYS)} on attempt {attempt}: {err_msg} (Status: {status_code})"
                    )
                    last_exception = e

                    # Check for 402 Payment Required credit error with affordable limit info
                    if status_code == 402 or "402" in err_msg or "credit" in err_msg.lower():
                        # Parse the affordable tokens limit
                        match = re.search(r"can only afford (\d+)", err_msg)
                        if match:
                            affordable = int(match.group(1))
                            new_max = max(affordable - 10, 10)
                            if new_max < current_max_tokens:
                                logger.info(f"Dynamically reducing max_tokens from {current_max_tokens} to {new_max} due to low credits.")
                                current_max_tokens = new_max
                                # Retry immediately on the same key with the lower max_tokens
                                continue
                        
                        logger.warning("Low balance detected (HTTP 402). Moving to next key immediately.")
                        break

                    # If it's a rate limit (429), move to the next key immediately without sleeping
                    if status_code == 429 or "429" in err_msg or "rate limit" in err_msg.lower() or "too many requests" in err_msg.lower():
                        logger.warning("Rate limit hit (HTTP 429). Moving to next key immediately.")
                        break

                    # Last attempt for this key
                    if attempt == retries_per_key:
                        break

                    delay = initial_delay * (backoff_factor ** (attempt - 1))
                    logger.info(f"Retrying key {idx+1} in {delay:.1f} seconds...")
                    time.sleep(delay)
        except Exception as e:
            logger.error(f"Error in client creation or rotation execution for key index {idx}: {e}")
            last_exception = e

    if last_exception:
        raise last_exception
    raise RuntimeError("No API keys available to perform completion")


def _safe_chat_completion(messages: list, max_tokens: int = 600, temperature: float = 0.7) -> str:
    """
    Call OpenRouter's API safely. If the primary model fails or is blocked due to 
    low credits/token reservations, it automatically retries with other API keys
    and falls back to stable free models.
    """
    # Cap reserved tokens to prevent 402 Payment Required errors on low-credit balances
    optimized_max_tokens = min(max_tokens, 600)
    
    fallback_models = [
        "meta-llama/llama-3.2-3b-instruct:free",
        "google/gemma-4-26b-a4b-it:free"
    ]
    
    # 1. Try primary paid model with key rotation and retry logic
    try:
        content = _execute_completion_with_rotation(
            model=MODEL,
            messages=messages,
            max_tokens=optimized_max_tokens,
            temperature=temperature,
            timeout=5.0
        )
        logger.info(f"Primary model {MODEL} call succeeded.")
        return content
    except Exception as e:
        logger.warning(f"All keys failed for primary model {MODEL}. Transitioning to free fallbacks. Error: {e}")

    # 2. Attempt fallback models sequentially (also using rotation)
    for fallback in fallback_models:
        try:
            content = _execute_completion_with_rotation(
                model=fallback,
                messages=messages,
                max_tokens=optimized_max_tokens,
                temperature=temperature,
                timeout=3.0
            )
            logger.info(f"Fallback model {fallback} succeeded!")
            return content
        except Exception as fe:
            logger.warning(f"Fallback model {fallback} failed on all keys: {fe}")
                     
    # Re-raise the original error if all fallbacks fail
    raise RuntimeError("All configured AI models (primary and fallbacks) failed to respond on all keys.")


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
        truncated_text = raw_text[:8000]
        return _safe_chat_completion(
            messages=[
                {
                    "role": "system", 
                    "content": (
                        "You are an expert academic tutor. Your goal is to synthesize the provided study text into an exam-ready guide with maximum factual accuracy, conceptual depth, and clarity.\n\n"
                        "Structure the output exactly into these four sections:\n"
                        "1. **Short Summary**: A concise high-level overview of the note.\n"
                        "2. **Important Concepts**: Elaborate explanation of all major terminologies, concepts, and definitions.\n"
                        "3. **Key Points**: A structured bullet list of critical takeaways to remember.\n"
                        "4. **Exam Ready Notes**: Synthesized core notes containing formulas, key dates, facts, and logical arguments ready for exams."
                    )
                },
                {"role": "user", "content": truncated_text}
            ],
            max_tokens=1800
        )
    except Exception as e:
        # Offline mock fallback
        return f"Offline Mock Summary for: {raw_text[:30]}...\n- Key Concept 1\n- Key Concept 2"


def summarize_notes_time_management(raw_text: str) -> str:
    """Summarize text specifically focusing on key concepts, difficulty, and study time management estimation."""
    try:
        truncated_text = raw_text[:8000]
        return _safe_chat_completion(
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
                {"role": "user", "content": truncated_text}
            ],
            max_tokens=2000
        )
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
    
    optimized_max_tokens = 600
    
    messages = [
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
    ]
    
    try:
        return _execute_completion_with_rotation(
            model=MODEL,
            messages=messages,
            max_tokens=optimized_max_tokens
        )
    except Exception as e:
        print(f"[AI-ENGINE-WARN] Multimodal primary model failed on all keys: {e}")
        try:
            print("[AI-ENGINE-INFO] Attempting multimodal fallback: openrouter/free")
            return _execute_completion_with_rotation(
                model="openrouter/free",
                messages=messages,
                max_tokens=optimized_max_tokens
            )
        except Exception as fe:
            print(f"[AI-ENGINE-WARN] openrouter/free fallback failed: {fe}. Trying secondary multimodal fallback: nvidia/nemotron-nano-12b-v2-vl:free")
            try:
                return _execute_completion_with_rotation(
                    model="nvidia/nemotron-nano-12b-v2-vl:free",
                    messages=messages,
                    max_tokens=optimized_max_tokens
                )
            except Exception as se:
                print(f"[AI-ENGINE-WARN] All multimodal fallbacks failed: {se}")
                return f"Offline Mock Summary for Image (Could not connect to multimodal AI): {str(e)}"



# ─────────────────────────────────────────────────────────
# 2. Quiz Generation
# ─────────────────────────────────────────────────────────

def generate_structured_quiz(raw_text: str, num_questions: int = 5, user_ability: str = "Medium", topic: str = "") -> list:
    """Text -> N-question MCQ (JSON array) adjusted to user academic ability and focus topic."""
    try:
        topic_clause = f" specifically covering the topic '{topic}'" if topic else ""
        system_content = (
            f"You are an elite academic assessment creator. Generate {num_questions} multiple choice questions "
            f"from the provided text{topic_clause}. Adjust the question complexity and vocabulary to align with the user's profile ability: '{user_ability}'.\n\n"
            "Return a valid JSON array of objects (no markdown blocks), each matching this schema exactly:\n"
            '{"question": "The question text?", "options": ["Option A", "Option B", "Option C", "Option D"], "answer": "The correct option text exactly"}'
        )
        content = _safe_chat_completion(
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": f"Source study materials:\n{raw_text}"},
            ],
            max_tokens=1500
        )
        result = _parse_json_response(content)
        if result:
            # Normalize dictionary responses
            if isinstance(result, dict):
                for key in ["questions", "quiz", "items"]:
                    if key in result and isinstance(result[key], list):
                        result = result[key]
                        break
                else:
                    if "question" in result:
                        result = [result]
                    else:
                        result = []

            # Validate list of questions
            if isinstance(result, list):
                valid_questions = []
                for item in result:
                    if isinstance(item, dict) and "question" in item:
                        q_text = item.get("question", "Question")
                        opts = item.get("options", ["A", "B", "C", "D"])
                        ans = item.get("answer", "A")
                        valid_questions.append({
                            "question": q_text,
                            "options": opts if isinstance(opts, list) else ["A", "B", "C", "D"],
                            "answer": ans
                        })
                if valid_questions:
                    return valid_questions

        return [{"question": f"Could not parse quiz question {i+1}", "options": ["A", "B", "C", "D"], "answer": "A"} for i in range(num_questions)]
    except Exception:
        return [{"question": f"Offline Mock Question {i+1}?", "options": ["A", "B", "C", "D"], "answer": "A"} for i in range(num_questions)]


# ─────────────────────────────────────────────────────────
# 3. Automatic Notes Generation
# ─────────────────────────────────────────────────────────

def generate_automatic_notes(description: str) -> str:
    """Subject description -> Simple and clear topic summary notes via AI"""
    try:
        return _safe_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert academic study assistant. Generate simple, clear, and highly focused study notes "
                        "and a concise summary for the specified topic. Explain key concepts simply, outline important points, "
                        "and provide a clear overview. Keep the content simple, clear, and easy to understand. Use markdown."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Generate simple, clear study notes for the following topic:\n\n{description}",
                },
            ],
            max_tokens=1500
        )
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
        truncated_desc = description[:4000]
        content = _safe_chat_completion(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional study planner AI and curriculum developer. Create a detailed day-wise study plan based on the subject description.\n"
                        "Break the syllabus down logically into sequential study topics.\n"
                        "Keep topic names extremely short, simple, and clean (maximum 3 words, e.g. 'Basic Anatomy', 'Action Potentials', 'Synapses'). Avoid long descriptions or compound sentences.\n"
                        "Return ONLY a valid JSON array of objects (no markdown blocks, no backticks, no comments), each matching this schema exactly:\n"
                        '{"name": "Specific Topic Name", "day": 1, "duration": 60}'
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Subject: {subject_name}\n"
                        f"Description: {truncated_desc}\n"
                        f"Deadline: {deadline}\n"
                        f"Daily study target time: {daily_minutes} minutes\n\n"
                        "Generate study plan JSON array."
                    ),
                },
            ],
            max_tokens=1500
        )
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
        return _safe_chat_completion(
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
        content = _safe_chat_completion(
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


def generate_notes_for_topic(topic_name: str, subject_name: str, web_context: str = "", uploaded_context: str = "") -> str:
    """Generate detailed, comprehensive study notes for a specific topic, utilizing web context and user uploads if available."""
    try:
        system_content = (
            "You are a world-class academic tutor. Your goal is to write comprehensive, detailed, "
            "and academically rigorous study notes on the requested topic. Explain core principles, "
            "include definitions, and summarize primary formulas or logical arguments. "
            "Use clear headings, markdown styling, bullet points, and highlight important vocabulary."
        )
        user_content = f"Generate complete study notes for the topic '{topic_name}' in the subject '{subject_name}'."
        if uploaded_context:
            user_content += f"\n\nUse the student's own uploaded notes/syllabus context as the PRIMARY source for accuracy:\n{uploaded_context}"
        if web_context:
            user_content += f"\n\nUse the following gathered web information as additional reference:\n{web_context}"
            
        return _safe_chat_completion(
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content}
            ],
            max_tokens=2000
        )
    except Exception as e:
        return (
            f"### Study Notes: {topic_name}\n\n"
            f"**Subject:** {subject_name}\n\n"
            f"**Core Summary:**\n"
            f"Detailed overview of {topic_name} covering foundational principles, standard methodologies, "
            f"and practical applications. Read relevant textbook chapters for detailed equations and examples.\n\n"
            f"*(Generated in offline mode)*"
        )