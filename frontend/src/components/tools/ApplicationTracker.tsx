import { useEffect, useState } from 'react'
import { useApp } from '../../App'
import LetterDraftModal from '../LetterDraftModal'

// Escalation ladder for Tamil Nadu revenue matters. Days are typical expected
// response times; the person should confirm the exact limit with the office.
const LADDER = [
  { key: 'vao', en: 'VAO (Village Administrative Officer)', ta: 'கிராம நிர்வாக அலுவலர் (VAO)', days: 15, designation: 'The Village Administrative Officer', office: 'Village Administrative Office' },
  { key: 'tahsildar', en: 'Tahsildar (Taluk Office)', ta: 'வட்டாட்சியர் (தாலுகா அலுவலகம்)', days: 30, designation: 'The Tahsildar', office: 'Taluk Office' },
  { key: 'rdo', en: 'RDO (Revenue Divisional Officer)', ta: 'கோட்டாட்சியர் (RDO)', days: 30, designation: 'The Revenue Divisional Officer', office: 'RDO Office' },
  { key: 'collector', en: 'District Collector (Grievance Day — Mondays)', ta: 'மாவட்ட ஆட்சியர் (திங்கள் குறைதீர் நாள்)', days: 30, designation: 'The District Collector', office: 'Collectorate' },
  { key: 'cm', en: 'CM Helpline 1100 / CM Cell / Lokayukta', ta: 'முதல்வர் உதவி எண் 1100 / முதல்வர் தனிப்பிரிவு', days: 30, designation: 'The Chief Minister\'s Special Cell', office: 'Secretariat, Chennai' },
] as const

interface TrackedApp {
  id: string
  title: string
  level: number          // index in LADDER where it currently sits
  since: string          // ISO date it was submitted / last escalated
  resolved: boolean
  history: string[]
}

const KEY = 'civicaid_applications_v1'

