import type { Page, Lang } from '../App'

interface Props {
  open: boolean
  onClose: () => void
  activePage: Page
  onNavigate: (page: Page) => void
  lang: Lang
  setLang: (l: Lang) => void
}

// Application Status entry removed — feature not implementable, removed from project.
const navItems: { page: Page; labels: Record<Lang, string>; icon: string }[] = [
  { page: 'home',       labels: { english: 'Home',              tamil: 'முகப்பு' },        icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { page: 'chat',       labels: { english: 'Legal Help',        tamil: 'சட்ட உதவி' },      icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { page: 'upload',     labels: { english: 'Document Analysis', tamil: 'ஆவண விளக்கம்' },  icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6' },
  { page: 'procedures', labels: { english: 'Procedure Guide',   tamil: 'வழிகாட்டி' },      icon: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01' },
  { page: 'about',      labels: { english: 'About CivicAid',    tamil: 'பற்றி' },          icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
]

export default function MobileDrawer({ open, onClose, activePage, onNavigate, lang, setLang }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.25s ease' }}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, width: 280, background: '#193d2c', transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 24px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4" style={{ height: 64, borderBottom: '1px solid rgba(246,241,230,0.12)' }}>
          <div className="flex items-center gap-3">
            <span className="grid place-items-center rounded-full" style={{ width: 32, height: 32, background: '#f6f1e6', color: '#193d2c', fontSize: 14 }}>✦</span>
            <div>
              <span style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: 15, color: '#f6f1e6' }}>CivicAid</span>
              <div style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#b8cfaf', letterSpacing: '0.06em' }}>FREE LEGAL HELP</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{ color: '#c6d1c3', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(246,241,230,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 py-3 overflow-y-auto">
          {navItems.map(item => {
            const isActive = activePage === item.page
            return (
              <button
                key={item.page}
                onClick={() => onNavigate(item.page)}
                aria-current={isActive ? 'page' : undefined}
                className="w-full flex items-center gap-3 px-4 transition-colors"
                style={{ height: 50, background: isActive ? 'rgba(230,173,54,0.14)' : 'transparent', color: isActive ? '#e6ad36' : '#c6d1c3', borderLeft: isActive ? '3px solid #e6ad36' : '3px solid transparent', fontFamily: 'DM Sans', fontSize: 14, fontWeight: isActive ? 700 : 400 }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(246,241,230,0.06)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  {item.icon.split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
                </svg>
                {item.labels[lang]}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(246,241,230,0.12)' }}>
          <p style={{ fontFamily: 'DM Mono', fontSize: 10, color: '#93a291', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Language</p>
          <div className="flex rounded-full overflow-hidden" style={{ border: '1.5px solid rgba(246,241,230,0.18)' }}>
            {(['english', 'tamil'] as Lang[]).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className="flex-1 py-2 text-center transition-colors"
                style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, background: lang === l ? '#e6ad36' : 'transparent', color: lang === l ? '#193d2c' : '#93a291', borderRadius: l === 'english' ? '999px 0 0 999px' : '0 999px 999px 0' }}
              >
                {l === 'tamil' ? 'தமிழ்' : 'English'}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: '#78a070' }} />
            <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: '#93a291' }}>Free · No signup · Always online</span>
          </div>
        </div>
      </div>
    </>
  )
}
