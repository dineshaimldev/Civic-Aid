import type { Lang } from '../App'

interface Props {
  title: string
  lang: Lang
  setLang: (l: Lang) => void
  onMenuClick: () => void
}

export default function TopBar({ title, lang, setLang, onMenuClick }: Props) {
  return (
    <header
      className="flex items-center justify-between px-4"
      style={{ height: 56, background: '#faf9f4', borderBottom: '1px solid #d2d7cd' }}
    >
      <button
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.background = '#eef1ea')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#193d2c" strokeWidth="1.5" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Title — center with logo */}
      <div className="flex items-center gap-2">
        {/* C-arc + scales mark (small, light-bg variant) */}
        <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M34 8.5A17 17 0 1 0 34 31.5" stroke="#193d2c" strokeWidth="3.2" strokeLinecap="round" fill="none"/>
          <line x1="20" y1="12" x2="20" y2="28" stroke="#193d2c" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="12" y1="16" x2="28" y2="16" stroke="#193d2c" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="13" y1="16" x2="11" y2="22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="13" y1="16" x2="15" y2="22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="27" y1="16" x2="25" y2="22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="27" y1="16" x2="29" y2="22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round"/>
          <path d="M10 22 Q13 25 16 22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
          <path d="M24 22 Q27 25 30 22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
          <line x1="17" y1="28" x2="23" y2="28" stroke="#193d2c" strokeWidth="1.6" strokeLinecap="round"/>
          <circle cx="20" cy="10" r="2" fill="#193d2c"/>
        </svg>
        <span style={{ fontFamily: 'DM Sans', fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
          <span style={{ color: '#193d2c' }}>Civic</span><span style={{ color: '#2d7a52' }}>Aid</span>
        </span>
      </div>

      {/* Language toggle */}
      <div className="flex rounded-full overflow-hidden flex-shrink-0" style={{ border: '1.5px solid #bdc9b9' }}>
        {(['english', 'tamil'] as Lang[]).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-label={`Switch to ${l === 'english' ? 'English' : 'Tamil'}`}
            aria-pressed={lang === l}
            className="px-3 py-1.5 transition-colors"
            style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 700, background: lang === l ? '#193d2c' : '#faf9f4', color: lang === l ? '#e6ad36' : '#536053' }}
          >
            {l === 'tamil' ? 'தமிழ்' : 'EN'}
          </button>
        ))}
      </div>
    </header>
  )
}
