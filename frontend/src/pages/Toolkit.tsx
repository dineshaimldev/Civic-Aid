import { useState } from 'react'
import { useApp } from '../App'
import MismatchChecker from '../components/tools/MismatchChecker'
import PetitionMaker from '../components/tools/PetitionMaker'
import ApplicationTracker from '../components/tools/ApplicationTracker'
import PurchaseChecker from '../components/tools/PurchaseChecker'
import OfficeFinder from '../components/tools/OfficeFinder'
import ScamAlert from '../components/tools/ScamAlert'

type Tab = 'purchase' | 'mismatch' | 'petition' | 'tracker' | 'offices' | 'scam'

const TABS: { key: Tab; en: string; ta: string }[] = [
  { key: 'purchase', en: 'Land purchase check', ta: 'நிலம் வாங்கும் சரிபார்ப்பு' },
  { key: 'mismatch', en: 'Document mismatch', ta: 'ஆவண ஒப்பீடு' },
  { key: 'petition', en: 'Petition maker', ta: 'மனு தயாரிப்பு' },
  { key: 'tracker', en: 'Application tracker', ta: 'விண்ணப்ப கண்காணிப்பு' },
  { key: 'offices', en: 'Offices & legal aid', ta: 'அலுவலகங்கள்' },
  { key: 'scam', en: 'Scam alert', ta: 'மோசடி எச்சரிக்கை' },
]

export default function ToolkitPage() {
  const { lang } = useApp()
  const tamil = lang === 'tamil'
  const [tab, setTab] = useState<Tab>('purchase')

  return (
    <div className="relative z-10 mx-auto max-w-[1100px] px-5 pb-20 pt-12 md:px-10">
      <p className="font-['DM_Mono'] text-[10px] uppercase tracking-[.18em] text-[#618062]">{tamil ? 'கருவிகள்' : 'Toolkit'}</p>
      <h1 className="mt-4 font-['DM_Serif_Display'] text-[clamp(2.6rem,5vw,4.5rem)] leading-[.95] tracking-[-.04em] text-[#193d2c]">
        {tamil ? 'உங்கள் வேலையை முடிக்கும் கருவிகள்' : 'Tools to get it done'}
      </h1>

      <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-shrink-0 rounded-full px-4 py-2 font-['DM_Sans'] text-[13px] font-semibold transition"
            style={{ background: tab === t.key ? '#193d2c' : '#e7ebe2', color: tab === t.key ? '#fff' : '#536053' }}>
            {tamil ? t.ta : t.en}
          </button>
        ))}
      </div>

      <div className="mt-8 rounded-[1.6rem] p-6 md:p-9" style={{ background: '#faf9f4', border: '1px solid #d2d7cd' }}>
        {tab === 'purchase' && <PurchaseChecker />}
        {tab === 'mismatch' && <MismatchChecker />}
        {tab === 'petition' && <PetitionMaker />}
        {tab === 'tracker' && <ApplicationTracker />}
        {tab === 'offices' && <OfficeFinder />}
        {tab === 'scam' && <ScamAlert />}
      </div>
    </div>
  )
}