function load(): TrackedApp[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

const daysBetween = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

export default function ApplicationTracker() {
  const { lang, addToast } = useApp()
  const tamil = lang === 'tamil'
  const [apps, setApps] = useState<TrackedApp[]>(load)
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState(0)
  const [since, setSince] = useState(new Date().toISOString().slice(0, 10))
  const [draftFor, setDraftFor] = useState<{ app: TrackedApp; next: number } | null>(null)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(apps)) } catch { /* storage unavailable */ } }, [apps])

  const add = () => {
    if (!title.trim()) { addToast({ type: 'warning', message: tamil ? 'விண்ணப்பத்தின் பெயரை உள்ளிடவும்.' : 'Enter what you applied for.' }); return }
    setApps([{ id: Date.now().toString(), title: title.trim(), level, since, resolved: false, history: [`${since}: ${LADDER[level].en}`] }, ...apps])
    setTitle('')
  }

  const escalate = (a: TrackedApp) => {
    const next = Math.min(a.level + 1, LADDER.length - 1)
    const today = new Date().toISOString().slice(0, 10)
    setApps(apps.map(x => x.id === a.id ? { ...x, level: next, since: today, history: [...x.history, `${today}: ${LADDER[next].en}`] } : x))
  }

  return (
    <div>
      <h3 className="font-['DM_Serif_Display'] text-3xl text-[#193d2c]">{tamil ? 'விண்ணப்ப கண்காணிப்பு' : 'Application tracker'}</h3>
      <p className="mt-2 max-w-2xl font-['DM_Sans'] text-[#596458]">
        {tamil
          ? 'நீங்கள் அளித்த விண்ணப்பத்தை இங்கே பதிவு செய்யுங்கள். காலம் கடந்தால் அடுத்த அதிகாரியிடம் எப்படி செல்வது என்று காட்டுவோம்.'
          : 'Log an application you submitted. If the time limit passes, we show who to escalate to next and draft the petition.'}
      </p>
      <p className="mt-1 font-['DM_Sans'] text-[12px] text-[#8a978a]">
        {tamil ? 'தரவு உங்கள் சாதனத்தில் மட்டுமே சேமிக்கப்படும்.' : 'Saved only on this device.'}
      </p>

      <div className="mt-5 grid gap-3 rounded-2xl bg-white p-5" style={{ border: '1px solid #d2d7cd' }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={tamil ? 'எதற்காக விண்ணப்பித்தீர்கள்? (எ.கா. பட்டா பெயர் மாற்றம்)' : 'What did you apply for? (e.g. Patta name change)'}
          className="rounded-full border border-[#c4ccc1] px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={level} onChange={e => setLevel(Number(e.target.value))} className="rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm">
            {LADDER.map((l, i) => <option key={l.key} value={i}>{tamil ? l.ta : l.en}</option>)}
          </select>
          <input type="date" value={since} max={new Date().toISOString().slice(0, 10)} onChange={e => setSince(e.target.value)}
            className="rounded-full border border-[#c4ccc1] px-4 py-2.5 font-['DM_Sans'] text-sm" />
        </div>
        <button onClick={add} className="self-start rounded-full bg-[#193d2c] px-6 py-2.5 font-['DM_Sans'] text-sm font-semibold text-white">
          {tamil ? 'சேர் +' : 'Track it +'}
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {apps.length === 0 && <p className="font-['DM_Sans'] text-sm text-[#8a978a]">{tamil ? 'இன்னும் எதுவும் இல்லை.' : 'Nothing tracked yet.'}</p>}
        {apps.map(a => {
          const cur = LADDER[a.level]
          const elapsed = daysBetween(a.since)
          const overdue = !a.resolved && elapsed > cur.days
          const isLast = a.level >= LADDER.length - 1
          return (
            <div key={a.id} className="rounded-2xl p-5" style={{ background: a.resolved ? '#dff0e6' : overdue ? '#f7ddd6' : '#faf9f4', border: `1px solid ${a.resolved ? '#b3d9c4' : overdue ? '#e3b3a6' : '#d2d7cd'}` }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-['DM_Sans'] text-[15px] font-semibold text-[#193d2c]">{a.title}</p>
                <span className="rounded-full px-3 py-1 font-['DM_Mono'] text-[10px]" style={{ background: a.resolved ? '#4caf82' : overdue ? '#a04530' : '#e6ad36', color: a.resolved || overdue ? '#fff' : '#193426' }}>
                  {a.resolved ? (tamil ? 'முடிந்தது' : 'RESOLVED') : overdue ? (tamil ? 'காலம் கடந்தது' : 'OVERDUE') : (tamil ? 'நடைபெறுகிறது' : 'IN PROGRESS')}
                </span>
              </div>
              <p className="mt-1 font-['DM_Sans'] text-[13px] text-[#536053]">
                {tamil ? cur.ta : cur.en} · {elapsed} {tamil ? 'நாட்கள் ஆயிற்று' : 'days since'} ({tamil ? 'எதிர்பார்ப்பு' : 'expected'} ~{cur.days} {tamil ? 'நாட்கள்' : 'days'})
              </p>

              {/* ladder progress */}
              <div className="mt-3 flex gap-1">
                {LADDER.map((l, i) => <div key={l.key} title={l.en} className="h-1.5 flex-1 rounded-full" style={{ background: i <= a.level ? (overdue && i === a.level ? '#a04530' : '#193d2c') : '#d2d7cd' }} />)}
              </div>

              {overdue && !isLast && (
                <div className="mt-4 rounded-xl bg-white p-4" style={{ border: '1px solid #e3b3a6' }}>
                  <p className="font-['DM_Sans'] text-[13px] text-[#193426]">
                    <b>{tamil ? 'அடுத்த படி: ' : 'Next step: '}</b>{tamil ? LADDER[a.level + 1].ta : LADDER[a.level + 1].en}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => setDraftFor({ app: a, next: a.level + 1 })} className="rounded-full bg-[#193d2c] px-4 py-2 font-['DM_Sans'] text-[12px] font-semibold text-white">
                      {tamil ? 'மனு தயார் செய் →' : 'Draft escalation petition →'}
                    </button>
                    <button onClick={() => escalate(a)} className="rounded-full border border-[#193d2c] px-4 py-2 font-['DM_Sans'] text-[12px] font-semibold text-[#193d2c]">
                      {tamil ? 'அடுத்த நிலைக்கு அனுப்பினேன்' : 'I have escalated'}
                    </button>
                  </div>
                </div>
              )}
              {overdue && isLast && (
                <p className="mt-3 font-['DM_Sans'] text-[13px] text-[#a04530]">{tamil ? 'இது கடைசி நிலை. இலவச சட்ட உதவிக்கு 1516 அழைக்கவும் அல்லது RTI மனு தாக்கல் செய்யவும்.' : 'This is the last step on the ladder. Call 1516 for free legal help, or file an RTI to ask why it is pending.'}</p>
              )}

              <div className="mt-3 flex gap-3">
                {!a.resolved && <button onClick={() => setApps(apps.map(x => x.id === a.id ? { ...x, resolved: true } : x))} className="font-['DM_Sans'] text-[12px] font-semibold text-[#1f5c2a]">✓ {tamil ? 'முடிந்தது' : 'Mark resolved'}</button>}
                <button onClick={() => setApps(apps.filter(x => x.id !== a.id))} className="font-['DM_Sans'] text-[12px] text-[#a04530]">{tamil ? 'நீக்கு' : 'Delete'}</button>
              </div>
            </div>
          )
        })}
      </div>

      <LetterDraftModal
        open={!!draftFor}
        onClose={() => setDraftFor(null)}
        presetRecipientDesignation={draftFor ? LADDER[draftFor.next].designation : undefined}
        presetRecipientOffice={draftFor ? LADDER[draftFor.next].office : undefined}
        presetSubject={draftFor ? `Escalation: no action on my application — ${draftFor.app.title}` : undefined}
        presetDetails={draftFor ? `I submitted an application for "${draftFor.app.title}" to the ${LADDER[draftFor.app.level].designation} on ${draftFor.app.since}. ${daysBetween(draftFor.app.since)} days have passed and no action has been taken. I request your intervention to have my application disposed of at the earliest.` : undefined}
        presetDetailsHint="Add your application number and any reference given by the office."
      />
    </div>
  )
}
