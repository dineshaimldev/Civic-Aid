import { useEffect, useState } from 'react'
import { useApp } from '../../App'

interface DocItem {
  key: string
  en: string
  ta: string
  critical: boolean
  where: string   // office / portal
  note: string    // fee / time — approximate, confirm locally
}

// The 13 documents to collect before buying village natham land / a house.
const DOCS: DocItem[] = [
  { key: 'deed', en: 'Sale deed (Pathiram)', ta: 'பத்திரம்', critical: true, where: 'Seller / Sub-Registrar', note: 'Registered copy; check the registration number on tnreginet.gov.in' },
  { key: 'mother', en: 'All mother / original deeds', ta: 'மூலப் பத்திரங்கள் அனைத்தும்', critical: true, where: 'Seller', note: 'Unbroken chain of ownership — every earlier sale or gift' },
  { key: 'heir', en: 'Ownership / legal heir certificate', ta: 'உரிமைச் சான்றிதழ்', critical: true, where: 'Tahsildar (Taluk Office)', note: 'Needed when the seller inherited the land. About 30 days' },
  { key: 'patta', en: 'Natham patta (original)', ta: 'கிராம நத்தம் பட்டா அசல்', critical: true, where: 'Taluk Office', note: 'Check the owner name matches the seller' },
  { key: 'chitta', en: 'Natham chitta', ta: 'கிராம நத்தம் சிட்டா', critical: true, where: 'VAO / eservices.tn.gov.in', note: 'Small fee, a few working days' },
  { key: 'adangal', en: 'Natham adangal', ta: 'கிராம நத்தம் அடங்கல்', critical: false, where: 'VAO', note: 'Shows who is in possession' },
  { key: 'areg', en: 'Adangal register (A-Register)', ta: 'அடங்கல் பதிவேடு (A-Register)', critical: true, where: 'Taluk Office', note: 'For natham land the A-Register entry is the basis of title' },
  { key: 'online_chitta', en: 'Online chitta', ta: 'ஆன்லைன் சிட்டா', critical: false, where: 'eservices.tn.gov.in', note: 'Cross-check against the paper chitta' },
  { key: 'fmb', en: 'FMB — field measurement sketch', ta: 'மனையின் புல வரைபடம் FMB', critical: false, where: 'Taluk Survey Office / DSO', note: 'Confirms boundaries and extent. Fee roughly ₹100 and about 30 days' },
  { key: 'topo', en: 'Topo sketch (combined sketch)', ta: 'கூட்டு வரைபடம் Topo Sketch', critical: false, where: 'District Survey Office', note: 'Roughly ₹300–600 and 30–45 days' },
  { key: 'ec', en: 'Encumbrance certificate from 1900 to date', ta: '1900 முதல் தற்போதைய தேதி வரை வில்லங்கச் சான்றிதழ்', critical: true, where: 'Sub-Registrar / tnreginet.gov.in', note: 'Shows loans, mortgages and earlier sales on the property' },
  { key: 'udr', en: 'Natham UDR', ta: 'கிராம நத்தம் UDR', critical: false, where: 'VAO / Taluk Office', note: 'Updated register of the natham site' },
  { key: 'rsr', en: '1912 RSR', ta: '1912 RSR', critical: false, where: 'District Survey Office', note: 'Historic resurvey record; roughly ₹200–500' },
]

type Status = 'have' | 'missing' | 'na'
const KEY = 'civicaid_purchase_check_v1'

