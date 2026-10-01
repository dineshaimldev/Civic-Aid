import { useState } from 'react'
import { useApp } from '../App'
import { submitCorruptionReport, ApiError } from '../lib/api'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-['DM_Mono'] text-[10px] uppercase tracking-[.18em] text-[#618062]">{children}</p>
}

export default function AboutPage() {
  const { lang, addToast } = useApp()
  const [sent, setSent] = useState(false)
  const [mood, setMood] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const tamil = lang === 'tamil'

  // Feature #4 — Corruption Reporting
  const [reportOffice, setReportOffice] = useState('')
  const [reportOfficer, setReportOfficer] = useState('')
  const [reportDesc, setReportDesc] = useState('')
  const [reportAmount, setReportAmount] = useState('')
  const [reportPhone, setReportPhone] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportResult, setReportResult] = useState<{ report_id: string; dvac_reference_note: string } | null>(null)

  const submitReport = async () => {
    if (!reportOffice.trim() || reportDesc.trim().length < 10) {
      addToast({ type: 'error', message: 'Please name the office and describe what happened (at least a sentence).' })
      return
    }
    setReportSubmitting(true)
    try {
      const result = await submitCorruptionReport({
        office_name: reportOffice.trim(),
        officer_designation: reportOfficer.trim() || undefined,
        incident_description: reportDesc.trim(),
        amount_demanded: reportAmount.trim() || undefined,
        contact_phone: reportPhone.trim() || undefined,
      })
      setReportResult(result)
      addToast({ type: 'success', message: 'Report prepared. See your DVAC reference below.' })
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not submit. Please try again.' })
    }
    setReportSubmitting(false)
  }

  const submitFeedback = () => {
    setSent(true)
    addToast({ type: 'success', message: 'Thank you for helping.' })
  }

  return (
    <div>
      <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-11 pt-16 md:px-10 lg:px-14 lg:pb-16 lg:pt-24">
        <Eyebrow>{tamil ? 'CivicAid ஏன் உள்ளது' : 'Why CivicAid exists'}</Eyebrow>
        <h1 className="mt-5 max-w-3xl font-['DM_Serif_Display'] text-[clamp(3.4rem,6vw,6.5rem)] leading-[.86] tracking-[-.06em] text-[#193d2c]">
          {tamil ? <>பொது அமைப்புகள்<br /><em>படிக்கக்கூடியதாக இருக்க வேண்டும்.</em></> : <>Public systems<br /><em>should be legible.</em></>}
        </h1>
        <p className="mt-7 max-w-xl font-['DM_Sans'] text-lg leading-relaxed text-[#596458]">
          {tamil ? 'CivicAid என்பது தமிழ்நாட்டில் அன்றாட உரிமைகள் மற்றும் பொது சேவைகளுக்கான மக்கள்-முதன்மை வழிகாட்டி.' : 'CivicAid is a people-first guide to everyday rights and public services in Tamil Nadu.'}
        </p>
      </section>

      <section className="relative z-10 mx-auto grid max-w-[1440px] gap-12 px-5 pb-20 md:px-10 lg:grid-cols-2 lg:px-14">
        <div className="rounded-[1.8rem] bg-[#193d2c] p-8 text-[#f5f0e5] md:p-11">
          <Eyebrow>{tamil ? 'எங்கள் உறுதிமொழி' : 'Our promise'}</Eyebrow>
          <p className="mt-7 font-['DM_Serif_Display'] text-4xl leading-[.95]">
            {tamil ? 'சிக்கலுக்கு முன் தெளிவு. அதிகாரத்துவத்திற்கு முன் கண்ணியம்.' : 'Clarity before complexity. Dignity before bureaucracy.'}
          </p>
        </div>
        <div className="space-y-7 pt-4 font-['DM_Sans'] leading-relaxed text-[#536053]">
          <p>{tamil ? 'சட்ட மற்றும் அரசு நடைமுறைகளை பயனுள்ள அடுத்த படிகளாக நாங்கள் மொழிபெயர்க்கிறோம் — அமைப்பை ஏற்கனவே தெரியாததால் மக்களை சிறியதாக உணர வைக்காமல்.' : 'We translate legal and government procedures into useful next steps — without making people feel small for not already knowing the system.'}</p>
          <p>{tamil ? 'CivicAid அங்கீகரிக்கப்பட்ட சட்ட நிபுணர்கள் மற்றும் அரசு அலுவலகங்களை மாற்ற அல்ல, ஆதரிக்க வடிவமைக்கப்பட்டுள்ளது.' : 'CivicAid is designed to support, not replace, accredited legal professionals and government offices.'}</p>
          <div className="border-t border-[#c7cec3] pt-5">
            <Eyebrow>{tamil ? 'கொள்கைகள்' : 'Principles'}</Eyebrow>
            <p className="mt-3 font-['DM_Serif_Display'] text-2xl text-[#193d2c]">
              {tamil ? 'எளிய மொழி · உள்ளூர் சூழல் · இயல்பாக தனிப்பட்டது' : 'Plain language · Local context · Private by default'}
            </p>
          </div>
        </div>
      </section>

      {/* Feedback — kept as local UI state, exactly matching the zip's Feedback page (no backend claim) */}
      <section className="relative z-10 mx-auto max-w-[900px] px-5 pb-20 md:px-10">
        <Eyebrow>{tamil ? 'சேவையை வடிவமைக்கவும்' : 'Shape the service'}</Eyebrow>
        <h2 className="mt-4 font-['DM_Serif_Display'] text-4xl text-[#193d2c]">
          {tamil ? <>எது தெளிவாக<br /><em>இருக்கலாம் என்று சொல்லுங்கள்.</em></> : <>Tell us what<br /><em>could be clearer.</em></>}
        </h2>
        <div className="mt-8 rounded-[1.8rem] bg-[#faf9f4] p-7 shadow-[0_15px_35px_rgba(30,54,38,.08)] md:p-10">
          {sent ? (
            <div className="py-10 text-center">
              <span className="text-4xl">✦</span>
              <h2 className="mt-5 font-['DM_Serif_Display'] text-4xl text-[#193d2c]">Thank you for helping.</h2>
              <p className="mt-4 font-['DM_Sans'] text-[#617061]">Your feedback has been received.</p>
            </div>
          ) : (
            <>
              <label className="font-['DM_Mono'] text-[10px] uppercase tracking-[.16em] text-[#618062]">How was your experience?</label>
              <div className="mt-4 flex flex-wrap gap-3">
                {['Clear', 'Useful', 'Confusing', 'Incomplete'].map(x => (
                  <button key={x} onClick={() => setMood(x)} className="rounded-full border px-4 py-2 font-['DM_Sans'] text-sm transition"
                    style={{ borderColor: mood === x ? '#193d2c' : '#c4ccc1', background: mood === x ? '#e8eee5' : 'transparent' }}>
                    {x}
                  </button>
                ))}
              </div>
              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                className="mt-8 min-h-36 w-full rounded-2xl border border-[#c4ccc1] bg-white p-5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]"
                placeholder="What should we improve?"
              />
              <button onClick={submitFeedback} className="mt-5 rounded-full bg-[#193d2c] px-6 py-4 font-['DM_Sans'] text-sm font-semibold text-white transition hover:-translate-y-0.5">
                Send feedback →
              </button>
            </>
          )}
        </div>
      </section>

      {/* Feature #4 — Corruption Reporting */}
      <section className="relative z-10 mx-auto max-w-[900px] px-5 pb-20 md:px-10">
        <Eyebrow>{tamil ? 'ஊழல் புகார்' : 'Report corruption'}</Eyebrow>
        <h2 className="mt-4 font-['DM_Serif_Display'] text-4xl text-[#193d2c]">
          {tamil ? <>இலஞ்சம் கேட்கப்பட்டதா?<br /><em>அநாமதேயமாக புகாரளிக்கவும்.</em></> : <>Asked for a bribe?<br /><em>Report it anonymously.</em></>}
        </h2>
        <p className="mt-4 max-w-lg font-['DM_Sans'] text-[15px] text-[#536053] leading-relaxed">
          {tamil ? 'இலஞ்சம் கேட்பது சட்டத்திற்குப் புறம்பானது. உங்கள் பெயர் இல்லாமல் புகார் தயார் செய்யப்படும்.' : 'Demanding a bribe is a criminal offence under the Prevention of Corruption Act 1988. Your report is anonymous by default — no name required.'}
        </p>
        <div className="mt-8 rounded-[1.8rem] p-7 md:p-10" style={{ background: '#193d2c' }}>
          {reportResult ? (
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: '#e6ad36' }}>✓</span>
              <h3 className="mt-5 font-['DM_Serif_Display'] text-2xl text-[#f6f1e6]">Report prepared</h3>
              <p className="mt-2 font-['DM_Sans'] text-sm text-[#c6d1c3]">Reference: <span className="font-['DM_Mono']">{reportResult.report_id}</span></p>
              <pre className="mt-5 whitespace-pre-wrap rounded-2xl p-5 font-['DM_Mono'] text-[11px] leading-relaxed" style={{ background: '#122c20', color: '#ced8cb' }}>{reportResult.dvac_reference_note}</pre>
              <p className="mt-5 font-['DM_Sans'] text-sm text-[#c6d1c3]">Submit this to DVAC via helpline <b className="text-[#e6ad36]">044-28592750</b>, email <b className="text-[#e6ad36]">dvac.tn@nic.in</b>, or their online portal.</p>
              <button onClick={() => setReportResult(null)} className="mt-6 rounded-full px-5 py-2.5 font-['DM_Sans'] text-sm font-semibold" style={{ background: '#e6ad36', color: '#193426' }}>File another report</button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <input value={reportOffice} onChange={e => setReportOffice(e.target.value)} placeholder="Office / department name *" className="rounded-full border-0 bg-[#f4f1e9] px-5 py-3 font-['DM_Sans'] text-sm outline-none" />
              <input value={reportOfficer} onChange={e => setReportOfficer(e.target.value)} placeholder="Officer designation (optional)" className="rounded-full border-0 bg-[#f4f1e9] px-5 py-3 font-['DM_Sans'] text-sm outline-none" />
              <input value={reportAmount} onChange={e => setReportAmount(e.target.value)} placeholder="Amount demanded (optional)" className="rounded-full border-0 bg-[#f4f1e9] px-5 py-3 font-['DM_Sans'] text-sm outline-none" />
              <textarea value={reportDesc} onChange={e => setReportDesc(e.target.value)} placeholder="What happened? *" className="min-h-28 rounded-2xl border-0 bg-[#f4f1e9] p-5 font-['DM_Sans'] text-sm outline-none" />
              <input value={reportPhone} onChange={e => setReportPhone(e.target.value)} placeholder="Your phone (optional — leave blank to stay fully anonymous)" className="rounded-full border-0 bg-[#f4f1e9] px-5 py-3 font-['DM_Sans'] text-sm outline-none" />
              <button onClick={submitReport} disabled={reportSubmitting} className="self-start rounded-full px-6 py-3 font-['DM_Sans'] text-sm font-semibold" style={{ background: '#e6ad36', color: '#193426', opacity: reportSubmitting ? 0.6 : 1 }}>
                {reportSubmitting ? 'Preparing…' : 'Prepare report →'}
              </button>
            </div>
          )}
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#d2d7cd] px-5 py-7 font-['DM_Sans'] text-xs text-[#667066] md:px-10 lg:px-14">
        <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-3">
          <span>© 2025 CivicAid</span>
          <span>Guidance, not legal representation. Call <b className="text-[#193d2c]">1516</b> for serious matters.</span>
        </div>
      </footer>
    </div>
  )
}
