"""
CivicAid Reminder Service — Feature #2 of Legal Advisor Priority Ranking

Prevents people from losing land/legal rights due to missed deadlines
(30-day Patta objection periods, 60-day acquisition objections, court dates).

Storage: uses the existing cache service (Redis or in-memory fallback).
No new infrastructure required — reuses what's already built.
"""
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional
from app.services.cache_service import get_cache

logger = logging.getLogger(__name__)

REMINDER_TTL = 86400 * 120  # keep reminders for 120 days max
REMINDER_INDEX_KEY = "reminders:all_ids"  # tracks all reminder IDs for the daily sweep


class ReminderService:
    """
    Simple, dependency-free deadline reminder system.
    Reminders are checked by a daily sweep (see check_due_reminders())
    which can be triggered by a cron job, or manually via an admin endpoint.
    """

    def create_reminder(
        self,
        phone: str,
        title: str,
        deadline_date: str,
        description: str = "",
        source: str = "manual",
    ) -> dict:
        cache = get_cache()
        reminder_id = str(uuid.uuid4())[:12]

        reminder = {
            "id": reminder_id,
            "phone": phone,
            "title": title,
            "deadline_date": deadline_date,
            "description": description,
            "source": source,
            "created_at": datetime.now().isoformat(),
            "notified": False,
        }

        cache.set(f"reminder:{reminder_id}", reminder, ttl=REMINDER_TTL)

        # Add to this phone's reminder list
        phone_key = f"reminders:phone:{phone}"
        phone_reminders = cache.get(phone_key) or []
        phone_reminders.append(reminder_id)
        cache.set(phone_key, phone_reminders, ttl=REMINDER_TTL)

        # Add to global index for the daily sweep
        all_ids = cache.get(REMINDER_INDEX_KEY) or []
        all_ids.append(reminder_id)
        cache.set(REMINDER_INDEX_KEY, all_ids, ttl=REMINDER_TTL)

        logger.info(f"[Reminder] Created {reminder_id} for {phone} — deadline {deadline_date}")
        return reminder

    def get_reminders_for_phone(self, phone: str) -> list[dict]:
        cache = get_cache()
        phone_key = f"reminders:phone:{phone}"
        ids = cache.get(phone_key) or []
        reminders = []
        for rid in ids:
            r = cache.get(f"reminder:{rid}")
            if r:
                reminders.append(r)
        # Sort by deadline date, soonest first
        reminders.sort(key=lambda r: r["deadline_date"])
        return reminders

    def count_upcoming(self, phone: str, within_days: int = 30) -> int:
        reminders = self.get_reminders_for_phone(phone)
        cutoff = datetime.now() + timedelta(days=within_days)
        count = 0
        for r in reminders:
            try:
                deadline = datetime.fromisoformat(r["deadline_date"])
                if datetime.now() <= deadline <= cutoff:
                    count += 1
            except ValueError:
                continue
        return count

    def create_reminders_from_document_dates(
        self,
        phone: str,
        doc_title: str,
        dates: list[dict],
    ) -> list[dict]:
        """
        Auto-create reminders from dates extracted during document analysis.
        Called automatically after OCR + AI document analysis when a phone
        number is provided — turns 'passive information' into 'active protection'.
        """
        created = []
        for date_item in dates:
            raw_date = date_item.get("date", "")
            desc = date_item.get("desc", "")
            parsed = self._try_parse_date(raw_date)
            if parsed:
                reminder = self.create_reminder(
                    phone=phone,
                    title=f"{doc_title}: {desc}",
                    deadline_date=parsed.isoformat()[:10],
                    description=f"Extracted from your uploaded document: {doc_title}",
                    source="document_analysis",
                )
                created.append(reminder)
        return created

    def _try_parse_date(self, raw: str) -> Optional[datetime]:
        """Best-effort parse of dates like '15 Mar 2024', '2024-03-15', etc."""
        formats = ["%d %b %Y", "%d %B %Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]
        for fmt in formats:
            try:
                return datetime.strptime(raw.strip(), fmt)
            except ValueError:
                continue
        return None

    def check_due_reminders(self, warn_days_before: int = 3) -> list[dict]:
        """
        Daily sweep — finds reminders whose deadline is within `warn_days_before`
        days and have not yet been notified. Returns them so the caller
        (e.g. a cron endpoint or scheduler) can send WhatsApp/SMS alerts.
        """
        cache = get_cache()
        all_ids = cache.get(REMINDER_INDEX_KEY) or []
        due = []
        now = datetime.now()
        warn_cutoff = now + timedelta(days=warn_days_before)

        for rid in all_ids:
            r = cache.get(f"reminder:{rid}")
            if not r or r.get("notified"):
                continue
            try:
                deadline = datetime.fromisoformat(r["deadline_date"])
            except (ValueError, KeyError):
                continue
            if now <= deadline <= warn_cutoff:
                due.append(r)

        return due

    def mark_notified(self, reminder_id: str):
        cache = get_cache()
        r = cache.get(f"reminder:{reminder_id}")
        if r:
            r["notified"] = True
            cache.set(f"reminder:{reminder_id}", r, ttl=REMINDER_TTL)

    def send_due_reminders_via_whatsapp(self) -> int:
        """
        Checks for due reminders and sends WhatsApp notifications.
        Designed to be called by a scheduled job (cron, or a simple
        while-loop worker) every few hours.
        Returns the count of reminders sent.
        """
        from app.services.whatsapp_service import get_whatsapp_service

        due = self.check_due_reminders(warn_days_before=3)
        wa = get_whatsapp_service()
        sent = 0

        for r in due:
            days_left = (datetime.fromisoformat(r["deadline_date"]) - datetime.now()).days
            urgency = "🔴 TOMORROW" if days_left <= 1 else f"🟡 in {days_left} days"

            message = (
                f"⏰ *Deadline Reminder*\n\n"
                f"*{r['title']}*\n"
                f"{r.get('description', '')}\n\n"
                f"Deadline: {urgency} ({r['deadline_date']})\n\n"
                f"Don't miss this — call *1516* if you need help acting on it now."
            )

            success = wa.send_proactive_message(r["phone"], message)
            if success:
                self.mark_notified(r["id"])
                sent += 1
                logger.info(f"[Reminder] Sent WhatsApp alert for {r['id']} to {r['phone']}")

        return sent


# ── Singleton ─────────────────────────────────────────────────────────────
_reminder_service: Optional[ReminderService] = None

def get_reminder_service() -> ReminderService:
    global _reminder_service
    if _reminder_service is None:
        _reminder_service = ReminderService()
    return _reminder_service
