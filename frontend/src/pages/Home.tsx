import { useApp } from '../App'

const Arrow = () => <span aria-hidden="true" className="text-lg">↗</span>

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-['DM_Mono'] text-[10px] uppercase tracking-[.18em] text-[#618062]">{children}</p>
}

export default function HomePage() {
  const { navigate, lang } = useApp()
  const tamil = lang === 'tamil'

  const services: [string, string, () => void][] = [
    ['01', tamil ? 'நிலம் மற்றும் சொத்து' : 'Land & property', () => navigate('chat')],
    ['02', tamil ? 'குடும்பம் மற்றும் வாரிசு' : 'Family & inheritance', () => navigate('chat')],
    ['03', tamil ? 'ஆவணங்கள் விளக்கம்' : 'Documents explained', () => navigate('upload')],
  ]

  return (
    <div>
      <div
        className="pointer-events-none fixed inset-0 opacity-[.26]"
        style={{ backgroundImage: 'radial-gradient(#8fa08b .6px,transparent .6px)', backgroundSize: '13px 13px' }}
      />

      <section className="relative z-10 mx-auto grid max-w-[1440px] gap-12 px-5 pb-20 pt-16 md:px-10 lg:grid-cols-[1.15fr_.85fr] lg:px-14 lg:pb-28 lg:pt-24">
        <div className="self-center">
          <Eyebrow>{tamil ? 'பொது சேவைகளைப் புரிந்துகொள்ள எளிய வழி' : 'A clearer way through public systems'}</Eyebrow>
          <h1 className="mt-6 font-['DM_Serif_Display'] text-[clamp(4rem,7.2vw,7.5rem)] leading-[.82] tracking-[-.065em] text-[#193d2c]">
            {tamil ? <>உங்கள் உரிமை<br />‎<em className="text-[#d58920]">தெளிவாக.</em></> : <>Know where<br />you <em className="text-[#d58920]">stand.</em></>}
          </h1>
          <p className="mt-9 max-w-xl font-['DM_Sans'] text-lg leading-relaxed text-[#536053] md:text-xl">
            {tamil
              ? 'வீடு, குடும்பம், எதிர்காலம் பற்றிய சட்டக் கேள்விகளுக்கு நடைமுறை வழிகாட்டுதல். உங்களுக்காக, புரியும் மொழியில்.'
              : 'Practical legal guidance for the questions that shape a home, a family, and a future—written in language that makes sense.'}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <button
              onClick={() => navigate('chat')}
              className="flex items-center gap-6 rounded-full bg-[#193d2c] px-6 py-4 font-['DM_Sans'] text-sm font-semibold text-white shadow-lg shadow-[#193d2c]/15 transition hover:-translate-y-0.5"
            >
              {tamil ? 'உங்கள் அடுத்த படி' : 'Find your next step'} <Arrow />
            </button>
            <button
              onClick={() => navigate('procedures')}
              className="border-b border-[#80917e] pb-1 font-['DM_Sans'] text-sm font-medium text-[#274b36]"
            >
              {tamil ? 'பொதுவான கேள்விகள்' : 'Explore common questions'}
            </button>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 font-['DM_Mono'] text-[9px] uppercase tracking-[.1em] text-[#657261]">
            <span>◎ Tamil & English</span>
            <span>◎ Private by default</span>
            <span>◎ Source-linked guidance</span>
          </div>
        </div>

        <div className="relative mx-auto flex min-h-[380px] w-full max-w-[470px] items-center justify-center lg:min-h-[490px]">
          <div className="absolute inset-4 rounded-full border border-[#b7c1b1]" />
          <div className="absolute inset-14 rounded-full border border-dashed border-[#c8d0c3]" />
          <div className="absolute h-56 w-56 rounded-full bg-[#e6ad36] shadow-[0_22px_40px_rgba(212,139,33,.17)] lg:h-64 lg:w-64" />
          <div className="absolute grid h-20 w-20 -translate-x-24 -translate-y-28 place-items-center rounded-full border border-[#9bac98] bg-[#f4f1e9] font-['DM_Serif_Display'] text-4xl text-[#365b3b] shadow-sm">அ</div>
          <div className="relative grid h-48 w-48 place-items-center rounded-full border-[12px] border-[#f4f1e9] bg-[#193d2c] text-center text-[#f5efdf] shadow-xl lg:h-60 lg:w-60">
            <div>
              <span className="font-['DM_Mono'] text-[9px] uppercase tracking-[.22em] text-[#b8cfaf]">CivicAid</span>
              <p className="mt-2 font-['DM_Serif_Display'] text-3xl leading-none lg:text-4xl">Your rights,<br /><em>made clear.</em></p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-[#193d2c] px-5 py-18 text-[#f7f2e7] md:px-10 lg:px-14">
        <div className="mx-auto max-w-[1440px]">
          <Eyebrow>{tamil ? 'முக்கியமானதில் தொடங்குங்கள்' : 'Start with what matters'}</Eyebrow>
          <div className="mt-10 grid border-t border-[#54725d] md:grid-cols-3">
            {services.map(([n, t, action]) => (
              <button onClick={action} key={n} className="group border-b border-[#54725d] py-7 text-left md:border-b-0 md:border-r md:px-7 md:first:pl-0">
                <span className="font-['DM_Mono'] text-xs text-[#e6ad36]">{n}</span>
                <p className="mt-8 flex items-start justify-between font-['DM_Serif_Display'] text-3xl">
                  <span>{t}</span>
                  <span className="opacity-0 transition group-hover:opacity-100">↗</span>
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
