import { useMemo, useState } from 'react'

// Grafice simple desenate direct în SVG/HTML (fără biblioteci), folosite de dashboardurile
// „Evenimentele mele" și „Echipa mea".
export const CULORI_STATUS = { de_facut: '#9AA6B8', in_lucru: '#E0A21B', terminat: '#2E9E6B', anulat: '#D5D9E0' }
export const CULORI_SERIE = ['#22406B', '#D4537E', '#E0A21B', '#1D9E75', '#7F77DD', '#D85A30', '#378ADD', '#639922', '#BA7517', '#5F5E5A']
export const CULOARE_FARA = '#C3CAD6'

function felieSvg(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`
}

// felii: [{ nume, valoare, culoare }] — inel cu totalul în mijloc, legenda lângă el (nume, număr, procent).
export function Placinta({ titlu, felii, gol = 'Nu sunt taskuri.' }) {
  const vizibile = felii.filter((f) => f.valoare > 0)
  const total = vizibile.reduce((s, f) => s + f.valoare, 0)
  const R = 70
  const L = 2 * Math.PI * R
  let deplasare = 0
  return (
    <section className="flex min-w-0 flex-col rounded-[14px] border border-[#E1E4EA] bg-white p-4 sm:p-5" aria-label={titlu}>
      <h3 className="text-[15px] font-extrabold text-[#172036]">{titlu}</h3>
      {total === 0 ? (
        <p className="mt-4 text-sm text-[#5B6578]">{gol}</p>
      ) : (
        <div className="flex flex-1 flex-wrap items-center justify-center gap-x-10 gap-y-4 py-2">
          <svg viewBox="0 0 190 190" className="aspect-square w-full max-w-[260px] shrink-0 sm:w-[260px]" role="img" aria-label={`${titlu}: ${vizibile.map((f) => `${f.nume} ${f.valoare}`).join(', ')}`}>
            <circle cx="95" cy="95" r={R} fill="none" stroke="#EEF1F6" strokeWidth="26" />
            {vizibile.map((f) => {
              const lung = (f.valoare / total) * L
              const el = (
                <circle key={f.nume} cx="95" cy="95" r={R} fill="none" stroke={f.culoare} strokeWidth="26" transform="rotate(-90 95 95)"
                  strokeDasharray={`${vizibile.length === 1 ? L : Math.max(lung - 3, 0.5)} ${L}`} strokeDashoffset={-deplasare} />
              )
              deplasare += lung
              return el
            })}
            <text x="95" y="99" textAnchor="middle" fontSize="34" fontWeight="800" fill="#172036">{total}</text>
            <text x="95" y="121" textAnchor="middle" fontSize="12" fill="#5B6578">taskuri</text>
          </svg>
          <ul className="space-y-3 text-[15px]">
            {felii.map((f) => (
              <li key={f.nume} className="grid grid-cols-[12px_minmax(80px,auto)_32px_48px] items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.culoare }} />
                <span className="truncate text-[#3A465C]" title={f.nume}>{f.nume}</span>
                <b className="text-right text-[#172036]">{f.valoare}</b>
                <span className="text-right text-[13px] text-[#5B6578]">{Math.round((f.valoare / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// Rânduri cu bară de progres: [{ nume, gata, total }] — „Progres pe tag".
export function ProgresPeTag({ titlu, randuri, gol = 'Niciun task cu tag.' }) {
  return (
    <section className="min-w-0 rounded-[14px] border border-[#E1E4EA] bg-white p-4 sm:p-5" aria-label={titlu}>
      <h3 className="text-[15px] font-extrabold text-[#172036]">{titlu}</h3>
      {randuri.length === 0 ? (
        <p className="mt-4 text-sm text-[#5B6578]">{gol}</p>
      ) : (
        <ul className="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
          {randuri.map((r) => {
            const pct = r.total ? Math.round((r.gata / r.total) * 100) : 0
            return (
              <li key={r.nume}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-[#172036]" title={r.nume}>{r.nume}</span>
                  <span className="shrink-0 text-[13px] text-[#5B6578]">{r.gata}/{r.total}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#E9EDF3]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.nume}: ${pct}%`}>
                  <div className="h-2 rounded-full bg-[#2E9E6B]" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// Bare orizontale stivuite: randuri = [{ nume, segmente: [{ cheie, valoare, culoare }], eticheta }]
