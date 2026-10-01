import type { Page, Lang } from '../App'
import { useApp } from '../App'

interface Props {
  activePage: Page
  onNavigate: (page: Page) => void
}

// Application Status tab removed — feature not implementable, removed from project.
const tabs: { page: Page; labels: Record<Lang, string>; iconPath: string }[] = [
  { page: 'home',       labels: { english: 'Home',   tamil: 'முகப்பு' }, iconPath: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { page: 'chat',       labels: { english: 'Chat',   tamil: 'உதவி' },   iconPath: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { page: 'upload',     labels: { english: 'Upload', tamil: 'ஆவணம்' }, iconPath: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12' },
  { page: 'procedures', labels: { english: 'Guide',  tamil: 'வழி' },    iconPath: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01' },
  { page: 'about',      labels: { english: 'About',  tamil: 'பற்றி' },  iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
]

export default function BottomNav({ activePage, onNavigate }: Props) {
  const { lang } = useApp()
  return (
    <nav className="flex items-center" style={{ height: 64, background: '#faf9f4', borderTop: '1px solid #d2d7cd' }}>
      {tabs.map(tab => {
        const isActive = activePage === tab.page
        return (
          <button
            key={tab.page}
            onClick={() => onNavigate(tab.page)}
            aria-label={tab.labels[lang]}
            aria-current={isActive ? 'page' : undefined}
            className="flex-1 flex flex-col items-center justify-center gap-1 relative"
            style={{ height: '100%' }}
          >
            {isActive && (
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, background: '#e6ad36', borderRadius: '0 0 4px 4px' }} />
            )}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#193d2c' : '#8a978a'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {tab.iconPath.split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
            </svg>
            <span style={{ fontFamily: 'DM Sans', fontSize: 10, fontWeight: isActive ? 700 : 400, color: isActive ? '#193d2c' : '#8a978a' }}>
              {tab.labels[lang]}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
