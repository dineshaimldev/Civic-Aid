const BASE = import.meta.env.VITE_API_BASE_URL || ''

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new ApiError(res.status, err.detail || err.error || 'Something went wrong')
  }
  return res.json()
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface SourceDetail { source: string; verified: boolean; last_checked: string | null }
export interface ChatResponse { text: string; sources: string[]; source_details: SourceDetail[]; is_fallback: boolean; confidence: number; session_id: string }

export async function sendChatMessage(messages: ChatMessage[], sessionId?: string, lang = 'english'): Promise<ChatResponse> {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, session_id: sessionId, lang }),
  })
}

export interface DateItem { date: string; desc: string }
export interface DocAnalysis { doc_type: string; type_label: string; title: string; confidence: number; key_info: string[]; dates: DateItem[]; warnings: string[]; next_steps: string[]; disclaimer: string }
export interface DocumentAnalysisResponse { analysis: DocAnalysis; extracted_text: string; raw_text_length: number; processing_time_ms: number }

export async function analyzeDocument(file: File, lang = 'english'): Promise<DocumentAnalysisResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('lang', lang)
  const res = await fetch(`${BASE}/api/document/analyze`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new ApiError(res.status, err.detail || err.error || 'Analysis failed')
  }
  return res.json()
}

export async function checkHealth() {
  return request<{ status: string; version: string; services: Record<string, string> }>('/api/health')
}

// ── Feature #2: Deadline Reminders ────────────────────────────────
export interface Reminder { id: string; phone: string; title: string; deadline_date: string; description: string; source: string; created_at: string; notified: boolean }

export async function createReminder(phone: string, title: string, deadlineDate: string, description = ''): Promise<Reminder> {
  return request<Reminder>('/api/reminders', {
    method: 'POST',
    body: JSON.stringify({ phone, title, deadline_date: deadlineDate, description, source: 'manual' }),
  })
}

export async function listReminders(phone: string): Promise<{ reminders: Reminder[]; upcoming_count: number }> {
  return request(`/api/reminders/${encodeURIComponent(phone)}`)
}

// ── Feature #3: Document Vault ───────────────────────────────────────
export interface VaultDocumentMeta { id: string; phone: string; title: string; doc_type: string; uploaded_at: string; size_bytes: number }

export async function uploadToVault(file: File, phone: string, title: string, docType: string): Promise<{ document: VaultDocumentMeta; message: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('phone', phone)
  form.append('title', title)
  form.append('doc_type', docType)
  const res = await fetch(`${BASE}/api/vault/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Vault upload failed' }))
    throw new ApiError(res.status, err.detail || err.error || 'Could not store document')
  }
  return res.json()
}

export async function listVaultDocuments(phone: string): Promise<{ documents: VaultDocumentMeta[]; total_count: number }> {
  return request(`/api/vault/${encodeURIComponent(phone)}`)
}

export function vaultDownloadUrl(phone: string, docId: string) {
  return `${BASE}/api/vault/${encodeURIComponent(phone)}/${docId}/download`
}

// ── Feature #4: Corruption Reporting ──────────────────────────────
export interface CorruptionReportInput { office_name: string; officer_designation?: string; incident_description: string; amount_demanded?: string; incident_date?: string; contact_phone?: string }
export interface CorruptionReportResult { report_id: string; submitted_at: string; dvac_reference_note: string; message: string }

export async function submitCorruptionReport(input: CorruptionReportInput): Promise<CorruptionReportResult> {
  return request<CorruptionReportResult>('/api/corruption-report', { method: 'POST', body: JSON.stringify(input) })
}

export async function getDvacContact(): Promise<{ helpline: string; email: string; portal: string; note: string }> {
  return request('/api/corruption-report/dvac-contact')
}

// ── Feature #1: WhatsApp ──────────────────────────────────────────────
export async function getWhatsAppStatus(): Promise<{ configured: boolean; sandbox_number: string | null }> {
  return request('/api/whatsapp/status')
}

// ── Feature #5: Document Generation ──────────────────────────────────
export interface LetterGenerateInput {
  applicant_name: string
  father_or_husband_name: string
  address: string
  phone: string
  recipient_designation: string
  recipient_office: string
  subject: string
  details: string
  survey_number?: string
  village?: string
  lang?: string
}
export interface LetterGenerateResult { letter_text: string; generated_at: string }
export interface LetterPreset { recipient_designation: string; recipient_office: string; subject: string; details_hint: string }

export async function generateLetter(input: LetterGenerateInput): Promise<LetterGenerateResult> {
  return request<LetterGenerateResult>('/api/generate/letter', { method: 'POST', body: JSON.stringify(input) })
}

export async function getLetterPresets(): Promise<Record<string, LetterPreset>> {
  return request('/api/generate/letter/presets')
}
