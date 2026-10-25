import { useState } from 'react'
import { useApp } from '../../App'
import { compareDocuments, ApiError, type CompareResult } from '../../lib/api'

export default function MismatchChecker() {
  const { addToast, lang } = useApp()
  const tamil = lang === 'tamil'
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompareResult | null>(null)

  const onPick = (list: FileList | null) => {
    if (!list) return
    setFiles([...files, ...Array.from(list)].slice(0, 4))
    setResult(null)
  }

  const run = async () => {
    if (files.length < 2) { addToast({ type: 'warning', message: tamil ? 'குறைந்தது 2 ஆவணங்களை பதிவேற்றவும்.' : 'Upload at least 2 documents.' }); return }
    setLoading(true)
    try {
      setResult(await compareDocuments(files))
    } catch (err) {
      addToast({ type: 'error', message: err instanceof ApiError ? err.message : 'Could not compare the documents.' })
    }
    setLoading(false)
  }

  return (
    <div>
      <h3 className="font-['DM_Serif_Display'] text-3xl text-[#193d2c]">{tamil ? 'ஆவணங்களை ஒப்பிடு' : 'Document mismatch checker'}</h3>
      <p className="mt-2 max-w-2xl font-['DM_Sans'] text-[#596458]">
        {tamil
          ? 'பட்டா + சிட்டா, அல்லது விற்பனைப் பத்திரம் + வில்லங்கச் சான்றிதழ் போன்ற 2–4 ஆவணங்களைப் பதிவேற்றவும். பெயர், சர்வே எண், பரப்பளவு, கிராமம் ஆகியவற்றில் வேறுபாடு இருந்தால் காட்டுவோம்.'
          : 'Upload 2–4 documents (for example patta + chitta, or sale deed + EC). We flag differences in owner name, survey number, extent and village.'}
      </p>

      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#aeb8ab] bg-white px-6 py-8 text-center">
        <span className="font-['DM_Sans'] text-sm font-semibold text-[#193d2c]">{tamil ? '+ ஆவணங்களைச் சேர்க்கவும் (PDF / JPG / PNG)' : '+ Add documents (PDF / JPG / PNG)'}</span>
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { onPick(e.target.files); e.target.value = '' }} />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-full bg-[#e7ebe2] px-4 py-2 font-['DM_Sans'] text-[13px] text-[#193426]">
              <span className="truncate">{f.name}</span>
              <button onClick={() => { setFiles(files.filter((_, j) => j !== i)); setResult(null) }} className="ml-3 text-[#a04530]">✕</button>
            </li>
          ))}
        </ul>
      )}

      <button onClick={run} disabled={loading || files.length < 2}
        className="mt-5 rounded-full bg-[#193d2c] px-6 py-3 font-['DM_Sans'] text-sm font-semibold text-white"
        style={{ opacity: loading || files.length < 2 ? 0.55 : 1 }}>
        {loading ? (tamil ? 'ஒப்பிடுகிறோம்…' : 'Comparing…') : (tamil ? 'ஒப்பிடு →' : 'Compare documents →')}
      </button>

      {result && (
        <div className="mt-8">
          {result.all_consistent ? (
            <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: '#dff0e6', border: '1px solid #b3d9c4' }}>
              <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: '#4caf82' }}>✓</span>
              <p className="font-['DM_Sans'] text-sm font-semibold text-[#1f5c2a]">
                {tamil ? 'ஆவணங்களுக்கிடையே வேறுபாடு எதுவும் இல்லை' : 'No mismatches found between these documents'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {result.issues.map((iss, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: iss.severity === 'high' ? '#f7ddd6' : '#fdf6e8', border: `1px solid ${iss.severity === 'high' ? '#e3b3a6' : '#e9d9ac'}` }}>
                  <p className="font-['DM_Sans'] text-sm font-bold" style={{ color: iss.severity === 'high' ? '#a04530' : '#8a6512' }}>
                    {iss.severity === 'high' ? '⚠ ' : '• '}{iss.field} {tamil ? 'வேறுபடுகிறது' : 'does not match'}
                  </p>
                  <p className="mt-1 font-['DM_Sans'] text-[13px] text-[#193426]">{iss.detail}</p>
                  <p className="mt-1 font-['DM_Mono'] text-[10px] text-[#8a978a]">{iss.pair}</p>
                </div>
              ))}
              {result.unreadable.length > 0 && (
                <div className="rounded-xl p-4" style={{ background: '#e7ebe2' }}>
                  <p className="font-['DM_Sans'] text-[13px] text-[#536053]">
                    {tamil ? 'இவற்றைப் படிக்க முடியவில்லை — தெளிவான படத்தைப் பதிவேற்றவும்: ' : 'Could not read these — upload a clearer scan: '}
                    <b>{result.unreadable.join(', ')}</b>
                  </p>
                </div>
              )}
              {result.issues.length > 0 && (
                <p className="font-['DM_Sans'] text-[13px] text-[#193426]">
                  {tamil ? 'அடுத்த படி: VAO / வட்டாட்சியரிடம் திருத்தம் கோரவும் (மனு தயாரிப்பு தாவலில் "பிழை திருத்தம்" தேர்வு).' : 'Next step: ask the VAO / Tahsildar to correct the record. Use "Correction request" in the Petition maker tab to draft it.'}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-xl bg-white" style={{ border: '1px solid #d2d7cd' }}>
            <table className="w-full text-left font-['DM_Sans'] text-[12px] text-[#193426]">
              <thead style={{ background: '#f4f1e9' }}>
                <tr>{['File', 'Type', 'Owner', 'Survey no.', 'Extent', 'Village'].map(h => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {result.documents.map((d, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #e0e4db' }}>
                    <td className="px-3 py-2 max-w-[140px] truncate">{d.filename}</td>
                    <td className="px-3 py-2">{d.doc_type}</td>
                    <td className="px-3 py-2">{d.owner_name || '—'}</td>
                    <td className="px-3 py-2">{d.survey_number || '—'}</td>
                    <td className="px-3 py-2">{d.extent || '—'}</td>
                    <td className="px-3 py-2">{d.village || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-['DM_Sans'] text-[11px] text-[#8a978a]">{result.disclaimer}</p>
        </div>
      )}
    </div>
  )
}
