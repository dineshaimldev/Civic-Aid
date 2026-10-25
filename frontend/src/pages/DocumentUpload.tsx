import { useState, useRef } from 'react'
import { useApp } from '../App'
import { analyzeDocument, ApiError, uploadToVault, createReminder } from '../lib/api'
import type { ActiveDocument } from '../App'

type UploadState = 'idle' | 'processing' | 'result'

const statusMessages = ['Reading the file...', 'Extracting text content...', 'Identifying document type...', 'Analyzing clauses and dates...', 'Preparing your results...']

interface DocAnalysis {
  type: string
  title: string
  confidence: number
  keyInfo: string[]
  dates: { date: string; desc: string }[]
  nextSteps: string[]
  warnings?: string[]
  issuesFound?: boolean
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-['DM_Mono'] text-[10px] uppercase tracking-[.18em] text-[#618062]">{children}</p>
}

function Icon({ path, size = 20, color = 'currentColor' }: { path: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {path.split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
    </svg>
  )
}

export default function DocumentUploadPage() {
  const { addToast, lang, navigate, setActiveDocument } = useApp()
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [statusIdx, setStatusIdx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [analysis, setAnalysis] = useState<DocAnalysis | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [phone, setPhone] = useState('')
  const [protecting, setProtecting] = useState(false)
  const [protected_, setProtected] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tamil = lang === 'tamil'

  const handleFile = async (file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (!allowed.includes(file.type)) { addToast({ type: 'error', message: 'Please upload a PDF, JPG, or PNG file.' }); return }
    if (file.size > 10 * 1024 * 1024) { addToast({ type: 'error', message: 'File too large. Maximum size is 10MB.' }); return }

    setFileName(file.name)
    setUploadedFile(file)
    setState('processing')
    setProgress(0)
    setStatusIdx(0)

    let p = 0
    const interval = setInterval(() => {
      p += 0.8
      if (p < 85) { setProgress(Math.min(p, 85)); setStatusIdx(Math.min(Math.floor((p / 85) * (statusMessages.length - 1)), statusMessages.length - 1)) }
    }, 60)

    try {
      const result = await analyzeDocument(file, lang)
      clearInterval(interval)
      setProgress(100)
      const a = result.analysis
      setExtractedText(result.extracted_text ?? '')
      setAnalysis({ type: a.type_label, title: a.title, confidence: a.confidence, keyInfo: a.key_info, dates: a.dates, nextSteps: a.next_steps, warnings: a.warnings, issuesFound: a.issues_found ?? true })
      // Store document in app context so Chat page can use it
      setActiveDocument({
        title: a.title,
        extractedText: result.extracted_text ?? '',
        docType: a.type_label,
      } as ActiveDocument)
      setTimeout(() => setState('result'), 400)
    } catch (err) {
      clearInterval(interval)
      setState('idle')
      setProgress(0)
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Analysis failed. Please try again or call 1516 for help.' })
    }
  }

  const reset = () => { setState('idle'); setProgress(0); setStatusIdx(0); setFileName(''); setExtractedText(''); setAnalysis(null); setUploadedFile(null); setProtected(false); setPhone('') }

  // Convert any date string the AI returns ("15 Oct 2026", "06th October 2026", "2026-10-15") → YYYY-MM-DD
  const toIsoDate = (raw: string): string | null => {
    if (!raw) return null
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim()
    // Remove ordinal suffixes: 15th → 15, 06th → 06
    const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/gi, '$1').trim()
    const parsed = new Date(cleaned)
    if (isNaN(parsed.getTime())) return null
    const yyyy = parsed.getFullYear()
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const protectDocument = async () => {
    if (!phone.trim() || phone.trim().length < 8) { addToast({ type: 'error', message: 'Enter a valid phone number to continue.' }); return }
    if (!uploadedFile || !analysis) return
    setProtecting(true)
    try {
      const vault = await uploadToVault(uploadedFile, phone.trim(), analysis.title, analysis.type)
      localStorage.setItem(`civicaid:vault-token:${phone.trim()}`, vault.access_token)
      for (const d of analysis.dates) {
        const iso = toIsoDate(d.date)
        if (!iso) continue   // skip dates we can't parse — don't send a 422
        try { await createReminder(phone.trim(), `${analysis.title}: ${d.desc}`, iso, `Extracted from your uploaded document: ${analysis.title}`) } catch { /* best-effort per date */ }
      }
      setProtected(true)
      addToast({ type: 'success', message: 'Document saved and deadline reminders set.' })
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not save. Please try again.' })
    }
    setProtecting(false)
  }

  // ── IDLE + PROCESSING — exact zip "Documents" layout ──
  if (state !== 'result') {
    return (
      <div>
        <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-11 pt-16 md:px-10 lg:px-14 lg:pb-16 lg:pt-24">
          <Eyebrow>{tamil ? 'ஆவண மேசை / 02' : 'Document desk / 02'}</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-['DM_Serif_Display'] text-[clamp(3.4rem,6vw,6.5rem)] leading-[.86] tracking-[-.06em] text-[#193d2c]">
            {tamil ? <>அதிகாரப்பூர்வத்தை<br /><em>புரியவைக்கவும்.</em></> : <>Make the official<br /><em>understandable.</em></>}
          </h1>
          <p className="mt-7 max-w-xl font-['DM_Sans'] text-lg leading-relaxed text-[#596458]">
            {tamil ? 'அறிவிப்பு, சான்றிதழ் அல்லது படிவத்தை பதிவேற்றி அது என்ன சொல்கிறது, அடுத்து என்ன செய்ய வேண்டும் என்பதை எளிய மொழியில் அறிக.' : 'Upload a notice, certificate, or form to get a plain-language reading of what it says and what to do next.'}
          </p>
        </section>

        <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-20 md:px-10 lg:px-14">
          {state === 'idle' ? (
            <div className="grid gap-7 lg:grid-cols-[1.15fr_.85fr]">
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                className="flex min-h-[300px] flex-col items-center justify-center rounded-[1.8rem] border border-dashed p-8 text-center transition hover:bg-white"
                style={{ borderColor: isDragging ? '#193d2c' : '#8fa08b', background: isDragging ? '#fff' : '#faf9f4' }}
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#dce6d8] text-2xl">↥</span>
                <h2 className="mt-5 font-['DM_Serif_Display'] text-3xl text-[#193d2c]">{tamil ? 'ஆவணத்தை இங்கே விடவும்' : 'Drop your document here'}</h2>
                <p className="mt-3 font-['DM_Sans'] text-sm text-[#687568]">PDF, image, or scanned paper · Tamil and English</p>
                <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </button>
              <div className="rounded-[1.8rem] bg-[#193d2c] p-8 text-[#f5f0e5]">
                <Eyebrow>{tamil ? 'நாங்கள் என்ன பார்க்கிறோம்' : 'What we look for'}</Eyebrow>
                <ul className="mt-7 space-y-5 font-['DM_Sans'] text-sm text-[#ced8cb]">
                  <li>01 — Important dates and reference numbers</li>
                  <li>02 — What the office is asking you to do</li>
                  <li>03 — Supporting documents you may need</li>
                  <li>04 — Words worth asking about</li>
                </ul>
                <p className="mt-10 border-t border-[#52715d] pt-5 font-['DM_Mono'] text-[10px] uppercase tracking-wider text-[#adc3a8]">
                  Your document is not published or shared.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.8rem] bg-white p-8" style={{ boxShadow: '0 15px 35px rgba(30,54,38,.08)' }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#dce6d8] text-xl">↥</div>
                <div>
                  <p className="font-['DM_Sans'] text-[15px] font-semibold text-[#193426]">{fileName}</p>
                  <p className="font-['DM_Sans'] text-[13px] text-[#4e8b4e]">Analyzing your document…</p>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: '#e7ebe2' }}>
                <div className="h-full rounded-full transition-all duration-200" style={{ width: `${progress}%`, background: '#193d2c' }} />
              </div>
              <div className="flex items-center justify-between">
                <p className="font-['DM_Sans'] text-sm text-[#536053]">{statusMessages[statusIdx]}</p>
                <p className="font-['DM_Mono'] text-[13px] text-[#193d2c]">{Math.round(progress)}%</p>
              </div>
            </div>
          )}
        </section>
      </div>
    )
  }

  // ── RESULT — zip visual language extended with real data ──
  const safeAnalysis = analysis!
  return (
    <div>
      <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-6 pt-10 md:px-10 lg:px-14">
        <button onClick={reset} className="font-['DM_Sans'] text-sm text-[#607061] hover:text-[#193d2c] mb-6">← New document</button>
        <div className="grid gap-7 lg:grid-cols-[.85fr_1.15fr]">
          {/* Left — extracted text panel, styled like the zip's dark panel */}
          <div className="rounded-[1.8rem] bg-[#193d2c] p-8 text-[#f5f0e5]">
            <Eyebrow>Extracted text</Eyebrow>
            <div className="mt-5 rounded-2xl p-5 font-['DM_Mono'] text-[11px] leading-relaxed" style={{ background: '#122c20', color: '#ced8cb', maxHeight: 320, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {extractedText ? extractedText.slice(0, 900) + (extractedText.length > 900 ? '\n\n… (truncated)' : '') : 'No text could be extracted.'}
            </div>
            <div className="mt-6 flex items-center gap-3 border-t border-[#52715d] pt-5">
              <span className="rounded-full px-3 py-1.5 font-['DM_Mono'] text-[10px] uppercase tracking-wide" style={{ background: '#e6ad36', color: '#193426' }}>{safeAnalysis.type}</span>
              <span className="font-['DM_Sans'] text-xs text-[#adc3a8]">Confidence: {safeAnalysis.confidence}%</span>
            </div>
          </div>

          {/* Right — analysis */}
          <div className="rounded-[1.8rem] bg-white p-8" style={{ boxShadow: '0 15px 35px rgba(30,54,38,.08)' }}>
            <h2 className="font-['DM_Serif_Display'] text-3xl text-[#193d2c]">{safeAnalysis.title}</h2>

            <div className="mt-8">
              <Eyebrow>Key information</Eyebrow>
              <ul className="mt-4 space-y-2">
                {safeAnalysis.keyInfo.map(item => (
                  <li key={item} className="flex items-start gap-2 font-['DM_Sans'] text-sm text-[#536053]"><span className="text-[#e6ad36]">•</span>{item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <Eyebrow>Important dates</Eyebrow>
              <div className="mt-4 flex flex-col gap-2">
                {safeAnalysis.dates.map(d => (
                  <div key={d.date} className="flex items-center gap-3 flex-wrap">
                    <span className="rounded-full px-2.5 py-1 font-['DM_Mono'] text-[11px]" style={{ background: '#f7e6bd', color: '#765717' }}>{d.date}</span>
                    <span className="font-['DM_Sans'] text-sm text-[#536053]">{d.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Clean state — no issues found */}
            {safeAnalysis.issuesFound === false && (
              <div className="mt-8 flex items-center gap-3 p-4 rounded-xl" style={{ background: '#dff0e6', border: '1px solid #b3d9c4' }}>
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-white text-lg" style={{ background: '#4caf82' }}>✓</span>
                <div>
                  <p className="font-['DM_Sans'] text-[14px] font-semibold" style={{ color: '#1f5c2a' }}>
                    {tamil ? 'ஆவணம் சரியாக உள்ளது — எந்த சிக்கலும் கண்டறியப்படவில்லை' : 'Document appears in order — no issues detected'}
                  </p>
                  <p className="font-['DM_Sans'] text-[12px] mt-0.5" style={{ color: '#2d7a52' }}>
                    {tamil ? 'இந்த ஆவணத்தில் அவசர நடவடிக்கை தேவைப்படும் எந்த சிக்கலும் இல்லை.' : 'No urgent warnings or red flags found in this document.'}
                  </p>
                </div>
              </div>
            )}

            {/* Warnings — issues found */}
            {safeAnalysis.warnings && safeAnalysis.warnings.length > 0 && (
              <div className="mt-8">
                <Eyebrow><span style={{ color: '#a04530' }}>Warnings</span></Eyebrow>
                <div className="mt-4 flex flex-col gap-2">
                  {safeAnalysis.warnings.map(w => (
                    <div key={w} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#f7ddd6', borderLeft: '3px solid #a04530' }}>
                      <p className="font-['DM_Sans'] text-[13px]" style={{ color: '#a04530' }}>{w}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 border-t pt-6" style={{ borderColor: '#c7cec3' }}>
              <Eyebrow>Next steps</Eyebrow>
              <ol className="mt-4 flex flex-col gap-3">
                {safeAnalysis.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 grid place-items-center rounded-full font-['DM_Mono'] text-[11px]" style={{ width: 22, height: 22, background: '#193d2c', color: '#f6f1e6' }}>{i + 1}</span>
                    <span className="font-['DM_Sans'] text-sm text-[#3f4b40] leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-8 font-['DM_Sans'] text-xs text-[#667066]">
              AI-assisted analysis only. For legal disputes, consult a qualified lawyer or call Tamil Nadu Legal Aid: <b className="text-[#193d2c]">1516</b>.
            </p>

            {/* Feature #2 + #3 — Document Vault + Deadline Reminders */}
            <div className="mt-8 rounded-2xl p-6" style={{ background: '#e7ebe2' }}>
              {protected_ ? (
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full text-white" style={{ background: '#4e8b4e' }}>✓</span>
                  <div>
                    <p className="font-['DM_Sans'] text-sm font-semibold text-[#193d2c]">Document protected</p>
                    <p className="font-['DM_Sans'] text-xs text-[#536053]">Saved to your vault. {safeAnalysis.dates.length > 0 ? `${safeAnalysis.dates.length} deadline reminder(s) set.` : ''}</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-['DM_Mono'] text-[10px] uppercase tracking-[.16em] text-[#618062]">Don't lose this document</p>
                  <p className="mt-2 font-['DM_Sans'] text-sm text-[#3f4b40]">
                    Most rural land cases are lost due to missing paperwork. Save a secure copy and get a WhatsApp reminder before any deadline mentioned above.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <input
                      type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="Your phone number (e.g. 9876543210)"
                      className="flex-1 min-w-[220px] rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]"
                    />
                    <button
                      onClick={protectDocument} disabled={protecting}
                      className="rounded-full px-5 py-2.5 font-['DM_Sans'] text-sm font-semibold text-white transition"
                      style={{ background: '#193d2c', opacity: protecting ? 0.6 : 1 }}
                    >
                      {protecting ? 'Saving…' : 'Save to Vault + Set Reminders'}
                    </button>
                  </div>
                  <p className="mt-3 font-['DM_Mono'] text-[10px] text-[#8a978a]">No account needed — retrieve anytime using the same phone number.</p>
                </>
              )}
            </div>

            <div className="mt-8 flex gap-3 flex-wrap">
              <button onClick={reset} className="rounded-full border px-5 py-2.5 font-['DM_Sans'] text-sm font-medium transition" style={{ borderColor: '#193d2c', color: '#193d2c' }}>New Document</button>
              <button
                onClick={() => navigate('chat')}
                className="rounded-full px-5 py-2.5 font-['DM_Sans'] text-sm font-semibold text-white transition hover:-translate-y-0.5"
                style={{ background: '#4caf82' }}
              >
                💬 {tamil ? 'இந்த ஆவணத்தைப் பற்றி கேளுங்கள் →' : 'Chat about this document →'}
              </button>
              <button
                onClick={() => {
                  const content = [`CivicAid Document Analysis`, `========================`, `Document: ${safeAnalysis.title}`, `Type: ${safeAnalysis.type}`, `Confidence: ${safeAnalysis.confidence}%`, ``, `KEY INFORMATION`, ...safeAnalysis.keyInfo.map(i => `• ${i}`), ``, `IMPORTANT DATES`, ...safeAnalysis.dates.map(d => `${d.date} — ${d.desc}`), ...(safeAnalysis.warnings?.length ? [``, `WARNINGS`, ...safeAnalysis.warnings.map(w => `⚠ ${w}`)] : []), ``, `NEXT STEPS`, ...safeAnalysis.nextSteps.map((s, i) => `${i + 1}. ${s}`), ``, `---`, `Tamil Nadu Legal Aid: 1516 (toll-free, 24/7)`, `Generated by CivicAid`].join('\n')
                  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `CivicAid_Analysis_${safeAnalysis.type.replace(/\s+/g, '_')}.txt`; a.click()
                  URL.revokeObjectURL(url)
                  addToast({ type: 'success', message: 'Analysis downloaded.' })
                }}
                className="rounded-full px-5 py-2.5 font-['DM_Sans'] text-sm font-semibold text-white transition"
                style={{ background: '#193d2c' }}
              >
                Download Analysis
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
