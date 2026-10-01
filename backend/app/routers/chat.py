import uuid
import logging
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import ChatRequest, ChatResponse
from app.services.ai_service import get_ai_service
from app.services.cache_service import get_cache
from app.core.config import get_settings

router   = APIRouter(prefix="/api/chat", tags=["chat"])
logger   = logging.getLogger(__name__)
settings = get_settings()
limiter  = Limiter(key_func=get_remote_address)


@router.post("", response_model=ChatResponse)
@limiter.limit(settings.rate_limit_chat)
async def chat(request: Request, body: ChatRequest):
    user_messages = [m for m in body.messages if m.role == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user message found.")

    last_msg = user_messages[-1].content.strip()
    if len(last_msg) < 2:
        raise HTTPException(status_code=400, detail="Message too short.")

    cache     = get_cache()
    cache_key = f"chat:{hash(last_msg + body.lang)}"

    # Return cached response for identical single-turn queries
    if len(body.messages) == 1:
        cached = cache.get(cache_key)
        if cached:
            return ChatResponse(**cached)

    api_messages = [{"role": m.role.value, "content": m.content} for m in body.messages]
    ai = get_ai_service()

    try:
        text, sources, is_fallback, confidence, source_details = ai.chat_with_rag(api_messages, lang=body.lang)
    except RuntimeError as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(status_code=502, detail="AI temporarily unavailable. Please try again.")

    session_id = body.session_id or str(uuid.uuid4())
    result     = ChatResponse(
        text           = text,
        sources        = sources,
        source_details = source_details,
        is_fallback    = is_fallback,
        confidence     = round(confidence, 4),
        session_id     = session_id,
    )

    if len(body.messages) == 1 and not is_fallback:
        cache.set(cache_key, result.model_dump(), ttl=300)

    cache.increment("stats:chat_count")
    return result
