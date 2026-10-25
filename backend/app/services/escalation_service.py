"""
CivicAid Human Escalation Service — Feature #6 of Legal Advisor Priority Ranking

Not every situation is safe to leave to an AI answer alone. This service
flags cases that should go to a human — either because the question
touches a high-risk legal situation (arrest, fraud, a court notice, land
grabbed by force) or because the RAG pipeline itself was not confident
in what it found. It logs the case and returns DLSA (District Legal
Services Authority) contact info so the person can follow up with a
real lawyer.

This does NOT auto-connect to a lawyer (no public API exists for that);
it logs the case for the person's own records and gives them the
NALSA toll-free helpline plus district office names to call or visit.
This is an honest scope — overclaiming a live lawyer connection would
be misleading.
"""
import uuid
import logging
from datetime import datetime
from typing import Optional
from app.services.cache_service import get_cache
from app.services.persistence_service import get_persistence
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

ESCALATION_TTL = 86400 * 180  # keep escalation logs for 6 months
NALSA_HELPLINE = "1516"

# Substring match against the lowercased question. Kept broad on purpose —
# a false positive just shows the "talk to a lawyer" option a bit more
# often, which is a safe failure mode for a legal-aid tool.
HIGH_RISK_KEYWORDS = [
    "arrest", "fir", "fraud", "cheated", "cheating", "court notice",
    "summon", "warrant", "land stolen", "land grabbed", "illegally occupied",
    "encroach", "domestic violence", "dowry", "custody", "jail", "bail",
    "eviction", "threat", "assault", "harassment", "bribe", "extortion",
    "police complaint", "chargesheet", "remand",
]

# District Legal Services Authority (DLSA) offices — Tamil Nadu.
# All route through the NALSA 1516 toll-free helpline, which connects
# callers to their district DLSA; office names are listed so the person
# knows which authority covers them and where it physically sits.
DISTRICT_CONTACTS: list[dict] = [
    {"district": "Chennai",          "office": "Chennai DLSA, High Court Campus",            "phone": "1516"},
    {"district": "Coimbatore",       "office": "Coimbatore DLSA, District Court Campus",      "phone": "1516"},
    {"district": "Madurai",          "office": "Madurai DLSA, District Court Campus",         "phone": "1516"},
    {"district": "Tiruchirappalli",  "office": "Tiruchirappalli DLSA, District Court Campus", "phone": "1516"},
    {"district": "Salem",            "office": "Salem DLSA, District Court Campus",           "phone": "1516"},
    {"district": "Tirunelveli",      "office": "Tirunelveli DLSA, District Court Campus",     "phone": "1516"},
    {"district": "Vellore",          "office": "Vellore DLSA, District Court Campus",         "phone": "1516"},
    {"district": "Erode",            "office": "Erode DLSA, District Court Campus",           "phone": "1516"},
    {"district": "Thanjavur",        "office": "Thanjavur DLSA, District Court Campus",       "phone": "1516"},
    {"district": "Dindigul",         "office": "Dindigul DLSA, District Court Campus",        "phone": "1516"},
]


class EscalationService:
    def should_suggest_escalation(self, question: str, confidence: float = 1.0) -> bool:
        """
        True if this question should be routed to a human:
          - it contains a high-risk legal keyword (arrest, fraud, court
            notice, land stolen, etc.), or
          - the RAG pipeline's retrieval confidence is below the same
            threshold used to gate a fallback answer.
        """
        text = question.lower()
        if any(kw in text for kw in HIGH_RISK_KEYWORDS):
            return True
        if confidence < settings.rag_confidence_threshold:
            return True
        return False

    def log_case(
        self,
        question: str,
        ai_answer: Optional[str] = None,
        confidence: float = 0.0,
        reason: Optional[str] = None,
        phone: Optional[str] = None,
        district: Optional[str] = None,
    ) -> dict:
        """Persist the case (6-month TTL) and return it with its new id."""
        cache = get_cache()
        escalation_id = str(uuid.uuid4())[:12]

        case = {
            "escalation_id": escalation_id,
            "question": question,
            "ai_answer": ai_answer,
            "confidence": confidence,
            "reason": reason or (
                "low_confidence" if confidence < settings.rag_confidence_threshold
                else "user_requested"
            ),
            "phone": phone,
            "district": district,
            "logged_at": datetime.now().isoformat(),
        }

        get_persistence().save_record(
            "escalation",
            escalation_id,
            case,
            case["logged_at"],
        )

        logger.info(
            f"[Escalation] Case {escalation_id} logged — reason={case['reason']}, "
            f"district={district or 'unspecified'}"
        )
        return case

    def get_district_contacts(self, district: Optional[str] = None) -> list[dict]:
        """All TN DLSA contacts, or just the matching one if a district is given."""
        if district:
            match = [c for c in DISTRICT_CONTACTS if c["district"].lower() == district.lower()]
            return match or DISTRICT_CONTACTS
        return DISTRICT_CONTACTS


# ── Singleton ─────────────────────────────────────────────────────────────
_escalation_service: Optional[EscalationService] = None

def get_escalation_service() -> EscalationService:
    global _escalation_service
    if _escalation_service is None:
        _escalation_service = EscalationService()
    return _escalation_service
