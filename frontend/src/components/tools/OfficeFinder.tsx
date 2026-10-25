import { useEffect, useState } from 'react'
import { useApp } from '../../App'
import { getEscalationContacts, type DistrictContact } from '../../lib/api'

const OFFICES = [
  { q: 'Village Administrative Officer office', en: 'VAO office', ta: 'கிராம நிர்வாக அலுவலகம் (VAO)', for_en: 'Chitta, adangal, community / income certificate, first inspection', for_ta: 'சிட்டா, அடங்கல், சாதி / வருமானச் சான்றிதழ்' },
  { q: 'Taluk office Tahsildar', en: 'Taluk office (Tahsildar)', ta: 'தாலுகா அலுவலகம் (வட்டாட்சியர்)', for_en: 'Patta transfer, legal heir certificate, A-Register', for_ta: 'பட்டா மாற்றம், வாரிசு சான்றிதழ், A-Register' },
  { q: 'Sub Registrar office', en: 'Sub-Registrar office', ta: 'சார்பதிவாளர் அலுவலகம்', for_en: 'Sale deed registration, encumbrance certificate', for_ta: 'பத்திரப் பதிவு, வில்லங்கச் சான்றிதழ்' },
  { q: 'Revenue Divisional Officer RDO office', en: 'RDO office', ta: 'கோட்டாட்சியர் அலுவலகம் (RDO)', for_en: 'Appeals against Tahsildar orders', for_ta: 'வட்டாட்சியர் உத்தரவுக்கு எதிரான மேல்முறையீடு' },
  { q: 'District Collectorate', en: 'Collectorate', ta: 'ஆட்சியர் அலுவலகம்', for_en: 'Monday grievance day, final revenue appeals', for_ta: 'திங்கள் குறைதீர் நாள், இறுதி மேல்முறையீடு' },
  { q: 'District Legal Services Authority DLSA', en: 'Legal aid centre (DLSA)', ta: 'சட்ட உதவி மையம் (DLSA)', for_en: 'Free lawyer for eligible people', for_ta: 'தகுதியுள்ளவர்களுக்கு இலவச வழக்கறிஞர்' },
  { q: 'Police station', en: 'Police station', ta: 'காவல் நிலையம்', for_en: 'FIR and complaints', for_ta: 'FIR மற்றும் புகார்கள்' },
  { q: 'District Survey office land survey', en: 'Survey office (DSO)', ta: 'நில அளவை அலுவலகம்', for_en: 'FMB, topo sketch, RSR, land measurement', for_ta: 'FMB, கூட்டு வரைபடம், RSR, நில அளவை' },
]

