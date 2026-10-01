"""
CivicAid AI Service — RAG-augmented Groq (LLaMA 3.3 70B) integration
Free tier: 14,400 requests/day — no payment required
"""
import re
import json
import logging
from typing import Optional
from groq import Groq
from app.core.config import get_settings
from app.services.rag_pipeline import get_rag_pipeline

settings = get_settings()
logger   = logging.getLogger(__name__)

# ── Model ─────────────────────────────────────────────────────────────────
# Groq retires models regularly (llama-3.3-70b-versatile went off on 2026-08-16,
# llama-3.1-70b-versatile long before that). The primary model is read from
# GROQ_MODEL in .env so a retirement never needs a code change. If it fails,
# the others below are tried in order.
# Current list: https://console.groq.com/docs/models
MODEL_CANDIDATES: list[str] = list(dict.fromkeys([
    settings.groq_model,
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-20b",
]))

# ── System Prompts ────────────────────────────────────────────────────────

CHAT_SYSTEM = """You are CivicAid, a free AI legal assistant for rural Tamil Nadu village residents.
You are given RETRIEVED LEGAL CONTEXT from Tamil Nadu government documents and laws.
Use this context to answer the user's question accurately.

STRICT RULES:
1. Base your answer PRIMARILY on the retrieved context provided
2. Give numbered step-by-step practical advice in plain, simple language
3. Cite specific laws/orders from the context (e.g. "TN Revenue Standing Orders §4.2")
4. Include: office names, timelines, fees (₹), helpline numbers from context
5. For land disputes, FIR, court notices: ALWAYS include "Call 1516 (Tamil Nadu Legal Aid, toll-free, 24/7)"
6. Maximum 300 words — concise but complete
7. End your response with this EXACT format on its own line:
   SOURCES:["source1","source2"]
8. If the context only partly answers the question, answer the part it supports, then say clearly what is not covered and advise confirming with a lawyer or calling 1516"""

FALLBACK_SYSTEM = """You are CivicAid, a free legal information assistant for people in Tamil Nadu, India.
No verified source in our knowledge base matched this question, so answer from your general knowledge of Indian law and Tamil Nadu procedures.

RULES:
1. Give a clear, practical answer in plain language. Use numbered steps when the question is about a procedure.
2. Be honest about uncertainty. Do not invent section numbers, fees, deadlines, office names or case citations. If you are not sure of a specific figure or section, say so and tell the user to confirm it with the concerned office or a lawyer.
3. Name a law only when you are confident it applies. For offences committed on or after 1 July 2024, the BNS/BNSS apply in place of the IPC/CrPC.
4. For urgent or serious matters (arrest, FIR, court notice, land fraud) include: Call 1516 (Tamil Nadu Legal Aid, toll-free, 24/7).
5. Maximum 250 words.
6. End your response with SOURCES:[] on its own line."""

DOC_ANALYSIS_SYSTEM = """You are a document analysis AI for CivicAid specialising in Tamil Nadu government documents.
Analyse the provided document text and respond with ONLY a valid JSON object — no extra text, no markdown:
{
  "doc_type": "patta|sale_deed|fir|court|certificate|land_record|ec|legal_heir|other",
  "type_label": "Human readable document type",
  "title": "Full document title or best description",
  "confidence": 85,
  "key_info": ["Field: Value", "Field: Value"],
  "dates": [{"date": "DD Mon YYYY", "desc": "What this date means"}],
  "warnings": ["Warning if urgent action needed — leave empty array if none"],
  "next_steps": ["Step 1 — what the person should do next", "Step 2"]
}
Rules:
- Extract ACTUAL values from the document text. Never invent data.
- confidence is 0-100 based on how clearly you can read the document
- warnings: only add if genuinely urgent (court deadline, rejection notice, fraud indicator)
- next_steps: always give at least 2 practical steps"""

STATUS_SYSTEM = """Generate a realistic Tamil Nadu government land application status.
Respond with ONLY valid JSON — no extra text, no markdown:
{
  "status": "completed|pending|rejected",
  "heading": "Short 5-7 word status heading",
  "explanation": "2-3 sentences explaining the current status in plain language a villager can understand",
  "next_step": "One specific actionable next step with office name and timing",
  "last_updated": "DD Mon YYYY",
  "office": "Specific Tamil Nadu office name (e.g. Thiruvallur Taluk Office)"
}
Distribution: 60% pending, 30% completed, 10% rejected.
Make the explanation specific to the service type (patta/esevai/general)."""


# ── Response Parser ───────────────────────────────────────────────────────

# Scope guard: CivicAid only answers law and government-service questions.
# The model replies with OUT_OF_SCOPE_TOKEN for anything else, and the backend
# swaps in the fixed, polite message below (in the user's language).
OUT_OF_SCOPE_TOKEN = "[[OUT_OF_SCOPE]]"

