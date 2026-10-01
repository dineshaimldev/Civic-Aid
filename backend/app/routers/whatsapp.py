import logging
from fastapi import APIRouter, Request, Response, Form
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import get_settings
from app.services.whatsapp_service import get_whatsapp_service

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
logger = logging.getLogger(__name__)
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)


@router.post("/webhook")
@limiter.limit(settings.rate_limit_whatsapp)
async def whatsapp_webhook(
    request: Request,
    From: str = Form(...),
    Body: str = Form(...),
):
    """
    Twilio WhatsApp webhook — called every time a user sends a message
    to your CivicAid WhatsApp number.

    Setup (free, ~5 minutes):
      1. Sign up at twilio.com (free trial, no card charged)
      2. Go to Console → Messaging → Try it out → WhatsApp Sandbox
      3. Set the Sandbox "When a message comes in" webhook to:
         https://your-backend-url.onrender.com/api/whatsapp/webhook
      4. Method: POST
      5. Save your Account SID + Auth Token into backend/.env
      6. From your phone, WhatsApp the sandbox number with the join code shown

    This reuses the exact same RAG pipeline and AI service as the web chat —
    no duplicate logic, no separate knowledge base.
    """
    wa = get_whatsapp_service()
    reply_text = wa.handle_incoming_message(From, Body)
    twiml = wa.build_twiml_response(reply_text)
    return Response(content=twiml, media_type="application/xml")


@router.get("/status")
async def whatsapp_status():
    """Check if WhatsApp integration is configured and ready."""
    configured = bool(settings.twilio_account_sid and settings.twilio_auth_token)
    return {
        "configured": configured,
        "sandbox_number": settings.twilio_whatsapp_number if configured else None,
        "webhook_path": "/api/whatsapp/webhook",
        "setup_required": [] if configured else [
            "Sign up free at twilio.com",
            "Get Account SID and Auth Token from Twilio Console",
            "Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env",
            "Set webhook URL in Twilio WhatsApp Sandbox settings",
        ],
    }