function load(): Record<string, Status> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export default function PurchaseChecker() {
  const { lang } = useApp()
  const tamil = lang === 'tamil'
  const [state, setState] = useState<Record<string, Status>>(load)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ } }, [state])

  const set = (k: string, s: Status) => setState(prev => ({ ...prev, [k]: prev[k] === s ? undefined as unknown as Status : s }))

  const have = DOCS.filter(d => state[d.key] === 'have').length
  const na = DOCS.filter(d => state[d.key] === 'na').length
  const applicable = DOCS.length - na
  const missingCritical = DOCS.filter(d => d.critical && state[d.key] !== 'have' && state[d.key] !== 'na')
  const checked = DOCS.filter(d => state[d.key]).length

  let level: 'safe' | 'caution' | 'risky' = 'safe'
  if (missingCritical.length >= 3) level = 'risky'
  else if (missingCritical.length >= 1) level = 'caution'

  const palette = {
    safe:    { bg: '#dff0e6', bd: '#b3d9c4', fg: '#1f5c2a', en: 'LOW RISK — all key documents collected', ta: 'குறைந்த ஆபத்து — முக்கிய ஆவணங்கள் உள்ளன' },
    caution: { bg: '#fdf6e8', bd: '#e9d9ac', fg: '#8a6512', en: 'CAUTION — some key documents are missing', ta: 'எச்சரிக்கை — சில முக்கிய ஆவணங்கள் இல்லை' },
    risky:   { bg: '#f7ddd6', bd: '#e3b3a6', fg: '#a04530', en: 'HIGH RISK — do not pay until these are collected', ta: 'அதிக ஆபத்து — இவை கிடைக்கும் வரை பணம் தர வேண்டாம்' },
  }[level]

  return (
    <div>
      <h3 className="font-['DM_Serif_Display'] text-3xl text-[#193d2c]">{tamil ? 'நிலம் வாங்கும் முன் சரிபார்ப்பு' : 'Pre-purchase land check'}</h3>
      <p className="mt-2 max-w-2xl font-['DM_Sans'] text-[#596458]">
        {tamil
          ? 'கிராம நத்தம் இடம் / வீடு வாங்கும் முன் இந்த 13 ஆவணங்களைச் சரிபார்க்கவும். ஒவ்வொன்றையும் "உள்ளது", "இல்லை" அல்லது "பொருந்தாது" எனக் குறிக்கவும்.'
          : 'Before buying village natham land or a house, collect these 13 documents. Mark each one Have, Missing or N/A.'}
      </p>

      <div className="mt-5 rounded-2xl p-5" style={{ background: checked === 0 ? '#e7ebe2' : palette.bg, border: `1px solid ${checked === 0 ? '#c8d0c4' : palette.bd}` }}>
        <div className="flex items-center justify-between">
          <p className="font-['DM_Sans'] text-sm font-bold" style={{ color: checked === 0 ? '#536053' : palette.fg }}>
            {checked === 0 ? (tamil ? 'தொடங்க கீழே குறியுங்கள்' : 'Mark the documents below to see your risk level') : (tamil ? palette.ta : palette.en)}
          </p>
          <p className="font-['DM_Mono'] text-[11px] text-[#536053]">{have}/{applicable}</p>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/70">
          <div className="h-2 rounded-full" style={{ width: `${applicable ? (have / applicable) * 100 : 0}%`, background: '#193d2c' }} />
        </div>
        {checked > 0 && missingCritical.length > 0 && (
          <p className="mt-3 font-['DM_Sans'] text-[12px] text-[#193426]">
            {tamil ? 'இன்னும் தேவை: ' : 'Still needed: '}<b>{missingCritical.map(d => tamil ? d.ta : d.en).join(' · ')}</b>
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {DOCS.map((d, i) => {
          const s = state[d.key]
          return (
            <div key={d.key} className="rounded-2xl bg-white px-4 py-3" style={{ border: '1px solid #d2d7cd' }}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full font-['DM_Mono'] text-[11px] text-white" style={{ background: s === 'have' ? '#4caf82' : s === 'missing' ? '#a04530' : '#aeb8ab' }}>{i + 1}</span>
                <button onClick={() => setOpen(open === d.key ? null : d.key)} className="min-w-0 flex-1 text-left">
                  <span className="font-['DM_Sans'] text-[14px] font-semibold text-[#193426]">{tamil ? d.ta : d.en}</span>
                  {d.critical && <span className="ml-2 rounded-full bg-[#f4e9cf] px-2 py-0.5 font-['DM_Mono'] text-[9px] text-[#8a6512]">{tamil ? 'முக்கியம்' : 'KEY'}</span>}
                </button>
                <div className="flex gap-1.5">
                  {([['have', tamil ? 'உள்ளது' : 'Have', '#4caf82'], ['missing', tamil ? 'இல்லை' : 'Missing', '#a04530'], ['na', 'N/A', '#8a978a']] as const).map(([v, label, c]) => (
                    <button key={v} onClick={() => set(d.key, v)} className="rounded-full px-3 py-1 font-['DM_Sans'] text-[11px] font-semibold"
                      style={{ background: s === v ? c : '#e7ebe2', color: s === v ? '#fff' : '#536053' }}>{label}</button>
                  ))}
                </div>
              </div>
              {open === d.key && (
                <p className="mt-2 pl-9 font-['DM_Sans'] text-[12px] text-[#536053]">
                  <b>{tamil ? 'எங்கு: ' : 'Where: '}</b>{d.where}. {d.note}. <span className="text-[#8a978a]">{tamil ? '(கட்டணம் மாறலாம் — அலுவலகத்தில் உறுதி செய்யவும்)' : '(Fees may change — confirm at the office.)'}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={() => setState({})} className="font-['DM_Sans'] text-[12px] text-[#a04530]">{tamil ? 'மீட்டமை' : 'Reset checklist'}</button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent((tamil ? 'நத்தம் நிலம் வாங்கும் முன் தேவையான ஆவணங்கள்:\n' : 'Documents to collect before buying natham land:\n') + DOCS.map((d, i) => `${i + 1}. ${tamil ? d.ta : d.en} ${state[d.key] === 'have' ? '✅' : state[d.key] === 'missing' ? '❌' : ''}`).join('\n') + '\n\n— CivicAid')}`}
          target="_blank" rel="noopener noreferrer"
          className="rounded-full px-4 py-2 font-['DM_Sans'] text-[12px] font-semibold text-white" style={{ background: '#25D366' }}>
          {tamil ? 'WhatsApp-ல் பகிர்' : 'Share on WhatsApp'}
        </a>
      </div>
      <p className="mt-4 font-['DM_Sans'] text-[11px] text-[#8a978a]">
        {tamil ? 'இது வழிகாட்டி மட்டுமே. வாங்கும் முன் வழக்கறிஞரிடம் சரிபார்க்கவும் அல்லது 1516 அழைக்கவும்.' : 'This is a guide only. Have a lawyer verify the documents before you pay, or call 1516 for free advice.'}
      </p>
    </div>
  )
}
