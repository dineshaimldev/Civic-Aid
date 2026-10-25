import { useState, useEffect } from 'react'
import { useApp } from '../App'
import { generateLetter, ApiError } from '../lib/api'

interface Props {
  open: boolean
  onClose: () => void
  presetRecipientDesignation?: string
  presetRecipientOffice?: string
  presetSubject?: string
  presetDetailsHint?: string
  presetDetails?: string
}

export default function LetterDraftModal({ open, onClose, presetRecipientDesignation, presetRecipientOffice, presetSubject, presetDetailsHint, presetDetails }: Props) {
  const { addToast, lang } = useApp()
  const [applicantName, setApplicantName] = useState('')
  const [fatherName, setFatherName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [recipientDesignation, setRecipientDesignation] = useState('')
  const [recipientOffice, setRecipientOffice] = useState('')
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [surveyNumber, setSurveyNumber] = useState('')
  const [village, setVillage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [letterText, setLetterText] = useState('')

  useEffect(() => {
    if (open) {
      setRecipientDesignation(presetRecipientDesignation ?? '')
      setRecipientOffice(presetRecipientOffice ?? '')
      setSubject(presetSubject ?? '')
      setDetails(presetDetails ?? '')
      setLetterText('')
    }
  }, [open, presetRecipientDesignation, presetRecipientOffice, presetSubject, presetDetails])

  if (!open) return null

  const handleGenerate = async () => {
    if (!applicantName.trim() || !fatherName.trim() || !address.trim() || !phone.trim() || !recipientDesignation.trim() || !recipientOffice.trim() || !subject.trim() || details.trim().length < 10) {
      addToast({ type: 'error', message: 'Please fill in all required fields. Details should be at least a sentence.' })
      return
    }
    setGenerating(true)
    try {
      const result = await generateLetter({
        applicant_name: applicantName.trim(),
        father_or_husband_name: fatherName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        recipient_designation: recipientDesignation.trim(),
        recipient_office: recipientOffice.trim(),
        subject: subject.trim(),
        details: details.trim(),
        survey_number: surveyNumber.trim() || undefined,
        village: village.trim() || undefined,
        lang,
      })
      setLetterText(result.letter_text)
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not generate the letter. Please try again.' })
    }
    setGenerating(false)
  }

  const downloadLetter = () => {
    const blob = new Blob([letterText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CivicAid_Letter_${subject.replace(/\s+/g, '_').slice(0, 40)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyLetter = () => {
    navigator.clipboard.writeText(letterText)
    addToast({ type: 'success', message: 'Letter copied to clipboard.' })
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: 'rgba(25,61,44,0.45)' }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-[1.8rem] p-7 md:p-9"
        style={{ background: '#faf9f4' }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="font-['DM_Mono'] text-[10px] uppercase tracking-[.16em] text-[#618062]">Draft a letter</p>
            <h2 className="mt-2 font-['DM_Serif_Display'] text-3xl text-[#193d2c]">Write your complaint or application</h2>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[#607061]" style={{ background: '#e7ebe2' }}>×</button>
        </div>

        {!letterText ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={applicantName} onChange={e => setApplicantName(e.target.value)} placeholder="Your full name *" className="rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />
              <input value={fatherName} onChange={e => setFatherName(e.target.value)} placeholder="Father's / Husband's name *" className="rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />
            </div>
            <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Your address *" className="min-h-16 rounded-2xl border border-[#c4ccc1] bg-white p-4 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Your phone number *" className="rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />

            <div className="h-px my-1" style={{ background: '#d2d7cd' }} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={recipientDesignation} onChange={e => setRecipientDesignation(e.target.value)} placeholder="Addressed to (e.g. The Tahsildar) *" className="rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />
              <input value={recipientOffice} onChange={e => setRecipientOffice(e.target.value)} placeholder="Office (e.g. Taluk Office, Thiruvallur) *" className="rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />
            </div>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject of your letter *" className="rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />
            <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder={presetDetailsHint ? `${presetDetailsHint} *` : 'Describe what happened, clearly and factually *'} className="min-h-28 rounded-2xl border border-[#c4ccc1] bg-white p-4 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={surveyNumber} onChange={e => setSurveyNumber(e.target.value)} placeholder="Survey number (if land-related)" className="rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />
              <input value={village} onChange={e => setVillage(e.target.value)} placeholder="Village (if land-related)" className="rounded-full border border-[#c4ccc1] bg-white px-4 py-2.5 font-['DM_Sans'] text-sm outline-none focus:border-[#193d2c]" />
            </div>

            <button
              onClick={handleGenerate} disabled={generating}
              className="mt-3 self-start rounded-full px-6 py-3 font-['DM_Sans'] text-sm font-semibold text-white transition"
              style={{ background: '#193d2c', opacity: generating ? 0.6 : 1 }}
            >
              {generating ? 'Drafting…' : 'Generate letter →'}
            </button>
          </div>
        ) : (
          <div>
            <pre className="whitespace-pre-wrap rounded-2xl border p-5 font-['DM_Mono'] text-[12px] leading-relaxed text-[#193426]" style={{ background: '#fff', borderColor: '#d2d7cd', maxHeight: '45vh', overflowY: 'auto' }}>
              {letterText}
            </pre>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => setLetterText('')} className="rounded-full border px-5 py-2.5 font-['DM_Sans'] text-sm font-medium" style={{ borderColor: '#193d2c', color: '#193d2c' }}>Edit details</button>
              <button onClick={copyLetter} className="rounded-full border px-5 py-2.5 font-['DM_Sans'] text-sm font-medium" style={{ borderColor: '#193d2c', color: '#193d2c' }}>Copy</button>
              <button onClick={downloadLetter} className="rounded-full px-5 py-2.5 font-['DM_Sans'] text-sm font-semibold text-white" style={{ background: '#193d2c' }}>Download .txt</button>
            </div>
            <p className="mt-5 font-['DM_Sans'] text-xs text-[#667066]">
              This is a draft. Review every detail before submitting it anywhere. For legal guidance, call <b className="text-[#193d2c]">1516</b> (toll-free, 24/7).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
