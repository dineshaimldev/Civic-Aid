import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import StatusRequest, StatusResponse, StatusType
from app.services.ai_service import get_ai_service
from app.services.cache_service import get_cache
from app.core.config import get_settings

router   = APIRouter(prefix="/api/status", tags=["status"])
logger   = logging.getLogger(__name__)
settings = get_settings()
limiter  = Limiter(key_func=get_remote_address)

# Demo reference numbers — cover all 5 land status types
KNOWN: dict[str, dict] = {
    # Patta transfer — approved
    "TN2024001234": {
        "status":      "completed",
        "heading":     "Patta Transfer Approved ✓",
        "explanation": "Your Patta transfer has been approved by the Tahsildar. The new Patta in your name is ready for collection at the Taluk Office.",
        "next_step":   "Visit Taluk Office Counter 3 (Mon–Fri 10am–5pm) with your Aadhaar card and acknowledgement slip to collect the Patta.",
        "last_updated":"15 Mar 2024",
        "office":      "Thiruvallur Taluk Office",
    },
    # Patta transfer — pending VAO inspection
    "TN2024005678": {
        "status":      "pending",
        "heading":     "VAO Field Inspection Scheduled",
        "explanation": "A Village Administrative Officer (VAO) is scheduled to visit your land within 5 working days for field verification.",
        "next_step":   "Be present at your land on weekdays 10am–4pm. Keep Patta, sale deed, and Aadhaar ready for the VAO.",
        "last_updated":"12 Mar 2024",
        "office":      "Thiruvallur VAO Office",
    },
    # Patta transfer — rejected (stale EC)
    "TN2024009999": {
        "status":      "rejected",
        "heading":     "Application Rejected — Stale EC",
        "explanation": "Your application was rejected because the Encumbrance Certificate (EC) submitted was older than 30 days at the time of filing.",
        "next_step":   "Obtain a fresh EC from the Sub-Registrar office (fee ₹200) and resubmit all documents at the Taluk Office Patta Section.",
        "last_updated":"10 Mar 2024",
        "office":      "Thiruvallur Taluk Office",
    },
    # Land boundary dispute — under RDO review
    "TN2024007777": {
        "status":      "pending",
        "heading":     "Boundary Dispute Under RDO Review",
        "explanation": "Your land boundary dispute complaint has been escalated to the Revenue Divisional Officer (RDO). A joint survey by the Taluk Surveyor has been ordered.",
        "next_step":   "Attend the joint survey inspection when notified. Carry your FMB copy, Patta, and EC. Call 1516 for free legal guidance.",
        "last_updated":"08 Apr 2024",
        "office":      "Thiruvallur Revenue Divisional Office",
    },
    # Land acquisition compensation — payment processed
    "TN2024003456": {
        "status":      "completed",
        "heading":     "Acquisition Compensation Released ✓",
        "explanation": "The land acquisition compensation for your survey number has been calculated and the award amount has been deposited into your registered bank account via NEFT.",
        "next_step":   "Check your bank account (allow 2–3 working days). If not received, contact the Land Acquisition Officer at the Collectorate with your award copy.",
        "last_updated":"20 Apr 2024",
        "office":      "Thiruvallur District Collectorate — LAO Section",
    },
}


@router.post("/check", response_model=StatusResponse)
@limiter.limit(settings.rate_limit_status)
async def check_status(request: Request, body: StatusRequest):
    ref = body.reference_number.strip().upper()
    if len(ref) < 3:
        raise HTTPException(status_code=400, detail="Invalid reference number.")

    cache     = get_cache()
    cache_key = f"status:{ref}:{body.service.value}"

    cached = cache.get(cache_key)
    if cached:
        return StatusResponse(**cached)

    if ref in KNOWN:
        d      = KNOWN[ref]
        result = StatusResponse(
            status      = StatusType(d["status"]),
            heading     = d["heading"],
            explanation = d["explanation"],
            next_step   = d["next_step"],
            last_updated= d["last_updated"],
            reference_number = ref,
            office      = d.get("office"),
        )
        cache.set(cache_key, result.model_dump(), ttl=600)
        return result

    # Unknown reference — generate realistic AI status
    raw    = get_ai_service().generate_status(ref, body.service.value)
    result = StatusResponse(
        status      = StatusType(raw.get("status",      "pending")),
        heading     = raw.get("heading",     "Application Under Review"),
        explanation = raw.get("explanation", "Your application is being processed by the concerned officer."),
        next_step   = raw.get("next_step",   "Check again in 3–5 working days or visit your Taluk Office."),
        last_updated= raw.get("last_updated", datetime.now().strftime("%d %b %Y")),
        reference_number = ref,
        office      = raw.get("office",      "Taluk Office"),
    )
    cache.set(cache_key, result.model_dump(), ttl=600)
    get_cache().increment("stats:status_count")
    return result
