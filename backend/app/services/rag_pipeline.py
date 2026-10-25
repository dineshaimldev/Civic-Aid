"""
CivicAid RAG Pipeline — Hybrid BM25 + Dense Retrieval with auto-invalidation
Journal-grade: Reciprocal Rank Fusion, confidence scoring,
multilingual embeddings, stale-index detection, and per-category stats.
"""
import json
import hashlib
import logging
from pathlib import Path
from typing import Any, Optional

import faiss
import numpy as np
from rank_bm25 import BM25Okapi

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Reciprocal Rank Fusion
# ─────────────────────────────────────────────────────────────
def reciprocal_rank_fusion(
    dense_ranks: list[tuple[int, float]],
    bm25_ranks:  list[tuple[int, float]],
    k:            int   = 60,
    dense_weight: float = 0.7,
    bm25_weight:  float = 0.3,
) -> list[tuple[int, float]]:
    """
    Combines dense and sparse retrieval via Reciprocal Rank Fusion.
    RRF score = Σ weight_i / (k + rank_i)
    Reference: Cormack et al., SIGIR 2009.
    """
    scores: dict[int, float] = {}
    for rank, (doc_id, _) in enumerate(dense_ranks):
        scores[doc_id] = scores.get(doc_id, 0.0) + dense_weight / (k + rank + 1)
    for rank, (doc_id, _) in enumerate(bm25_ranks):
        scores[doc_id] = scores.get(doc_id, 0.0) + bm25_weight  / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