export function BareStivuite({ titlu, randuri, legenda = [], gol = 'Nu sunt date.' }) {
  const max = Math.max(1, ...randuri.map((r) => r.segmente.reduce((s, x) => s + x.valoare, 0)))
  return (
    <section className="min-w-0 rounded-[14px] border border-[#E1E4EA] bg-white p-4 sm:p-5" aria-label={titlu}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-extrabold text-[#172036]">{titlu}</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5B6578]">
          {legenda.map((l) => (
            <span key={l.nume} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.culoare }} />{l.nume}</span>
          ))}
        </div>
      </div>
      {randuri.length === 0 ? (
        <p className="mt-4 text-sm text-[#5B6578]">{gol}</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
          {randuri.map((r) => {
            const total = r.segmente.reduce((s, x) => s + x.valoare, 0)
            return (
              <li key={r.nume} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate font-semibold text-[#172036] sm:w-40" title={r.nume}>{r.nume}</span>
                <div className="flex h-5 flex-1 overflow-hidden rounded bg-[#EEF1F6]">
                  {r.segmente.filter((x) => x.valoare > 0).map((x) => (
                    <div key={x.cheie} title={`${x.cheie}: ${x.valoare}`} style={{ width: `${(x.valoare / max) * 100}%`, backgroundColor: x.culoare }} />
                  ))}
                </div>
                <span className="w-16 shrink-0 text-right text-[13px] text-[#5B6578]">{total}{r.eticheta ? <b className="ml-1 text-[#B4332E]">{r.eticheta}</b> : null}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function Casete({ elemente }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {elemente.map(([eticheta, n, culoare]) => (
        <div key={eticheta} className="rounded-[14px] border border-[#E1E4EA] bg-white px-4 py-3">
          <div className="text-xs font-semibold text-[#5B6578]">{eticheta}</div>
          <div className={`mt-0.5 text-[28px] font-extrabold leading-tight tracking-tight ${culoare || ''}`}>{n}</div>
        </div>
      ))}
    </div>
  )
}

const LUNI_SCURT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']
const LUNI_STATUS = [
  { cod: 'de_facut', nume: 'De făcut', culoare: CULORI_STATUS.de_facut },
  { cod: 'in_lucru', nume: 'În lucru', culoare: CULORI_STATUS.in_lucru },
  { cod: 'terminat', nume: 'Terminat', culoare: CULORI_STATUS.terminat },
]

// Taskuri pe luni (ultimele 12, după termen), stivuite pe status; filtru opțional pe persoană.
// persoane: [{ id, nume }]
export function TaskuriPeLuni({ titlu = 'Taskuri pe luni', taskuri, persoane }) {
  const [persoana, setPersoana] = useState('')
  const luni = useMemo(() => {
    const acum = new Date()
    const lista = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(acum.getFullYear(), acum.getMonth() - i, 1)
      lista.push({ cheie: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, luna: d.getMonth(), an: d.getFullYear() })
    }
    return lista
  }, [])
  const date = useMemo(() => {
    const per = Object.fromEntries(luni.map((l) => [l.cheie, { de_facut: 0, in_lucru: 0, terminat: 0 }]))
    for (const t of taskuri) {
      if (!t.termen || (persoana && t.responsabil_id !== persoana)) continue
      const c = per[t.termen.slice(0, 7)]
      if (c && c[t.status] !== undefined) c[t.status]++
    }
    return luni.map((l) => ({ ...l, ...per[l.cheie] }))
  }, [taskuri, persoana, luni])

  const totalLuna = (d) => d.de_facut + d.in_lucru + d.terminat
  const maxim = Math.max(...date.map(totalLuna), 0)
  const mx = Math.max(4, Math.ceil(maxim / 4) * 4)
  const W = 520, H = 230, x0 = 26, yb = 200, yt = 14
  const bw = (W - x0) / 12
  const gol = maxim === 0

  return (
    <section className="min-w-0 rounded-[14px] border border-[#E1E4EA] bg-white p-4 sm:p-5" aria-label={titlu}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-extrabold text-[#172036]">{titlu}</h3>
        <select value={persoana} onChange={(e) => setPersoana(e.target.value)} aria-label="Filtru angajat"
          className="max-w-[220px] rounded-lg border border-[#E1E4EA] bg-white px-2 py-1.5 text-sm text-[#172036]">
          <option value="">Toți angajații</option>
          {persoane.map((p) => <option key={p.id} value={p.id}>{p.nume}</option>)}
        </select>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5B6578]">
        {LUNI_STATUS.map((l) => <span key={l.cod} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.culoare }} />{l.nume}</span>)}
        <span className="text-[#8A94A6]">· după termen, ultimele 12 luni</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={`${titlu}, ultimele 12 luni`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const y = yb - ((yb - yt) * i) / 4
          return (
            <g key={i}>
              <line x1={x0} x2={W} y1={y} y2={y} stroke={i ? '#EEF1F6' : '#D5D9E0'} />
              <text x={x0 - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#5B6578">{Math.round((mx * i) / 4)}</text>
            </g>
          )
        })}
        {date.map((d, i) => {
          let y = yb
          const x = x0 + i * bw + bw * 0.2
          const tot = totalLuna(d)
          return (
            <g key={d.cheie}>
              {LUNI_STATUS.map((st) => {
                const v = d[st.cod]
                if (!v) return null
                const h = ((yb - yt) * v) / mx
                y -= h
                return <rect key={st.cod} x={x} y={y} width={bw * 0.6} height={Math.max(h - 1, 1)} rx="2" fill={st.culoare}><title>{`${LUNI_SCURT[d.luna]} ${d.an}: ${st.nume} ${v}`}</title></rect>
              })}
              {tot > 0 && <text x={x0 + i * bw + bw / 2} y={y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#172036">{tot}</text>}
              <text x={x0 + i * bw + bw / 2} y={yb + 14} textAnchor="middle" fontSize="10" fill="#5B6578">{LUNI_SCURT[d.luna]}</text>
              {(i === 0 || d.luna === 0) && <text x={x0 + i * bw + bw / 2} y={yb + 26} textAnchor="middle" fontSize="9" fill="#8A94A6">{d.an}</text>}
            </g>
          )
        })}
      </svg>
      {gol && <p className="-mt-1 text-center text-xs text-[#5B6578]">Niciun task cu termen în ultimele 12 luni{persoana ? ' pentru persoana aleasă' : ''}.</p>}
    </section>
  )
}
