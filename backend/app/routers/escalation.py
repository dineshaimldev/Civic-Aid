import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import EscalationRequest, EscalationResponse, DistrictContact
from app.services.escalation_service import get_escalation_service

router  = APIRouter(prefix="/api/escalate", tags=["escalation"])
logger  = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


@router.post("", response_model=EscalationResponse)
@limiter.limit("10/minute")
async def escalate_case(request: Request, body: EscalationRequest):
    """
    Log a case for human follow-up and return DLSA contact info.

    Called when the person taps "Connect me to a lawyer" after an AI
    answer, whether or not escalation was auto-suggested. Does not
    auto-connect to a lawyer — logs the case and hands back the NALSA
    helpline and district DLSA office names so the person can follow up.
    """
    try:
        service = get_escalation_service()
        case = service.log_case(
            question=body.question,
            ai_answer=body.ai_answer,
            confidence=body.confidence,
            reason=body.reason,
            phone=body.phone,
            district=body.district,
        )
        contacts = service.get_district_contacts(body.district)
        return EscalationResponse(
            escalation_id=case["escalation_id"],
            logged_at=case["logged_at"],
            dlsa_helpline="1516",
            district_contacts=[DistrictContact(**c) for c in contacts],
            message=(
                "Your case has been logged. Call 1516 (toll-free, 24/7) to speak "
                "with Tamil Nadu Legal Services Authority, or contact your district "
                "DLSA office directly below."
            ),
        )
    except Exception as e:
        logger.error(f"Escalation error: {e}")
        raise HTTPException(status_code=500, detail="Could not log your case. Please call 1516 directly.")


@router.get("/contacts")
async def escalation_contacts(district: Optional[str] = None):
    """DLSA contacts — all districts, or filtered to one if given."""
    service = get_escalation_service()
    contacts = service.get_district_contacts(district)
    return {"dlsa_helpline": "1516", "district_contacts": contacts}
