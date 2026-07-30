"""AI document validator route."""

import os

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from deps import MAX_UPLOAD_BYTES, get_current_user, limiter
from hermes_client import validate_document
from models import User

router = APIRouter()

# ---------------------------------------------------------------------------
# AI Document Validator
# ---------------------------------------------------------------------------

@router.post("/documents/validate")
@limiter.limit("20/minute")
async def validate_doc(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum is 15 MB.")

    ext = os.path.splitext(file.filename or "").lower()[1]
    mime = file.content_type or ""

    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}
    if mime not in {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf"} and ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail="Only image files (JPG/PNG/WEBP/GIF) and PDF documents are supported.",
        )

    if ext in {".jpg", ".jpeg"} and not mime.startswith("image/"):
        mime = "image/jpeg"
    elif ext == ".png" and not mime.startswith("image/"):
        mime = "image/png"
    elif ext == ".pdf":
        mime = "application/pdf"

    result = validate_document(content, mime, file.filename or "document")
    return result
