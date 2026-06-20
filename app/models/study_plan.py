"""Study plan document model for MongoDB."""


def create_study_plan_document(
    user_id: str,
    subject_name: str,
    description: str,
    deadline: str,
    daily_minutes: int,
    topics: list,
) -> dict:
    """Create a study plan document ready for MongoDB insertion."""
    return {
        "user_id": user_id,
        "subject_name": subject_name,
        "description": description,
        "deadline": deadline,
        "daily_minutes": daily_minutes,
        "topics": topics,  # [{name, day, duration, completed}]
        "overall_progress": 0,
        "is_active": True,
        "created_at": None,
        "updated_at": None,
    }
