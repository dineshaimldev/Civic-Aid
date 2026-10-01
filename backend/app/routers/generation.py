import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import LetterGenerateRequest, LetterGenerateResponse
from app.services.document_generation_service import generate_official_letter, LETTER_PRESETS

router  = APIRouter(prefix="/api/generate", tags=["document-generation"])
logger  = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


@router.post("/letter", response_model=LetterGenerateResponse)
@limiter.limit("15/minute")
async def generate_letter(request: Request, body: LetterGenerateRequest):
    """
    Drafts a ready-to-submit complaint/application letter in standard
    Tamil Nadu petition format. This is a draft only — the response says
    so, and the person should review it before submitting.
    """
    try:
        text = generate_official_letter(
            applicant_name          = body.applicant_name,
            father_or_husband_name  = body.father_or_husband_name,
            address                 = body.address,
            phone                   = body.phone,
            recipient_designation   = body.recipient_designation,
            recipient_office        = body.recipient_office,
            subject                 = body.subject,
            details                 = body.details,
            survey_number           = body.survey_number,
            village                 = body.village,
            lang                    = body.lang,
        )
        return LetterGenerateResponse(letter_text=text, generated_at=datetime.now().isoformat())
    except Exception as e:
        logger.error(f"Letter generation error: {e}")
        raise HTTPException(status_code=500, detail="Could not generate letter.")


@router.get("/letter/presets")
async def letter_presets():
    """Pre-filled subject/office suggestions for common situations, used by the frontend form."""
    return LETTER_PRESETS
