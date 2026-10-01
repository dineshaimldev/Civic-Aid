# CivicAid — Village Legal & Government Assistance Platform

> "Let everyone understand the law"

Free AI-powered legal and government assistance for Tamil Nadu village residents. Bilingual (Tamil + English), voice-enabled, works offline for procedure guides.

---

## Stage 1 — Complete Land Issues (Current)

CivicAid Stage 1 focuses entirely on the 8 most common land-related legal issues faced by Tamil Nadu village residents:

| Category | Coverage |
|---|---|
| Patta Transfer | 10 KB chunks — inheritance, purchase, gift deed, partition, fraud |
| Land Records | Patta, Chitta, Adangal, FMB, EC, A-Register |
| Land Disputes | Encroachment, fraud, adverse possession, benami, Lok Adalat |
| Land Classification | Nanjai/Punjai, Poromboke, Natham, conversion |
| Inheritance | Legal heir cert, succession cert, Hindu Succession Act, women's rights |
| Land Acquisition | LARR Act, compensation, urgency clause, LARRA appeals |
| Land Tax (Kist) | Payment, receipts, correction, arrears |
| Registration | Sale deed, gift deed, release deed, mortgage, POA, cancellation |

---

## Architecture

```
Frontend (React + Vite + TypeScript + TailwindCSS)
    → FastAPI Backend
        → RAG Pipeline (BM25 + FAISS + Reciprocal Rank Fusion)
            → 91 KB Chunks (tn_legal_kb.json)
        → LLM: Claude Sonnet 4.6 (primary) / Groq LLaMA 70B (fallback)
        → OCR: PyPDF2 + Tesseract (Tamil + English)
        → Cache: Redis (in-memory fallback)
```

### RAG Pipeline
- **Dense retrieval**: `paraphrase-multilingual-MiniLM-L12-v2` → FAISS IndexFlatIP (cosine)
- **Sparse retrieval**: BM25Okapi on `content + title + keywords`
- **Fusion**: Reciprocal Rank Fusion (Cormack et al., SIGIR 2009) — dense 0.7 / BM25 0.3
- **Confidence gate**: max dense score < 0.35 → fallback prompt (no context injection)
- **Top-K**: 5 chunks retrieved per query

---

## Features

- **AI Legal Chat** — RAG-augmented answers with legal citations and source chips
- **Document Analysis** — OCR + AI analysis of Patta, FIR notices, sale deeds
- **Procedure Guides** — 5 offline step-by-step government service walkthroughs with progress tracking
- **Application Status Tracker** — 5 demo references + AI generation for unknown refs
- **Voice Input** — Web Speech API (Tamil + English)
- **Bilingual** — Complete English and Tamil UI

---

## Evaluation Benchmark

- **150 questions** across 8 land issue categories
- **3 difficulty levels**: easy (45), medium (65), hard (40)
- **Metrics**: Accuracy@1/3/5, MRR, NDCG@5, Confidence Rate
- **Ablation study**: Hybrid RAG vs BM25-only vs Dense-only

Run: `python scripts/run_eval.py`

---

## Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env           # add ANTHROPIC_API_KEY and GROQ_API_KEY
python scripts/build_index.py  # build FAISS index (run once)
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables (.env)
```
ANTHROPIC_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
APP_ENV=development
REDIS_URL=redis://localhost:6379
TESSERACT_PATH=/usr/bin/tesseract
# Windows: TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | RAG chat — 20/min rate limit |
| POST | `/api/document/analyze` | OCR + AI document analysis — 5/min |
| POST | `/api/status/check` | Application status check — 30/min |
| GET | `/api/eval/retrieval` | Full 150-question benchmark — 2/hour |
| GET | `/api/eval/rag-vs-baseline` | Three-way ablation study — 2/hour |
| GET | `/api/eval/coverage` | KB coverage per category |
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Usage counters + RAG stats |
| GET | `/api/metadata` | Project metadata and KB stats |

---

## Deployment

- **Frontend**: Vercel
- **Backend**: Render
- **CI**: GitHub Actions

---

## Legal Helpline

Tamil Nadu State Legal Services Authority (TNSLSA): **1516** (toll-free, 24/7)

---

## Disclaimer

CivicAid is not a law firm and does not provide legal advice. All information is for general educational purposes. For serious legal matters, contact TNSLSA at 1516.

---

*Final Year AIML Project — Tamil Nadu · 2024–2025*
