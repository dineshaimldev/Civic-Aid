import { useState } from 'react'
import { useApp } from '../App'
import LetterDraftModal from '../components/LetterDraftModal'

interface Step { title: string; docs: string[]; office: string; timeline: string; tips: string }
interface Guide { id: string; category: string; title: string; subtitle: string; time: string; steps: Step[] }

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-['DM_Mono'] text-[10px] uppercase tracking-[.18em] text-[#618062]">{children}</p>
}

// ── Real guide data — all 4 stages, flattened into one list like the zip's Guides page ──
const GUIDES: Guide[] = [
  { id: 'patta', category: 'Land', title: 'Transfer a Patta after a death', subtitle: 'Gather certificates, apply at the Taluk office, follow the mutation record.', time: '30–45 days', steps: [
    { title: 'Gather Required Documents', docs: ['Current Patta copy', 'Death certificate + legal heir certificate', 'Aadhaar card', 'Encumbrance Certificate (last 30 years)'], office: 'Sub-Registrar Office', timeline: '1–2 days', tips: 'Gather the legal heir certificate first if this is an inheritance case.' },
    { title: 'Obtain Form A', docs: ['Form A (free) — Taluk office or tn.gov.in'], office: 'Taluk Office, Counter 1', timeline: 'Same day', tips: 'Form A is completely free — do not pay anyone for it.' },
    { title: 'Submit Application', docs: ['Completed Form A', 'All documents (2 photocopy sets)'], office: 'Taluk Office, Patta Section', timeline: 'Same day', tips: 'Keep the acknowledgement receipt — it has your tracking number.' },
    { title: 'Field Inspection by VAO', docs: ['Be present on inspection date'], office: 'VAO visits your land', timeline: '7–15 days', tips: 'If VAO does not visit within 15 days, file a complaint at cms.tn.gov.in.' },
    { title: '30-Day Objection Period', docs: [], office: 'Taluk Office Notice Board', timeline: '30 days', tips: 'If no objections are raised, approval proceeds automatically.' },
    { title: 'New Patta Issued', docs: ['Original documents for verification'], office: 'Taluk Office, Patta Desk', timeline: '5–7 days', tips: 'Verify name spelling, survey number, and area before leaving.' },
  ]},
  { id: 'name_correction', category: 'Land', title: 'Correct a name on a patta', subtitle: 'Prepare supporting identity and ownership records before filing.', time: '15–30 days', steps: [
    { title: 'Identify the Discrepancy', docs: ['Current Patta copy', 'Aadhaar showing correct name'], office: 'Compare at home first', timeline: 'Same day', tips: 'Note exactly which spelling or detail is wrong.' },
    { title: 'Gather Supporting Proof', docs: ['Aadhaar', 'Ration card', 'Old records showing correct name'], office: 'Collect before applying', timeline: '1–2 days', tips: 'More supporting documents make correction faster.' },
    { title: 'File Correction Application', docs: ['Written application', 'All supporting proof'], office: 'Taluk Office', timeline: 'Same day', tips: 'No fee for genuine name corrections.' },
    { title: 'Verification & Correction', docs: [], office: 'Tahsildar Office', timeline: '15–30 days', tips: 'Follow up if not resolved within 30 days.' },
  ]},
  { id: 'boundary', category: 'Land', title: 'Resolve a boundary dispute', subtitle: 'Survey your land, file with the VAO, and escalate if encroachment continues.', time: '30–90 days', steps: [
    { title: 'Gather Land Documents', docs: ['Patta', 'Chitta/Adangal', 'FMB', 'Sale deed', 'EC'], office: 'Taluk Office — Survey Section', timeline: '2–3 days', tips: 'FMB is the single most important document for a boundary dispute.' },
    { title: 'File Complaint with VAO', docs: ['Written petition', 'Copies of land documents', 'Photographs'], office: 'Village Administrative Officer', timeline: 'Same day', tips: 'State clearly what your Patta says versus the actual ground situation.' },
    { title: 'Joint Survey Measurement', docs: ['Be present on survey date', 'Original Patta and FMB'], office: 'Revenue Inspector + VAO', timeline: '15–30 days', tips: 'Both parties must be present — insist on advance notice.' },
    { title: 'Tahsildar Order', docs: [], office: 'Tahsildar Office', timeline: '15–30 days', tips: 'Appeal to RDO within 30 days if unsatisfied.' },
  ]},
  { id: 'fraud', category: 'Land', title: 'Report fraudulent land transfer', subtitle: 'Act quickly if your land was transferred without your knowledge.', time: 'Urgent — days', steps: [
    { title: 'Obtain Fraudulent Documents', docs: ['Fraudulent Patta copy', 'Fraudulent sale deed copy'], office: 'Taluk Office & Sub-Registrar', timeline: 'Same day', tips: 'These are public records — you have a right to obtain them immediately.' },
    { title: 'File FIR', docs: ['Copy of fraudulent documents', 'Original Patta', 'Written complaint'], office: 'Local Police Station', timeline: 'Same day', tips: 'File under IPC §420, §467, §468, §471 — these are cognizable offences.' },
    { title: 'File Civil Suit', docs: ['FIR copy', 'All land documents'], office: 'District Munsiff Court', timeline: '1–7 days', tips: 'Apply for interim injunction to stop any further sale immediately.' },
    { title: 'Call Legal Aid', docs: [], office: '1516 (TNSLSA — toll-free, 24/7)', timeline: 'Immediate', tips: 'Time is critical — act within days, not weeks.' },
  ]},
  { id: 'inheritance', category: 'Land', title: 'Apply for legal heir certificate', subtitle: 'Claim your rightful share after a family member\'s death.', time: '15–30 days', steps: [
    { title: 'Obtain Death Certificate', docs: ['Death certificate application', 'Aadhaar'], office: 'Panchayat Office or e-Sevai', timeline: '1–3 days', tips: 'Fee: ₹30. This is needed for everything else.' },
    { title: 'Apply for Legal Heir Certificate', docs: ['Death certificate', 'Ration card', 'Affidavit naming all heirs', 'Aadhaar of all heirs'], office: 'Taluk Office (free) or e-Sevai (₹60)', timeline: '15–30 days', tips: 'A Revenue Inspector will visit your home to verify family members.' },
    { title: 'Know Daughters\' Equal Rights', docs: [], office: 'Understand before proceeding', timeline: 'Same day', tips: 'Daughters have EQUAL rights as sons under the 2005 amendment.' },
    { title: 'Apply for Patta Mutation', docs: ['Legal Heir Certificate', 'Death certificate'], office: 'Taluk Office', timeline: '30–45 days', tips: 'Follow the standard Patta Transfer process next.' },
  ]},
  { id: 'acquisition', category: 'Land', title: 'Respond to land acquisition notice', subtitle: 'Know your rights and claim fair compensation.', time: '60–180 days', steps: [
    { title: 'Read Section 11 Notice', docs: ['Official Gazette notification'], office: 'District Collector', timeline: 'From notice date', tips: 'You have 60 days to object.' },
    { title: 'File Written Objection', docs: ['Objection letter', 'Land documents'], office: 'District Collector Office', timeline: 'Within 60 days', tips: 'Objecting establishes your position for compensation negotiations.' },
    { title: 'Review Compensation Award', docs: ['Award copy', 'Nearby sale deeds for comparison'], office: 'Land Acquisition Officer', timeline: 'After award', tips: 'You are entitled to market value plus 100% solatium.' },
    { title: 'Challenge Inadequate Compensation', docs: ['Award copy', 'Valuation evidence'], office: 'LARRA', timeline: 'Within 6 weeks', tips: 'Call 1516 for free legal aid.' },
  ]},
  { id: 'kist', category: 'Land', title: 'Pay or correct land tax (Kist)', subtitle: 'Pay Kist and fix name or record mismatches.', time: '1–7 days', steps: [
    { title: 'Check Kist Dues', docs: ['Survey number'], office: 'VAO Office or Taluk Office', timeline: 'Same day', tips: 'Kist is very small — typically ₹5–200/year.' },
    { title: 'Pay Kist', docs: ['Survey number'], office: 'VAO, Taluk Office, or tn.payitonline.com', timeline: 'Same day', tips: 'Always collect a receipt — it is critical possession evidence.' },
    { title: 'Fix Name Mismatch', docs: ['New Patta copy'], office: 'Taluk Office Revenue Inspector', timeline: '3–7 days', tips: 'Kist records do not update automatically after Patta transfer.' },
  ]},
  { id: 'registration', category: 'Land', title: 'Register a sale, gift, or mortgage deed', subtitle: 'Register any land deed correctly with the Sub-Registrar.', time: '2–5 days', steps: [
    { title: 'Decide the Deed Type', docs: [], office: 'Understand before drafting', timeline: 'Same day', tips: 'Sale = 7% stamp duty. Family gift/settlement = 1%.' },
    { title: 'Check Guideline Value & EC', docs: ['Survey number'], office: 'tnreginet.gov.in', timeline: '1–2 days', tips: 'Always check EC for the last 30 years before purchase.' },
    { title: 'Pay Stamp Duty', docs: ['Stamp duty amount', 'Registration fee'], office: 'Authorised bank', timeline: 'Same day', tips: 'Registration fee max ₹4,000.' },
    { title: 'Register at Sub-Registrar', docs: ['Deed', 'Aadhaar (both parties)', '2 witnesses'], office: 'Sub-Registrar Office', timeline: 'Same day', tips: 'Registered deed returned in 2–3 working days.' },
  ]},
  { id: 'community_cert', category: 'Certificates', title: 'Apply for a community certificate', subtitle: 'Understand eligibility, documents, and typical verification steps.', time: '7–15 days', steps: [
    { title: 'Gather Documents', docs: ["Parent's community certificate or school TC", 'Aadhaar', 'Ration card'], office: 'Collect before applying', timeline: 'Same day', tips: 'School TC is the easiest proof.' },
    { title: 'Apply at e-Sevai or Taluk Office', docs: ['Application form'], office: 'e-Sevai (₹60) or Taluk Office (free)', timeline: 'Same day', tips: 'e-Sevai is usually faster.' },
    { title: 'Home Verification', docs: ['Be available at registered address'], office: 'Revenue Inspector', timeline: '3–7 days', tips: 'Ensure someone is available to confirm details.' },
    { title: 'Collect Certificate', docs: [], office: 'e-Sevai or edistrict.tn.gov.in', timeline: 'Same day once approved', tips: 'Valid 2 years for education, permanent for TN govt employment.' },
  ]},
  { id: 'income_cert', category: 'Certificates', title: 'Apply for an income certificate', subtitle: 'Annual income proof for scholarships and government schemes.', time: '7–10 days', steps: [
    { title: 'Calculate Annual Income', docs: ['Salary slips or self-declaration affidavit'], office: 'Prepare before applying', timeline: 'Same day', tips: 'Include all income sources combined.' },
    { title: 'Apply at e-Sevai or Taluk Office', docs: ['Aadhaar', 'Ration card', 'Affidavit'], office: 'e-Sevai (₹60) or Taluk Office (free)', timeline: 'Same day', tips: 'Bring originals and photocopies.' },
    { title: 'Verification & Issue', docs: [], office: 'Revenue Inspector → Tahsildar', timeline: '4–8 days', tips: 'Download from edistrict.tn.gov.in once approved.' },
  ]},
  { id: 'fir', category: 'Legal', title: 'Respond to an FIR', subtitle: 'What to do if an FIR has been filed against you or a family member.', time: 'Urgent — days', steps: [
    { title: 'Obtain a Copy of the FIR', docs: ['Valid photo ID'], office: 'Local Police Station', timeline: 'Same day', tips: 'You have a LEGAL RIGHT to a free FIR copy under CrPC §207.' },
    { title: 'Read It Carefully', docs: ['FIR copy'], office: 'At home', timeline: 'Same day', tips: 'Note the sections, appearance date, and investigating officer.' },
    { title: 'Call Legal Aid', docs: [], office: '1516 (toll-free, 24/7)', timeline: 'Immediate', tips: 'A free lawyer must be provided if you cannot afford one.' },
    { title: 'Appear on the Date', docs: ['FIR copy', 'Photo ID', 'Lawyer'], office: 'As mentioned in the FIR', timeline: 'As per notice', tips: 'Never sign anything without reading it fully first.' },
  ]},
  { id: 'court_notice', category: 'Legal', title: 'Respond to a court summons', subtitle: 'Protect your rights when someone files a civil case against you.', time: '7–30 days to respond', steps: [
    { title: 'Read the Summons', docs: ['Court summons'], office: 'At home', timeline: 'Same day', tips: 'Note the deadline to file your Written Statement.' },
    { title: 'Hire a Lawyer or Call Legal Aid', docs: ['Summons copy'], office: '1516 (toll-free, 24/7)', timeline: '1–2 days', tips: 'Do not wait close to the deadline.' },
    { title: 'File Written Statement', docs: ['Written Statement', 'Supporting documents'], office: 'District Court', timeline: 'Within 30 days (CPC Order VIII)', tips: 'Missing this can result in an ex-parte decree against you.' },
    { title: 'Attend the Hearing', docs: ['Original documents', 'Lawyer', 'Photo ID'], office: 'District Court', timeline: 'As scheduled', tips: 'Arrive early, speak only when asked.' },
  ]},
  { id: 'mnrega', category: 'Schemes', title: 'File an MNREGA wage complaint', subtitle: 'Recover unpaid or delayed MNREGA wages.', time: '15–30 days', steps: [
    { title: 'Obtain Job Card & Muster Roll', docs: ['MNREGA Job Card'], office: 'Gram Panchayat Office', timeline: 'Same day', tips: 'These are public records you have a right to see.' },
    { title: 'File Written Complaint', docs: ['Written complaint', 'Job card copy'], office: 'Gram Panchayat', timeline: 'Must respond in 15 days', tips: 'Keep a stamped copy as proof.' },
    { title: 'Escalate to BDO', docs: ['Panchayat complaint copy'], office: 'Block Development Officer', timeline: 'If no response in 15 days', tips: 'Compensation at 0.05% per day for delayed wages.' },
    { title: 'Call National Helpline', docs: ['Job card number'], office: '1800-345-22-44 (toll-free)', timeline: 'If still unresolved', tips: 'Can directly escalate unresolved disputes.' },
  ]},
  { id: 'pension', category: 'Schemes', title: 'Apply for old age or widow pension', subtitle: 'Apply for IGNOAPS old age pension or IGNWPS widow pension.', time: '30–45 days', steps: [
    { title: 'Check Eligibility', docs: [], office: 'Understand before applying', timeline: 'Same day', tips: 'Old age: 60+ and BPL. Widow: 40–79 and BPL.' },
    { title: 'Gather Documents', docs: ['Aadhaar', 'Ration card', 'Age proof', 'BPL certificate', 'Bank passbook'], office: 'Collect before applying', timeline: 'Same day', tips: 'Ensure bank account is active for DBT.' },
    { title: 'Apply at Panchayat or e-Sevai', docs: ['Application form'], office: 'Panchayat Office', timeline: 'Same day', tips: 'Get an acknowledgement receipt.' },
    { title: 'Receive via Bank Transfer', docs: ['Bank passbook'], office: 'Direct Benefit Transfer', timeline: 'Monthly', tips: '₹1000/month (60–79), ₹1500/month (80+).' },
  ]},
]

