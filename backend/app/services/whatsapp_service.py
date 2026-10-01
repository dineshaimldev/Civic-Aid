"""
CivicAid WhatsApp Service — Feature #1 of Legal Advisor Priority Ranking
Reuses the existing ai_service.py and rag_pipeline.py completely.
No duplicate logic — WhatsApp is just another channel into the same RAG brain.

Uses Twilio's free WhatsApp Sandbox for testing (no payment required).
Production deployment requires WhatsApp Business API approval (separate from sandbox).
"""
import re
import logging
from typing import Optional
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse
from app.core.config import get_settings
from app.services.ai_service import get_ai_service
from app.services.cache_service import get_cache

settings = get_settings()
logger = logging.getLogger(__name__)

# Simple per-phone-number conversation memory (last 10 messages)
# Uses the existing cache service — no new infrastructure needed
CONVO_TTL = 1800  # 30 minutes of conversation memory per user

WELCOME_MESSAGE = (
    "🏛️ *Welcome to CivicAid*\n\n"
    "Free legal help for Tamil Nadu land issues, legal documents, "
    "certificates, and government schemes.\n\n"
    "Just type your question in Tamil or English.\n\n"
    "Example: _\"How do I transfer Patta after my father died?\"_\n\n"
    "Type *மொழி* or *language* to switch to Tamil.\n"
    "For urgent legal help, call *1516* (toll-free, 24/7)."
)

TAMIL_SWITCH_MESSAGE = (
    "மொழி தமிழுக்கு மாற்றப்பட்டது ✓\n\n"
    "இப்போது உங்கள் கேள்வியை தமிழில் கேளுங்கள்.\n\n"
    "அவசர சட்ட உதவிக்கு: *1516* (இலவசம், 24/7)"
)

ENGLISH_SWITCH_MESSAGE = (
    "Language switched to English ✓\n\n"
    "Ask your question in English now.\n\n"
    "For urgent legal help: *1516* (toll-free, 24/7)"
)

LANGUAGE_TRIGGERS_TAMIL = {"மொழி", "language", "tamil", "தமிழ்"}
LANGUAGE_TRIGGERS_ENGLISH = {"english", "ஆங்கிலம்"}


class WhatsAppService:
    def __init__(self):
        if settings.twilio_account_sid and settings.twilio_auth_token:
            self._client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        else:
            self._client = None
            logger.warning(
                "[WhatsApp] Twilio credentials not set — outbound sending disabled. "
                "Webhook replies will still work via TwiML."
            )

    def _get_user_lang(self, phone: str) -> str:
        cache = get_cache()
        return cache.get(f"wa:lang:{phone}") or "english"

    def _set_user_lang(self, phone: str, lang: str):
        cache = get_cache()
        cache.set(f"wa:lang:{phone}", lang, ttl=CONVO_TTL * 4)  # remember longer than convo

    def _get_history(self, phone: str) -> list[dict]:
        cache = get_cache()
        return cache.get(f"wa:history:{phone}") or []

    def _save_history(self, phone: str, history: list[dict]):
        cache = get_cache()
        # Keep only last 10 messages to control token usage
        cache.set(f"wa:history:{phone}", history[-10:], ttl=CONVO_TTL)

    def _is_first_message(self, phone: str) -> bool:
        cache = get_cache()
        seen = cache.get(f"wa:seen:{phone}")
        if not seen:
            cache.set(f"wa:seen:{phone}", True, ttl=86400 * 30)  # remember for 30 days
            return True
        return False

    def _strip_whatsapp_formatting(self, text: str) -> str:
        """Convert markdown-ish AI output to WhatsApp's formatting syntax."""
        # WhatsApp bold is *text* not **text**
        text = re.sub(r"\*\*(.+?)\*\*", r"*\1*", text)
        # Remove markdown headers
        text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
        return text

    def handle_incoming_message(self, from_number: str, body: str) -> str:
        """
        Process an incoming WhatsApp message and return the reply text.
        This is the core integration point — reuses ai_service.chat_with_rag()
        exactly as the web Chat page does.
        """
        phone = from_number.replace("whatsapp:", "").strip()
        text = body.strip()

        # First-time user → send welcome message
        if self._is_first_message(phone):
            return WELCOME_MESSAGE

        # Language switch commands
        if text.lower() in {t.lower() for t in LANGUAGE_TRIGGERS_TAMIL}:
            self._set_user_lang(phone, "tamil")
            return TAMIL_SWITCH_MESSAGE

        if text.lower() in {t.lower() for t in LANGUAGE_TRIGGERS_ENGLISH}:
            self._set_user_lang(phone, "english")
            return ENGLISH_SWITCH_MESSAGE

        if len(text) < 2:
            return "Please type your question. For example: \"How do I transfer Patta?\""

        # Load conversation history + language preference
        lang = self._get_user_lang(phone)
        history = self._get_history(phone)
        history.append({"role": "user", "content": text})

        # Reuse the EXACT same AI service the web app uses
        ai = get_ai_service()
        try:
            reply_text, sources, is_fallback, confidence, source_details = ai.chat_with_rag(history, lang=lang)
        except Exception as e:
            logger.error(f"[WhatsApp] chat_with_rag failed for {phone}: {e}")
            return (
                "I'm having trouble right now. Please call Tamil Nadu Legal Aid: "
                "*1516* (toll-free, 24/7) for immediate help."
            )

        history.append({"role": "assistant", "content": reply_text})
        self._save_history(phone, history)

        # Format for WhatsApp
        formatted = self._strip_whatsapp_formatting(reply_text)

        # Append sources compactly if present
        if sources:
            source_lines = "\n".join(f"• {s}" for s in sources[:3])
            formatted += f"\n\n📖 *Sources:*\n{source_lines}"

        # Always remind about legal aid for fallback/low-confidence responses
        if is_fallback:
            formatted += "\n\n⚠️ For specific advice, call *1516* (toll-free, 24/7)."

        return formatted

    def build_twiml_response(self, reply_text: str) -> str:
        """Wrap reply text in TwiML XML format required by Twilio webhooks."""
        resp = MessagingResponse()
        # WhatsApp messages have a ~1600 char practical limit for reliability
        if len(reply_text) > 1500:
            reply_text = reply_text[:1450] + "\n\n... (truncated — call 1516 for full details)"
        resp.message(reply_text)
        return str(resp)

    def send_proactive_message(self, to_phone: str, message: str) -> bool:
        """
        Send an outbound message not triggered by an incoming one.
        Used by the deadline reminder system (Feature #2) to notify users
        of upcoming deadlines without them messaging first.
        """
        if not self._client:
            logger.warning("[WhatsApp] Cannot send proactive message — Twilio not configured")
            return False
        try:
            to = to_phone if to_phone.startswith("whatsapp:") else f"whatsapp:{to_phone}"
            self._client.messages.create(
                from_=settings.twilio_whatsapp_number,
                to=to,
                body=message,
            )
            return True
        except Exception as e:
            logger.error(f"[WhatsApp] Failed to send proactive message to {to_phone}: {e}")
            return False


# ── Singleton ─────────────────────────────────────────────────────────────
_whatsapp_service: Optional[WhatsAppService] = None

def get_whatsapp_service() -> WhatsAppService:
    global _whatsapp_service
    if _whatsapp_service is None:
        _whatsapp_service = WhatsAppService()
    return _whatsapp_service
