import { useApp } from '../App'

export default function NotFoundPage() {
  const { navigate } = useApp()
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8" style={{ background: '#F5F0E8' }}>
      <div className="flex items-center justify-center rounded-2xl mb-6" style={{ width: 80, height: 80, background: '#EBF3EB' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6B9E6B" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <h2 style={{ fontFamily: 'Inter', fontSize: 28, fontWeight: 700, color: '#1C1C1C', marginBottom: 8 }}>Page Not Found</h2>
      <p style={{ fontFamily: 'Inter', fontSize: 15, color: '#4A4A4A', marginBottom: 28, maxWidth: 360 }}>
        The page you're looking for doesn't exist. Let's get you back to the right place.
      </p>
      <button
        onClick={() => navigate('home')}
        style={{ padding: '12px 28px', borderRadius: 8, background: '#6B9E6B', color: '#FFFFFF', fontFamily: 'Inter', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#4A7A4A')}
        onMouseLeave={e => (e.currentTarget.style.background = '#6B9E6B')}
      >
        Go to Home
      </button>
    </div>
  )
}
