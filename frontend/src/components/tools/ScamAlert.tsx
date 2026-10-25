import { useApp } from '../../App'

const SCAMS = [
  {
    en: '"Agent" promises quick patta or chitta for extra money',
    ta: '"தரகர்" கூடுதல் பணத்திற்கு உடனடி பட்டா / சிட்டா தருவதாகச் சொல்வது',
    flag_en: 'Chitta, adangal and patta copies are issued through the VAO / Taluk office or eservices.tn.gov.in at a small official fee. No one can "fast-track" them for a private payment.',
    flag_ta: 'சிட்டா, அடங்கல், பட்டா நகல்கள் VAO / தாலுகா அலுவலகம் அல்லது eservices.tn.gov.in மூலம் சிறிய அரசுக் கட்டணத்தில் கிடைக்கும். தனிப்பட்ட பணத்திற்கு "விரைவுபடுத்த" முடியாது.',
  },
  {
    en: 'Official asks a bribe to move your file',
    ta: 'கோப்பை நகர்த்த அதிகாரி லஞ்சம் கேட்பது',
    flag_en: 'Demanding money for a routine service is an offence. Note the name, date and amount, and report it to DVAC. You can also file an RTI asking why the file is pending.',
    flag_ta: 'வழக்கமான சேவைக்குப் பணம் கேட்பது குற்றம். பெயர், தேதி, தொகையைக் குறித்து DVAC-க்குப் புகார் அளிக்கவும். கோப்பு ஏன் நிலுவையில் உள்ளது என RTI மூலமும் கேட்கலாம்.',
  },
  {
    en: 'Seller refuses to show the mother deeds or EC',
    ta: 'விற்பவர் மூலப் பத்திரம் / வில்லங்கச் சான்றிதழைக் காட்ட மறுப்பது',
    flag_en: 'This is the biggest warning sign in land purchase. Do not pay an advance until you have the full chain of deeds and an encumbrance certificate you pulled yourself from tnreginet.gov.in.',
    flag_ta: 'நிலம் வாங்குவதில் இது மிகப்பெரிய எச்சரிக்கை. முழு பத்திரச் சங்கிலியும், tnreginet.gov.in-ல் நீங்களே எடுத்த வில்லங்கச் சான்றிதழும் கிடைக்கும் வரை முன்பணம் தர வேண்டாம்.',
  },
  {
    en: 'Same land sold to two buyers, or seller is not the patta holder',
    ta: 'ஒரே நிலம் இருவருக்கு விற்பனை, அல்லது விற்பவர் பட்டாதாரர் அல்ல',
    flag_en: 'Check that the patta / A-Register owner name equals the seller, and run the mismatch checker on patta + chitta + sale deed before you sign.',
    flag_ta: 'பட்டா / A-Register உரிமையாளர் பெயர் விற்பவருடன் ஒத்துள்ளதா எனப் பாருங்கள்; கையெழுத்திடும் முன் ஆவண ஒப்பீடு செய்யுங்கள்.',
  },
  {
    en: 'WhatsApp / SMS: "Your land will be cancelled, pay now" or links asking for OTP',
    ta: 'WhatsApp / SMS: "உங்கள் நிலம் ரத்தாகும், இப்போதே பணம் செலுத்துங்கள்" அல்லது OTP கேட்கும் இணைப்புகள்',
    flag_en: 'Government offices do not ask for OTPs or payments through random links. Only use eservices.tn.gov.in and tnreginet.gov.in. Never share OTP or Aadhaar details.',
    flag_ta: 'அரசு அலுவலகங்கள் OTP அல்லது தெரியாத இணைப்புகள் மூலம் பணம் கேட்காது. eservices.tn.gov.in மற்றும் tnreginet.gov.in மட்டும் பயன்படுத்துங்கள். OTP, ஆதார் விவரங்களைப் பகிர வேண்டாம்.',
  },
  {
    en: 'Lawyer or "fixer" asks for the full fee up front and gives no receipt',
    ta: 'வழக்கறிஞர் / "ஃபிக்ஸர்" முழுக் கட்டணத்தையும் முன்பே கேட்டு ரசீது தராதது',
    flag_en: 'Always take a written receipt. If you cannot afford a lawyer, free legal aid is available on 1516.',
    flag_ta: 'எப்போதும் எழுத்துப்பூர்வ ரசீது பெறுங்கள். வழக்கறிஞர் செலவு கட்ட இயலாவிட்டால் 1516-ல் இலவச சட்ட உதவி கிடைக்கும்.',
  },
]

export default function ScamAlert() {
  const { lang } = useApp()
  const tamil = lang === 'tamil'
  return (
    <div>
      <h3 className="font-['DM_Serif_Display'] text-3xl text-[#193d2c]">{tamil ? 'மோசடி எச்சரிக்கை' : 'Scam alert'}</h3>
      <p className="mt-2 max-w-2xl font-['DM_Sans'] text-[#596458]">
        {tamil ? 'கிராமங்களில் அடிக்கடி நடக்கும் மோசடிகளும், அவற்றைக் கண்டறியும் வழிகளும்.' : 'Common tricks used on village residents, and how to spot them.'}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {SCAMS.map((s, i) => (
          <div key={i} className="rounded-2xl p-5" style={{ background: '#fbf1ee', border: '1px solid #ecc9bf' }}>
            <p className="font-['DM_Sans'] text-[14px] font-bold text-[#a04530]">⚠ {tamil ? s.ta : s.en}</p>
            <p className="mt-2 font-['DM_Sans'] text-[13px] leading-relaxed text-[#193426]">{tamil ? s.flag_ta : s.flag_en}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl p-5" style={{ background: '#dff0e6', border: '1px solid #b3d9c4' }}>
        <p className="font-['DM_Sans'] text-sm font-semibold text-[#1f5c2a]">{tamil ? 'சந்தேகமா? இலவச உதவி' : 'Unsure? Free help'}</p>
        <p className="mt-1 font-['DM_Sans'] text-[13px] text-[#193426]">
          {tamil ? 'சட்ட உதவி: 1516 (கட்டணமில்லா, 24/7). லஞ்சம் புகார்: DVAC — "லஞ்சம் புகார்" பகுதியைப் பயன்படுத்தவும்.' : 'Legal aid: 1516 (toll-free, 24/7). Bribe demand: report to DVAC.'}
        </p>
        <p className="mt-2 font-['DM_Sans'] text-[12px] text-[#536053]">
          {tamil ? 'அரசுக் கட்டணங்கள் மாறலாம்; எப்போதும் அலுவலகத்தில் அல்லது அதிகாரப்பூர்வ இணையதளத்தில் உறுதி செய்யுங்கள்.' : 'Official fees can change; always confirm the current fee at the office or the official portal.'}
        </p>
      </div>
    </div>
  )
}
