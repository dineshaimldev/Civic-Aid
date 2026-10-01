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
        <span className="grid place-items-center rounded-full flex-shrink-0" style={{ width: 22, height: 22, background: '#193d2c', color: '#f6f1e6', fontSize: 11 }}>✦</span>
        <span style={{ fontFamily: 'DM Sans', fontSize: 15, fontWeight: 700, color: '#193d2c', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
          {title}
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