SCOPE_RULE = f"""

SCOPE: You only help with law and government services in India, with a focus on Tamil Nadu. This covers legal rights, land and property, inheritance and family law, criminal and civil procedure, police and court matters, consumer, labour and tenancy issues, legal documents, certificates and welfare schemes.
If the user's message is clearly outside this (for example cooking, entertainment, programming, sports, medical advice, or casual chat unrelated to legal help), reply with exactly {OUT_OF_SCOPE_TOKEN} and nothing else.
Greetings, and questions about what you can help with, are in scope: answer briefly and invite a legal question."""

OUT_OF_SCOPE_MESSAGE = {
    "english": (
        "I'm CivicAid, a legal assistance service for Tamil Nadu, and I'm not trained to help with "
        "questions outside legal matters. You can ask me about land and property, inheritance, "
        "police and court notices, certificates, or government schemes."
    ),
    "tamil": (
        "நான் CivicAid, தமிழ்நாட்டிற்கான சட்ட உதவி சேவை. சட்டம் தொடர்பற்ற கேள்விகளுக்கு உதவ நான் பயிற்சி பெறவில்லை. "
        "நிலம் மற்றும் சொத்து, வாரிசுரிமை, காவல் மற்றும் நீதிமன்ற அறிவிப்புகள், "
        "சான்றிதழ்கள் அல்லது அரசு திட்டங்கள் குறித்து கேளுங்கள்."
    ),
}


def parse_chat_response(raw: str) -> tuple[str, list[str]]:
    """Extract SOURCES:[...] block from LLM response."""
    sources: list[str] = []
    match = re.search(r'SOURCES:(\[.*?\])', raw, re.DOTALL)
    if match:
        try:
            sources = json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
        text = raw[:match.start()].strip()
    else:
        text = raw.strip()
    return text, sources


# ── AI Service ────────────────────────────────────────────────────────────

