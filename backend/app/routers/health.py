import logging
from fastapi import APIRouter
from app.models.schemas import HealthResponse
from app.services.cache_service import get_cache
from app.core.config import get_settings

router   = APIRouter(prefix="/api", tags=["health"])
settings = get_settings()
logger   = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse)
async def health():
    """Basic health check — returns status of API, cache, and AI keys."""
    cache = get_cache()

    # RAG status
    try:
        from app.services.rag_pipeline import get_rag_pipeline
        rag       = get_rag_pipeline()
        rag_status = f"ok ({len(rag.chunks)} chunks)" if rag._loaded else "not loaded"
    except Exception as e:
        rag_status = f"error: {e}"

    return HealthResponse(
        status   = "ok",
        version  = settings.app_version,
        env      = settings.app_env,
        services = {
            "api":   "ok",
            "cache": "ok" if not cache._use_memory else "memory_fallback",
            "ai":    "ok" if (settings.anthropic_api_key or settings.groq_api_key) else "no_key",
            "rag":   rag_status,
        },
    )


@router.get("/metadata")
async def metadata():
    """Project metadata — version, KB stats, model config."""
    import json
    from pathlib import Path
    meta_path = Path("app/data/metadata.json")
    if meta_path.exists():
        return json.loads(meta_path.read_text(encoding="utf-8"))
    return {"error": "metadata.json not found"}


@router.get("/stats")
async def stats():
    """Usage counters + RAG pipeline stats."""
    cache = get_cache()

    # Usage counters
    usage = {
        "chat_requests":      cache.get("stats:chat_count")     or 0,
        "document_analyses":  cache.get("stats:document_count") or 0,
        "status_checks":      cache.get("stats:status_count")   or 0,
    }

    # RAG pipeline stats
    rag_stats: dict = {}
    try:
        from app.services.rag_pipeline import get_rag_pipeline
        rag       = get_rag_pipeline()
        rag_stats = rag.stats() if rag._loaded else {"status": "not loaded"}
    except Exception as e:
        rag_stats = {"status": f"error: {e}"}

    return {
        "usage":    usage,
        "pipeline": rag_stats,
    }
