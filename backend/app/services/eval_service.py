"""
CivicAid Evaluation Service — Journal-grade RAG evaluation
Metrics: Accuracy@K, MRR, NDCG@5, Confidence Rate, Category/Difficulty breakdown
Benchmark: 150 questions across 8 land issue categories
"""
import json
import time
import logging
from pathlib import Path
from typing import Optional
import numpy as np
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Metric helpers
# ──────────────────────────────────────────────

def dcg(relevances: list[float], k: int) -> float:
    """Discounted Cumulative Gain at rank k."""
    relevances = relevances[:k]
    return sum(rel / np.log2(i + 2) for i, rel in enumerate(relevances))


def ndcg_score(chunks: list[dict], expected_keywords: list[str], k: int = 5) -> float:
    """
    NDCG@k — normalised DCG using keyword-hit fraction as relevance signal.
    Each retrieved chunk gets a relevance score = (keywords found in chunk) / (total expected keywords).
    """
    if not chunks or not expected_keywords:
        return 0.0

    relevances = []
    for chunk in chunks[:k]:
        chunk_text = (chunk.get("content", "") + " " + chunk.get("title", "")).lower()
        hits = sum(1 for kw in expected_keywords if kw.lower() in chunk_text)
        relevances.append(hits / len(expected_keywords))

    ideal = sorted(relevances, reverse=True)
    actual_dcg  = dcg(relevances, k)
    ideal_dcg   = dcg(ideal, k)
    return actual_dcg / ideal_dcg if ideal_dcg > 0 else 0.0


def mrr_score(chunks: list[dict], source_contains: str) -> float:
    """MRR — reciprocal rank of first chunk whose source matches expected source string."""
    if not source_contains:
        return 0.0
    for rank, chunk in enumerate(chunks, 1):
        if source_contains.lower() in chunk.get("source", "").lower():
            return 1.0 / rank
    return 0.0


def hit_at_k(chunks: list[dict], expected_keywords: list[str], k: int) -> bool:
    """True if any expected keyword appears in the top-k retrieved chunks."""
    if not chunks or not expected_keywords:
        return False
    top_text = " ".join(
        (c.get("content", "") + " " + c.get("title", "")) for c in chunks[:k]
    ).lower()
    return any(kw.lower() in top_text for kw in expected_keywords)


# ──────────────────────────────────────────────
# Baseline — BM25-only retrieval (no dense vector)
# ──────────────────────────────────────────────

def bm25_only_retrieve(rag, query: str, top_k: int = 5) -> list[dict]:
    """
    Pure BM25 retrieval — used as the ablation baseline.
    Uses the same BM25 corpus as the hybrid pipeline but without
    FAISS dense retrieval or RRF fusion.
    """
    try:
        from rank_bm25 import BM25Okapi
        tokenized_query = query.lower().split()
        scores = rag.bm25.get_scores(tokenized_query)
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [rag.chunks[i] for i in top_indices]
    except Exception:
        return []


def dense_only_retrieve(rag, query: str, top_k: int = 5) -> list[dict]:
    """
    Pure dense (FAISS) retrieval — second ablation baseline.
    """
    try:
        import faiss
        query_vec = rag.model.encode([query], normalize_embeddings=True).astype("float32")
        distances, indices = rag.index.search(query_vec, top_k)
        return [rag.chunks[i] for i in indices[0] if i < len(rag.chunks)]
    except Exception:
        return []


# ──────────────────────────────────────────────
# Singleton accessor
# ──────────────────────────────────────────────

def _get_rag():
    try:
        from app.services.rag_pipeline import get_rag_pipeline
        return get_rag_pipeline()
    except Exception as e:
        logger.error(f"RAG pipeline unavailable: {e}")
        return None


# ──────────────────────────────────────────────
# Main Eval Service
# ──────────────────────────────────────────────

