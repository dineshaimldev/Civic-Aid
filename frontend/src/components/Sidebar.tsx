import type { Page, Lang } from '../App'
import { T } from '../lib/translations'

interface Props {
  activePage: Page
  onNavigate: (page: Page) => void
  lang: Lang
  setLang: (l: Lang) => void
}

// Application Status nav item removed — feature not implementable, removed from project.
const getNavItems = (lang: Lang) => [
  { page: 'home' as Page, label: T(lang, 'home'), icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { page: 'chat' as Page, label: T(lang, 'chat'), icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { page: 'upload' as Page, label: T(lang, 'upload'), icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6' },
  { page: 'procedures' as Page, label: T(lang, 'procedures'), icon: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01' },
  { page: 'vault' as Page, label: lang === 'tamil' ? 'ஆவண பெட்டகம்' : 'Document vault', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { page: 'about' as Page, label: T(lang, 'about'), icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
]

export default function Sidebar({ activePage, onNavigate, lang, setLang }: Props) {
  const navItems = getNavItems(lang)
  return (
    <nav style={{ width: 260, background: '#193d2c' }} className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-[74px]" style={{ borderBottom: '1px solid rgba(246,241,230,0.12)' }}>
        {/* C-arc + scales mark */}
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          {/* Outer C arc */}
          <path d="M34 8.5A17 17 0 1 0 34 31.5" stroke="#b8cfaf" strokeWidth="3.2" strokeLinecap="round" fill="none"/>
          {/* Balance pole (vertical) */}
          <line x1="20" y1="12" x2="20" y2="28" stroke="#e6ad36" strokeWidth="1.8" strokeLinecap="round"/>
          {/* Balance beam (horizontal) */}
          <line x1="12" y1="16" x2="28" y2="16" stroke="#e6ad36" strokeWidth="1.8" strokeLinecap="round"/>
          {/* Left pan string */}
          <line x1="13" y1="16" x2="11" y2="22" stroke="#e6ad36" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="13" y1="16" x2="15" y2="22" stroke="#e6ad36" strokeWidth="1.4" strokeLinecap="round"/>
          {/* Right pan string */}
          <line x1="27" y1="16" x2="25" y2="22" stroke="#e6ad36" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="27" y1="16" x2="29" y2="22" stroke="#e6ad36" strokeWidth="1.4" strokeLinecap="round"/>
          {/* Left pan */}
          <path d="M10 22 Q13 25 16 22" stroke="#e6ad36" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
          {/* Right pan */}
          <path d="M24 22 Q27 25 30 22" stroke="#e6ad36" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
          {/* Base */}
          <line x1="17" y1="28" x2="23" y2="28" stroke="#e6ad36" strokeWidth="1.6" strokeLinecap="round"/>
          {/* Person head atop pole */}
          <circle cx="20" cy="10" r="2" fill="#b8cfaf"/>
        </svg>
        <div>
          <div style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: 17, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            <span style={{ color: '#f6f1e6' }}>Civic</span><span style={{ color: '#4caf82' }}>Aid</span>
          </div>
          <div style={{ fontFamily: 'DM Mono', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b8cfaf', lineHeight: 1.4 }}>Free Legal Help</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item: { page: Page; label: string; icon: string }) => {
          const isActive = activePage === item.page
          return (
            <button
              key={item.page}
              onClick={() => onNavigate(item.page)}
              className="w-full flex items-center gap-3 px-5 transition-colors text-left"
              style={{
                height: 48,
                background: isActive ? 'rgba(230,173,54,0.14)' : 'transparent',
                color: isActive ? '#e6ad36' : '#c6d1c3',
                borderLeft: isActive ? '3px solid #e6ad36' : '3px solid transparent',
                fontFamily: 'DM Sans', fontSize: 14, fontWeight: isActive ? 700 : 400,
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(246,241,230,0.06)' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {item.icon.split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
              </svg>
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Bottom */}
      <div style={{ borderTop: '1px solid rgba(246,241,230,0.12)' }} className="p-4 flex flex-col gap-3">
        <div className="flex rounded-full overflow-hidden" style={{ border: '1.5px solid rgba(246,241,230,0.18)' }}>
          {(['tamil', 'english'] as Lang[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="flex-1 py-2 text-center transition-colors"
              style={{
                fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600,
                background: lang === l ? '#e6ad36' : 'transparent',
                color: lang === l ? '#193d2c' : '#93a291',
                borderRadius: l === 'tamil' ? '999px 0 0 999px' : '0 999px 999px 0',
              }}
            >
              {l === 'tamil' ? 'தமிழ்' : 'English'}
            </button>
          ))}
        </div>
        <button
          onClick={() => onNavigate('about')}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full transition-colors"
          style={{ border: '1.5px solid rgba(246,241,230,0.18)', color: '#c6d1c3', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 500 }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#e6ad36')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(246,241,230,0.18)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Feedback
        </button>
      </div>
    </nav>
  )
}
