import { useEffect, useState } from 'react'

export interface ToastItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface Props {
  toast: ToastItem
  onClose: () => void
}

const config = {
  success: { color: '#2E7D32', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-3' },
  error: { color: '#C0392B', icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
  warning: { color: '#E8A838', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  info: { color: '#6B9E6B', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
}

export default function Toast({ toast, onClose }: Props) {
  const [progress, setProgress] = useState(100)
  const cfg = config[toast.type]

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => Math.max(0, p - 2))
    }, 100)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="toast-enter relative overflow-hidden rounded-xl"
      style={{
        background: '#FFFFFF',
        borderLeft: `4px solid ${cfg.color}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
        padding: '14px 16px',
      }}
    >
      <div className="flex items-start gap-3 pr-6">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
          {cfg.icon.split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
        </svg>
        <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#1C1C1C', lineHeight: 1.5 }}>{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center"
        style={{ color: '#8A8A8A' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div
        className="absolute bottom-0 left-0 h-0.5 transition-all"
        style={{ width: `${progress}%`, background: cfg.color, opacity: 0.4 }}
      />
    </div>
  )
}
