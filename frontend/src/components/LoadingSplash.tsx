export default function LoadingSplash() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: '#F5F0E8', zIndex: 9999 }}
    >
      <img src="/civicaid-logo.png" alt="CivicAid" style={{ width: 280, maxWidth: '80vw', height: 'auto', marginBottom: 24 }} />
      <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#8A8A8A', marginBottom: 32 }}>
        Free Legal Help · Tamil Nadu
      </p>
      <div className="relative" style={{ width: 36, height: 36 }}>
        <svg className="animate-spin" width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#E2DDD6" strokeWidth="3" />
          <path d="M18 3 A15 15 0 0 1 33 18" fill="none" stroke="#6B9E6B" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#8A8A8A', marginTop: 20 }}>
        Preparing your platform...
      </p>
    </div>
  )
}
