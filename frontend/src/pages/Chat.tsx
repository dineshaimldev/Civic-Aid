import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../App'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { sendChatMessage, escalatCase, explainRetrieval, createReminder, ApiError, type ChatMessage as ApiMsg, type SourceDetail, type EscalationResult, type ExplainResponse } from '../lib/api'

// Deadlines extracted from AI answer text — e.g. "30 days", "60-day appeal window"
interface ExtractedDeadline {
  label: string      // human readable: "30-day appeal window"
  days: number       // numeric days from today
}

interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  time: string
  sources?: string[]
  sourceDetails?: SourceDetail[]
  confidence?: number
  feedback?: 'up' | 'down' | null
  isConfidenceFallback?: boolean
  isQueued?: boolean
  queuedQuestion?: string
  question?: string
  escalationOpen?: boolean
  escalationLoading?: boolean
  escalationResult?: EscalationResult
  explainOpen?: boolean
  explainLoading?: boolean
  explainResult?: ExplainResponse
  deadlines?: ExtractedDeadline[]
  reminderPhone?: string
  reminderSet?: boolean
  reminderLoading?: boolean
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-['DM_Mono'] text-[10px] uppercase tracking-[.18em] text-[#618062]">{children}</p>
}

// Topics for the entry screen — labels only. Selecting one just opens
// the chat panel; it does not ask a question on the person's behalf.
const TOPICS: string[] = [
  'Land & property',
  'Family & inheritance',
  'Government notices',
  'Work & welfare',
]

const LOCAL_RESPONSES: [RegExp, { text: string; sources: string[] }][] = [
  [/patta|transfer|mutation|land.*name|name.*land/i, {
    text: `To transfer Patta to your name:\n\n1. Gather documents: current Patta copy, registered sale deed (or death certificate + legal heir certificate if inherited), Aadhaar card, Encumbrance Certificate (last 30 years from Sub-Registrar)\n2. Visit your Taluk Office and obtain Form A (free of cost)\n3. Submit completed Form A with all documents at Counter 3 (Patta Section). EC fee: ₹200\n4. A Village Administrative Officer (VAO) will visit your land within 7–15 working days\n5. After a 30-day objection period with no objections, the Tahsildar issues the new Patta\n6. Collect your new Patta and update Chitta/Adangal with the VAO\n\nTotal time: 30–45 working days. Call 1516 for free legal help.`,
    sources: ['TN Revenue Standing Orders §4.2–4.12', 'Revenue Dept Circular 2021']
  }],
  [/encroach|boundary|neighbour.*land|fence.*land/i, {
    text: `If your neighbour is encroaching on your land:\n\n1. Obtain your FMB from the Taluk Survey Office (fee ₹150–300)\n2. File a written complaint with the VAO requesting inspection within 7 days\n3. If VAO confirms encroachment but neighbour refuses: file complaint with Tahsildar under TN Land Encroachment Act 1905\n4. For immediate relief: file for an interim injunction in District Munsiff Court\n5. Call 1516 (toll-free, 24/7) for free legal guidance.`,
    sources: ['TN Land Encroachment Act 1905 §3–6', 'CPC Order XXXIX']
  }],
  [/daughter.*land|inherit.*daughter|women.*inherit|equal.*share/i, {
    text: `Daughters have EQUAL rights in their father's land in Tamil Nadu:\n\n1. Under Hindu Succession Act 1956 (amended 2005 §6), daughters have equal rights as sons — a birth right\n2. Married daughters retain this right — marriage does not remove inheritance rights\n3. If brothers are denying your share: file a Partition Suit in District Munsiff Court\n4. Women get FREE legal aid — call TNSLSA: 1516 (toll-free, 24/7)`,
    sources: ['Hindu Succession Act 1956 §6 (amended 2005)', 'Vineeta Sharma v Rakesh Sharma (2020)']
  }],
  [/fir|police|arrest|notice.*police/i, {
    text: `If you received an FIR notice:\n\n1. You have the right to a FREE copy of the FIR — go to the police station and ask\n2. Read it fully — note the section, appearance date, and investigating officer's name\n3. Call Tamil Nadu Legal Aid immediately: 1516 (toll-free, 24/7)\n4. Appear on the specified date with valid photo ID\n5. Never sign anything without reading it fully first.`,
    sources: ['CrPC Section 154', 'Legal Aid Act 1987 §12']
  }],
  [/mnrega|mgnrega|wage|job.card/i, {
    text: `For MNREGA wage complaint:\n\n1. Get your Job Card and Muster Roll from the Gram Panchayat office\n2. File a written complaint at the Gram Panchayat — they must respond within 15 days\n3. If no response: escalate to the Block Development Officer (BDO)\n4. Call the national MNREGA helpline: 1800-345-22-44 (toll-free)\n\nYou are entitled to compensation at 0.05% per day for delayed wages.`,
    sources: ['MGNREGA Act 2005 §6', 'Social Audit Guidelines 2011']
  }],
]

