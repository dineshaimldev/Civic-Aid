#!/usr/bin/env python3
"""
CivicAid — Pre-build FAISS index before deployment.

Run this once before `render deploy` or after editing tn_legal_kb.json.
The pipeline also auto-rebuilds at startup when it detects KB changes
(via MD5 hash comparison), but pre-building here keeps startup fast.

Usage:
    python scripts/build_index.py
    python scripts/build_index.py --force     # force rebuild even if hash matches
"""
import sys
import os
import argparse
import json
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import get_settings
from app.services.rag_pipeline import RAGPipeline, _kb_md5, _write_hash_file
from pathlib import Path

settings = get_settings()


def main():
    parser = argparse.ArgumentParser(description="Build CivicAid FAISS index")
    parser.add_argument("--force", action="store_true", help="Force rebuild even if index is up-to-date")
    args = parser.parse_args()

    kb_path         = Path(settings.knowledge_base_path)
    index_path      = Path(settings.faiss_index_path + ".index")
    embeddings_path = Path(settings.faiss_index_path + ".npy")
    hash_path       = Path(settings.faiss_index_path + ".hash")

    print("=" * 56)
    print("  CivicAid — FAISS Index Builder")
    print("=" * 56)

    # ── Validate KB ──────────────────────────────────────────
    if not kb_path.exists():
        print(f"[ERROR] Knowledge base not found: {kb_path}")
        sys.exit(1)

    with open(kb_path, encoding="utf-8") as f:
        chunks = json.load(f)

    print(f"  KB path       : {kb_path}")
    print(f"  Chunks found  : {len(chunks)}")

    # Category breakdown
    cat_counts: dict[str, int] = {}
    for c in chunks:
        cat = c.get("category", "unknown")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    print("\n  Chunks by category:")
    for cat, n in sorted(cat_counts.items()):
        print(f"    {cat:<35}  {n:>3} chunks")

    # Validate all chunks have required fields
    required = {"id", "category", "title", "content", "source", "keywords"}
    broken = [c.get("id", f"row_{i}") for i, c in enumerate(chunks) if not required.issubset(c.keys())]
    if broken:
        print(f"\n[WARNING] Chunks missing required fields: {broken}")
    else:
        print(f"\n  Schema check  : OK (all {len(chunks)} chunks valid)")

    # ── Check if rebuild needed ──────────────────────────────
    current_hash = _kb_md5(kb_path)
    stored_hash  = hash_path.read_text().strip() if hash_path.exists() else ""
    up_to_date   = (
        current_hash == stored_hash
        and index_path.exists()
        and embeddings_path.exists()
    )

    if up_to_date and not args.force:
        print(f"\n  Index status  : UP TO DATE (KB hash unchanged)")
        print(f"  Index path    : {index_path}")
        print("\n  Nothing to do — use --force to rebuild anyway.")
        print("=" * 56)
        return

    reason = "forced rebuild" if (args.force and up_to_date) else "KB changed or index missing"
    print(f"\n  Index status  : REBUILDING ({reason})")

    # ── Build ────────────────────────────────────────────────
    t0 = time.time()
    pipeline = RAGPipeline()
    pipeline.load()                      # load() detects stale hash and rebuilds
    elapsed = time.time() - t0

    # Write updated hash
    _write_hash_file(hash_path, current_hash)

    print(f"\n  Build time    : {elapsed:.1f}s")
    print(f"  Vectors       : {len(pipeline.chunks)}")
    print(f"  Embedding dim : {pipeline.embeddings.shape[1]}")
    print(f"  Index path    : {index_path}")
    print(f"  Hash stored   : {current_hash[:12]}...")

    # ── Quick sanity retrieval ───────────────────────────────
    print("\n  Sanity check (retrieval test):")
    test_queries = [
        "How do I transfer Patta after father's death?",
        "Neighbour encroaching on my land what to do?",
        "Daughter's inheritance rights in Tamil Nadu",
        "Government acquiring my land LARR Act compensation",
        "How to pay kist land tax online",
    ]
    for q in test_queries:
        chunks_ret, conf = pipeline.retrieve(q, top_k=3)
        top_title = chunks_ret[0]["title"] if chunks_ret else "NO RESULT"
        status    = "✓" if conf >= settings.rag_confidence_threshold else "⚠ low-conf"
        print(f"    [{status}] conf={conf:.3f}  → {top_title[:50]}")

    print("\n" + "=" * 56)
    print("  Build complete. Deploy with confidence.")
    print("=" * 56 + "\n")


if __name__ == "__main__":
    main()
