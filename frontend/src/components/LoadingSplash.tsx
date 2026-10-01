export default function LoadingSplash() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: '#F5F0E8', zIndex: 9999 }}
    >
      <div
        className="flex items-center justify-center rounded-2xl mb-6"
        style={{ width: 72, height: 72, background: '#6B9E6B', boxShadow: '0 8px 24px rgba(107,158,107,0.35)' }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <h1 style={{ fontFamily: "Inter", fontSize: 28, fontWeight: 700, color: '#1C1C1C', marginBottom: 4 }}>
        CivicAid
      </h1>
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
