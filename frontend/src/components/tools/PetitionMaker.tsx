import { useState } from 'react'
import { useApp } from '../../App'
import LetterDraftModal from '../LetterDraftModal'

export interface PetitionPreset {
  key: string
  en: string
  ta: string
  designation: string
  office: string
  subject: string
  hint: string
}

// Mirrors LETTER_PRESETS in the backend so the picker works even before the server answers.
export const PETITIONS: PetitionPreset[] = [
  { key: 'rti', en: 'RTI application', ta: 'தகவல் அறியும் உரிமை (RTI) மனு', designation: 'The Public Information Officer (PIO)', office: '', subject: 'Application under Section 6(1) of the Right to Information Act, 2005', hint: 'List exactly what information you want, e.g. status of my patta application no. ___ dated ___, officer holding the file, and reasons for delay. Fee ₹10 (BPL exempt).' },
  { key: 'fir', en: 'FIR / police complaint', ta: 'காவல் புகார் (FIR)', designation: 'The Station House Officer', office: 'Police Station', subject: 'Complaint requesting registration of FIR', hint: 'Date, time and place of incident; who did it; what happened in order; witnesses and evidence. If police refuse, send the same complaint by post to the Superintendent of Police.' },
  { key: 'correction', en: 'Patta / Chitta correction', ta: 'பட்டா / சிட்டா பிழை திருத்தம்', designation: 'The Tahsildar', office: 'Taluk Office', subject: 'Request for correction of errors in Patta / Chitta records', hint: 'What is wrong (name spelling, survey number, extent) versus what your registered document shows. Attach copies of both.' },
  { key: 'mutation', en: 'Patta name change (mutation)', ta: 'பட்டா பெயர் மாற்றம்', designation: 'The Tahsildar', office: 'Taluk Office', subject: 'Application for transfer of Patta to my name (mutation)', hint: 'How you got the land (sale deed no. & date / inheritance / partition). Attach deed, EC and previous patta.' },
  { key: 'heir', en: 'Legal heir certificate', ta: 'வாரிசு சான்றிதழ்', designation: 'The Tahsildar', office: 'Taluk Office', subject: 'Application for Legal Heir Certificate', hint: "Deceased person's name, date of death, each heir's relationship. Attach death certificate and ID of all heirs." },
  { key: 'vao_delay', en: 'Complaint: VAO delay', ta: 'VAO தாமதம் குறித்த புகார்', designation: 'The Tahsildar', office: 'Taluk Office', subject: 'Complaint regarding delay in VAO field inspection for Patta transfer application', hint: 'Application number, date submitted, and days passed without inspection.' },
  { key: 'boundary', en: 'Boundary / encroachment', ta: 'எல்லை / ஆக்கிரமிப்பு புகார்', designation: 'The Village Administrative Officer', office: 'Village Administrative Office', subject: 'Complaint regarding boundary encroachment on my land', hint: 'What your Patta/FMB shows versus the ground situation, and who is encroaching.' },
  { key: 'fraud', en: 'Fraudulent transfer', ta: 'மோசடி பட்டா மாற்றம்', designation: 'The Tahsildar', office: 'Taluk Office', subject: 'Urgent complaint regarding fraudulent transfer of my land without consent', hint: 'When you found out, and documents proving your original ownership.' },
  { key: 'collector', en: 'Grievance to Collector', ta: 'ஆட்சியருக்கு குறைதீர் மனு', designation: 'The District Collector', office: 'Collectorate', subject: 'Grievance petition — no action taken by lower revenue officials', hint: 'List each earlier petition with date and office, and state that no action was taken in time.' },
]

export default function PetitionMaker() {
  const { lang } = useApp()
  const tamil = lang === 'tamil'
  const [active, setActive] = useState<PetitionPreset | null>(null)

  return (
    <div>
      <h3 className="font-['DM_Serif_Display'] text-3xl text-[#193d2c]">{tamil ? 'மனு தயாரிப்பு' : 'Petition maker'}</h3>
      <p className="mt-2 max-w-2xl font-['DM_Sans'] text-[#596458]">
        {tamil
          ? 'ஒரு வகையைத் தேர்ந்தெடுங்கள். சில விவரங்களை நிரப்பினால் கையொப்பமிடத் தயாரான மனு கிடைக்கும்.'
          : 'Pick a type, fill in a few details, and get a ready-to-sign petition in standard format.'}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {PETITIONS.map(p => (
          <button key={p.key} onClick={() => setActive(p)}
            className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-left transition hover:-translate-y-0.5"
            style={{ border: '1px solid #d2d7cd' }}>
            <span className="font-['DM_Sans'] text-[15px] font-semibold text-[#193d2c]">{tamil ? p.ta : p.en}</span>
            <span className="text-[#d58920]">→</span>
          </button>
        ))}
      </div>
      <LetterDraftModal
        open={!!active}
        onClose={() => setActive(null)}
        presetRecipientDesignation={active?.designation}
        presetRecipientOffice={active?.office}
        presetSubject={active?.subject}
        presetDetailsHint={active?.hint}
      />
    </div>
  )
}
