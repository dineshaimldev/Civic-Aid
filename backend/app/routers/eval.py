import logging
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.services.eval_service import get_eval_service

router  = APIRouter(prefix="/api/eval", tags=["evaluation"])
logger  = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


@router.get("/retrieval")
@limiter.limit("2/hour")
async def run_retrieval_eval(request: Request):
    """
    Full retrieval evaluation on the 150-question land-issues benchmark.
    Returns Accuracy@1/3/5, MRR, NDCG@5, Confidence Rate,
    per-category and per-difficulty breakdown.
    Rate limited to 2/hour — expensive operation.
    """
    try:
        ev = get_eval_service()
        return ev.evaluate_retrieval()
    except Exception as e:
        logger.error(f"Eval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rag-vs-baseline")
@limiter.limit("2/hour")
async def rag_vs_baseline(request: Request):
    """
    Three-way ablation study:
      - Hybrid RAG  (Dense + BM25 + RRF)   ← our system
      - BM25-only   (sparse baseline)
      - Dense-only  (FAISS cosine baseline)
    All use top-5 retrieval on the same 150-question set.
    Rate limited to 2/hour — expensive operation.
    """
    try:
        ev = get_eval_service()
        return ev.evaluate_rag_vs_baseline()
    except Exception as e:
        logger.error(f"Ablation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/coverage")
@limiter.limit("10/minute")
async def coverage_report(request: Request):
    """
    KB chunks vs eval questions per category.
    Use to spot underserved categories before paper submission.
    """
    try:
        ev = get_eval_service()
        return ev.coverage_report()
    except Exception as e:
        logger.error(f"Coverage error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
