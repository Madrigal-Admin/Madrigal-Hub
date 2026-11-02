import { GRUPE, dataScurta, esteDeschis, grupa } from './date'
import StatusDropdown from '../taskuri/StatusDropdown'

const PRIORITATE = {
  mare: { nume: 'Mare', culoare: '#B4332E' },
  medie: { nume: 'Medie', culoare: '#C77700' },
  mica: { nume: 'Mică', culoare: '#7A869A' },
}

// Același șablon de coloane pe antet și pe rânduri
const COLOANE = 'grid grid-cols-[112px_minmax(0,1fr)_84px_148px_148px_84px] items-center gap-x-3'

function Eticheta({ t, evenimente }) {
  if (t.tip === 'eveniment') {
    const ev = evenimente[t.eveniment_id]
    return <span className="max-w-[220px] shrink-0 truncate rounded-md bg-cream px-2 py-0.5 text-xs font-semibold text-[#172036]" title={ev?.nume}>{ev?.nume || 'Eveniment'}</span>
  }
  return <span className="shrink-0 rounded-md border border-[#9AA6B8] px-2 py-0.5 text-xs font-semibold text-[#3A465C]">Operațional</span>
}

function textTermen(t, g) {
  if (!t.termen) return '—'
  return g === 'Azi' ? 'Azi' : dataScurta(t.termen)
}

function Responsabil({ t, ctx }) {
  if (!t.responsabil_id) return <span className="text-[13px] text-[#7A869A]">Fără responsabil</span>
  const nume = ctx.nume[t.responsabil_id] || '—'
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px] text-[#172036]" title={nume}>
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E4ECF8] text-[11px] font-bold text-accent">{nume.trim().charAt(0).toUpperCase()}</span>
      <span className="truncate">{nume}</span>
    </span>
  )
}

function Rand({ t, g, ctx }) {
  const terminat = t.status === 'terminat'
  const p = PRIORITATE[t.prioritate]
  const dd = (compact) => (
    <StatusDropdown status={t.status} poate={ctx.poateStatus(t)} poateAnula={ctx.poateAnula(t)} onChange={(s) => ctx.onStatus(t, s)} compact={compact} />
  )
  const titlu = `text-left text-sm font-semibold leading-snug hover:underline ${terminat ? 'text-[#7A869A] line-through' : 'text-[#172036]'}`
  return (
    <div className="border-t border-[#EEF0F4] px-4 py-2 hover:bg-[#FAFBFD] sm:px-5">
      {/* telefon: card compact */}
      <div className="sm:hidden">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={() => ctx.onDeschide(t)} className={`${titlu} text-[15px]`}>{t.titlu}</button>
          <span className={`shrink-0 text-[13px] font-bold ${g === 'Întârziate' ? 'text-[#B4332E]' : 'text-[#172036]'}`}>{textTermen(t, g)}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Eticheta t={t} evenimente={ctx.evenimente} />
          {dd(false)}
        </div>
      </div>

      {/* desktop: rând de tabel */}
      <div className={`${COLOANE} hidden sm:grid`}>
        <div>{dd(true)}</div>
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => ctx.onDeschide(t)} className={`${titlu} min-w-0 truncate`} title={t.titlu}>{t.titlu}</button>
          <Eticheta t={t} evenimente={ctx.evenimente} />
        </div>
        <div className={`text-[13px] font-bold ${g === 'Întârziate' ? 'text-[#B4332E]' : 'text-[#172036]'}`}>{textTermen(t, g)}</div>
        <Responsabil t={t} ctx={ctx} />
        <span className="min-w-0 truncate text-[13px] text-[#172036]" title={ctx.nume[t.creat_de] || ''}>{ctx.nume[t.creat_de] || '—'}</span>
        <div className="flex items-center gap-1.5 text-[13px] text-[#5B6578]">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.culoare }} />
          {p.nume}
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h2 className="text-[19px] font-extrabold">Taskurile mele</h2>
        <div className="flex flex-wrap gap-2">
          {taburi.map(([nume, nr]) => (
            <button
              key={nume}
              type="button"
              onClick={() => setFiltru(nume)}
              className={`min-h-[40px] rounded-full border px-3.5 text-sm font-semibold ${nume === 'Următoarele 7 zile' ? 'hidden sm:block' : ''} ${
                filtru === nume ? 'border-accent bg-accent text-white' : 'border-[#CBD3E0] bg-white text-accent'
              }`}
            >
              {nume === 'Următoarele 7 zile' ? '7 zile' : nume} · {nr}
            </button>
          ))}
        </div>
      </div>

      {grupe.length > 0 && (
        <div className={`${COLOANE} hidden border-t border-[#E1E4EA] bg-[#F6F8FB] px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#5B6578] sm:grid`} role="row">
          <span>Status</span><span>Titlu</span><span>Deadline</span><span>Responsabil</span><span>Deschis de</span><span>Prioritate</span>
        </div>
      )}

      {grupe.map(({ g, items }) => (
        <div key={g}>
          <div className="border-t border-[#E1E4EA] bg-[#EEF1F6] px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[#5B6578] sm:px-5">
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
