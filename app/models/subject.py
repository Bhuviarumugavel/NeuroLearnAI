"""Subject document model for MongoDB."""


def create_subject_document(
    user_id: str,
    name: str,
    priority: str = "Medium",
    level: str = "Intermediate",
    deadline: str = None,
    difficulty: str = "Moderate",
    color: str = "#4F46E5",
    description: str = "",
    daily_study_minutes: int = 45,
    progress: int = 0,
) -> dict:
    """Create a subject document ready for MongoDB insertion."""
    return {
        "user_id": user_id,
        "name": name,
        "priority": priority,
        "level": level,
        "deadline": deadline,
        "difficulty": difficulty,
        "color": color,
        "description": description,
        "daily_study_minutes": daily_study_minutes,
        "progress": progress,
        "uploaded_notes": [],
        "auto_notes": [],
        "topics": [],
        "created_at": None,
        "updated_at": None,
    }
