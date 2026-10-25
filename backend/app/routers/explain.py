import logging
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.schemas import ExplainRequest, ExplainResponse, RetrievedChunkExplain
from app.services.rag_pipeline import get_rag_pipeline
from app.core.config import get_settings

router   = APIRouter(prefix="/api/explain", tags=["explain"])
logger   = logging.getLogger(__name__)
settings = get_settings()
limiter  = Limiter(key_func=get_remote_address)


@router.post("", response_model=ExplainResponse)
@limiter.limit(settings.rate_limit_chat)
async def explain_retrieval(request: Request, body: ExplainRequest):
    """
    Returns the retrieval breakdown for a question — same input as
    /api/chat, but exposes BM25, dense, and fused (RRF) scores per
    chunk instead of generating an LLM answer. Powers the "Why this
    answer?" panel so people can see which chunks were retrieved,
    their scores, and whether each source has been verified against
    the official text.
    """
    question = body.question.strip()
    if len(question) < 2:
        raise HTTPException(status_code=400, detail="Question too short.")

    pipeline = get_rag_pipeline()
    try:
        raw_chunks, confidence = pipeline.retrieve_with_scores(question)
    except Exception as e:
        logger.error(f"Explain retrieval error: {e}")
        raise HTTPException(status_code=502, detail="Could not run retrieval. Please try again.")

    return ExplainResponse(
        question=question,
        chunks=[RetrievedChunkExplain(**c) for c in raw_chunks],
        confidence=round(confidence, 4),
        is_confident=pipeline.is_confident(confidence),
    )
