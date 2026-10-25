import { useState } from 'react'
import { useApp } from '../App'
import { listVaultDocuments, downloadVaultDocument, ApiError } from '../lib/api'
import type { VaultDocumentMeta } from '../lib/api'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-['DM_Mono'] text-[10px] uppercase tracking-[.18em] text-[#618062]">{children}</p>
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function VaultPage() {
  const { addToast, lang } = useApp()
  const tamil = lang === 'tamil'

  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [docs, setDocs] = useState<VaultDocumentMeta[] | null>(null)
  const [searched, setSearched] = useState('')
  const [accessToken, setAccessToken] = useState('')

  const fetchDocs = async () => {
    const p = phone.trim()
    if (p.length < 8) { addToast({ type: 'error', message: 'Enter a valid phone number.' }); return }
    setLoading(true)
    setDocs(null)
    try {
      const token = localStorage.getItem(`civicaid:vault-token:${p}`) || ''
      const res = await listVaultDocuments(p, token)
      setDocs(res.documents)
      setSearched(p)
      setAccessToken(token)
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not fetch documents. Try again.' })
    }
    setLoading(false)
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-11 pt-16 md:px-10 lg:px-14 lg:pb-16 lg:pt-24">
        <Eyebrow>{tamil ? 'ஆவண பெட்டகம் / 05' : 'Document vault / 05'}</Eyebrow>
        <h1 className="mt-5 max-w-3xl font-['DM_Serif_Display'] text-[clamp(3rem,5.5vw,5.5rem)] leading-[.88] tracking-[-.06em] text-[#193d2c]">
          {tamil ? <>உங்கள் ஆவணங்கள்<br /><em>பாதுகாப்பாக.</em></> : <>Your saved<br /><em>documents.</em></>}
        </h1>
        <p className="mt-7 max-w-xl font-['DM_Sans'] text-lg leading-relaxed text-[#596458]">
          {tamil
            ? 'உங்கள் தொலைபேசி எண்ணை உள்ளிட்டு, நீங்கள் சேமித்த ஆவணங்களை அணுகவும்.'
            : 'Enter the phone number you used when saving a document to retrieve your vault.'}
        </p>
      </section>

      {/* Phone lookup */}
      <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-10 md:px-10 lg:px-14">
        <div className="flex flex-wrap gap-3 max-w-xl">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchDocs()}
            placeholder={tamil ? 'தொலைபேசி எண் (எ.கா. 9876543210)' : 'Phone number (e.g. 9876543210)'}
            className="flex-1 min-w-[220px] rounded-full border border-[#c4ccc1] bg-white px-5 py-3 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]"
          />
          <button
            onClick={fetchDocs}
            disabled={loading}
            className="rounded-full px-6 py-3 font-['DM_Sans'] text-sm font-semibold text-white transition"
            style={{ background: '#193d2c', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? (tamil ? 'தேடுகிறது…' : 'Loading…') : (tamil ? 'காட்டு' : 'Show my documents')}
          </button>
        </div>
        <p className="mt-3 font-['DM_Mono'] text-[10px] tracking-wide text-[#8a978a]">
          {tamil ? 'எந்த கணக்கும் தேவையில்லை — அதே தொலைபேசி எண் மட்டுமே.' : 'No account needed — the same phone number you saved with.'}
        </p>
      </section>

      {/* Results */}
      {docs !== null && (
        <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-24 md:px-10 lg:px-14">
          {docs.length === 0 ? (
            <div className="rounded-[1.8rem] bg-white p-10 text-center" style={{ boxShadow: '0 15px 35px rgba(30,54,38,.06)' }}>
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full" style={{ background: '#e7ebe2' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#618062" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
                </svg>
              </div>
              <p className="font-['DM_Serif_Display'] text-2xl text-[#193d2c]">{tamil ? 'ஆவணங்கள் இல்லை' : 'No documents found'}</p>
              <p className="mt-2 font-['DM_Sans'] text-sm text-[#596458]">
                {tamil
                  ? `${searched} எண்ணில் சேமிக்கப்பட்ட ஆவணங்கள் இல்லை.`
                  : `No documents saved under ${searched}. Upload and analyse a document first.`}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                <Eyebrow>{docs.length} {docs.length === 1 ? 'document' : 'documents'} saved under {searched}</Eyebrow>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {docs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex flex-col justify-between rounded-[1.4rem] bg-white p-6 transition hover:shadow-lg"
                    style={{ boxShadow: '0 8px 24px rgba(30,54,38,.07)' }}
                  >
                    {/* Doc icon + type badge */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full" style={{ background: '#e7ebe2' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#193d2c" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>
                          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
                        </svg>
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 font-['DM_Mono'] text-[10px] uppercase tracking-wide"
                        style={{ background: '#f7e6bd', color: '#765717' }}
                      >
                        {doc.doc_type}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-['DM_Sans'] text-[15px] font-semibold leading-snug text-[#193d2c] mb-1">
                      {doc.title}
                    </h3>

                    {/* Meta */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-['DM_Mono'] text-[10px] text-[#8a978a]">
                      <span>{formatDate(doc.uploaded_at)}</span>
                      <span>{formatBytes(doc.size_bytes)}</span>
                    </div>

                    {/* Download */}
                    <button
                      onClick={async () => {
                        try {
                          const blob = await downloadVaultDocument(searched, doc.id, accessToken)
                          const url = URL.createObjectURL(blob)
                          const link = document.createElement('a')
                          link.href = url
                          link.download = doc.title
                          link.click()
                          URL.revokeObjectURL(url)
                        } catch (err) {
                          addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not download document.' })
                        }
                      }}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-['DM_Sans'] text-sm font-semibold transition"
                      style={{ background: '#193d2c', color: '#f6f1e6' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      {tamil ? 'பதிவிறக்கு' : 'Download'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
