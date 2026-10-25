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
            → 72 KB Chunks (tn_legal_kb.json)
            → LLM: Groq (configurable model with fallback candidates)
        → OCR: PyPDF2 + Tesseract (Tamil + English)
        → Durable records: SQLite locally / managed PostgreSQL in production
        → Cache and rate limiting: Redis (development fallback only)
```

### RAG Pipeline
- **Dense retrieval**: `paraphrase-multilingual-MiniLM-L12-v2` → FAISS IndexFlatIP (cosine)
- **Sparse retrieval**: BM25Okapi on `content + title + keywords`
- **Fusion**: Reciprocal Rank Fusion (Cormack et al., SIGIR 2009) — dense 0.7 / BM25 0.3
- **Confidence gate**: max dense score < 0.35 → fallback prompt (no context injection)
- **Top-K**: 5 chunks retrieved per query
- **Index invalidation**: the FAISS index is rebuilt automatically when the KB hash changes

---

## Features

- **AI Legal Chat** — RAG-augmented answers with legal citations and source chips
- **Document Analysis** — OCR + AI analysis of Patta, FIR notices, sale deeds
- **Procedure Guides** — 5 offline step-by-step government service walkthroughs with progress tracking
- **Toolkit** — land-purchase checklist, document mismatch checker, petition maker,
  local application tracker, office finder, and scam alerts
- **Voice Input** — Web Speech API (Tamil + English)
- **Bilingual** — English and Tamil UI
- **Document vault** — encrypted storage with token-protected retrieval
- **Deadline reminders** — optional WhatsApp notifications for extracted dates
- **Corruption reporting and human escalation** — DVAC-ready reports and DLSA contacts

---

## Evaluation Benchmark

- **150 questions** across 8 land issue categories
- **3 difficulty levels**: easy (45), medium (65), hard (40)
- **Metrics**: Accuracy@1/3/5, MRR, NDCG@5, Confidence Rate
- **Ablation study**: Hybrid RAG vs BM25-only vs Dense-only

Run: `python scripts/run_eval.py`

---

## Run locally

CivicAid uses one Python virtual environment at the project root:
`D:\Final-Year\.venv`. The backend and frontend run in separate terminals.

### First-time setup

Open PowerShell in `D:\Final-Year` and run:

```powershell
# Use the single shared Python environment
.\.venv\Scripts\Activate.ps1

# Install backend dependencies
cd backend
python -m pip install -r requirements.txt

# Create the local environment file if it does not exist, then add GROQ_API_KEY
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Build the search index once
python scripts\build_index.py
```

If PowerShell blocks activation, run this once in PowerShell as your user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Start the application

Use two PowerShell terminals.

**Terminal 1 — backend**

```powershell
cd D:\Final-Year
.\.venv\Scripts\Activate.ps1
cd backend
python -m uvicorn app.main:app --reload
```

**Terminal 2 — frontend**

```powershell
cd D:\Final-Year\frontend
npm install
npm run dev
```

Open the frontend URL shown by Vite, usually
`http://localhost:5173`. The backend API is available at
`http://localhost:8000`; its health check is
`http://localhost:8000/api/health`.

To leave the Python environment:

```powershell
deactivate
```

### Environment Variables (.env)
```
GROQ_API_KEY=your_key_here
APP_ENV=development
REDIS_URL=redis://localhost:6379
TESSERACT_PATH=/usr/bin/tesseract
APP_SECRET_KEY=replace_with_a_long_random_value
REMINDER_SWEEP_TOKEN=replace_with_a_long_random_value
# Windows: TESSERACT_PATH=C:\Program Files\Tesseract-OCR\tesseract.exe
```

The reminder sweep requires the `X-Admin-Token` header containing
`REMINDER_SWEEP_TOKEN`. The first reminder for a phone number returns a
separate `access_token`; clients must send it as `X-Reminder-Token` when
creating additional reminders or listing reminders. A caller cannot rotate
an existing reminder token by knowing only the phone number. Vault documents
are encrypted with `APP_SECRET_KEY` and require the access token returned
after upload; keep both tokens private.

In production, `REDIS_URL` must point to a managed Redis instance. CivicAid
only uses its in-memory fallback during development; production startup
fails rather than silently losing vault, reminder, rate-limit, and session
state when Redis is unavailable.

Sensitive vault bytes are encrypted before being written to the configured
database. Vault metadata, reminders, corruption reports, and escalation
records use the durable repository rather than Redis. For production, set
`DATABASE_URL` to a managed PostgreSQL instance and configure automated
backups, encryption at rest, access controls, and a documented retention
policy. The local SQLite repository is intended for development and tests;
it is not a substitute for managed production storage.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | RAG chat — 20/min rate limit |
| POST | `/api/document/analyze` | OCR + AI document analysis — 5/min |
| POST | `/api/document/compare` | Compare 2–4 land documents — 5/min |
| POST | `/api/generate/letter` | Generate a draft petition |
| POST | `/api/escalate` | Log a case for human legal-aid follow-up |
| POST | `/api/corruption-report` | Prepare a DVAC corruption report |
| POST | `/api/vault/upload` | Store an encrypted vault document |
| GET | `/api/vault/{phone}` | List vault documents with `X-Vault-Token` |
| POST | `/api/reminders` | Create a deadline reminder; returns an access token |
| GET | `/api/reminders/{phone}` | List reminders with `X-Reminder-Token` |
| POST | `/api/whatsapp/webhook` | Twilio-signed WhatsApp webhook |
| GET | `/api/eval/retrieval` | Full 150-question benchmark — 2/hour |
| GET | `/api/eval/rag-vs-baseline` | Three-way ablation study — 2/hour |
| GET | `/api/eval/coverage` | KB coverage per category |
| GET | `/api/health` | Health check |
| GET | `/api/ready` | Deployment readiness probe |
| GET | `/api/stats` | Usage counters + RAG stats |
| GET | `/api/metadata` | Project metadata and KB stats |

---

## Deployment

- **Frontend**: Vercel
- **Backend**: Render
- **Durable database**: Managed PostgreSQL (`DATABASE_URL`)
- **Cache/rate limiting**: Managed Redis (`REDIS_URL`)
- **CI**: GitHub Actions

---

## Legal Helpline

Tamil Nadu State Legal Services Authority (TNSLSA): **1516** (toll-free, 24/7)

---

## Disclaimer

CivicAid is not a law firm and does not provide legal advice. All information is for general educational purposes. For serious legal matters, contact TNSLSA at 1516.

---


