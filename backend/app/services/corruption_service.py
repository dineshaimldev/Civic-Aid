"""
CivicAid Corruption Reporting Service — Feature #4 of Legal Advisor Priority Ranking

Addresses the "fear of reprisal" problem: villagers avoid reporting bribe
demands because they must keep dealing with the same local officials.
This channel is anonymous by default and formats the report for DVAC
(Directorate of Vigilance and Anti-Corruption) submission.

This service does NOT auto-submit to DVAC (no public API exists for that);
it prepares a properly formatted report and gives the user the DVAC
contact info to submit it themselves, or attach as evidence to their
own complaint. This is an honest scope — overclaiming direct government
integration would be misleading.
"""
import uuid
import logging
from datetime import datetime
from typing import Optional
from app.services.cache_service import get_cache

logger = logging.getLogger(__name__)

REPORT_TTL = 86400 * 180  # keep reports for 6 months
DVAC_HELPLINE = "044-28592750"
DVAC_EMAIL = "dvac.tn@nic.in"
DVAC_ONLINE_PORTAL = "https://www.dvac.tn.gov.in"


class CorruptionReportService:
    def submit_report(
        self,
        office_name: str,
        incident_description: str,
        officer_designation: str = "",
        amount_demanded: Optional[str] = None,
        incident_date: Optional[str] = None,
        contact_phone: Optional[str] = None,
    ) -> dict:
        cache = get_cache()
        report_id = str(uuid.uuid4())[:12]

        report = {
            "report_id": report_id,
            "office_name": office_name,
            "officer_designation": officer_designation,
            "incident_description": incident_description,
            "amount_demanded": amount_demanded,
            "incident_date": incident_date,
            "contact_phone": contact_phone,  # None = fully anonymous
            "submitted_at": datetime.now().isoformat(),
            "is_anonymous": contact_phone is None,
        }

        cache.set(f"corruption_report:{report_id}", report, ttl=REPORT_TTL)

        # Add to global index (for aggregate reporting — Feature: village dashboard)
        all_reports_key = "corruption_reports:all_ids"
        all_ids = cache.get(all_reports_key) or []
        all_ids.append(report_id)
        cache.set(all_reports_key, all_ids, ttl=REPORT_TTL)

        logger.info(
            f"[Corruption] Report {report_id} submitted "
            f"({'anonymous' if report['is_anonymous'] else 'with contact'}) — office: {office_name}"
        )
        return report

    def get_report(self, report_id: str) -> Optional[dict]:
        cache = get_cache()
        return cache.get(f"corruption_report:{report_id}")

    def format_dvac_reference_note(self, report: dict) -> str:
        """
        Formats the report as text the user can copy-paste or forward
        when submitting to DVAC themselves via phone, email, or portal.
        """
        lines = [
            "CORRUPTION INCIDENT REPORT (drafted via CivicAid)",
            f"Reference: {report['report_id']}",
            f"Date Submitted: {report['submitted_at'][:10]}",
            "",
            f"Office/Department: {report['office_name']}",
        ]
        if report.get("officer_designation"):
            lines.append(f"Officer/Designation: {report['officer_designation']}")
        if report.get("incident_date"):
            lines.append(f"Incident Date: {report['incident_date']}")
        if report.get("amount_demanded"):
            lines.append(f"Amount Demanded: {report['amount_demanded']}")
        lines.append("")
        lines.append("Incident Description:")
        lines.append(report["incident_description"])
        lines.append("")
        lines.append(
            "This report was prepared as anonymous."
            if report["is_anonymous"]
            else f"Contact for follow-up: {report['contact_phone']}"
        )
        return "\n".join(lines)

    def get_dvac_contact_info(self) -> dict:
        return {
            "helpline": DVAC_HELPLINE,
            "email": DVAC_EMAIL,
            "portal": DVAC_ONLINE_PORTAL,
            "note": (
                "DVAC (Directorate of Vigilance and Anti-Corruption) handles bribery "
                "and corruption complaints against Tamil Nadu government officials. "
                "You can call, email, or use the online portal. Complaints can be filed "
                "anonymously. Demanding a bribe is an offence under the Prevention of "
                "Corruption Act 1988."
            ),
        }

    def get_aggregate_stats(self) -> dict:
        """
        Anonymized aggregate stats — no personal data exposed.
        Powers a future village-level dashboard showing where corruption
        complaints cluster, useful for NGOs and policy researchers.
        """
        cache = get_cache()
        all_ids = cache.get("corruption_reports:all_ids") or []
        office_counts: dict[str, int] = {}

        for rid in all_ids:
            r = cache.get(f"corruption_report:{rid}")
            if r:
                office = r.get("office_name", "Unknown")
                office_counts[office] = office_counts.get(office, 0) + 1

        return {
            "total_reports": len(all_ids),
            "reports_by_office": office_counts,
        }


# ── Singleton ─────────────────────────────────────────────────────────────
_corruption_service: Optional[CorruptionReportService] = None

def get_corruption_service() -> CorruptionReportService:
    global _corruption_service
    if _corruption_service is None:
        _corruption_service = CorruptionReportService()
    return _corruption_service
