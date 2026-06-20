"""User document model for MongoDB."""


def create_user_document(email: str, hashed_password: str, full_name: str = "") -> dict:
    """Create a user document ready for MongoDB insertion."""
    return {
        "email": email,
        "hashed_password": hashed_password,
        "full_name": full_name,
        "avatar_url": "",
        "study_preferences": {
            "daily_goal_minutes": 60,
            "preferred_subjects": [],
            "notification_enabled": True,
        },
        "streak_days": 0,
        "total_study_minutes": 0,
        "created_at": None,  # Set at insertion time
        "updated_at": None,
    }
