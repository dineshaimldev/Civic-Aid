import { useState, useEffect, createContext, useContext, Suspense } from 'react'
import Toast, { type ToastItem } from './components/Toast'
import LoadingSplash from './components/LoadingSplash'
import PageSkeleton from './components/PageSkeleton'
import { ErrorBoundary } from './components/ErrorBoundary'
import HomePage from './pages/Home'
import ChatPage from './pages/Chat'
import DocumentUploadPage from './pages/DocumentUpload'
import ProceduresPage from './pages/Procedures'
import AboutPage from './pages/About'

// Application Status feature removed — not implementable for this deployment.
export type Page = 'home' | 'chat' | 'upload' | 'procedures' | 'about'
export type Lang = 'tamil' | 'english'

interface AppCtx {
  lang: Lang
  setLang: (l: Lang) => void
  addToast: (toast: Omit<ToastItem, 'id'>) => void
  navigate: (p: Page) => void
}
export const AppContext = createContext<AppCtx>({
  lang: 'english', setLang: () => {}, addToast: () => {}, navigate: () => {},
})
export const useApp = () => useContext(AppContext)

// Exact nav items from the supplied design — top header, not a sidebar
const navItems: [Page, string][] = [
  ['home', 'Home'],
  ['chat', 'Legal help'],
  ['upload', 'Document analysis'],
  ['procedures', 'Procedure guides'],
  ['about', 'About'],
]

const tamilNav: Record<string, string> = {
  'Home': 'முகப்பு', 'Legal help': 'சட்ட உதவி', 'Document analysis': 'ஆவண வாசிப்பு',
  'Procedure guides': 'வழிகாட்டிகள்', 'About': 'எங்களைப் பற்றி',
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
    <AppContext.Provider value={{ lang, setLang, addToast, navigate }}>
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
            <button onClick={() => navigate('home')} className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#193d2c] text-[#f6f1e6]">✦</span>
              <span className="font-['DM_Sans'] text-lg font-bold tracking-[-.05em]">CivicAid</span>
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

        {/* Status strip */}
        <div className="relative z-10 border-b border-[#dfe3da] bg-[#e7ede3] px-5 py-2 md:px-10 lg:px-14">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 font-['DM_Mono'] text-[9px] uppercase tracking-[.12em] text-[#507050]">
            <span className="flex items-center gap-2">
              <i className="h-1.5 w-1.5 rounded-full bg-[#4e8b4e] inline-block" />
              Answers are drawn from a curated Tamil Nadu legal knowledge base — unverified sources are marked
            </span>
            
          </div>
        </div>

        {/* Page content */}
        <PageWrapper>
          {activePage === 'home' && <HomePage />}
          {activePage === 'chat' && <ChatPage />}
          {activePage === 'upload' && <DocumentUploadPage />}
          {activePage === 'procedures' && <ProceduresPage />}
          {activePage === 'about' && <AboutPage />}
        </PageWrapper>

        {/* Footer — exact match to supplied design */}
        <footer className="relative z-10 border-t border-[#d2d7cd] px-5 py-7 font-['DM_Sans'] text-xs text-[#667066] md:px-10 lg:px-14">
          <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-3">
            <span>© 2025 CivicAid</span>
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
