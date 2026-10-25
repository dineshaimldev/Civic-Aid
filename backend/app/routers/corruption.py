import logging
import secrets
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import CorruptionReportCreate, CorruptionReportResponse
from app.services.corruption_service import get_corruption_service
from app.core.config import get_settings

router  = APIRouter(prefix="/api/corruption-report", tags=["corruption"])
logger  = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


@router.post("", response_model=CorruptionReportResponse)
@limiter.limit("5/minute")
async def submit_corruption_report(request: Request, body: CorruptionReportCreate):
    """
    Submit an anonymous (by default) corruption/bribery report.
    Formats a DVAC-ready reference note the user can submit themselves
    via the DVAC helpline, email, or online portal.

    This does NOT auto-file with DVAC (no public API exists) — it prepares
    a properly structured report so the user has everything ready.
    """
    try:
        service = get_corruption_service()
        report = service.submit_report(
            office_name=body.office_name,
            incident_description=body.incident_description,
            officer_designation=body.officer_designation,
            amount_demanded=body.amount_demanded,
            incident_date=body.incident_date,
            contact_phone=body.contact_phone,
        )
        note = service.format_dvac_reference_note(report)
        return CorruptionReportResponse(
            report_id=report["report_id"],
            submitted_at=report["submitted_at"],
            dvac_reference_note=note,
            message=(
                "Your report has been prepared. Submit it to DVAC via the helpline, "
                "email, or portal shown below. Demanding a bribe is a criminal offence "
                "under the Prevention of Corruption Act 1988."
            ),
        )
    except Exception as e:
        logger.error(f"Corruption report error: {e}")
        raise HTTPException(status_code=500, detail="Could not submit report.")


@router.get("/dvac-contact")
async def dvac_contact():
    """DVAC helpline, email, and portal — for anyone wanting to report directly."""
    service = get_corruption_service()
    return service.get_dvac_contact_info()


@router.get("/stats")
@limiter.limit("10/minute")
async def corruption_aggregate_stats(request: Request):
    """
    Anonymized aggregate stats — total reports and office-level counts.
    No personal data exposed. Useful for NGOs/researchers.
    """
    configured_token = get_settings().reminder_sweep_token.strip()
    supplied_token = request.headers.get("X-Admin-Token", "")
    if not configured_token or not secrets.compare_digest(supplied_token, configured_token):
        raise HTTPException(status_code=401, detail="Unauthorized.")

    service = get_corruption_service()
    return service.get_aggregate_stats()
