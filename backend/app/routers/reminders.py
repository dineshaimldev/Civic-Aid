import logging
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import ReminderCreate, Reminder, ReminderListResponse
from app.services.reminder_service import get_reminder_service
from app.core.config import get_settings

router   = APIRouter(prefix="/api/reminders", tags=["reminders"])
logger   = logging.getLogger(__name__)
settings = get_settings()
limiter  = Limiter(key_func=get_remote_address)


@router.post("", response_model=Reminder)
@limiter.limit("10/minute")
async def create_reminder(request: Request, body: ReminderCreate):
    """
    Create a deadline reminder. Used both for manual reminders the user
    sets themselves, and automatically after document analysis extracts
    dates (30-day objection periods, court hearing dates, etc.).
    """
    try:
        service = get_reminder_service()
        reminder = service.create_reminder(
            phone=body.phone,
            title=body.title,
            deadline_date=body.deadline_date,
            description=body.description,
            source=body.source,
        )
        return Reminder(**reminder)
    except Exception as e:
        logger.error(f"Reminder creation error: {e}")
        raise HTTPException(status_code=500, detail="Could not create reminder.")


@router.get("/{phone}", response_model=ReminderListResponse)
@limiter.limit("30/minute")
async def list_reminders(request: Request, phone: str):
    """Get all upcoming reminders for a phone number, soonest first."""
    service = get_reminder_service()
    reminders = service.get_reminders_for_phone(phone)
    upcoming = service.count_upcoming(phone, within_days=30)
    return ReminderListResponse(
        reminders=[Reminder(**r) for r in reminders],
        upcoming_count=upcoming,
    )


@router.post("/sweep/run")
async def run_reminder_sweep():
    """
    Admin/cron endpoint — checks for reminders due within 3 days and
    sends WhatsApp notifications. Call this periodically (e.g. every
    6 hours) via a free cron service like cron-job.org pointed at this URL,
    or Render's built-in Cron Jobs feature.
    """
    try:
        service = get_reminder_service()
        sent_count = service.send_due_reminders_via_whatsapp()
        return {"sent": sent_count, "message": f"Sent {sent_count} deadline reminders."}
    except Exception as e:
        logger.error(f"Reminder sweep error: {e}")
        raise HTTPException(status_code=500, detail="Sweep failed.")
