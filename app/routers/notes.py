"""Notes router — full CRUD with AI summarization."""
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from datetime import datetime, timezone
from bson import ObjectId
from app.database import notes_collection
from app.models.note import create_note_document
from app.schemas.note import NoteCreate, NoteUpdate, AutoNotesRequest
from app.ai_engine import summarize_notes, generate_automatic_notes, summarize_image, summarize_notes_time_management
from app.middleware.auth import get_current_user, get_current_user_optional

router = APIRouter(prefix="/api/notes", tags=["Notes"])


def serialize_doc(doc: dict) -> dict:
    """Convert MongoDB ObjectId to string."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def extract_text_from_pptx(file_bytes: bytes) -> str:
    import zipfile
    import xml.etree.ElementTree as ET
    import io
    
    text_runs = []
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as pptx:
            slide_files = sorted([name for name in pptx.namelist() if name.startswith('ppt/slides/slide') and name.endswith('.xml')])
            for slide_file in slide_files:
                xml_content = pptx.read(slide_file)
                root = ET.fromstring(xml_content)
                for elem in root.iter():
                    if elem.tag.endswith('}t') or elem.tag == 't':
                        if elem.text:
                            text_runs.append(elem.text.strip())
    except Exception as e:
        print(f"PPTX parsing warning: {e}")
    
    return "\n".join(text_runs)


# ── POST /api/notes/ ─────────────────────────────────────

@router.post("/")
async def create_note(
    request: NoteCreate,
    user: dict = Depends(get_current_user_optional),
):
    """Add a note with AI-powered summarization."""
    user_id = user["_id"] if user else "anonymous"

    # AI summarization
    import asyncio
    summary_type = getattr(request, "summary_type", "general")
    if summary_type == "time_management":
        summary = await asyncio.to_thread(summarize_notes_time_management, request.text)
    else:
        summary = await asyncio.to_thread(summarize_notes, request.text)

    # Build document
    note_doc = create_note_document(
        user_id=user_id,
        subject_tag=request.subject_tag,
        original_text=request.text,
        summary=summary,
        note_type="manual",
        description=getattr(request, "description", ""),
        unit=getattr(request, "unit", ""),
        syllabus=getattr(request, "syllabus", ""),
        topic=getattr(request, "topic", ""),
        book=getattr(request, "book", ""),
    )
    now = datetime.now(timezone.utc).isoformat()
    note_doc["created_at"] = now
    note_doc["updated_at"] = now

    try:
        result = await notes_collection.insert_one(note_doc)
        return {
            "status": "success",
            "note_id": str(result.inserted_id),
            "summary": summary,
        }
    except Exception as e:
        return {"status": "offline_success", "summary": summary, "error": str(e)}


# ── GET /api/notes/ ──────────────────────────────────────

@router.get("/")
async def list_notes(
    user: dict = Depends(get_current_user_optional),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject: str = Query(None, description="Filter by subject tag"),
    search: str = Query(None, description="Full-text search"),
):
    """List notes with pagination and filtering."""
    user_id = user["_id"] if user else "anonymous"
    query = {"user_id": user_id}

    if subject:
        query["subject"] = subject
    if search:
        query["$text"] = {"$search": search}

    try:
        total = await notes_collection.count_documents(query)
        skip = (page - 1) * page_size
        cursor = notes_collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)

        notes = []
        async for doc in cursor:
            notes.append(serialize_doc(doc))

        return {
            "status": "success",
            "notes": notes,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except Exception:
        return {"status": "offline", "notes": [], "total": 0, "page": page, "page_size": page_size}


# ── GET /api/notes/{note_id} ─────────────────────────────

@router.get("/{note_id}")
async def get_note(note_id: str):
    """Get a single note by ID."""
    try:
        doc = await notes_collection.find_one({"_id": ObjectId(note_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"status": "success", "note": serialize_doc(doc)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── PUT /api/notes/{note_id} ─────────────────────────────

@router.put("/{note_id}")
async def update_note(note_id: str, updates: NoteUpdate):
    """Update a note. Re-summarizes if text is changed."""
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Re-summarize if text changed
    if "text" in update_data:
        update_data["original_text"] = update_data.pop("text")
        import asyncio
        update_data["summary"] = await asyncio.to_thread(summarize_notes, update_data["original_text"])

    if "subject_tag" in update_data:
        update_data["subject"] = update_data.pop("subject_tag")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = await notes_collection.update_one(
            {"_id": ObjectId(note_id)},
            {"$set": update_data},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"status": "success", "modified": result.modified_count}
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "offline_success"}


# ── DELETE /api/notes/{note_id} ──────────────────────────

@router.delete("/{note_id}")
async def delete_note(note_id: str):
    """Delete a note."""
    try:
        result = await notes_collection.delete_one({"_id": ObjectId(note_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "offline_success"}


# ── POST /api/notes/generate-auto ────────────────────────

@router.post("/generate-auto")
async def auto_generate_notes(
    request: AutoNotesRequest,
    user: dict = Depends(get_current_user_optional),
):
    """Generate comprehensive study notes from a description using AI."""
    if not request.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")

    user_id = user["_id"] if user else "anonymous"
    import asyncio
    notes = await asyncio.to_thread(generate_automatic_notes, request.description)

    # Persist to MongoDB
    try:
        note_doc = create_note_document(
            user_id=user_id,
            subject_tag=request.subject_name or "General",
            original_text="",
            summary="",
            note_type="auto_generated",
            subject_name=request.subject_name,
            description=request.description,
            generated_notes=notes,
        )
        note_doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await notes_collection.insert_one(note_doc)
    except Exception:
        pass  # Graceful degradation

    return {"status": "success", "notes": notes}


@router.post("/upload-file")
async def upload_file_notes(
    file: UploadFile = File(...),
    subject_tag: str = Form(...),
    description: str = Form(""),
    summary_type: str = Form("general"),
    unit: str = Form(""),
    syllabus: str = Form(""),
    topic: str = Form(""),
    book: str = Form(""),
    upload_source: str = Form("manual_summarizer"),
    user: dict = Depends(get_current_user_optional),
):
    """Upload a TXT, PDF, DOCX, PPTX, or Image file to extract text & generate AI summary."""
    user_id = user["_id"] if user else "anonymous"
    filename = file.filename.lower()
    content_type = file.content_type.lower() if file.content_type else ""
 
    # Read file bytes
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
 
    text = ""
    summary = ""
    import base64
    file_base64 = base64.b64encode(file_bytes).decode('utf-8')
 
    # Check file type and parse
    if filename.endswith(('.txt', '.md')) or content_type.startswith("text/"):
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to decode text file: {str(e)}")
 
    elif filename.endswith('.pdf') or content_type == "application/pdf":
        try:
            import pypdf
            import io
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for page in reader.pages:
                p_text = page.extract_text()
                if p_text:
                    pages_text.append(p_text)
            text = "\n".join(pages_text)
            if not text.strip():
                raise Exception("No readable text found in PDF.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF file: {str(e)}")
 
    elif filename.endswith('.docx') or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            import zipfile
            import xml.etree.ElementTree as ET
            import io
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as docx:
                xml_content = docx.read('word/document.xml')
                root = ET.fromstring(xml_content)
                ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                paragraphs = []
                for p in root.findall('.//w:p', ns):
                    texts = [t.text for t in p.findall('.//w:t', ns) if t.text]
                    if texts:
                        paragraphs.append("".join(texts))
                text = "\n".join(paragraphs)
            if not text.strip():
                raise Exception("No readable text found in DOCX.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse DOCX file: {str(e)}")

    elif filename.endswith(('.ppt', '.pptx')) or content_type in ("application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"):
        try:
            text = extract_text_from_pptx(file_bytes)
            if not text.strip():
                raise Exception("No readable text found in PPT/PPTX slide decks.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PPTX file: {str(e)}")
 
    elif filename.endswith(('.png', '.jpg', '.jpeg', '.webp')) or content_type.startswith("image/"):
        try:
            # Determine appropriate mime type if not present or generic
            mime = content_type if content_type.startswith("image/") else "image/png"
            import asyncio
            summary = await asyncio.to_thread(summarize_image, file_base64, mime, summary_type)
            text = "Uploaded image notes (Summarized directly via multimodal AI)"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")
 
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload text (.txt, .md), PDF (.pdf), Word (.docx), PowerPoint (.ppt, .pptx) or Image files."
        )
 
    # If it's a textual file, generate the summary using summarize_notes
    if not summary:
        if not text.strip():
            raise HTTPException(status_code=400, detail="The uploaded file contains no readable text.")
        import asyncio
        if summary_type == "time_management":
            summary = await asyncio.to_thread(summarize_notes_time_management, text)
        else:
            summary = await asyncio.to_thread(summarize_notes, text)
 
    # Build document & persist to MongoDB
    note_doc = create_note_document(
        user_id=user_id,
        subject_tag=subject_tag,
        original_text=text,
        summary=summary,
        note_type="manual",
        description=description,
        unit=unit,
        syllabus=syllabus,
        topic=topic,
        book=book,
        file_name=file.filename,
        file_type=filename.split('.')[-1] if '.' in filename else 'txt',
        file_data=file_base64,
        upload_source=upload_source,
    )
    now = datetime.now(timezone.utc).isoformat()
    note_doc["created_at"] = now
    note_doc["updated_at"] = now
 
    try:
        result = await notes_collection.insert_one(note_doc)
        return {
            "status": "success",
            "note_id": str(result.inserted_id),
            "original_text": text,
            "summary": summary,
        }
    except Exception as e:
        return {
            "status": "offline_success",
            "original_text": text,
            "summary": summary,
            "error": str(e),
        }


# ── GET /api/notes/{note_id}/download ─────────────────────

@router.get("/{note_id}/download")
async def download_note_file(note_id: str):
    """Retrieve the original uploaded note file as binary."""
    from fastapi.responses import Response
    import base64
    try:
        doc = await notes_collection.find_one({"_id": ObjectId(note_id)})
        if not doc or not doc.get("file_data"):
            raise HTTPException(status_code=404, detail="File data not found for this note.")
        
        file_bytes = base64.b64decode(doc["file_data"])
        filename = doc.get("file_name", "download")
        
        # Determine content type from file name
        ext = filename.split('.')[-1].lower() if '.' in filename else ''
        content_type = "application/octet-stream"
        if ext == 'pdf':
            content_type = "application/pdf"
        elif ext in ('png', 'jpg', 'jpeg', 'webp'):
            content_type = f"image/{ext}"
        elif ext == 'docx':
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif ext in ('ppt', 'pptx'):
            content_type = "application/vnd.ms-powerpoint"
        elif ext in ('txt', 'md'):
            content_type = "text/plain"
            
        headers = {
            "Content-Disposition": f"attachment; filename={filename}"
        }
        return Response(content=file_bytes, media_type=content_type, headers=headers)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
