"""Quiz document model for MongoDB."""


def create_quiz_document(
    user_id: str,
    subject: str,
    source_text: str,
    questions: list,
    topic: str = "",
) -> dict:
    """Create a quiz document ready for MongoDB insertion."""
    return {
        "user_id": user_id,
        "subject": subject,
        "topic": topic,
        "source_text": source_text[:500],  # Store first 500 chars as reference
        "questions": questions,
        "attempts": [],  # List of {score, total, answers, attempted_at}
        "created_at": None,
    }


def create_quiz_attempt(score: int, total: int, answers: list) -> dict:
    """Create a quiz attempt record."""
    return {
        "score": score,
        "total": total,
        "answers": answers,
        "attempted_at": None,
    }