class EvalService:
    def __init__(self):
        self.eval_path = Path(settings.eval_set_path)
        self.questions: list[dict] = []
        self._load_eval_set()

    def _load_eval_set(self):
        if self.eval_path.exists():
            with open(self.eval_path, encoding="utf-8") as f:
                self.questions = json.load(f)
            logger.info(f"[Eval] Loaded {len(self.questions)} benchmark questions")
        else:
            logger.warning(f"[Eval] Benchmark file not found: {self.eval_path}")

    # ──────────────────────────────────────────────
    # Full retrieval evaluation
    # ──────────────────────────────────────────────

    def evaluate_retrieval(self) -> dict:
        """
        Evaluate hybrid RAG retrieval on the 150-question benchmark.
        Returns Accuracy@1/3/5, MRR, NDCG@5, Confidence Rate,
        category-wise breakdown, difficulty-wise breakdown,
        and per-question detail — all suitable for a results table.
        """
        rag = _get_rag()
        if not rag:
            return {"error": "RAG pipeline not available"}
        if not self.questions:
            return {"error": "Benchmark questions not loaded"}

        results          = []
        hits_at_1        = 0
        hits_at_3        = 0
        hits_at_5        = 0
        total_mrr        = 0.0
        total_ndcg       = 0.0
        confident_count  = 0
        total_latency_ms = 0.0

        for q in self.questions:
            qid       = q["id"]
            question  = q["question"]
            kws       = q.get("expected_keywords", [])
            src       = q.get("expected_source_contains", "")
            category  = q.get("category", "unknown")
            difficulty= q.get("difficulty", "medium")

            t0 = time.time()
            chunks, confidence = rag.retrieve(question, top_k=5)
            latency = (time.time() - t0) * 1000

            h1 = hit_at_k(chunks, kws, 1)
            h3 = hit_at_k(chunks, kws, 3)
            h5 = hit_at_k(chunks, kws, 5)
            if h1: hits_at_1 += 1
            if h3: hits_at_3 += 1
            if h5: hits_at_5 += 1

            mrr   = mrr_score(chunks, src)
            ndcg  = ndcg_score(chunks, kws, k=5)
            total_mrr        += mrr
            total_ndcg       += ndcg
            total_latency_ms += latency

            if confidence >= settings.rag_confidence_threshold:
                confident_count += 1

            results.append({
                "id":         qid,
                "category":   category,
                "difficulty": difficulty,
                "confidence": round(confidence, 4),
                "hit_at_1":   h1,
                "hit_at_3":   h3,
                "hit_at_5":   h5,
                "mrr":        round(mrr, 4),
                "ndcg_at_5":  round(ndcg, 4),
                "latency_ms": round(latency, 1),
                "top_chunk_id": chunks[0]["id"] if chunks else None,
            })

        n = len(self.questions)

        # ── Category-level breakdown ──
        cat_stats: dict[str, dict] = {}
        for r in results:
            cat = r["category"]
            if cat not in cat_stats:
                cat_stats[cat] = {"h1": 0, "h5": 0, "mrr": 0.0, "ndcg": 0.0, "total": 0}
            cat_stats[cat]["h1"]    += int(r["hit_at_1"])
            cat_stats[cat]["h5"]    += int(r["hit_at_5"])
            cat_stats[cat]["mrr"]   += r["mrr"]
            cat_stats[cat]["ndcg"]  += r["ndcg_at_5"]
            cat_stats[cat]["total"] += 1

        category_metrics = {}
        for cat, s in cat_stats.items():
            t = s["total"]
            category_metrics[cat] = {
                "questions":      t,
                "accuracy_at_1":  round(s["h1"]   / t, 3),
                "accuracy_at_5":  round(s["h5"]   / t, 3),
                "mean_mrr":       round(s["mrr"]  / t, 3),
                "mean_ndcg_at_5": round(s["ndcg"] / t, 3),
            }

        # ── Difficulty-level breakdown ──
        diff_stats: dict[str, dict] = {}
        for r in results:
            d = r["difficulty"]
            if d not in diff_stats:
                diff_stats[d] = {"h1": 0, "h5": 0, "total": 0}
            diff_stats[d]["h1"]    += int(r["hit_at_1"])
            diff_stats[d]["h5"]    += int(r["hit_at_5"])
            diff_stats[d]["total"] += 1

        difficulty_metrics = {
            d: {
                "questions":     s["total"],
                "accuracy_at_1": round(s["h1"] / s["total"], 3),
                "accuracy_at_5": round(s["h5"] / s["total"], 3),
            }
            for d, s in diff_stats.items()
        }

        return {
            "benchmark": "150-question land-issues benchmark",
            "total_questions": n,
            "metrics": {
                "accuracy_at_1":   round(hits_at_1 / n, 4),
                "accuracy_at_3":   round(hits_at_3 / n, 4),
                "accuracy_at_5":   round(hits_at_5 / n, 4),
                "mean_mrr":        round(total_mrr  / n, 4),
                "mean_ndcg_at_5":  round(total_ndcg / n, 4),
                "confidence_rate": round(confident_count / n, 4),
                "avg_latency_ms":  round(total_latency_ms / n, 1),
            },
            "by_category":   category_metrics,
            "by_difficulty": difficulty_metrics,
            "detailed_results": results,
        }

    # ──────────────────────────────────────────────
    # Ablation study — Hybrid vs BM25-only vs Dense-only
    # ──────────────────────────────────────────────

    def evaluate_rag_vs_baseline(self) -> dict:
        """
        Three-way ablation study for paper results table:
          System A — Hybrid RAG (Dense + BM25 + RRF)   ← our system
          System B — BM25-only sparse retrieval          ← ablation 1
          System C — Dense-only (FAISS cosine)           ← ablation 2

        All three use identical top-5 retrieval and the same eval set.
        This fixes the original baseline bug where the keyword baseline
        checked the entire corpus (always 100%) rather than top-K only.
        """
        rag = _get_rag()
        if not rag or not self.questions:
            return {"error": "Not available"}

        hybrid_h5    = 0
        bm25_h5      = 0
        dense_h5     = 0
        hybrid_mrr   = 0.0
        bm25_mrr     = 0.0
        dense_mrr    = 0.0
        hybrid_ndcg  = 0.0
        bm25_ndcg    = 0.0
        dense_ndcg   = 0.0

        per_question = []

        for q in self.questions:
            kws = q.get("expected_keywords", [])
            src = q.get("expected_source_contains", "")

            # System A — Hybrid
            hybrid_chunks, _ = rag.retrieve(q["question"], top_k=5)
            h_h5   = hit_at_k(hybrid_chunks, kws, 5)
            h_mrr  = mrr_score(hybrid_chunks, src)
            h_ndcg = ndcg_score(hybrid_chunks, kws, 5)

            # System B — BM25-only
            bm25_chunks = bm25_only_retrieve(rag, q["question"], top_k=5)
            b_h5   = hit_at_k(bm25_chunks, kws, 5)
            b_mrr  = mrr_score(bm25_chunks, src)
            b_ndcg = ndcg_score(bm25_chunks, kws, 5)

            # System C — Dense-only
            dense_chunks = dense_only_retrieve(rag, q["question"], top_k=5)
            d_h5   = hit_at_k(dense_chunks, kws, 5)
            d_mrr  = mrr_score(dense_chunks, src)
            d_ndcg = ndcg_score(dense_chunks, kws, 5)

            if h_h5: hybrid_h5 += 1
            if b_h5: bm25_h5   += 1
            if d_h5: dense_h5  += 1
            hybrid_mrr  += h_mrr;  bm25_mrr  += b_mrr;  dense_mrr  += d_mrr
            hybrid_ndcg += h_ndcg; bm25_ndcg += b_ndcg; dense_ndcg += d_ndcg

            per_question.append({
                "id":          q["id"],
                "category":    q.get("category"),
                "difficulty":  q.get("difficulty"),
                "hybrid_hit":  h_h5,
                "bm25_hit":    b_h5,
                "dense_hit":   d_h5,
            })

        n = len(self.questions)

        def _metrics(h5, mrr, ndcg_sum):
            return {
                "accuracy_at_5":  round(h5 / n, 4),
                "mean_mrr":       round(mrr / n, 4),
                "mean_ndcg_at_5": round(ndcg_sum / n, 4),
            }

        hybrid_m = _metrics(hybrid_h5, hybrid_mrr, hybrid_ndcg)
        bm25_m   = _metrics(bm25_h5,   bm25_mrr,   bm25_ndcg)
        dense_m  = _metrics(dense_h5,  dense_mrr,  dense_ndcg)

        return {
            "questions_evaluated": n,
            "systems": {
                "hybrid_rag (Dense+BM25+RRF)": hybrid_m,
                "bm25_only":                   bm25_m,
                "dense_only":                  dense_m,
            },
            "delta_hybrid_vs_bm25": {
                "accuracy_at_5":  round(hybrid_m["accuracy_at_5"]  - bm25_m["accuracy_at_5"],  4),
                "mean_mrr":       round(hybrid_m["mean_mrr"]        - bm25_m["mean_mrr"],        4),
                "mean_ndcg_at_5": round(hybrid_m["mean_ndcg_at_5"] - bm25_m["mean_ndcg_at_5"], 4),
            },
            "delta_hybrid_vs_dense": {
                "accuracy_at_5":  round(hybrid_m["accuracy_at_5"]  - dense_m["accuracy_at_5"],  4),
                "mean_mrr":       round(hybrid_m["mean_mrr"]        - dense_m["mean_mrr"],        4),
                "mean_ndcg_at_5": round(hybrid_m["mean_ndcg_at_5"] - dense_m["mean_ndcg_at_5"], 4),
            },
            "note": "Baseline = top-5 retrieval only (not full corpus). Fixes prior corpus-wide keyword baseline bug.",
            "per_question": per_question,
        }

    # ──────────────────────────────────────────────
    # Category coverage check
    # ──────────────────────────────────────────────

    def coverage_report(self) -> dict:
        """
        Reports how many KB chunks exist per category and
        how many eval questions target each category.
        Useful for identifying underserved categories.
        """
        rag = _get_rag()
        kb_by_cat: dict[str, int] = {}
        if rag and rag.chunks:
            for chunk in rag.chunks:
                cat = chunk.get("category", "unknown")
                kb_by_cat[cat] = kb_by_cat.get(cat, 0) + 1

        eval_by_cat: dict[str, int] = {}
        for q in self.questions:
            cat = q.get("category", "unknown")
            eval_by_cat[cat] = eval_by_cat.get(cat, 0) + 1

        all_cats = sorted(set(list(kb_by_cat.keys()) + list(eval_by_cat.keys())))
        coverage = []
        for cat in all_cats:
            kb_count   = kb_by_cat.get(cat, 0)
            eval_count = eval_by_cat.get(cat, 0)
            coverage.append({
                "category":        cat,
                "kb_chunks":       kb_count,
                "eval_questions":  eval_count,
                "ratio":           round(eval_count / kb_count, 2) if kb_count else None,
            })

        return {
            "total_kb_chunks":       sum(kb_by_cat.values()),
            "total_eval_questions":  len(self.questions),
            "by_category":           coverage,
        }


# ──────────────────────────────────────────────
# Singleton
# ──────────────────────────────────────────────

_eval_service: Optional[EvalService] = None

def get_eval_service() -> EvalService:
    global _eval_service
    if _eval_service is None:
        _eval_service = EvalService()
    return _eval_service