// ── Offline cache: remember real answers so repeat questions work with no signal ──
const QA_CACHE_KEY = 'civicaid_qa_cache_v1'
interface CachedAnswer { text: string; sources: string[]; sourceDetails: SourceDetail[]; ts: number }
const normQ = (q: string) => q.toLowerCase().replace(/[^\w஀-௿]+/g, ' ').trim()

function cacheGet(question: string): CachedAnswer | null {
  try {
    const all = JSON.parse(localStorage.getItem(QA_CACHE_KEY) || '{}') as Record<string, CachedAnswer>
    return all[normQ(question)] ?? null
  } catch { return null }
}

function cachePut(question: string, a: Omit<CachedAnswer, 'ts'>) {
  try {
    const all = JSON.parse(localStorage.getItem(QA_CACHE_KEY) || '{}') as Record<string, CachedAnswer>
    all[normQ(question)] = { ...a, ts: Date.now() }
    const keys = Object.keys(all).sort((x, y) => all[y].ts - all[x].ts).slice(0, 40)
    const trimmed: Record<string, CachedAnswer> = {}
    keys.forEach(k => { trimmed[k] = all[k] })
    localStorage.setItem(QA_CACHE_KEY, JSON.stringify(trimmed))
  } catch { /* storage full or unavailable — caching is best-effort */ }
}

function getLocalResponse(question: string) {
  for (const [pattern, resp] of LOCAL_RESPONSES) if (pattern.test(question)) return resp
  return null
}

