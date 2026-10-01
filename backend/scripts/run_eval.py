#!/usr/bin/env python3
"""
CivicAid — Run evaluation benchmark.
Usage: python scripts/run_eval.py
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.rag_pipeline import get_rag_pipeline
from app.services.eval_service import EvalService

# ── Load pipeline ──────────────────────────────────────────
print("Loading RAG pipeline...")
rag = get_rag_pipeline()
print(f"  Chunks loaded : {len(rag.chunks)}")

ev = EvalService()
print(f"  Benchmark     : {len(ev.questions)} questions\n")

# ── Full retrieval eval ────────────────────────────────────
print("Running retrieval evaluation...")
results = ev.evaluate_retrieval()
m = results["metrics"]

W = 52
print("\n" + "=" * W)
print("  CIVICAID RAG — RETRIEVAL EVALUATION RESULTS")
print("=" * W)
print(f"  Benchmark           : {results['benchmark']}")
print(f"  Questions evaluated : {results['total_questions']}")
print("-" * W)
print(f"  Accuracy@1          : {m['accuracy_at_1']:.1%}")
print(f"  Accuracy@3          : {m['accuracy_at_3']:.1%}")
print(f"  Accuracy@5          : {m['accuracy_at_5']:.1%}")
print(f"  Mean MRR            : {m['mean_mrr']:.4f}")
print(f"  Mean NDCG@5         : {m['mean_ndcg_at_5']:.4f}")
print(f"  Confidence Rate     : {m['confidence_rate']:.1%}")
print(f"  Avg Latency (ms)    : {m['avg_latency_ms']:.1f}")
print("-" * W)

print("\n  By Category:")
print(f"  {'Category':<30} {'Acc@1':>6}  {'Acc@5':>6}  {'MRR':>6}  {'NDCG@5':>7}  {'Qs':>4}")
print(f"  {'-'*30}  {'-'*6}  {'-'*6}  {'-'*6}  {'-'*7}  {'-'*4}")
for cat, cm in sorted(results["by_category"].items()):
    print(
        f"  {cat:<30}  {cm['accuracy_at_1']:>5.1%}  {cm['accuracy_at_5']:>5.1%}"
        f"  {cm['mean_mrr']:>5.3f}  {cm['mean_ndcg_at_5']:>6.3f}  {cm['questions']:>4}"
    )

print("\n  By Difficulty:")
print(f"  {'Difficulty':<12}  {'Acc@1':>6}  {'Acc@5':>6}  {'Qs':>4}")
print(f"  {'-'*12}  {'-'*6}  {'-'*6}  {'-'*4}")
for diff, dm in sorted(results["by_difficulty"].items()):
    print(
        f"  {diff:<12}  {dm['accuracy_at_1']:>5.1%}  {dm['accuracy_at_5']:>5.1%}  {dm['questions']:>4}"
    )

# ── Ablation study ─────────────────────────────────────────
print("\n" + "=" * W)
print("  ABLATION STUDY — Hybrid vs BM25-only vs Dense-only")
print("=" * W)
print("  Running three-way comparison (top-5 retrieval each)...")
ablation = ev.evaluate_rag_vs_baseline()
sys_results = ablation["systems"]

print(f"\n  {'System':<35}  {'Acc@5':>6}  {'MRR':>6}  {'NDCG@5':>7}")
print(f"  {'-'*35}  {'-'*6}  {'-'*6}  {'-'*7}")
for sys_name, sm in sys_results.items():
    print(
        f"  {sys_name:<35}  {sm['accuracy_at_5']:>5.1%}"
        f"  {sm['mean_mrr']:>5.3f}  {sm['mean_ndcg_at_5']:>6.3f}"
    )

print(f"\n  Delta (Hybrid vs BM25-only):")
d1 = ablation["delta_hybrid_vs_bm25"]
print(f"    Acc@5:   +{d1['accuracy_at_5']:.1%}")
print(f"    MRR:     +{d1['mean_mrr']:.4f}")
print(f"    NDCG@5:  +{d1['mean_ndcg_at_5']:.4f}")

print(f"\n  Delta (Hybrid vs Dense-only):")
d2 = ablation["delta_hybrid_vs_dense"]
print(f"    Acc@5:   +{d2['accuracy_at_5']:.1%}")
print(f"    MRR:     +{d2['mean_mrr']:.4f}")
print(f"    NDCG@5:  +{d2['mean_ndcg_at_5']:.4f}")

print(f"\n  Note: {ablation['note']}")

# ── Coverage report ────────────────────────────────────────
print("\n" + "=" * W)
print("  KNOWLEDGE BASE COVERAGE REPORT")
print("=" * W)
cov = ev.coverage_report()
print(f"  Total KB chunks     : {cov['total_kb_chunks']}")
print(f"  Total eval questions: {cov['total_eval_questions']}")
print(f"\n  {'Category':<30}  {'KB Chunks':>9}  {'Eval Qs':>7}  {'Q/Chunk':>8}")
print(f"  {'-'*30}  {'-'*9}  {'-'*7}  {'-'*8}")
for row in cov["by_category"]:
    ratio = f"{row['ratio']:.2f}" if row["ratio"] is not None else "  N/A"
    print(
        f"  {row['category']:<30}  {row['kb_chunks']:>9}  "
        f"{row['eval_questions']:>7}  {ratio:>8}"
    )

# ── Save outputs ───────────────────────────────────────────
output = {
    "retrieval_eval": results,
    "ablation_study": ablation,
    "coverage":       cov,
}
out_path = os.path.join(os.path.dirname(__file__), "..", "eval_results.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print("\n" + "=" * W)
print(f"  Full results saved → eval_results.json")
print("=" * W + "\n")
