import time
import logging
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import DocumentAnalysisResponse, DocAnalysis, DateItem
from app.services.ai_service import get_ai_service
from app.services.ocr_service import extract_text
from app.services.cache_service import get_cache
from app.services.reminder_service import get_reminder_service
from app.core.config import get_settings

router   = APIRouter(prefix="/api/document", tags=["document"])
logger   = logging.getLogger(__name__)
settings = get_settings()
limiter  = Limiter(key_func=get_remote_address)

ALLOWED   = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}
MAX_BYTES = settings.max_upload_mb * 1024 * 1024


@router.post("/analyze", response_model=DocumentAnalysisResponse)
@limiter.limit(settings.rate_limit_upload)
async def analyze_document(
    request: Request,
    file: UploadFile = File(...),
    lang: str = Form(default="english"),
    phone: str = Form(default=""),
):
    start = time.time()
    ct    = file.content_type or ""
    fn    = file.filename or "document"

    if ct not in ALLOWED and not any(fn.lower().endswith(e) for e in (".pdf", ".jpg", ".jpeg", ".png")):
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload PDF, JPG, or PNG.")

    data = await file.read()

    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Max {settings.max_upload_mb}MB.")
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="File appears empty or corrupted.")

    extracted_text, _ = extract_text(data, ct, fn)
    ai  = get_ai_service()
    raw = ai.analyze_document(extracted_text, fn)

    try:
        analysis = DocAnalysis(
            doc_type  = raw.get("doc_type",   "other"),
            type_label= raw.get("type_label", "Document"),
            title     = raw.get("title",      fn),
            confidence= int(raw.get("confidence", 50)),
            key_info  = raw.get("key_info",   []),
            dates     = [
                DateItem(date=d["date"], desc=d["desc"])
                for d in raw.get("dates", [])
                if "date" in d and "desc" in d
            ],
            warnings   = raw.get("warnings",   []),
            next_steps = raw.get("next_steps", []),
        )
    except Exception as e:
        logger.error(f"Schema parse error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse document analysis.")

    total_ms = int((time.time() - start) * 1000)
    get_cache().increment("stats:document_count")

    # Feature #2 — auto-create deadline reminders from extracted dates
    # This turns passive document analysis into active deadline protection
    if phone and analysis.dates:
        try:
            reminder_service = get_reminder_service()
            created = reminder_service.create_reminders_from_document_dates(
                phone=phone,
                doc_title=analysis.title,
                dates=[{"date": d.date, "desc": d.desc} for d in analysis.dates],
            )
            if created:
                logger.info(f"[Document] Auto-created {len(created)} reminders for {phone}")
        except Exception as e:
            logger.warning(f"[Document] Reminder auto-creation failed (non-fatal): {e}")

    return DocumentAnalysisResponse(
        analysis           = analysis,
        extracted_text     = extracted_text[:2000],  # first 2000 chars for preview
        raw_text_length    = len(extracted_text),
        processing_time_ms = total_ms,
    )