const CATEGORIES = ['All', 'Land', 'Legal', 'Certificates', 'Schemes']

function Icon({ path, size = 16, color = 'currentColor' }: { path: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {path.split(' M').map((d, i) => <path key={i} d={i === 0 ? d : 'M' + d} />)}
    </svg>
  )
}

export default function ProceduresPage() {
  const { addToast, lang } = useApp()
  const [openAccordion, setOpenAccordion] = useState<number>(0)
  const [filter, setFilter] = useState('All')
  const [activeGuide, setActiveGuide] = useState<Guide | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [expandedStep, setExpandedStep] = useState<number | null>(0)
  const [letterModalOpen, setLetterModalOpen] = useState(false)
  const [letterPreset, setLetterPreset] = useState<{ designation: string; office: string; subject: string } | null>(null)
  const tamil = lang === 'tamil'

  const visibleGuides = filter === 'All' ? GUIDES : GUIDES.filter(g => g.category === filter)

  const openGuide = (g: Guide) => { setActiveGuide(g); setCompletedSteps(new Set()); setExpandedStep(0) }

  const markComplete = (i: number) => {
    const next = new Set(completedSteps); next.add(i); setCompletedSteps(next)
    if (activeGuide && i + 1 < activeGuide.steps.length) setExpandedStep(i + 1)
    else if (activeGuide) addToast({ type: 'success', message: `${activeGuide.title} — all steps completed!` })
  }

  // A step calls for a written letter when its document list mentions one.
  // The button offers a draft pre-addressed to that step's office, saving
  // the person from writing a petition from scratch.
  const stepNeedsLetter = (step: Step) =>
    step.docs.some(d => /written (complaint|petition|application|statement|objection)/i.test(d))

  const openLetterForStep = (step: Step) => {
    setLetterPreset({ designation: `The ${step.office.split(/[,(]/)[0].trim()}`, office: step.office, subject: step.title })
    setLetterModalOpen(true)
  }

  // ── Step-by-step tracker (restyled to zip palette) ──
  if (activeGuide) {
    const steps = activeGuide.steps
    const pct = Math.round((completedSteps.size / steps.length) * 100)
    return (
      <div>
        <div className="max-w-3xl mx-auto px-5 md:px-10 py-12">
          <button onClick={() => setActiveGuide(null)} className="font-['DM_Sans'] text-sm text-[#607061] hover:text-[#193d2c] mb-6">← All guides</button>
          <div className="flex items-start justify-between mb-6 gap-4">
            <div>
              <Eyebrow>{activeGuide.category}</Eyebrow>
              <h1 className="mt-3 font-['DM_Serif_Display'] text-4xl text-[#193d2c]">{activeGuide.title}</h1>
              <p className="mt-3 font-['DM_Sans'] text-[15px] text-[#536053]">{activeGuide.subtitle}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-['DM_Mono'] text-2xl text-[#193d2c]">{pct}%</div>
              <div className="font-['DM_Sans'] text-xs text-[#8a978a]">complete</div>
            </div>
          </div>

          <div className="h-1.5 rounded-full overflow-hidden mb-8" style={{ background: '#e0e5db' }}>
            <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: '#e6ad36' }} />
          </div>

          <div className="flex flex-col gap-3">
            {steps.map((step, i) => {
              const isDone = completedSteps.has(i)
              const isExpanded = expandedStep === i
              return (
                <div key={i} className="rounded-2xl overflow-hidden transition-all" style={{ background: isExpanded ? '#fff' : '#faf9f4', border: `1px solid ${isDone ? '#4e8b4e' : '#d2d7cd'}` }}>
                  <button onClick={() => setExpandedStep(isExpanded ? null : i)} className="w-full flex items-center gap-4 p-4 text-left">
                    <div className="flex-shrink-0 grid place-items-center rounded-full font-['DM_Mono'] text-sm" style={{ width: 34, height: 34, background: isDone ? '#4e8b4e' : '#193d2c', color: '#fff' }}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-['DM_Sans'] text-[15px] font-semibold text-[#193426]">{step.title}</div>
                      <div className="font-['DM_Mono'] text-[10px] text-[#8a978a] mt-0.5">{isDone ? 'Completed' : `Step ${i + 1} of ${steps.length}`}{step.timeline && ` · ${step.timeline}`}</div>
                    </div>
                    <span className="text-[#8a978a]">{isExpanded ? '−' : '+'}</span>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t" style={{ borderColor: '#e0e5db' }}>
                      <div className="pt-4 flex flex-col gap-4">
                        {step.docs.length > 0 && (
                          <div>
                            <Eyebrow>Documents needed</Eyebrow>
                            <ul className="mt-2 space-y-1.5">
                              {step.docs.map(d => <li key={d} className="flex items-start gap-2 font-['DM_Sans'] text-sm text-[#536053]"><span className="text-[#e6ad36]">•</span>{d}</li>)}
                            </ul>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3">
                          <span className="rounded-full px-3 py-1.5 font-['DM_Sans'] text-xs" style={{ background: '#e7ebe2', color: '#365b3b' }}>{step.office}</span>
                        </div>
                        <div className="rounded-xl p-3" style={{ background: '#f7e6bd' }}>
                          <p className="font-['DM_Sans'] text-[13px]" style={{ color: '#765717' }}><b>Tip:</b> {step.tips}</p>
                        </div>
                        {stepNeedsLetter(step) && (
                          <button
                            onClick={() => openLetterForStep(step)}
                            className="flex items-center gap-2 self-start rounded-full border px-4 py-2 font-['DM_Sans'] text-sm font-medium transition"
                            style={{ borderColor: '#193d2c', color: '#193d2c' }}
                          >
                            ✎ Draft this letter for me
                          </button>
                        )}
                        {!isDone && (
                          <button onClick={() => markComplete(i)} className="self-start rounded-full px-5 py-2.5 font-['DM_Sans'] text-sm font-semibold text-white transition" style={{ background: '#193d2c' }}>
                            {i < steps.length - 1 ? 'Mark done & continue →' : '✓ Mark as completed'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {completedSteps.size === steps.length && (
            <div className="mt-8 rounded-[1.8rem] p-8 text-center" style={{ background: '#193d2c' }}>
              <p className="font-['DM_Serif_Display'] text-3xl text-[#f6f1e6]">All steps completed.</p>
              <p className="mt-2 font-['DM_Sans'] text-sm text-[#c6d1c3]">Keep your receipts and new documents safely stored.</p>
              <button onClick={() => setActiveGuide(null)} className="mt-6 rounded-full px-6 py-3 font-['DM_Sans'] text-sm font-semibold" style={{ background: '#e6ad36', color: '#193426' }}>Back to guides</button>
            </div>
          )}
        </div>
        <LetterDraftModal
          open={letterModalOpen}
          onClose={() => setLetterModalOpen(false)}
          presetRecipientDesignation={letterPreset?.designation}
          presetRecipientOffice={letterPreset?.office}
          presetSubject={letterPreset ? `Regarding: ${letterPreset.subject}` : undefined}
        />
      </div>
    )
  }

  // ── Guide list — exact zip "Guides" accordion structure ──
  return (
    <div>
      <section className="relative z-10 mx-auto max-w-[1440px] px-5 pb-11 pt-16 md:px-10 lg:px-14 lg:pb-16 lg:pt-24">
        <Eyebrow>{tamil ? 'செயல்முறை நூலகம் / 03' : 'Procedure library / 03'}</Eyebrow>
        <h1 className="mt-5 max-w-3xl font-['DM_Serif_Display'] text-[clamp(3.4rem,6vw,6.5rem)] leading-[.86] tracking-[-.06em] text-[#193d2c]">
          {tamil ? <>நீங்கள் பின்பற்றக்<br /><em>கூடிய செயல்முறை.</em></> : <>A process you can<br /><em>actually follow.</em></>}
        </h1>
        <p className="mt-7 max-w-xl font-['DM_Sans'] text-lg leading-relaxed text-[#596458]">
          {tamil ? 'பொதுவான பொது சேவை நடைமுறைகளுக்கான எளிய ஆங்கில வழிகாட்டிகள்.' : 'Plain-English guides for common public-service procedures. Save the uncertainty for better things.'}
        </p>
      </section>

      <section className="relative z-10 mx-auto max-w-[1050px] px-5 pb-6 md:px-10">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => { setFilter(c); setOpenAccordion(0) }} className="rounded-full px-4 py-2 font-['DM_Sans'] text-sm transition"
              style={{ background: filter === c ? '#193d2c' : 'transparent', color: filter === c ? '#fff' : '#607061', border: `1px solid ${filter === c ? '#193d2c' : '#c4ccc1'}` }}>
              {c} {c !== 'All' && <span className="opacity-60">({GUIDES.filter(g => g.category === c).length})</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-[1050px] px-5 pb-20 md:px-10">
        {visibleGuides.map((guide, i) => (
          <article key={guide.id} className="border-t border-[#bfc8bd] py-6 last:border-b">
            <button onClick={() => setOpenAccordion(i === openAccordion ? -1 : i)} className="flex w-full items-center justify-between gap-5 text-left">
              <span className="flex gap-6">
                <b className="pt-1 font-['DM_Mono'] text-[10px] text-[#d58920]">0{i + 1}</b>
                <h2 className="font-['DM_Serif_Display'] text-2xl md:text-3xl text-[#193d2c]">{guide.title}</h2>
              </span>
              <span className="text-xl text-[#607061] flex-shrink-0">{openAccordion === i ? '−' : '+'}</span>
            </button>
            {openAccordion === i && (
              <div className="ml-10 mt-5 max-w-xl pb-3 font-['DM_Sans'] leading-relaxed text-[#5d695c]">
                <p>{guide.subtitle}</p>
                <div className="mt-3 flex gap-3">
                  <span className="rounded-full px-3 py-1 font-['DM_Mono'] text-[10px]" style={{ background: '#e7ebe2', color: '#365b3b' }}>{guide.steps.length} steps</span>
                  <span className="rounded-full px-3 py-1 font-['DM_Mono'] text-[10px]" style={{ background: '#f7e6bd', color: '#765717' }}>{guide.time}</span>
                </div>
                <button onClick={() => openGuide(guide)} className="mt-5 border-b border-[#7c927b] pb-1 text-sm font-semibold text-[#315a3e]">
                  Open step-by-step guide →
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}
