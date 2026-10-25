import { useState, useEffect, createContext, useContext, Suspense } from 'react'
import Toast, { type ToastItem } from './components/Toast'
import LoadingSplash from './components/LoadingSplash'
import PageSkeleton from './components/PageSkeleton'
import { ErrorBoundary } from './components/ErrorBoundary'
import HomePage from './pages/Home'
import ChatPage from './pages/Chat'
import DocumentUploadPage from './pages/DocumentUpload'
import ProceduresPage from './pages/Procedures'
import VaultPage from './pages/Vault'
import AboutPage from './pages/About'
import ToolkitPage from './pages/Toolkit'

// Application Status feature removed — not implementable for this deployment.
export type Page = 'home' | 'chat' | 'upload' | 'toolkit' | 'procedures' | 'vault' | 'about'
export type Lang = 'tamil' | 'english'

export interface ActiveDocument {
  title: string
  extractedText: string
  docType: string
}

interface AppCtx {
  lang: Lang
  setLang: (l: Lang) => void
  addToast: (toast: Omit<ToastItem, 'id'>) => void
  navigate: (p: Page) => void
  activeDocument: ActiveDocument | null
  setActiveDocument: (doc: ActiveDocument | null) => void
}
export const AppContext = createContext<AppCtx>({
  lang: 'english', setLang: () => {}, addToast: () => {}, navigate: () => {},
  activeDocument: null, setActiveDocument: () => {},
})
export const useApp = () => useContext(AppContext)

// Exact nav items from the supplied design — top header, not a sidebar
const navItems: [Page, string][] = [
  ['home', 'Home'],
  ['chat', 'Legal help'],
  ['upload', 'Document analysis'],
  ['toolkit', 'Toolkit'],
  ['procedures', 'Procedure guides'],
  ['vault', 'Document vault'],
  ['about', 'About'],
]

const tamilNav: Record<string, string> = {
  'Home': 'முகப்பு', 'Legal help': 'சட்ட உதவி', 'Document analysis': 'ஆவண வாசிப்பு', 'Toolkit': 'கருவிகள்',
  'Procedure guides': 'வழிகாட்டிகள்', 'Document vault': 'ஆவண பெட்டகம்', 'About': 'எங்களைப் பற்றி',
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  const [activePage, setActivePage] = useState<Page>('home')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState<Lang>('english')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [activeDocument, setActiveDocument] = useState<ActiveDocument | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1800)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); addToast({ type: 'success', message: 'You are back online.' }) }
    const handleOffline = () => { setIsOnline(false); addToast({ type: 'warning', message: 'You are offline. Procedure guides still work.' }) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...toast, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))
  const navigate = (page: Page) => { setActivePage(page); setMenuOpen(false); window.scrollTo(0, 0) }
  const tamil = lang === 'tamil'

  if (loading) return <LoadingSplash />

  return (
    <AppContext.Provider value={{ lang, setLang, addToast, navigate, activeDocument, setActiveDocument }}>
      <main className="min-h-screen bg-[#f4f1e9] text-[#193426] selection:bg-[#e6ad36]">
        <div
          className="pointer-events-none fixed inset-0 opacity-[.26]"
          style={{ backgroundImage: 'radial-gradient(#8fa08b .6px,transparent .6px)', backgroundSize: '13px 13px' }}
        />

        {/* Offline banner */}
        {!isOnline && (
          <div className="relative z-30 flex items-center justify-center gap-2 py-2 bg-[#a04530] font-['DM_Sans'] text-[13px] text-[#f7f2e7]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
            </svg>
            You're offline — Procedure guides are available without internet
          </div>
        )}

        {/* Top Header — exact match to supplied design */}
        <header className="relative z-20 border-b border-[#d2d7cd] bg-[#f4f1e9]/90 backdrop-blur sticky top-0">
          <div className="mx-auto flex h-[74px] max-w-[1440px] items-center justify-between px-5 md:px-10 lg:px-14">
            <button onClick={() => navigate('home')} className="flex items-center gap-2.5">
              {/* Inline SVG logo — no background box, matches page colour */}
              <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M34 8.5A17 17 0 1 0 34 31.5" stroke="#193d2c" strokeWidth="3.2" strokeLinecap="round"/>
                <circle cx="20" cy="10" r="2" fill="#193d2c"/>
                <line x1="20" y1="12" x2="20" y2="28" stroke="#193d2c" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="12" y1="16" x2="28" y2="16" stroke="#193d2c" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="13" y1="16" x2="11" y2="22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="13" y1="16" x2="15" y2="22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="27" y1="16" x2="25" y2="22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="27" y1="16" x2="29" y2="22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M10 22 Q13 25.5 16 22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
                <path d="M24 22 Q27 25.5 30 22" stroke="#193d2c" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
                <line x1="17" y1="28" x2="23" y2="28" stroke="#193d2c" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <span style={{ fontFamily: 'DM Sans', fontWeight: 700, fontSize: 18, letterSpacing: '-0.03em' }}>
                <span style={{ color: '#193d2c' }}>Civic</span><span style={{ color: '#2d7a52' }}>Aid</span>
              </span>
            </button>

            <nav className="hidden items-center gap-5 lg:flex">
              {navItems.map(([page, label]) => (
                <button
                  key={page}
                  onClick={() => navigate(page)}
                  className={`font-['DM_Sans'] text-[13px] transition ${activePage === page ? 'font-bold text-[#193d2c]' : 'text-[#607061] hover:text-[#193d2c]'}`}
                >
                  {tamil ? tamilNav[label] : label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setLang(lang === 'english' ? 'tamil' : 'english')}
                className="rounded-full border border-[#aeb8ab] px-3 py-2 font-['DM_Mono'] text-[10px] tracking-wide"
              >
                {tamil ? 'தமிழ்' : 'English'}
              </button>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="grid h-9 w-9 place-items-center rounded-full bg-[#193d2c] text-white lg:hidden"
                aria-label="Open menu"
              >
                {menuOpen ? '×' : '☰'}
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav className="border-t border-[#d2d7cd] bg-[#f4f1e9] px-5 py-4 lg:hidden">
              {navItems.map(([page, label]) => (
                <button
                  key={page}
                  onClick={() => navigate(page)}
                  className={`block w-full py-3 text-left font-['DM_Sans'] text-sm ${activePage === page ? 'font-bold text-[#193d2c]' : 'text-[#647064]'}`}
                >
                  {tamil ? tamilNav[label] : label}
                </button>
              ))}
            </nav>
          )}
        </header>



        {/* Page content */}
        <PageWrapper>
          {activePage === 'home' && <HomePage />}
          {activePage === 'chat' && <ChatPage />}
          {activePage === 'upload' && <DocumentUploadPage />}
          {activePage === 'toolkit' && <ToolkitPage />}
          {activePage === 'procedures' && <ProceduresPage />}
          {activePage === 'vault' && <VaultPage />}
          {activePage === 'about' && <AboutPage />}
        </PageWrapper>

        {/* Footer — exact match to supplied design */}
        <footer className="relative z-10 border-t border-[#d2d7cd] px-5 py-7 font-['DM_Sans'] text-xs text-[#667066] md:px-10 lg:px-14">
          <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-3">
            <span>© 2026 CivicAid</span>
            <button onClick={() => navigate('about')} className="font-semibold text-[#31583d] underline underline-offset-4">
              Share feedback ↗
            </button>
            <span>Guidance, not legal representation.</span>
          </div>
        </footer>

        {/* Toasts */}
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-[340px] max-w-[calc(100vw-2rem)]">
          {toasts.map(t => <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />)}
        </div>
      </main>
    </AppContext.Provider>
  )
}
