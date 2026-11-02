import { GRUPE, dataScurta, esteDeschis, grupa, prenume } from './date'

const STATUS = {
  de_facut: { nume: 'De făcut', cls: 'bg-[#EEF1F6] text-[#3A465C]' },
  in_lucru: { nume: 'În lucru', cls: 'bg-[#FFF1D6] text-[#8A5A00]' },
  terminat: { nume: 'Terminat', cls: 'bg-[#DDF3E6] text-[#1E6B43]' },
}
const PRIORITATE = {
  mare: { nume: 'Mare', culoare: '#B4332E' },
  medie: { nume: 'Medie', culoare: '#C77700' },
  mica: { nume: 'Mică', culoare: '#7A869A' },
}

function Eticheta({ t, evenimente }) {
  if (t.tip === 'eveniment') {
    const ev = evenimente[t.eveniment_id]
    return <span className="rounded-md bg-cream px-2 py-0.5 text-xs font-semibold text-[#172036]">{ev?.nume || 'Eveniment'}</span>
  }
  return <span className="rounded-md border border-[#9AA6B8] px-2 py-0.5 text-xs font-semibold text-[#3A465C]">Operațional</span>
}

function textTermen(t, g) {
  if (!t.termen) return 'Fără termen'
  return g === 'Azi' ? 'Azi' : dataScurta(t.termen)
}

function Rand({ t, g, ctx }) {
  const s = STATUS[t.status]
  const terminat = t.status === 'terminat'
  const p = PRIORITATE[t.prioritate]
  const de = t.creat_de && t.creat_de !== ctx.me.id ? prenume(ctx.nume[t.creat_de]) : null
  return (
    <div className="border-t border-[#EEF0F4] px-4 py-3 sm:px-5 sm:py-3.5">
      {/* telefon: card compact */}
      <div className="sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={() => ctx.onDeschide(t)} className={`text-left text-[15px] font-bold leading-snug ${terminat ? 'text-[#7A869A] line-through' : 'text-[#172036]'}`}>{t.titlu}</button>
          <span className={`shrink-0 text-[13px] font-bold ${g === 'Întârziate' ? 'text-[#B4332E]' : 'text-[#172036]'}`}>{textTermen(t, g)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Eticheta t={t} evenimente={ctx.evenimente} />
          <button type="button" onClick={() => ctx.onCicleaza(t)} aria-label={`Status: ${s.nume}. Apasă pentru a-l schimba`} className={`min-h-[44px] rounded-lg px-3 text-xs font-bold ${s.cls}`}>
            {s.nume}
          </button>
        </div>
      </div>

      {/* desktop: rând */}
      <div className="hidden items-center gap-4 sm:flex">
        <button type="button" onClick={() => ctx.onCicleaza(t)} aria-label={`Status: ${s.nume}. Apasă pentru a-l schimba`} className={`min-h-[44px] min-w-[96px] shrink-0 rounded-lg px-3.5 text-[13px] font-bold ${s.cls}`}>
          {s.nume}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => ctx.onDeschide(t)} className={`block text-left text-[15px] font-semibold leading-snug hover:underline ${terminat ? 'text-[#7A869A] line-through' : 'text-[#172036]'}`}>{t.titlu}</button>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[#5B6578]">
            <Eticheta t={t} evenimente={ctx.evenimente} />
            {de && <span>de la {de}</span>}
          </div>
        </div>
        <div className="min-w-[96px] text-right">
          <div className={`text-sm font-bold ${g === 'Întârziate' ? 'text-[#B4332E]' : 'text-[#172036]'}`}>{textTermen(t, g)}</div>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[13px] text-[#5B6578]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.culoare }} />
            {p.nume}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TaskuriMele({ taskuri, filtru, setFiltru, ctx }) {
  const deschise = taskuri.filter(esteDeschis)
  const numara = (g) => deschise.filter((t) => grupa(t) === g).length
  const taburi = [
    ['Toate', deschise.length],
    ['Întârziate', numara('Întârziate')],
    ['Azi', numara('Azi')],
    ['Următoarele 7 zile', numara('Următoarele 7 zile')],
  ]
  const grupe = GRUPE.map((g) => ({
    g,
    items: taskuri
      .filter((t) => grupa(t) === g && (filtru === 'Toate' || filtru === g))
      .sort((a, b) => (a.termen || '9999').localeCompare(b.termen || '9999')),
  })).filter((x) => x.items.length)

  return (
    <section aria-label="Taskurile mele" className="min-w-0 overflow-hidden rounded-[14px] border border-[#E1E4EA] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 className="text-[19px] font-extrabold">Taskurile mele</h2>
        <div className="flex flex-wrap gap-2">
          {taburi.map(([nume, nr]) => (
            <button
              key={nume}
              type="button"
              onClick={() => setFiltru(nume)}
              className={`min-h-[44px] rounded-full border px-3.5 text-sm font-semibold ${nume === 'Următoarele 7 zile' ? 'hidden sm:block' : ''} ${
                filtru === nume ? 'border-accent bg-accent text-white' : 'border-[#CBD3E0] bg-white text-accent'
              }`}
            >
              {nume === 'Următoarele 7 zile' ? '7 zile' : nume} · {nr}
            </button>
          ))}
        </div>
      </div>

      {grupe.map(({ g, items }) => (
        <div key={g}>
          <div className="border-t border-[#E1E4EA] bg-[#F6F8FB] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#5B6578] sm:px-5">
            {g} · {items.length}
          </div>
          {items.map((t) => (
            <Rand key={t.id} t={t} g={g} ctx={ctx} />
          ))}
        </div>
      ))}

      {grupe.length === 0 && (
        <div className="border-t border-[#EEF0F4] px-5 py-7 text-center text-sm text-[#5B6578]">
          {taskuri.length === 0 ? 'Nu ai niciun task alocat. Când primești unul, apare aici.' : 'Niciun task în această categorie.'}
        </div>
      )}
    </section>
  )
}