# ─────────────────────────────────────────────────────────────
# KB hash — detects when knowledge base changes on disk
# ─────────────────────────────────────────────────────────────
def _kb_md5(kb_path: Path) -> str:
    """MD5 of the raw knowledge base file bytes."""
    h = hashlib.md5()
    with open(kb_path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            h.update(block)
    return h.hexdigest()


def _read_hash_file(hash_path: Path) -> str:
    return hash_path.read_text().strip() if hash_path.exists() else ""


def _write_hash_file(hash_path: Path, digest: str):
    hash_path.write_text(digest)


# ─────────────────────────────────────────────────────────────
# RAG Pipeline
# ─────────────────────────────────────────────────────────────
class RAGPipeline:
    """
    Production RAG pipeline for Tamil Nadu legal domain.

    Architecture:
      1. Query → multilingual-MiniLM-L12-v2 embedding  (dense)
      2. Query → BM25Okapi tokenised search             (sparse)
      3. Hybrid fusion via RRF (dense 0.7 / BM25 0.3)
      4. Confidence gate — max dense score < 0.35 → fallback prompt
      5. Context formatted for LLM with source citations

    Index auto-rebuilds when tn_legal_kb.json changes on disk
    (MD5 hash written to <index>.hash).
    """

    def __init__(self):
        self.model:      Optional[Any] = None
        self.index:      Optional[faiss.IndexFlatIP] = None
        self.bm25:       Optional[BM25Okapi] = None
        self.chunks:     list[dict] = []
        self.embeddings: Optional[np.ndarray] = None
        self._loaded:    bool = False

    # ── public ────────────────────────────────────────────────
    def load(self):
        """Load (or rebuild) embedding model, FAISS index, BM25 index."""
        if self._loaded:
            return

        logger.info("[RAG] Starting pipeline load...")

        try:
            from sentence_transformers import SentenceTransformer
        except Exception as exc:
            logger.warning("[RAG] sentence-transformers import failed: %s", exc)
            return

        # 1 — Knowledge base
        kb_path = Path(settings.knowledge_base_path)
        if not kb_path.exists():
            logger.error(f"[RAG] Knowledge base not found: {kb_path}")
            return

        with open(kb_path, encoding="utf-8") as f:
            self.chunks = json.load(f)
        logger.info(f"[RAG] Loaded {len(self.chunks)} KB chunks")

        # 2 — Embedding model
        logger.info(f"[RAG] Loading model: {settings.embedding_model}")
        try:
            self.model = SentenceTransformer(settings.embedding_model)
        except Exception as exc:
            logger.warning("[RAG] embedding model failed to initialize: %s", exc)
            return

        # 3 — FAISS index (rebuild if KB changed or index missing)
        index_path      = Path(settings.faiss_index_path + ".index")
        embeddings_path = Path(settings.faiss_index_path + ".npy")
        hash_path       = Path(settings.faiss_index_path + ".hash")

        current_hash  = _kb_md5(kb_path)
        stored_hash   = _read_hash_file(hash_path)
        index_stale   = (current_hash != stored_hash)
        index_missing = not (index_path.exists() and embeddings_path.exists())

        if index_missing or index_stale:
            reason = "missing" if index_missing else "KB changed — rebuilding"
            logger.info(f"[RAG] FAISS index {reason}...")
            self._build_faiss_index(index_path, embeddings_path)
            _write_hash_file(hash_path, current_hash)
        else:
            logger.info("[RAG] Loading cached FAISS index")
            self.index      = faiss.read_index(str(index_path))
            self.embeddings = np.load(str(embeddings_path))

        # 4 — BM25 index (always rebuilt in-memory — cheap)
        tokenised_corpus = [
            (
                chunk.get("content", "") + " " +
                chunk.get("title",   "") + " " +
                " ".join(chunk.get("keywords", []))
            ).lower().split()
            for chunk in self.chunks
        ]
        self.bm25 = BM25Okapi(tokenised_corpus)

        self._loaded = True
        logger.info(
            f"[RAG] Pipeline ready — {len(self.chunks)} chunks, "
            f"{self.embeddings.shape[1]}D embeddings"
        )

    def retrieve(
        self,
        query:  str,
        top_k:  int | None = None,
    ) -> tuple[list[dict], float]:
        """
        Hybrid retrieval: Dense + BM25 → RRF fusion.

        Returns:
            chunks    — top-k ranked dicts (with _rrf_score, _dense_score)
            confidence — max dense cosine score (used for fallback gating)
        """
        if not self._loaded:
            self.load()
        if not self._loaded:
            return [], 0.0

        top_k       = top_k or settings.rag_top_k
        fetch_k     = min(top_k * 3, len(self.chunks))   # wider net before fusion
        query_lower = query.lower()

        # ── Dense (FAISS cosine) ──────────────────────────────
        query_vec = self.model.encode(
            [query], normalize_embeddings=True
        ).astype(np.float32)
        raw_scores, raw_indices = self.index.search(query_vec, fetch_k)
        dense_ranks = [
            (int(raw_indices[0][i]), float(raw_scores[0][i]))
            for i in range(len(raw_indices[0]))
            if raw_indices[0][i] >= 0
        ]

        # ── Sparse (BM25) ─────────────────────────────────────
        tokens      = query_lower.split()
        bm25_scores = self.bm25.get_scores(tokens)
        bm25_ranks  = sorted(
            enumerate(bm25_scores), key=lambda x: x[1], reverse=True
        )[:fetch_k]
        bm25_ranks  = [(idx, s) for idx, s in bm25_ranks if s > 0]

        # ── RRF Fusion ────────────────────────────────────────
        fused = reciprocal_rank_fusion(
            dense_ranks, bm25_ranks,
            dense_weight=settings.dense_weight,
            bm25_weight=settings.bm25_weight,
        )

        # ── Build result list ─────────────────────────────────
        dense_score_map = {doc_id: s for doc_id, s in dense_ranks}
        results: list[dict] = []
        for doc_id, rrf_score in fused[:top_k]:
            if 0 <= doc_id < len(self.chunks):
                chunk = dict(self.chunks[doc_id])
                chunk["_rrf_score"]   = round(rrf_score, 6)
                chunk["_dense_score"] = round(dense_score_map.get(doc_id, 0.0), 4)
                results.append(chunk)

        max_dense = dense_ranks[0][1] if dense_ranks else 0.0
        return results, float(max_dense)

    def retrieve_with_scores(
        self,
        query:  str,
        top_k:  int | None = None,
    ) -> tuple[list[dict], float]:
        """
        Same hybrid retrieval as retrieve(), but returns the per-chunk
        score breakdown instead of the raw chunk dicts — powers the
        "Why this answer?" explainability panel.

        Returns:
            chunks     — list of {title, source, verified, bm25_score,
                         dense_score, rrf_score, rank} for the fused top-k
            confidence — max dense cosine score (same definition as retrieve())
        """
        if not self._loaded:
            self.load()
        if not self._loaded:
            return [], 0.0

        top_k       = top_k or settings.rag_top_k
        fetch_k     = min(top_k * 3, len(self.chunks))
        query_lower = query.lower()

        # ── Dense (FAISS cosine) ──────────────────────────────
        query_vec = self.model.encode(
            [query], normalize_embeddings=True
        ).astype(np.float32)
        raw_scores, raw_indices = self.index.search(query_vec, fetch_k)
        dense_ranks = [
            (int(raw_indices[0][i]), float(raw_scores[0][i]))
            for i in range(len(raw_indices[0]))
            if raw_indices[0][i] >= 0
        ]
        dense_score_map = {doc_id: s for doc_id, s in dense_ranks}

        # ── Sparse (BM25) ─────────────────────────────────────
        tokens          = query_lower.split()
        bm25_scores     = self.bm25.get_scores(tokens)
        bm25_score_map  = {i: float(s) for i, s in enumerate(bm25_scores)}
        bm25_ranks      = sorted(
            enumerate(bm25_scores), key=lambda x: x[1], reverse=True
        )[:fetch_k]
        bm25_ranks      = [(idx, s) for idx, s in bm25_ranks if s > 0]

        # ── RRF Fusion ────────────────────────────────────────
        fused = reciprocal_rank_fusion(
            dense_ranks, bm25_ranks,
            dense_weight=settings.dense_weight,
            bm25_weight=settings.bm25_weight,
        )

        results: list[dict] = []
        for rank, (doc_id, rrf_score) in enumerate(fused[:top_k], 1):
            if 0 <= doc_id < len(self.chunks):
                chunk = self.chunks[doc_id]
                results.append({
                    "title":       chunk.get("title", ""),
                    "source":      chunk.get("source", ""),
                    "verified":    bool(chunk.get("verified", False)),
                    "bm25_score":  round(bm25_score_map.get(doc_id, 0.0), 4),
                    "dense_score": round(dense_score_map.get(doc_id, 0.0), 4),
                    "rrf_score":   round(rrf_score, 6),
                    "rank":        rank,
                })

        max_dense = dense_ranks[0][1] if dense_ranks else 0.0
        return results, float(max_dense)

    def format_context(self, chunks: list[dict]) -> tuple[str, list[str], list[dict]]:
        """
        Format retrieved chunks as a numbered LLM context block.
        Returns (context_string, deduplicated_source_list, source_detail_list).
        source_detail_list carries verified/last_checked per source so the
        API and UI can show which citations have been checked against a
        real Act, Revenue Standing Order, or circular, versus AI-drafted
        content that has not yet been verified.
        """
        if not chunks:
            return "", [], []

        parts:   list[str] = []
        sources: list[str] = []
        details: list[dict] = []

        for i, chunk in enumerate(chunks, 1):
            parts.append(
                f"[Source {i}] {chunk['title']}\n"
                f"{chunk['content']}\n"
                f"Legal reference: {chunk['source']}\n"
                f"Verification status: {'verified against a primary source' if chunk.get('verified') else 'not independently verified'}"
            )
            sources.append(chunk["source"])
            details.append({
                "source": chunk["source"],
                "verified": bool(chunk.get("verified", False)),
                "last_checked": chunk.get("last_checked"),
            })

        # Deduplicate sources preserving order (and matching details)
        seen: set[str] = set()
        unique_sources: list[str] = []
        unique_details: list[dict] = []
        for s, d in zip(sources, details):
            if s not in seen:
                seen.add(s)
                unique_sources.append(s)
                unique_details.append(d)

        return "\n\n".join(parts), unique_sources, unique_details

    def is_confident(self, confidence: float) -> bool:
        """True if max dense score meets the confidence threshold."""
        return confidence >= settings.rag_confidence_threshold

    def stats(self) -> dict:
        """Runtime stats for the /api/health and /api/stats endpoints."""
        cat_counts: dict[str, int] = {}
        for chunk in self.chunks:
            cat = chunk.get("category", "unknown")
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

        return {
            "total_chunks":        len(self.chunks),
            "embedding_model":     settings.embedding_model,
            "embedding_dim":       int(self.embeddings.shape[1]) if self.embeddings is not None else 0,
            "index_type":          "IndexFlatIP (cosine)",
            "bm25_ready":          self.bm25 is not None,
            "dense_weight":        settings.dense_weight,
            "bm25_weight":         settings.bm25_weight,
            "confidence_threshold":settings.rag_confidence_threshold,
            "top_k":               settings.rag_top_k,
            "chunks_by_category":  cat_counts,
        }

    # ── private ───────────────────────────────────────────────
    def _build_faiss_index(self, index_path: Path, embeddings_path: Path):
        """Encode all chunks and build + persist FAISS IndexFlatIP."""
        texts = [
            f"{c['title']}. {c['content']} {' '.join(c.get('keywords', []))}"
            for c in self.chunks
        ]
        logger.info(f"[RAG] Encoding {len(texts)} chunks...")
        self.embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=True,
            batch_size=32,
        ).astype(np.float32)

        dim = self.embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(self.embeddings)

        index_path.parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(index_path))
        np.save(str(embeddings_path), self.embeddings)
        logger.info(
            f"[RAG] FAISS index saved — {dim}D × {len(self.chunks)} vectors"
        )


# ─────────────────────────────────────────────────────────────
# Singleton
# ─────────────────────────────────────────────────────────────
_pipeline: Optional[RAGPipeline] = None

def get_rag_pipeline() -> RAGPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = RAGPipeline()
        _pipeline.load()
    return _pipeline
