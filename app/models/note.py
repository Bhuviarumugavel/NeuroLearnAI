"""Note document model for MongoDB."""


def create_note_document(
    user_id: str,
    subject_tag: str,
    original_text: str,
    summary: str,
    note_type: str = "manual",
    subject_name: str = "",
    description: str = "",
    generated_notes: str = "",
    unit: str = "",
    syllabus: str = "",
    topic: str = "",
    book: str = "",
    file_name: str = "",
    file_type: str = "",
    file_data: str = "",
    upload_source: str = "",
) -> dict:
    """Create a note document ready for MongoDB insertion."""
    return {
        "user_id": user_id,
        "subject": subject_tag,
        "subject_name": subject_name,
        "description": description,
        "original_text": original_text,
        "summary": summary,
        "generated_notes": generated_notes,
        "type": note_type,  # "manual" | "auto_generated"
        "is_favorite": False,
        "tags": [],
        "created_at": None,
        "updated_at": None,
        "unit": unit,
        "syllabus": syllabus,
        "topic": topic,
        "book": book,
        "file_name": file_name,
        "file_type": file_type,
        "file_data": file_data,
        "upload_source": upload_source,
    }