function Icon({ path, size = 20, color = 'currentColor' }: { path: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {path.split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
    </svg>
  )
}

export default function ChatPage() {
  const { addToast, lang, activeDocument, setActiveDocument } = useApp()
  const [started, setStarted] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [useLocalFallback, setUseLocalFallback] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      const queued = messages.filter(m => m.isQueued && m.queuedQuestion)
      if (queued.length === 0) return
      addToast({ type: 'info', message: `Back online — fetching ${queued.length} real answer${queued.length > 1 ? 's' : ''}...` })
      for (const qMsg of queued) {
        try {
          const before = messages.filter(m => !m.isConfidenceFallback && m.time < qMsg.time).slice(-8)
            .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text }))
          before.push({ role: 'user', content: qMsg.queuedQuestion! })
          const result = await sendChatMessage(before, undefined, lang)
          setMessages(prev => prev.map(m => m.id === qMsg.id ? { ...m, text: result.text, sources: result.sources, sourceDetails: result.source_details, confidence: result.confidence, isConfidenceFallback: result.is_fallback, isQueued: false, queuedQuestion: undefined } : m))
        } catch {
          setMessages(prev => prev.map(m => m.id === qMsg.id ? { ...m, isQueued: false } : m))
        }
      }
      setUseLocalFallback(false)
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [messages, lang, addToast])

  // ── Voice-first: speak the question, it is sent automatically, and the answer is read aloud ──
  const sendRef = useRef<(text: string) => void>(() => {})
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const voiceAskedRef = useRef(false)   // true when the latest question was spoken

  const { isRecording, isSupported: voiceSupported, toggle: toggleVoice } = useVoiceInput({
    recogLang: lang === 'tamil' ? 'ta-IN' : 'en-IN',
    onResult: (text) => {
      setInput(text)
      voiceAskedRef.current = true
      sendRef.current(text)   // no typing or extra tap needed
    },
    onError: (msg) => addToast({ type: 'warning', message: msg }),
  })

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Remove the SOURCES line and markdown noise so only the useful answer is spoken
  const cleanForSpeech = (t: string) =>
    t.replace(/SOURCES:\s*\[.*?\]/gis, '').replace(/[*#_`>]/g, '').replace(/\n{2,}/g, '. ').trim()

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel()
    setSpeakingId(null)
  }, [ttsSupported])

  const speakMessage = useCallback((id: string, text: string) => {
    if (!ttsSupported) { addToast({ type: 'warning', message: 'Read-aloud is not supported in this browser.' }); return }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text))
    const wantTamil = lang === 'tamil'
    u.lang = wantTamil ? 'ta-IN' : 'en-IN'
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find(v => v.lang.toLowerCase().startsWith(wantTamil ? 'ta' : 'en-in')) ?? voices.find(v => v.lang.toLowerCase().startsWith(wantTamil ? 'ta' : 'en'))
    if (match) u.voice = match
    else if (wantTamil) addToast({ type: 'info', message: 'No Tamil voice found on this device — install the Tamil voice in your phone/PC speech settings.' })
    u.rate = 0.92
    u.onend = () => setSpeakingId(null)
    u.onerror = () => setSpeakingId(null)
    setSpeakingId(id)
    window.speechSynthesis.speak(u)
  }, [ttsSupported, lang, addToast])

  // Stop talking when leaving the page
  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel() }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: text.trim(), time: now }])
    setInput('')
    setIsTyping(true)

    if (useLocalFallback || !navigator.onLine) {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 500))
      const hit = cacheGet(text)
      if (hit) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(), role: 'ai',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `📴 ${tamil ? 'சேமிக்கப்பட்ட பதில் (இணையம் இல்லை)' : 'Saved answer (you are offline)'}\n\n${hit.text}`,
          sources: hit.sources, sourceDetails: hit.sourceDetails, feedback: null, question: text.trim(),
          deadlines: extractDeadlines(hit.text),
        }])
        setIsTyping(false)
        return
      }
      const local = getLocalResponse(text)
      // Local fallback answers are always unverified — they are hardcoded
      // for offline use, not drawn from the checked knowledge base.
      const localDetails: SourceDetail[] = (local?.sources ?? []).map(s => ({ source: s, verified: false, last_checked: null }))
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: local?.text ?? "I don't have enough information for this specific question. Please call Tamil Nadu Legal Aid at 1516 (toll-free, 24/7).",
        sources: local?.sources ?? [], sourceDetails: localDetails, feedback: null, isConfidenceFallback: !local,
        isQueued: !navigator.onLine, queuedQuestion: !navigator.onLine ? text.trim() : undefined,
        question: text.trim(),
      }])
      setIsTyping(false)
      return
    }

    try {
      const apiMsgs: ApiMsg[] = messages.filter(m => !m.isConfidenceFallback).slice(-9)
        .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text }))
      // If a document is active, prepend its text as a system-style user message at position 0
      // so the LLM has full document context for every question in this session
      const msgsToSend: ApiMsg[] = activeDocument
        ? [
            {
              role: 'user' as const,
              content: `[DOCUMENT CONTEXT — answer questions using this document as primary reference]\nTitle: ${activeDocument.title}\nType: ${activeDocument.docType}\n\n${activeDocument.extractedText.slice(0, 3000)}`,
            },
            { role: 'assistant' as const, content: 'I have read your document and I am ready to answer questions about it.' },
            ...apiMsgs,
          ]
        : apiMsgs
      msgsToSend.push({ role: 'user', content: text.trim() })
      const result = await sendChatMessage(msgsToSend, undefined, lang)
      const aiId = (Date.now() + 1).toString()
      setMessages(prev => [...prev, {
        id: aiId, role: 'ai',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: result.text, sources: result.sources, sourceDetails: result.source_details, confidence: result.confidence, feedback: null, isConfidenceFallback: result.is_fallback,
        question: text.trim(),
        deadlines: extractDeadlines(result.text),
      }])
      if (!result.is_fallback) cachePut(text, { text: result.text, sources: result.sources, sourceDetails: result.source_details })
      // Spoken question → spoken answer
      if (autoSpeak && voiceAskedRef.current) speakMessage(aiId, result.text)
      voiceAskedRef.current = false
      setUseLocalFallback(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: 'Too many requests. Please wait a moment and try again.', sources: [], feedback: null, isConfidenceFallback: true }])
      } else {
        setUseLocalFallback(true)
        const hit = cacheGet(text)
        const local = hit ? { text: `📴 ${tamil ? 'சேமிக்கப்பட்ட பதில்' : 'Saved answer'}\n\n${hit.text}`, sources: hit.sources } : getLocalResponse(text)
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: local?.text ?? "I'm having trouble connecting. Call Tamil Nadu Legal Aid: 1516.", sources: local?.sources ?? [], feedback: null, isConfidenceFallback: !local, question: text.trim() }])
      }
    }
    setIsTyping(false)
  }, [messages, isTyping, useLocalFallback, lang, autoSpeak, speakMessage])

  useEffect(() => { sendRef.current = sendMessage }, [sendMessage])

  const beginRoute = () => setStarted(true)

  const handleFeedback = (id: string, vote: 'up' | 'down') => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, feedback: vote } : m))
    addToast({ type: 'success', message: 'Thank you for your feedback!' })
  }

  const copyMessage = (text: string) => { navigator.clipboard.writeText(text); addToast({ type: 'success', message: 'Copied.' }) }

  // Feature #6 — Human Escalation: logs the case to the backend and shows
  // the DLSA helpline + district contacts. Safe to call more than once;
  // re-opening an already-fetched panel does not re-log the case.
  const handleEscalate = async (msg: Message) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, escalationOpen: true } : m))
    if (msg.escalationResult || msg.escalationLoading) return
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, escalationLoading: true } : m))
    try {
      const result = await escalatCase({
        question: msg.question || msg.text,
        ai_answer: msg.text,
        confidence: msg.confidence ?? 0,
        reason: 'user_requested',
      })
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, escalationLoading: false, escalationResult: result } : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, escalationLoading: false } : m))
      addToast({ type: 'warning', message: 'Could not reach the server. Call 1516 directly.' })
    }
  }

  // Feature #7 — Explainable Retrieval: toggles the "Why this answer?"
  // panel open/closed, fetching the retrieval breakdown on first open.
  const toggleExplain = async (msg: Message) => {
    const willOpen = !msg.explainOpen
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, explainOpen: willOpen } : m))
    if (!willOpen || msg.explainResult || msg.explainLoading || !msg.question) return
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, explainLoading: true } : m))
    try {
      const result = await explainRetrieval(msg.question, lang)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, explainLoading: false, explainResult: result } : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, explainLoading: false } : m))
      addToast({ type: 'warning', message: 'Could not load retrieval details.' })
    }
  }

  const tamil = lang === 'tamil'

  // Extract deadline hints from AI answer text (e.g. "within 30 days", "60-day limit")
  const extractDeadlines = (text: string): ExtractedDeadline[] => {
    const deadlines: ExtractedDeadline[] = []
    const patterns: [RegExp, (m: RegExpMatchArray) => number][] = [
      [/(\d+)[-\s]day(?:s)?\s+(?:appeal|window|limit|period|deadline|notice)/gi, m => parseInt(m[1])],
      [/within\s+(\d+)\s+days?/gi, m => parseInt(m[1])],
      [/(\d+)\s+working\s+days?/gi, m => parseInt(m[1])],
      [/(\d+)\s+(?:calendar\s+)?days?\s+(?:from|after|of)/gi, m => parseInt(m[1])],
    ]
    const seen = new Set<number>()
    for (const [pattern, getDays] of patterns) {
      let match: RegExpExecArray | null
      const re = new RegExp(pattern.source, 'gi')
      while ((match = re.exec(text)) !== null) {
        const days = getDays(match)
        if (days > 0 && days <= 365 && !seen.has(days)) {
          seen.add(days)
          deadlines.push({ label: match[0].trim(), days })
        }
      }
    }
    return deadlines.slice(0, 3) // max 3 deadline hints per answer
  }

  const handleSetReminder = async (msg: Message, deadline: ExtractedDeadline) => {
    if (!msg.reminderPhone || msg.reminderPhone.trim().length < 8) {
      addToast({ type: 'warning', message: 'Enter your phone number first.' })
      return
    }
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reminderLoading: true } : m))
    try {
      const due = new Date()
      due.setDate(due.getDate() + deadline.days)
      const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
      await createReminder(
        msg.reminderPhone.trim(),
        `${msg.question?.slice(0, 80) ?? 'Legal matter'}: ${deadline.label}`,
        iso,
        `Set from CivicAid chat. Answer: ${msg.text.slice(0, 200)}`,
      )
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reminderLoading: false, reminderSet: true } : m))
      addToast({ type: 'success', message: `Reminder set for ${iso} via WhatsApp.` })
    } catch {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reminderLoading: false } : m))
      addToast({ type: 'error', message: 'Could not set reminder. Try again.' })
    }
  }

  // Feature #6 panel — DLSA helpline + district contacts, shown once the
  // case has been logged (or while it's logging).
  const renderEscalationPanel = (msg: Message) => {
    if (!msg.escalationOpen) return null
    return (
      <div className="mt-2 px-4 py-3 rounded-[14px]" style={{ background: '#fdf6e8', border: '1px solid #e9d9ac' }}>
        {msg.escalationLoading ? (
          <p className="font-['DM_Sans'] text-[13px] text-[#8a6512]">Logging your case…</p>
        ) : msg.escalationResult ? (
          <>
            <p className="font-['DM_Sans'] text-[13px] font-semibold text-[#193d2c] mb-1">Talk to a lawyer — free</p>
            <p className="font-['DM_Sans'] text-[13px] text-[#536053] mb-2">
              TN Legal Services Authority helpline: <b className="text-[#193d2c]">{msg.escalationResult.dlsa_helpline}</b> (toll-free, 24/7)
            </p>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {msg.escalationResult.district_contacts.map(c => (
                <div key={c.district} className="font-['DM_Sans'] text-[12px] text-[#536053] flex justify-between gap-2">
                  <span>{c.office}</span>
                  <span className="font-['DM_Mono'] text-[#8a6512] flex-shrink-0">{c.phone}</span>
                </div>
              ))}
            </div>
            {(() => {
              const summary = [
                'CASE SUMMARY (prepared by CivicAid)',
                `Date: ${new Date().toLocaleDateString('en-GB')}`,
                `Reference: ${msg.escalationResult.escalation_id}`,
                `Client's question: ${msg.question || '(not recorded)'}`,
                activeDocument ? `Document shared: ${activeDocument.title} (${activeDocument.docType})` : 'Document shared: none',
                `Preliminary guidance given (AI, not legal advice): ${msg.text.replace(/SOURCES:\s*\[.*?\]/gis, '').trim().slice(0, 700)}`,
                `Sources cited: ${(msg.sources ?? []).join('; ') || 'none'}`,
                'Please verify the above and advise the client. This summary is generated automatically.',
              ].join('\n')
              return (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #e9d9ac' }}>
                  <p className="font-['DM_Sans'] text-[12px] font-semibold text-[#193d2c] mb-1">
                    {tamil ? 'வழக்கறிஞருக்கான வழக்கு சுருக்கம் — மீண்டும் கதை சொல்ல வேண்டாம்' : 'Case summary for the lawyer — no need to retell your story'}
                  </p>
                  <pre className="whitespace-pre-wrap rounded-xl bg-white p-3 font-['DM_Mono'] text-[10px] leading-relaxed text-[#193426] max-h-32 overflow-y-auto" style={{ border: '1px solid #e9d9ac' }}>{summary}</pre>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => copyMessage(summary)} className="font-['DM_Sans'] text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: '#193d2c', color: '#fff' }}>{tamil ? 'நகலெடு' : 'Copy'}</button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(summary)}`} target="_blank" rel="noopener noreferrer" className="font-['DM_Sans'] text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: '#25D366', color: '#fff' }}>WhatsApp</a>
                  </div>
                </div>
              )
            })()}
            <p className="font-['DM_Mono'] text-[10px] text-[#8a978a] mt-2">Case logged — ref {msg.escalationResult.escalation_id}</p>
          </>
        ) : (
          <p className="font-['DM_Sans'] text-[13px] text-[#536053]">Could not log your case right now. Call 1516 (toll-free, 24/7) directly.</p>
        )}
      </div>
    )
  }

  // Feature #7 panel — BM25 / dense / RRF scores per retrieved chunk.
  const renderExplainPanel = (msg: Message) => {
    if (!msg.explainOpen) return null
    return (
      <div className="mt-2 px-4 py-3 rounded-[14px]" style={{ background: '#f4f6f1', border: '1px solid #d2d7cd' }}>
        {msg.explainLoading ? (
          <p className="font-['DM_Sans'] text-[13px] text-[#607061]">Loading retrieval details…</p>
        ) : msg.explainResult && msg.explainResult.chunks.length > 0 ? (
          <div className="flex flex-col gap-2">
            {msg.explainResult.chunks.map(c => (
              <div key={`${c.rank}-${c.title}`} className="pb-2" style={{ borderBottom: '1px solid #e0e4db' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-['DM_Sans'] text-[12px] font-semibold text-[#193d2c]">#{c.rank} · {c.title}</span>
                  <span
                    className="font-['DM_Mono'] text-[9px] px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: c.verified ? '#e0efe0' : '#f4e9cf', color: c.verified ? '#1f5c2a' : '#8a6512' }}
                  >
                    {c.verified ? '✓ verified' : '◐ unverified'}
                  </span>
                </div>
                <p className="font-['DM_Sans'] text-[11px] text-[#697469] mt-0.5">{c.source}</p>
                <div className="flex gap-3 mt-1 font-['DM_Mono'] text-[10px] text-[#8a978a]">
                  <span>BM25 {c.bm25_score}</span>
                  <span>Dense {c.dense_score}</span>
                  <span>RRF {c.rrf_score}</span>
                </div>
              </div>
            ))}
            <p className="font-['DM_Mono'] text-[10px] text-[#8a978a]">
              Overall confidence {Math.round(msg.explainResult.confidence * 100)}% — {msg.explainResult.is_confident ? 'above' : 'below'} the fallback threshold
            </p>
          </div>
        ) : (
          <p className="font-['DM_Sans'] text-[13px] text-[#607061]">Could not load retrieval details.</p>
        )}
      </div>
    )
  }

  // ── Entry screen — exact zip "LegalHelp" topic picker ──
  if (!started) {
    return (
      <div>
        <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-11 pt-16 md:px-10 lg:px-14 lg:pb-16 lg:pt-24">
          <Eyebrow>{tamil ? 'வழிகாட்டப்பட்ட உதவி / 01' : 'Guided help / 01'}</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-['DM_Serif_Display'] text-[clamp(3.4rem,6vw,6.5rem)] leading-[.86] tracking-[-.06em] text-[#193d2c]">
            {tamil ? <>உங்கள்<br /><em>மனதில் என்ன?</em></> : <>What's on<br /><em>your mind?</em></>}
          </h1>
          <p className="mt-7 max-w-xl font-['DM_Sans'] text-lg leading-relaxed text-[#596458]">
            {tamil ? 'உங்கள் சூழ்நிலைக்கு நெருக்கமான ஒன்றைத் தேர்ந்தெடுக்கவும். சரியான ஆவணங்கள், அலுவலகம் மற்றும் அடுத்த படியை நாங்கள் காண்பிப்போம்.' : "Choose the situation closest to yours. We'll point you toward the right documents, office, and next step."}
          </p>
        </section>
        <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-20 md:px-10 lg:px-14">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div className="space-y-2">
              {TOPICS.map((topic, i) => (
                <button
                  onClick={() => setSelectedTopic(topic)}
                  key={topic}
                  className={`flex w-full items-center justify-between border-b px-1 py-5 text-left font-['DM_Sans'] text-lg transition ${selectedTopic === topic ? 'border-[#193d2c] font-bold text-[#193d2c]' : 'border-[#cbd1c6] text-[#697469] hover:text-[#193d2c]'}`}
                >
                  <span><b className="mr-4 font-['DM_Mono'] text-[10px] text-[#d58920]">0{i + 1}</b>{topic}</span>
                  <span>→</span>
                </button>
              ))}
            </div>
            <div className="rounded-[1.6rem] bg-[#e7ebe2] p-7 md:p-10">
              <Eyebrow>{tamil ? 'உங்கள் பாதை' : 'Your route'}</Eyebrow>
              <h2 className="mt-5 font-['DM_Serif_Display'] text-4xl leading-none">{selectedTopic}</h2>
              <p className="mt-5 max-w-md font-['DM_Sans'] leading-relaxed text-[#526052]">
                {tamil ? 'நடந்ததை உங்கள் சொந்த வார்த்தைகளில் சொல்லுங்கள். எளிய சரிபார்ப்பு பட்டியல் மற்றும் பொருந்தும் அரசு செயல்முறையை நாங்கள் காண்பிப்போம்.' : 'Tell us what happened in your own words. We will show a simple checklist and the government process that applies.'}
              </p>
              <button onClick={beginRoute} className="mt-9 rounded-full bg-[#193d2c] px-5 py-3 font-['DM_Sans'] text-sm font-semibold text-white transition hover:-translate-y-0.5">
                {tamil ? 'இந்த பாதையைத் தொடங்கு →' : 'Begin this route →'}
              </button>
            </div>
          </div>
        </section>

        {/* Feature #1 — WhatsApp */}
        <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-16 md:px-10 lg:px-14">
          <a
            href="https://wa.me/14155238886?text=join%20civicaid" target="_blank" rel="noopener noreferrer"
            className="flex flex-wrap items-center justify-between gap-4 rounded-[1.4rem] px-7 py-6 transition hover:-translate-y-0.5"
            style={{ background: '#1f4d33' }}
          >
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full text-lg" style={{ background: '#25D366', color: '#fff' }}>☎</span>
              <div>
                <p className="font-['DM_Sans'] text-[15px] font-semibold text-[#f6f1e6]">Prefer WhatsApp? Message CivicAid there instead.</p>
                <p className="font-['DM_Mono'] text-[10px] text-[#adc3a8] mt-1">Same free legal help, no app needed — tap to open WhatsApp</p>
              </div>
            </div>
            <span className="font-['DM_Sans'] text-sm font-semibold text-[#e6ad36]">Open WhatsApp →</span>
          </a>
        </section>
      </div>
    )
  }

  // ── Real working chat, restyled to the same palette ──
  return (
    <div className="mx-auto max-w-3xl px-5 md:px-10 py-8">
      <button onClick={() => setStarted(false)} className="font-['DM_Sans'] text-sm text-[#607061] hover:text-[#193d2c] mb-4">← Topics</button>
      <div className="flex flex-col rounded-[1.8rem] overflow-hidden" style={{ height: '78vh', background: '#faf9f4', border: '1px solid #d2d7cd', boxShadow: '0 15px 35px rgba(30,54,38,.08)' }}>
      <div className="hidden md:flex items-center justify-between px-8 py-4 flex-shrink-0" style={{ background: '#f4f1e9', borderBottom: '1px solid #d2d7cd' }}>
        <div className="flex items-center gap-3">
          <h2 className="font-['DM_Serif_Display'] text-2xl text-[#193d2c]">{selectedTopic}</h2>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: '#f7e6bd', display: isOnline ? 'none' : 'flex' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: isOnline ? '#4e8b4e' : '#d58920' }} />
            <span className="font-['DM_Sans'] text-xs" style={{ color: isOnline ? '#4e8b4e' : '#765717' }}>Offline — will sync</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              {msg.role === 'user' ? (
                <div style={{ maxWidth: '72%' }}>
                  <div className="px-4 py-3 rounded-[16px_16px_4px_16px]" style={{ background: '#e6ad36' }}>
                    <p className="font-['DM_Sans'] text-[15px] text-[#193d2c] leading-relaxed">{msg.text}</p>
                  </div>
                  <p className="font-['DM_Mono'] text-[10px] text-[#8a978a] text-right mt-1">{msg.time}</p>
                </div>
              ) : msg.isConfidenceFallback ? (
                <div style={{ maxWidth: '80%' }}>
                  <div className="px-4 py-4 rounded-[4px_16px_16px_16px]" style={{ background: '#e7ebe2', border: '1px solid #c8d0c4' }}>
                    <p className="font-['DM_Sans'] text-sm font-semibold text-[#536053] mb-1">{msg.isQueued ? 'Offline — queued for real answer' : 'Not enough information'}</p>
                    <p className="font-['DM_Sans'] text-sm text-[#536053] leading-relaxed">{msg.text}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 ml-1">
                    <span className="font-['DM_Mono'] text-[10px] text-[#8a978a]">{msg.time}</span>
                    {!msg.isQueued && (
                      <button onClick={() => handleEscalate(msg)} className="font-['DM_Sans'] text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#f4e9cf', color: '#8a6512' }}>
                        Connect me to a lawyer →
                      </button>
                    )}
                  </div>
                  {renderEscalationPanel(msg)}
                </div>
              ) : (
                <div style={{ maxWidth: '82%' }}>
                  <div className="px-5 py-4 rounded-[4px_20px_20px_20px]" style={{ background: '#faf9f4', borderLeft: '3px solid #193d2c', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <p className="font-['DM_Sans'] text-[15px] text-[#193426] leading-[1.75] whitespace-pre-wrap">{msg.text}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #d2d7cd' }}>
                        <span className="font-['DM_Mono'] text-[10px] text-[#8a978a] self-center">SOURCES</span>
                        {msg.sources.map(src => {
                          const detail = msg.sourceDetails?.find(d => d.source === src)
                          const isVerified = detail?.verified ?? false
                          return (
                            <span
                              key={src}
                              title={isVerified ? `Checked against the source text${detail?.last_checked ? ` on ${detail.last_checked}` : ''}` : 'AI-drafted — not yet checked against the official source text'}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full font-['DM_Mono'] text-[10px]"
                              style={{ background: isVerified ? '#e0efe0' : '#f4e9cf', color: isVerified ? '#1f5c2a' : '#8a6512' }}
                            >
                              {isVerified ? '✓' : '◐'} {src}
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {msg.sources && msg.sources.length > 0 && msg.sourceDetails?.every(d => !d.verified) && (
                      <p className="mt-2 font-['DM_Sans'] text-[11px]" style={{ color: '#8a6512' }}>
                        ◐ These sources are AI-drafted and have not yet been checked against the official text. Confirm with 1516 or a lawyer before relying on them.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 ml-1 flex-wrap">
                    <span className="font-['DM_Mono'] text-[10px] text-[#8a978a]">{msg.time}</span>
                    {typeof msg.confidence === 'number' && msg.sources && msg.sources.length > 0 && (
                      <span
                        title="How strongly this answer matched the knowledge base"
                        className="font-['DM_Mono'] text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: msg.confidence >= 0.6 ? '#e0efe0' : msg.confidence >= 0.35 ? '#f4e9cf' : '#f7ddd6',
                          color:      msg.confidence >= 0.6 ? '#1f5c2a' : msg.confidence >= 0.35 ? '#8a6512' : '#a04530',
                        }}
                      >
                        {Math.round(msg.confidence * 100)}% match
                      </span>
                    )}
                    <button onClick={() => handleFeedback(msg.id, 'up')} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ color: msg.feedback === 'up' ? '#4e8b4e' : '#8a978a' }}>
                      <Icon path="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" size={13} color="currentColor" />
                    </button>
                    <button onClick={() => handleFeedback(msg.id, 'down')} className="w-7 h-7 flex items-center justify-center rounded-full" style={{ color: msg.feedback === 'down' ? '#a04530' : '#8a978a' }}>
                      <Icon path="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" size={13} color="currentColor" />
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${msg.question ? `Q: ${msg.question}\n\n` : ''}${msg.text.replace(/SOURCES:\s*\[.*?\]/gis, '').trim()}\n\n— CivicAid (free legal help, TN) · Legal aid 1516`)}`}
                      target="_blank" rel="noopener noreferrer"
                      title={tamil ? 'WhatsApp-ல் பகிர்' : 'Share on WhatsApp'}
                      className="font-['DM_Sans'] text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: '#d9f5e3', color: '#128c4a' }}
                    >
                      {tamil ? 'WhatsApp பகிர்' : 'Share'}
                    </a>
                    {ttsSupported && (
                      <button
                        onClick={() => speakingId === msg.id ? stopSpeaking() : speakMessage(msg.id, msg.text)}
                        title={speakingId === msg.id ? 'Stop' : (tamil ? 'படித்துக் காட்டு' : 'Read aloud')}
                        className="flex items-center gap-1 font-['DM_Sans'] text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: speakingId === msg.id ? '#193d2c' : '#e0efe0', color: speakingId === msg.id ? '#fff' : '#1f5c2a' }}
                      >
                        {speakingId === msg.id ? '■ ' : '🔊 '}{speakingId === msg.id ? (tamil ? 'நிறுத்து' : 'Stop') : (tamil ? 'படிக்க' : 'Listen')}
                      </button>
                    )}
                    <button onClick={() => copyMessage(msg.text)} className="w-7 h-7 flex items-center justify-center rounded-full text-[#8a978a]">
                      <Icon path="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1" size={12} color="currentColor" />
                    </button>
                    {msg.question && (
                      <button onClick={() => toggleExplain(msg)} className="font-['DM_Sans'] text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: msg.explainOpen ? '#dde4d7' : '#e7ebe2', color: '#536053' }}>
                        Why this answer? {msg.explainOpen ? '−' : '+'}
                      </button>
                    )}
                    <button onClick={() => handleEscalate(msg)} className="font-['DM_Sans'] text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#f4e9cf', color: '#8a6512' }}>
                      Connect me to a lawyer →
                    </button>
                  </div>
                  {renderExplainPanel(msg)}
                  {renderEscalationPanel(msg)}
                  {/* Feature #4 — Inline deadline reminders */}
                  {msg.deadlines && msg.deadlines.length > 0 && !msg.reminderSet && (
                    <div className="mt-2 px-4 py-3 rounded-[14px]" style={{ background: '#fdf6e8', border: '1px solid #e9d9ac' }}>
                      <p className="font-['DM_Mono'] text-[10px] uppercase tracking-wider text-[#8a6512] mb-2">
                        {tamil ? 'காலகெடு உள்ளது' : 'Deadlines mentioned'}
                      </p>
                      {msg.deadlines.map(d => (
                        <div key={d.days} className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-['DM_Sans'] text-[12px] text-[#765717] flex-1">⏰ {d.label} ({d.days} days)</span>
                          <button
                            onClick={() => handleSetReminder(msg, d)}
                            disabled={!!msg.reminderLoading}
                            className="font-['DM_Sans'] text-[11px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: '#e6ad36', color: '#193426', opacity: msg.reminderLoading ? 0.6 : 1 }}
                          >
                            {msg.reminderLoading ? '...' : (tamil ? 'ரிமைண்டர் அமை' : 'Set reminder')}
                          </button>
                        </div>
                      ))}
                      <input
                        type="tel"
                        placeholder={tamil ? 'உங்கள் தொலைபேசி எண்' : 'Your phone number'}
                        value={msg.reminderPhone ?? ''}
                        onChange={e => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reminderPhone: e.target.value } : m))}
                        className="w-full rounded-full border border-[#e9d9ac] bg-white px-3 py-1.5 font-['DM_Sans'] text-[12px] outline-none focus:border-[#e6ad36]"
                      />
                    </div>
                  )}
                  {msg.reminderSet && (
                    <div className="mt-2 px-4 py-2 rounded-[14px] font-['DM_Sans'] text-[12px]" style={{ background: '#dff0e6', color: '#1f5c2a' }}>
                      ✓ {tamil ? 'ரிமைண்டர் அமைக்கப்பட்டது' : 'Reminder set via WhatsApp'}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start animate-fade-in">
              <div className="px-5 py-4 flex items-center gap-2 rounded-[4px_20px_20px_20px]" style={{ background: '#faf9f4', borderLeft: '3px solid #193d2c' }}>
                <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="flex-shrink-0 px-4 md:px-8 py-4" style={{ background: '#faf9f4', borderTop: '1px solid #d2d7cd' }}>
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {/* Active document banner */}
          {activeDocument && (
            <div className="flex items-center justify-between gap-2 px-4 py-2 rounded-xl" style={{ background: '#dff0e6', border: '1px solid #b3d9c4' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[#2d7a52] flex-shrink-0">📄</span>
                <span className="font-['DM_Sans'] text-[12px] text-[#1f5c2a] truncate">
                  {tamil ? 'ஆவணம்: ' : 'Document: '}<b>{activeDocument.title}</b>
                </span>
              </div>
              <button
                onClick={() => setActiveDocument(null)}
                className="flex-shrink-0 font-['DM_Mono'] text-[10px] text-[#536053] hover:text-[#a04530] transition"
                title="Remove document context"
              >
                ✕ {tamil ? 'நீக்கு' : 'Remove'}
              </button>
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: '#f7ddd6' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: '#a04530', animation: 'pulse-ring 0.8s infinite' }} />
              <span className="font-['DM_Sans'] text-[13px]" style={{ color: '#a04530' }}>Listening...</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={voiceSupported ? toggleVoice : undefined} className="flex-shrink-0 flex items-center justify-center rounded-full" style={{ width: 44, height: 44, background: isRecording ? '#a04530' : '#193d2c' }}>
              <Icon path={isRecording ? 'M18 8h1a4 4 0 010 8h-1 M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z' : 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8'} size={18} color="white" />
            </button>
            <input
              ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
              placeholder={tamil ? 'உங்கள் கேள்வியை டைப் செய்யவும் அல்லது 🎤 அழுத்திப் பேசவும்...' : 'Type your question, or tap 🎤 and speak...'} disabled={isTyping}
              className="flex-1 rounded-full border font-['DM_Sans'] text-[15px] outline-none"
              style={{ height: 44, padding: '0 18px', background: '#fbfaf6', borderColor: '#bdc9b9', color: '#193426', opacity: isTyping ? 0.6 : 1 }}
            />
            <button
              onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}
              className="flex-shrink-0 flex items-center justify-center rounded-full"
              style={{ width: 44, height: 44, background: input.trim() && !isTyping ? '#e6ad36' : '#d2d7cd' }}
            >
              <Icon path="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7" size={16} color="#193426" />
            </button>
          </div>
          {ttsSupported && (
            <label className="flex items-center justify-center gap-2 font-['DM_Sans'] text-[11px] text-[#536053] cursor-pointer select-none">
              <input type="checkbox" checked={autoSpeak} onChange={e => { setAutoSpeak(e.target.checked); if (!e.target.checked) stopSpeaking() }} />
              {tamil ? 'கேள்வியை பேசிக் கேட்டால் பதிலை சத்தமாக படிக்கவும்' : 'Read answers aloud when I ask by voice'}
            </label>
          )}
          <p className="text-center font-['DM_Sans'] text-[11px] text-[#8a978a]">
            {tamil
              ? 'CivicAid தமிழ்நாடு நிலம், வருவாய் மற்றும் அரசு நடைமுறைகளில் சிறப்புப் பெற்றது. மற்ற விஷயங்களுக்கு வழக்கறிஞரை அணுகவும் அல்லது 1516 அழைக்கவும்.'
              : 'CivicAid specialises in Tamil Nadu land, revenue and government procedures. For other matters, confirm with a lawyer or call 1516.'}
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}
