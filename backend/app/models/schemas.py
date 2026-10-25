from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"

class ChatMessage(BaseModel):
    role: MessageRole
    content: str = Field(..., min_length=1, max_length=4000)

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=10)
    session_id: Optional[str] = None
    lang: str = "english"

class SourceDetail(BaseModel):
    source: str
    verified: bool = False
    last_checked: Optional[str] = None

class ChatResponse(BaseModel):
    text: str
    sources: List[str] = []
    source_details: List[SourceDetail] = []
    is_fallback: bool = False
    confidence: float = 0.0
    session_id: Optional[str] = None

class DateItem(BaseModel):
    date: str
    desc: str

class DocAnalysis(BaseModel):
    doc_type: str
    type_label: str
    title: str
    confidence: int
    key_info: List[str]
    dates: List[DateItem]
    warnings: List[str] = []
    issues_found: bool = True   # False when document appears clean with no urgent issues
    next_steps: List[str]
    disclaimer: str = "AI-assisted analysis only. Call 1516 (Tamil Nadu Legal Aid, toll-free) for advice."

class DocumentAnalysisResponse(BaseModel):
    analysis: DocAnalysis
    extracted_text: str = ""
    raw_text_length: int
    processing_time_ms: int

class HealthResponse(BaseModel):
    status: str
    version: str
    env: str
    services: dict

class EvalMetrics(BaseModel):
    accuracy_at_1: float
    accuracy_at_3: float
    accuracy_at_5: float
    mean_mrr: float
    mean_ndcg_at_5: float
    confidence_rate: float
    avg_latency_ms: float


# ── Feature #2: Deadline Reminders ────────────────────────────
class ReminderCreate(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    title: str = Field(..., min_length=3, max_length=200)
    deadline_date: str  # ISO format YYYY-MM-DD
    description: str = Field(default="", max_length=500)
    source: str = Field(default="manual")  # "manual" | "document_analysis"

class Reminder(BaseModel):
    id: str
    phone: str
    title: str
    deadline_date: str
    description: str = ""
    source: str = "manual"
    created_at: str
    notified: bool = False
    access_token: Optional[str] = None

class ReminderListResponse(BaseModel):
    reminders: List[Reminder]
    upcoming_count: int


# ── Feature #3: Document Vault ───────────────────────────────────────
class VaultDocumentMeta(BaseModel):
    id: str
    phone: str
    title: str
    doc_type: str
    uploaded_at: str
    size_bytes: int

class VaultUploadResponse(BaseModel):
    document: VaultDocumentMeta
    access_token: str
    message: str = "Document securely stored."

class VaultListResponse(BaseModel):
    documents: List[VaultDocumentMeta]
    total_count: int


# ── Feature #4: Corruption Reporting ────────────────────────────────
class CorruptionReportCreate(BaseModel):
    office_name: str = Field(..., min_length=3, max_length=200)
    officer_designation: str = Field(default="", max_length=100)
    incident_description: str = Field(..., min_length=10, max_length=2000)
    amount_demanded: Optional[str] = None
    incident_date: Optional[str] = None
    contact_phone: Optional[str] = None  # optional — anonymous by default

class CorruptionReportResponse(BaseModel):
    report_id: str
    submitted_at: str
    dvac_reference_note: str
    message: str


# ── Feature #5: Document Generation ──────────────────────────────────
class LetterGenerateRequest(BaseModel):
    applicant_name: str = Field(..., min_length=2, max_length=100)
    father_or_husband_name: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=5, max_length=300)
    phone: str = Field(..., min_length=8, max_length=20)
    recipient_designation: str = Field(..., min_length=2, max_length=150)
    recipient_office: str = Field(..., min_length=2, max_length=150)
    subject: str = Field(..., min_length=5, max_length=200)
    details: str = Field(..., min_length=10, max_length=2000)
    survey_number: Optional[str] = None
    village: Optional[str] = None
    lang: str = "english"

class LetterGenerateResponse(BaseModel):
    letter_text: str
    generated_at: str


# ── Feature #6: Human Escalation ──────────────────────────────────────
class DistrictContact(BaseModel):
    district: str
    office: str
    phone: str

class EscalationRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)
    ai_answer: Optional[str] = Field(default=None, max_length=4000)
    confidence: float = 0.0
    phone: Optional[str] = Field(default=None, max_length=20)
    district: Optional[str] = Field(default=None, max_length=100)
    reason: Optional[str] = Field(default=None, max_length=200)

class EscalationResponse(BaseModel):
    escalation_id: str
    logged_at: str
    dlsa_helpline: str = "1516"
    district_contacts: List[DistrictContact]
    message: str


# ── Feature #7: Explainable Retrieval ─────────────────────────────────
class RetrievedChunkExplain(BaseModel):
    title: str
    source: str
    verified: bool = False
    bm25_score: float
    dense_score: float
    rrf_score: float
    rank: int

class ExplainRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    lang: str = "english"

class ExplainResponse(BaseModel):
    question: str
    chunks: List[RetrievedChunkExplain]
    confidence: float
    is_confident: bool