class AIService:
    def __init__(self):
        if not settings.groq_api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. "
                "Get a free key at console.groq.com and add it to your .env file."
            )
        self._client = Groq(api_key=settings.groq_api_key)
        logger.info(f"[AI] Groq client initialised — models: {MODEL_CANDIDATES}")

    def _call_llm(
        self,
        system:     str,
        messages:   list[dict],
        max_tokens: int = 1000,
        temperature: float = 0.3,
    ) -> str:
        """
        Call Groq API, trying each model in MODEL_CANDIDATES until one answers.
        gpt-oss models are reasoning models: reasoning tokens count against
        max_tokens, so we lower reasoning effort and add headroom.
        """
        groq_messages = [{"role": "system", "content": system}] + messages
        last_error = ""

        for model in MODEL_CANDIDATES:
            try:
                kwargs: dict = dict(
                    model       = model,
                    messages    = groq_messages,
                    max_tokens  = max_tokens,
                    temperature = temperature,
                )
                if model.startswith("openai/gpt-oss"):
                    kwargs["max_tokens"] = max_tokens + 800
                    kwargs["extra_body"] = {"reasoning_effort": "low"}

                resp = self._client.chat.completions.create(**kwargs)
                content = resp.choices[0].message.content or ""
                if content.strip():
                    return content
                last_error = f"{model} returned empty content"
                logger.warning(f"[AI] {last_error}")
            except Exception as e:
                last_error = f"{model}: {e}"
                logger.warning(f"[AI] {model} failed: {e}")
                continue

        raise RuntimeError(f"Groq API unavailable. Last error: {last_error}")

    # ── Public Methods ────────────────────────────────────────────────────

    def _translate_tamil_to_english(self, tamil_text: str) -> str:
        """
        Translate a Tamil query to English so it can match
        the English knowledge base chunks via RAG retrieval.
        Fast, single-turn call with low token count.
        """
        try:
            result = self._call_llm(
                system="You are a translator. Translate the Tamil legal question to English. "
                       "Return ONLY the English translation — no explanation, no extra text.",
                messages=[{"role": "user", "content": tamil_text}],
                max_tokens=120,
                temperature=0.1,
            )
            return result.strip()
        except Exception as e:
            logger.warning(f"[AI] Tamil translation failed: {e} — using original query")
            return tamil_text

    def chat_with_rag(
        self,
        messages: list[dict],
        lang:     str = "english",
    ) -> tuple[str, list[str], bool, float, list[dict]]:
        """
        RAG-augmented chat using retrieved Tamil Nadu legal KB.
        Returns: (response_text, sources, is_fallback, confidence_score, source_details)
        source_details carries {source, verified, last_checked} per citation so the
        API can tell the frontend which sources have been checked against a real
        Act/Order/circular and which are still AI-drafted and unverified.
        """
        rag = get_rag_pipeline()

        # Extract latest user query for retrieval
        user_query = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
        )

        # Translate Tamil query to English for RAG retrieval
        # The KB is in English — Tamil queries need to be translated first
        retrieval_query = user_query
        if lang == "tamil" and any(ord(c) > 0x0B80 for c in user_query):
            retrieval_query = self._translate_tamil_to_english(user_query)
            logger.info(f"[AI] Tamil query translated for retrieval: {retrieval_query[:80]}")

        # Retrieve context from KB
        retrieved_chunks, confidence           = rag.retrieve(retrieval_query)
        context, rag_sources, rag_source_details = rag.format_context(retrieved_chunks)
        is_confident                            = rag.is_confident(confidence)

        # Build system prompt
        if is_confident and context:
            system = CHAT_SYSTEM + SCOPE_RULE + f"\n\nRETRIEVED LEGAL CONTEXT:\n{context}"
            if lang == "tamil":
                system += (
                    "\n\nIMPORTANT: Respond entirely in Tamil (தமிழ்) using simple village-level language. "
                    "Keep technical terms (Patta, Tahsildar, VAO etc.) in English. "
                    "Cite laws in their original form."
                )
        else:
            logger.info(f"[AI] Low confidence ({confidence:.3f}) — using fallback prompt")
            system = FALLBACK_SYSTEM + SCOPE_RULE
            if lang == "tamil":
                system += "\nRespond entirely in Tamil."

        # A failed model call raises RuntimeError. The router turns that into a 502 and
        # the frontend shows a real connection message instead of a fake answer.
        raw = self._call_llm(system, messages, max_tokens=800)

        if OUT_OF_SCOPE_TOKEN in raw:
            return (OUT_OF_SCOPE_MESSAGE["tamil" if lang == "tamil" else "english"], [], False, confidence, [])

        text, llm_srcs = parse_chat_response(raw)
        all_sources    = list(dict.fromkeys(rag_sources + llm_srcs))

        # LLM-only citations (not from the KB) have no verification record —
        # they are always AI-drafted from the model's own knowledge, so they
        # are marked unverified rather than silently omitted.
        known = {d["source"]: d for d in rag_source_details}
        source_details = [
            known.get(s, {"source": s, "verified": False, "last_checked": None})
            for s in all_sources
        ]

        return text, all_sources, not is_confident, confidence, source_details

    def analyze_document(self, text: str, filename: str) -> dict:
        """OCR text → structured JSON document analysis."""
        if len(text.strip()) < 20:
            return {
                "doc_type":   "other",
                "type_label": "Unreadable Document",
                "title":      "Could not extract readable text",
                "confidence": 5,
                "key_info":   ["Text extraction failed — document may be a scanned image with low quality"],
                "dates":      [],
                "warnings":   ["Upload a higher quality scan or photograph"],
                "next_steps": [
                    "Take a clearer photograph in good lighting and upload again",
                    "Call 1516 for manual help if you cannot get a better scan",
                ],
            }

        prompt = (
            f"Filename: {filename}\n\n"
            f"Document text (first 3000 characters):\n---\n{text[:3000]}\n---\n\n"
            "Analyse this Tamil Nadu government document and return the JSON."
        )

        try:
            raw = self._call_llm(
                DOC_ANALYSIS_SYSTEM,
                [{"role": "user", "content": prompt}],
                max_tokens  = 1200,
                temperature = 0.1,   # low temp for structured output
            )
            raw = re.sub(r"```json\s*|\s*```", "", raw).strip()
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error(f"[AI] Document JSON parse error: {e} | raw: {raw[:200]}")
            return {
                "doc_type":   "other",
                "type_label": "Partial Analysis",
                "title":      filename,
                "confidence": 30,
                "key_info":   ["Document was read but structured analysis failed"],
                "dates":      [],
                "warnings":   [],
                "next_steps": [
                    "Try uploading a clearer version of the document",
                    "Call 1516 for free guidance on reading this document",
                ],
            }
        except Exception as e:
            logger.error(f"[AI] analyze_document error: {e}")
            return {
                "doc_type":   "other",
                "type_label": "Analysis Error",
                "title":      filename,
                "confidence": 10,
                "key_info":   ["Analysis temporarily unavailable"],
                "dates":      [],
                "warnings":   [],
                "next_steps": ["Try again in a moment", "Call 1516 for help"],
            }

    def generate_status(self, ref: str, service: str) -> dict:
        """Generate realistic AI status for unknown reference numbers."""
        prompt = (
            f"Reference number: {ref}\n"
            f"Service type: {service}\n"
            "Generate a realistic Tamil Nadu government application status."
        )
        try:
            raw = self._call_llm(
                STATUS_SYSTEM,
                [{"role": "user", "content": prompt}],
                max_tokens  = 400,
                temperature = 0.5,
            )
            raw = re.sub(r"```json\s*|\s*```", "", raw).strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"[AI] generate_status error: {e}")
            return {
                "status":      "pending",
                "heading":     "Application Under Review",
                "explanation": "Your application is being processed by the concerned officer at the Taluk office.",
                "next_step":   "Visit your Taluk office with your acknowledgement receipt after 5 working days.",
                "last_updated":"Today",
                "office":      "Taluk Office",
            }


# ── Singleton ─────────────────────────────────────────────────────────────

_ai_service: Optional[AIService] = None

def get_ai_service() -> AIService:
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