export default function OfficeFinder() {
  const { lang } = useApp()
  const tamil = lang === 'tamil'
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoState, setGeoState] = useState<'idle' | 'asking' | 'denied'>('idle')
  const [contacts, setContacts] = useState<DistrictContact[]>([])
  const [dlsaHelpline, setDlsaHelpline] = useState('1516')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    getEscalationContacts().then(r => { setContacts(r.district_contacts); setDlsaHelpline(r.dlsa_helpline) }).catch(() => { /* offline: helpline still shown */ })
  }, [])

  const locate = () => {
    if (!('geolocation' in navigator)) { setGeoState('denied'); return }
    setGeoState('asking')
    navigator.geolocation.getCurrentPosition(
      p => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoState('idle') },
      () => setGeoState('denied'),
      { timeout: 10000 },
    )
  }

  const mapsUrl = (q: string) =>
    coords
      ? `https://www.google.com/maps/search/${encodeURIComponent(q)}/@${coords.lat},${coords.lng},13z`
      : `https://www.google.com/maps/search/${encodeURIComponent(q + ' near me')}`

  const shown = contacts.filter(c => !filter.trim() || `${c.district} ${c.office}`.toLowerCase().includes(filter.trim().toLowerCase()))

  return (
    <div>
      <h3 className="font-['DM_Serif_Display'] text-3xl text-[#193d2c]">{tamil ? 'அருகிலுள்ள அலுவலகம்' : 'Nearest office & legal aid'}</h3>
      <p className="mt-2 max-w-2xl font-['DM_Sans'] text-[#596458]">
        {tamil ? 'எந்த அலுவலகம் எதற்கு என்பதை அறிந்து, உங்கள் இருப்பிடத்திற்கு அருகிலுள்ளதை வரைபடத்தில் திறக்கவும்.' : 'Know which office handles what, and open the nearest one on the map.'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={locate} className="rounded-full bg-[#193d2c] px-5 py-2.5 font-['DM_Sans'] text-sm font-semibold text-white">
          {coords ? (tamil ? '✓ இருப்பிடம் கிடைத்தது' : '✓ Location found') : geoState === 'asking' ? '…' : (tamil ? '📍 என் இருப்பிடத்தைப் பயன்படுத்து' : '📍 Use my location')}
        </button>
        {geoState === 'denied' && <span className="font-['DM_Sans'] text-[12px] text-[#a04530]">{tamil ? 'இருப்பிடம் கிடைக்கவில்லை — "அருகில்" தேடல் பயன்படுத்தப்படும்.' : 'Location unavailable — falling back to a "near me" search.'}</span>}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {OFFICES.map(o => (
          <div key={o.q} className="flex flex-col justify-between rounded-2xl bg-white p-4" style={{ border: '1px solid #d2d7cd' }}>
            <div>
              <p className="font-['DM_Sans'] text-[15px] font-semibold text-[#193d2c]">{tamil ? o.ta : o.en}</p>
              <p className="mt-1 font-['DM_Sans'] text-[12px] text-[#596458]">{tamil ? o.for_ta : o.for_en}</p>
            </div>
            <a href={mapsUrl(o.q)} target="_blank" rel="noopener noreferrer" className="mt-3 self-start font-['DM_Sans'] text-[12px] font-semibold text-[#2d7a52] underline underline-offset-4">
              {tamil ? 'வரைபடத்தில் காண்க ↗' : 'Open on map ↗'}
            </a>
          </div>
        ))}
      </div>
      <p className="mt-3 font-['DM_Sans'] text-[11px] text-[#8a978a]">
        {tamil ? 'அரசு அலுவலகங்கள் பொதுவாக திங்கள்–வெள்ளி காலை 10 முதல் மாலை 5:45 வரை செயல்படும். செல்லும் முன் உறுதி செய்யவும்.' : 'Government offices usually work Monday–Friday, about 10:00 to 17:45. Confirm before travelling.'}
      </p>

      <div className="mt-8 rounded-2xl p-5" style={{ background: '#fdf6e8', border: '1px solid #e9d9ac' }}>
        <p className="font-['DM_Sans'] text-sm font-semibold text-[#193d2c]">
          {tamil ? 'இலவச சட்ட உதவி' : 'Free legal aid'} — <span className="text-[#8a6512]">{dlsaHelpline}</span> <span className="font-normal text-[#536053]">({tamil ? 'கட்டணமில்லா, 24/7' : 'toll-free, 24/7'})</span>
        </p>
        {contacts.length > 0 && (
          <>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={tamil ? 'மாவட்டத்தைத் தேடு…' : 'Search your district…'}
              className="mt-3 w-full rounded-full border border-[#e9d9ac] bg-white px-4 py-2 font-['DM_Sans'] text-sm outline-none" />
            <div className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto">
              {shown.map(c => (
                <div key={c.district} className="flex justify-between gap-2 font-['DM_Sans'] text-[12px] text-[#536053]">
                  <span>{c.district} — {c.office}</span>
                  <a href={`tel:${c.phone}`} className="flex-shrink-0 font-['DM_Mono'] text-[#8a6512]">{c.phone}</a>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
