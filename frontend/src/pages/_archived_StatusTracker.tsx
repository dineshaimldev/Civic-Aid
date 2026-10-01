import { useState } from 'react'
import { useApp } from '../App'
import { checkApplicationStatus, ApiError } from '../lib/api'
import { T } from '../lib/translations'

type ServiceId = 'patta' | 'esevai' | 'general'
type StatusType = 'completed' | 'pending' | 'rejected'

const services: { id: ServiceId; title: string; subtitle: string; iconPath: string; color: string }[] = [
  { id: 'patta', title: 'Patta Transfer', subtitle: 'Land ownership transfer', color: '#6B9E6B', iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'esevai', title: 'e-Sevai Certificate', subtitle: 'Community / income / nativity', color: '#7C3AED', iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'general', title: 'General Enquiry', subtitle: 'Any government application', color: '#E8A838', iconPath: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
]

interface StatusResult {
  status: StatusType
  heading: string
  explanation: string
  nextStep: string
  updated: string
  refNo: string
}


const statusConfig: Record<StatusType, { color: string; bg: string; label: string; icon: string }> = {
  completed: { color: '#2E7D32', bg: '#EBF3EB', label: 'Completed', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-3' },
  pending: { color: '#E8A838', bg: '#FDF3DC', label: 'Pending', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  rejected: { color: '#C0392B', bg: '#FDECEA', label: 'Rejected', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
}

function Icon({ path, size = 20, color = 'currentColor' }: { path: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {path.split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
    </svg>
  )
}

export default function StatusTrackerPage() {
  const { addToast, lang } = useApp()
  const [selectedService, setSelectedService] = useState<ServiceId | null>(null)
  const [refNumber, setRefNumber] = useState('')
  const [result, setResult] = useState<StatusResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkStatus = async () => {
    if (!selectedService) { addToast({ type: 'warning', message: 'Please select a service first.' }); return }
    if (!refNumber.trim()) { addToast({ type: 'warning', message: 'Please enter your application number.' }); return }

    if (lastChecked) {
      const elapsed = (Date.now() - lastChecked.getTime()) / 1000
      if (elapsed < 10) {
        addToast({ type: 'info', message: `Please wait ${Math.ceil(10 - elapsed)}s before checking again.` })
        return
      }
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await checkApplicationStatus(
        refNumber.trim(),
        selectedService!
      )
      setResult({
        status: response.status as StatusType,
        heading: response.heading,
        explanation: response.explanation,
        nextStep: response.next_step,
        updated: response.last_updated,
        refNo: response.reference_number,
      })
      setLastChecked(new Date())
    } catch (err) {
      if (err instanceof ApiError) {
        addToast({ type: 'error', message: err.message })
      } else {
        addToast({ type: 'error', message: 'Status check failed. Please try again.' })
      }
    } finally {
      setLoading(false)
    }
  }

  const copyRef = () => {
    navigator.clipboard.writeText(result?.refNo ?? refNumber)
    addToast({ type: 'success', message: 'Application number copied to clipboard.' })
  }

  const shareResult = () => {
    if (result) {
      const text = `Application: ${result.refNo}\nStatus: ${result.heading}\n${result.explanation}\n\nNext step: ${result.nextStep}`
      if (navigator.share) {
        navigator.share({ title: 'Application Status', text })
      } else {
        navigator.clipboard.writeText(text)
        addToast({ type: 'success', message: 'Status summary copied to clipboard.' })
      }
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F5F0E8' }}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 style={{ fontFamily: "'Noto Serif Tamil', serif", fontSize: 32, fontWeight: 600, color: '#1C1C1C', marginBottom: 8 }}>
            Application Status
          </h1>
          <p style={{ fontFamily: 'Inter', fontSize: 16, color: '#4A4A4A' }}>
            Track your government application status with your reference number.
          </p>
        </div>

        {/* Service selection */}
        <div className="mb-6">
          <p style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 700, color: '#4A4A4A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Select Service
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {services.map(svc => {
              const isSel = selectedService === svc.id
              return (
                <button
                  key={svc.id}
                  onClick={() => { setSelectedService(svc.id); setResult(null) }}
                  className="relative flex flex-col items-start gap-2 p-4 rounded-xl transition-all text-left"
                  style={{
                    background: isSel ? '#EBF3EB' : '#FFFFFF',
                    border: `${isSel ? 2 : 1}px solid ${isSel ? '#6B9E6B' : '#E2DDD6'}`,
                    boxShadow: isSel ? '0 4px 12px rgba(107,158,107,0.15)' : '0 2px 6px rgba(0,0,0,0.05)',
                    transform: isSel ? 'translateY(-1px)' : 'translateY(0)',
                  }}
                >
                  {isSel && (
                    <div className="absolute top-3 right-3 flex items-center justify-center rounded-full" style={{ width: 20, height: 20, background: '#6B9E6B' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  )}
                  <div className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, background: `${svc.color}15` }}>
                    <Icon path={svc.iconPath} size={20} color={svc.color} />
                  </div>
                  <div>
                    <p style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 600, color: '#1C1C1C' }}>{svc.title}</p>
                    <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#8A8A8A' }}>{svc.subtitle}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Reference input */}
        <div className="mb-5">
          <label style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 700, color: '#4A4A4A', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
            Your Application Number
          </label>
          <div className="relative">
            <input
              value={refNumber}
              onChange={e => setRefNumber(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && checkStatus()}
              placeholder="e.g. TN2024001234"
              style={{
                width: '100%', height: 56,
                padding: '0 110px 0 16px',
                borderRadius: 8,
                background: '#FFFFFF', border: '1.5px solid #E2DDD6',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 16,
                letterSpacing: 2, color: '#1C1C1C', outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#6B9E6B')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E2DDD6')}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
              {refNumber && (
                <button
                  onClick={() => { setRefNumber(''); setResult(null) }}
                  className="px-2 py-1 rounded text-xs"
                  style={{ fontFamily: 'Inter', color: '#C0392B', background: '#FDECEA' }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => navigator.clipboard.readText().then(t => setRefNumber(t.toUpperCase())).catch(() => addToast({ type: 'info', message: 'Paste using Ctrl+V in the input field.' }))}
                className="px-2 py-1 rounded text-xs"
                style={{ fontFamily: 'Inter', color: '#6B9E6B', background: '#EBF3EB' }}
              >
                Paste
              </button>
            </div>
          </div>
          <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#8A8A8A', marginTop: 6 }}>
            Try: <button className="hover:underline" style={{ color: '#6B9E6B' }} onClick={() => setRefNumber('TN2024001234')}>TN2024001234</button> (approved Patta) ·
            <button className="hover:underline ml-1" style={{ color: '#E8A838' }} onClick={() => setRefNumber('TN2024005678')}>TN2024005678</button> (pending VAO) ·
            <button className="hover:underline ml-1" style={{ color: '#C0392B' }} onClick={() => setRefNumber('TN2024009999')}>TN2024009999</button> (rejected EC) ·
            <button className="hover:underline ml-1" style={{ color: '#E8A838' }} onClick={() => setRefNumber('TN2024007777')}>TN2024007777</button> (dispute RDO) ·
            <button className="hover:underline ml-1" style={{ color: '#6B9E6B' }} onClick={() => setRefNumber('TN2024003456')}>TN2024003456</button> (compensation paid)
          </p>
        </div>

        <button
          onClick={checkStatus}
          disabled={loading}
          className="w-full py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 mb-8"
          style={{
            background: loading ? '#E2DDD6' : '#E8A838',
            color: loading ? '#8A8A8A' : '#1C1C1C',
            fontFamily: 'Inter', fontSize: 16, fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(232,168,56,0.3)',
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = '#d4962e') }}
          onMouseLeave={e => { if (!loading) (e.currentTarget.style.background = '#E8A838') }}
        >
          {loading ? (
            <>
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="15" stroke="#8A8A8A" strokeWidth="3" />
                <path d="M18 3 A15 15 0 0 1 33 18" stroke="#4A4A4A" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Checking status…
            </>
          ) : T(lang, 'checkStatus')}
        </button>

        {/* Result */}
        {result && (
          <div className="animate-slide-up">
            {/* Status badge header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: statusConfig[result.status].bg, fontFamily: 'Inter', fontSize: 14, fontWeight: 700, color: statusConfig[result.status].color }}>
                <Icon path={statusConfig[result.status].icon} size={16} color={statusConfig[result.status].color} />
                {statusConfig[result.status].label}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#8A8A8A' }}>{result.refNo}</span>
              <button onClick={copyRef} className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg transition-colors" style={{ border: '1px solid #E2DDD6', fontFamily: 'Inter', fontSize: 12, color: '#4A4A4A' }} onMouseEnter={e => (e.currentTarget.style.background = '#F5F0E8')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Icon path="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1 M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" size={13} color="#4A4A4A" />
                Copy
              </button>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2DDD6', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <div className="px-6 py-5" style={{ borderBottom: `4px solid ${statusConfig[result.status].color}` }}>
                <h2 style={{ fontFamily: "'Noto Serif Tamil', serif", fontSize: 22, fontWeight: 700, color: '#1C1C1C', marginBottom: 8 }}>{result.heading}</h2>
                <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#4A4A4A', lineHeight: 1.7 }}>{result.explanation}</p>
              </div>

              <div className="px-6 py-5">
                {/* Next action */}
                <div className="flex items-start gap-3 p-4 rounded-xl mb-4" style={{ background: '#F5F0E8', borderLeft: '4px solid #6B9E6B' }}>
                  <Icon path="M13 10V3L4 14h7v7l9-11h-7z" size={18} color="#6B9E6B" />
                  <div>
                    <p style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 700, color: '#4A7A4A', marginBottom: 4 }}>Your Next Action</p>
                    <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#4A4A4A', lineHeight: 1.6 }}>{result.nextStep}</p>
                  </div>
                </div>

                {/* Timestamps and actions */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#8A8A8A' }}>Last updated</p>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#4A4A4A' }}>{result.updated}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={shareResult}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                      style={{ border: '1px solid #E2DDD6', fontFamily: 'Inter', fontSize: 13, color: '#4A4A4A' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F0E8')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Icon path="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" size={14} color="#4A4A4A" />
                      Share
                    </button>
                    <button
                      onClick={() => { setResult(null); setRefNumber(''); setSelectedService(null) }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                      style={{ border: '1.5px solid #6B9E6B', fontFamily: 'Inter', fontSize: 13, color: '#6B9E6B' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#EBF3EB')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      Check Another
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal aid helpline nudge */}
            {result.status === 'rejected' && (
              <div className="mt-4 flex items-start gap-3 p-4 rounded-xl animate-fade-in" style={{ background: '#FDECEA', border: '1px solid #C0392B' }}>
                <Icon path="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={18} color="#C0392B" />
                <div>
                  <p style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#C0392B', marginBottom: 4 }}>Need help with a rejection?</p>
                  <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#4A4A4A' }}>
                    Call Tamil Nadu Legal Aid: <strong>1516</strong> (toll-free, 24/7) or visit your nearest Taluk office for guidance on reapplication.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
