import re
import time
import logging
from typing import List
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


def _norm_text(s: str) -> str:
    return re.sub(r"[^\w஀-௿]+", "", s.lower())


def _norm_survey(s: str) -> str:
    # "123/4A" and "123 / 4 a" should match; keep digits, letters and slash
    return re.sub(r"[^0-9a-z/஀-௿]", "", s.lower())


def _names_match(a: str, b: str) -> bool:
    na, nb = _norm_text(a), _norm_text(b)
    if not na or not nb:
        return True
    if na in nb or nb in na:
        return True
    # token overlap handles initials/reordering ("S. Murugan" vs "Murugan S")
    ta = {t for t in re.split(r"\W+", a.lower()) if len(t) > 1}
    tb = {t for t in re.split(r"\W+", b.lower()) if len(t) > 1}
    return bool(ta and tb and len(ta & tb) / min(len(ta), len(tb)) >= 0.5)


def _extent_value(s: str):
    m = re.search(r"(\d+(?:\.\d+)?)", s or "")
    return float(m.group(1)) if m else None


@router.post("/compare")
@limiter.limit(settings.rate_limit_upload)
async def compare_documents(request: Request, files: List[UploadFile] = File(...)):
    """
    Cross-checks 2-4 land documents (e.g. patta vs chitta, sale deed vs EC) and flags
    differences in owner name, survey number, extent and village. Extraction is
    AI-assisted, so results are flags to verify - not a legal finding.
    """
    if len(files) < 2 or len(files) > 4:
        raise HTTPException(status_code=400, detail="Upload between 2 and 4 documents to compare.")

    ai = get_ai_service()
    docs = []
    for f in files:
        fn = f.filename or "document"
        ct = f.content_type or ""
        if ct not in ALLOWED and not any(fn.lower().endswith(e) for e in (".pdf", ".jpg", ".jpeg", ".png")):
            raise HTTPException(status_code=415, detail=f"Unsupported file type: {fn}")
        data = await f.read()
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"{fn} is too large. Max {settings.max_upload_mb}MB.")
        if len(data) < 100:
            raise HTTPException(status_code=400, detail=f"{fn} appears empty or corrupted.")
        text, _ = extract_text(data, ct, fn)
        fields = ai.extract_land_fields(text, fn)
        docs.append({"filename": fn, **fields})

    issues = []
    for i in range(len(docs)):
        for j in range(i + 1, len(docs)):
            a, b = docs[i], docs[j]
            pair = f"{a['filename']} vs {b['filename']}"
            if a["owner_name"] and b["owner_name"] and not _names_match(a["owner_name"], b["owner_name"]):
                issues.append({"field": "Owner name", "severity": "high", "pair": pair,
                               "detail": f"'{a['owner_name']}' vs '{b['owner_name']}'"})
            if a["survey_number"] and b["survey_number"] and _norm_survey(a["survey_number"]) != _norm_survey(b["survey_number"]):
                issues.append({"field": "Survey number", "severity": "high", "pair": pair,
                               "detail": f"'{a['survey_number']}' vs '{b['survey_number']}'"})
            ea, eb = _extent_value(a["extent"]), _extent_value(b["extent"])
            if ea is not None and eb is not None and abs(ea - eb) > max(0.01, 0.02 * max(ea, eb)):
                issues.append({"field": "Extent / area", "severity": "medium", "pair": pair,
                               "detail": f"'{a['extent']}' vs '{b['extent']}' (check units: acres / cents / hectares / sq.ft)"})
            if a["village"] and b["village"] and _norm_text(a["village"]) != _norm_text(b["village"]) \
                    and _norm_text(a["village"]) not in _norm_text(b["village"]) and _norm_text(b["village"]) not in _norm_text(a["village"]):
                issues.append({"field": "Village", "severity": "medium", "pair": pair,
                               "detail": f"'{a['village']}' vs '{b['village']}'"})

    unread = [d["filename"] for d in docs if not any(d[k] for k in ("owner_name", "survey_number", "extent"))]
    return {
        "documents": docs,
        "issues": issues,
        "all_consistent": not issues and not unread,
        "unreadable": unread,
        "disclaimer": "Fields were read automatically from the uploaded images and may contain errors. Verify flagged items against the originals with the VAO or Taluk office, or call 1516.",
    }


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
            issues_found = bool(raw.get("issues_found", True)) or bool(raw.get("warnings")),
            next_steps = raw.get("next_steps", []),
        )
    except Exception as e:
        logger.error(f"Schema parse error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse document analysis.")

    total_ms = int((time.time() - start) * 1000)
    get_cache().increment("stats:document_count")

    # Feature #2 — auto-create deadline reminders from extracted dates
    # This turns passive document analysis into active deadline protection
    reminder_token = request.headers.get("X-Reminder-Token", "")
    if phone and analysis.dates and reminder_token:
        reminder_service = get_reminder_service()
        if not reminder_service.verify_access_token(phone, reminder_token):
            raise HTTPException(status_code=401, detail="Reminder access token required.")
        try:
            created = reminder_service.create_reminders_from_document_dates(
                phone=phone,
                doc_title=analysis.title,
                dates=[{"date": d.date, "desc": d.desc} for d in analysis.dates],
                access_token=reminder_token,
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
