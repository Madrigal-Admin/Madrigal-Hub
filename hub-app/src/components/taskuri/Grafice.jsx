import { useMemo, useState } from 'react'
import { esteIntarziat } from '../../lib/taskuri/ui'

// Grafice simple desenate direct în SVG/HTML (fără biblioteci), folosite de dashboardurile
// „Evenimentele mele" și „Echipa mea".
export const CULORI_STATUS = { de_facut: '#9AA6B8', in_lucru: '#E0A21B', terminat: '#2E9E6B', anulat: '#D5D9E0', intarziat: '#C0392B' }
export const CULORI_SERIE = ['#22406B', '#D4537E', '#E0A21B', '#1D9E75', '#7F77DD', '#D85A30', '#378ADD', '#639922', '#BA7517', '#5F5E5A']
export const CULOARE_FARA = '#C3CAD6'

function felieSvg(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`
}

// felii: [{ nume, valoare, culoare }] — inel cu totalul în mijloc, legenda lângă el (nume, număr, procent).
export function Placinta({ titlu, felii, gol = 'Nu sunt taskuri.', ingust = false, onFelie, activ }) {
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
        <div className={`flex flex-1 items-center justify-center py-2 ${ingust ? 'flex-col gap-y-3' : 'flex-wrap gap-x-10 gap-y-4'}`}>
          <svg viewBox="0 0 190 190" className={`aspect-square shrink-0 ${ingust ? 'w-full max-w-[170px]' : 'w-full max-w-[260px] sm:w-[260px]'}`} role="img" aria-label={`${titlu}: ${vizibile.map((f) => `${f.nume} ${f.valoare}`).join(', ')}`}>
            <circle cx="95" cy="95" r={R} fill="none" stroke="#EEF1F6" strokeWidth="26" />
            {vizibile.map((f) => {
              const lung = (f.valoare / total) * L
              const el = (
                <circle key={f.nume} cx="95" cy="95" r={R} fill="none" stroke={f.culoare} strokeWidth={activ && activ === f.cod ? 32 : 26} transform="rotate(-90 95 95)" className={onFelie && f.cod ? 'cursor-pointer' : ''} onClick={onFelie && f.cod ? () => onFelie(f) : undefined}
                  strokeDasharray={`${vizibile.length === 1 ? L : Math.max(lung - 3, 0.5)} ${L}`} strokeDashoffset={-deplasare} />
              )
              deplasare += lung
              return el
            })}
            <text x="95" y="99" textAnchor="middle" fontSize="34" fontWeight="800" fill="#172036">{total}</text>
            <text x="95" y="121" textAnchor="middle" fontSize="12" fill="#5B6578">taskuri</text>
          </svg>
          <ul className={ingust ? 'grid w-full grid-cols-2 gap-x-2 gap-y-0.5 text-[14px]' : 'space-y-3 text-[15px]'}>
            {felii.map((f) => {
              const interior = (
                <>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.culoare }} />
                  <span className="truncate text-left text-[#3A465C]" title={f.nume}>{f.nume}</span>
                  <b className="text-right text-[#172036]">{f.valoare}</b>
                  {!ingust && <span className="text-right text-[13px] text-[#5B6578]">{Math.round((f.valoare / total) * 100)}%</span>}
                </>
              )
              const cls = `grid items-center gap-2.5 ${ingust ? 'grid-cols-[10px_1fr_auto_auto] gap-x-1.5' : 'grid-cols-[12px_minmax(80px,auto)_32px_48px]'}`
              return (
                <li key={f.nume}>
                  {onFelie && f.cod ? (
                    <button type="button" onClick={() => onFelie(f)} aria-pressed={activ === f.cod} title="Filtrează lista de mai jos" className={`${cls} w-full rounded-lg px-1.5 py-1 hover:bg-[#F2F5FA] ${activ === f.cod ? 'bg-[#E7ECF6] ring-1 ring-accent' : ''}`}>{interior}</button>
                  ) : (
                    <div className={cls}>{interior}</div>
                  )}
                </li>
              )
            })}
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
export function BareStivuite({ titlu, randuri, legenda = [], gol = 'Nu sunt date.', ingust = false, onSegment, onNume, activNume }) {
  const max = Math.max(1, ...randuri.map((r) => r.segmente.reduce((s, x) => s + x.valoare, 0) + (r.afara || 0)))
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
        <ul className={`mt-3 space-y-2.5 overflow-y-auto pr-1 ${ingust ? 'max-h-[17.5rem]' : 'max-h-72'}`}>
          {randuri.map((r) => {
            const total = r.segmente.reduce((s, x) => s + x.valoare, 0)
            return (
              <li key={r.nume} className="flex items-center gap-3 text-sm">
                {onNume && r.id !== undefined ? (
                  <button type="button" onClick={() => onNume(r)} title="Filtrează lista de mai jos" className={`shrink-0 truncate rounded px-1 text-left font-semibold ${ingust ? 'w-24' : 'w-32 sm:w-40'} ${activNume === r.id ? 'bg-accent text-white' : 'text-[#172036] hover:bg-[#EEF1F6]'}`}>{r.nume}</button>
                ) : (
                  <span className={`shrink-0 truncate font-semibold text-[#172036] ${ingust ? 'w-24' : 'w-32 sm:w-40'}`} title={r.nume}>{r.nume}</span>
                )}
                <div className="flex h-5 flex-1 overflow-hidden rounded bg-[#EEF1F6]">
                  {r.segmente.filter((x) => x.valoare > 0).map((x) => (
                    <div key={x.cheie} title={`${x.cheie}: ${x.valoare}`} onClick={onSegment && x.cod ? () => onSegment(r, x) : undefined} className={onSegment && x.cod ? 'cursor-pointer hover:brightness-90' : ''} style={{ width: `${(x.valoare / max) * 100}%`, backgroundColor: x.culoare }} />
                  ))}
                  {r.afara > 0 && <div title={`+${r.afara} în afara departamentului`} style={{ width: `${(r.afara / max) * 100}%`, background: 'repeating-linear-gradient(45deg, #C9D1DF 0 4px, #E9EDF3 4px 8px)' }} />}
                </div>
                <span className={`shrink-0 text-right text-[13px] text-[#5B6578] ${ingust ? 'w-12' : 'w-24'}`}>{total}{r.afara > 0 ? <span className="ml-1">+{r.afara}</span> : null}{r.eticheta ? <b className="ml-1 text-[#B4332E]">{r.eticheta}</b> : null}</span>
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
  { cod: 'intarziat', nume: 'Întârziat', culoare: CULORI_STATUS.intarziat },
  { cod: 'terminat', nume: 'Terminat', culoare: CULORI_STATUS.terminat },
]

// Taskuri în timp, stivuite pe status, după termen. Treapta se alege singură după perioadă:
// fără perioadă = 12 luni (6 înapoi, luna curentă, 5 înainte); ≤7 zile = pe zile; ≤31 zile = pe săptămâni; altfel pe luni.
// iv: { start, end } (AAAA-LL-ZZ) sau null; persoane: [{ id, nume }]
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ZILE_SCURT = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm']
function construiesteCosuri(iv) {
  const luniDin = (a, b) => {
    const out = []
    for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d <= b; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      out.push({ eticheta: LUNI_SCURT[d.getMonth()], sub: d.getMonth() === 0 || out.length === 0 ? String(d.getFullYear()) : '', de: iso(d), la: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) })
    }
    return out
  }
  if (!iv) {
    const acum = new Date()
    return { tip: 'luni', cosuri: luniDin(new Date(acum.getFullYear(), acum.getMonth() - 6, 1), new Date(acum.getFullYear(), acum.getMonth() + 5, 1)) }
  }
  const [a, b] = [iv.start, iv.end].map((s) => { const [y, m, z] = s.split('-').map(Number); return new Date(y, m - 1, z) })
  const zile = Math.round((b - a) / 864e5) + 1
  if (zile <= 7) {
    const cosuri = []
    for (let i = 0; i < zile; i++) { const d = new Date(a); d.setDate(a.getDate() + i); cosuri.push({ eticheta: `${ZILE_SCURT[d.getDay()]} ${d.getDate()}`, sub: '', de: iso(d), la: iso(d) }) }
    return { tip: 'zile', cosuri }
  }
  if (zile <= 31) {
    const cosuri = []
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 7)) {
      const e = new Date(d); e.setDate(d.getDate() + 6); if (e > b) e.setTime(b.getTime())
      cosuri.push({ eticheta: `${d.getDate()}–${e.getDate()}`, sub: LUNI_SCURT[d.getMonth()], de: iso(d), la: iso(e) })
    }
    return { tip: 'săptămâni', cosuri }
  }
  return { tip: 'luni', cosuri: luniDin(a, b) }
}

export function TaskuriPeLuni({ titlu, taskuri, persoane, iv = null, ingust = false }) {
  const [persoana, setPersoana] = useState('')
  const { tip, cosuri } = useMemo(() => construiesteCosuri(iv), [iv?.start, iv?.end]) // eslint-disable-line react-hooks/exhaustive-deps
  const titluAles = titlu || `Taskuri pe ${tip}`
  const date = useMemo(() => {
    const per = cosuri.map((c) => ({ ...c, de_facut: 0, in_lucru: 0, intarziat: 0, terminat: 0 }))
    for (const t of taskuri) {
      if (!t.termen || (persoana && t.responsabil_id !== persoana)) continue
      const z = t.termen.slice(0, 10)
      const c = per.find((x) => z >= x.de && z <= x.la)
      const cod = esteIntarziat(t) ? 'intarziat' : t.status // un task întârziat se numără o singură dată
      if (c && c[cod] !== undefined) c[cod]++
    }
    return per
  }, [taskuri, persoana, cosuri])
  // taskurile care NU apar în grafic: fără termen sau cu termen în afara treptelor (anulatele nu se numără)
  const nelistate = useMemo(() => {
    let faraTermen = 0, inAfara = 0
    for (const t of taskuri) {
      if (t.status === 'anulat' || (persoana && t.responsabil_id !== persoana)) continue
      if (!t.termen) faraTermen++
      else if (!cosuri.some((c) => t.termen.slice(0, 10) >= c.de && t.termen.slice(0, 10) <= c.la)) inAfara++
    }
    return { faraTermen, inAfara }
  }, [taskuri, persoana, cosuri])

  const totalCos = (d) => d.de_facut + d.in_lucru + d.intarziat + d.terminat
  const maxim = Math.max(...date.map(totalCos), 0)
  const mx = Math.max(4, Math.ceil(maxim / 4) * 4)
  const W = ingust ? 330 : 520, H = 230, x0 = 26, yb = 200, yt = 14
  const bw = (W - x0) / date.length
  const lat = Math.min(bw * 0.6, 44)
  const gol = maxim === 0
  const etichetaMica = bw < 30
  const afisareEtichete = (i) => !etichetaMica || i % 2 === 0

  return (
    <section className="min-w-0 rounded-[14px] border border-[#E1E4EA] bg-white p-4 sm:p-5" aria-label={titluAles}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-extrabold text-[#172036]">{titluAles}</h3>
        <select value={persoana} onChange={(e) => setPersoana(e.target.value)} aria-label="Filtru angajat"
          className="max-w-[170px] rounded-lg border border-[#E1E4EA] bg-white px-2 py-1.5 text-sm text-[#172036]">
          <option value="">Toți angajații</option>
          {persoane.map((p) => <option key={p.id} value={p.id}>{p.nume}</option>)}
        </select>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5B6578]">
        {LUNI_STATUS.map((l) => <span key={l.cod} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.culoare }} />{l.nume}</span>)}
        {!ingust && <span className="text-[#8A94A6]">· după termen{iv ? '' : ': 6 luni înapoi, 5 înainte'}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={titluAles}>
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
          const cx = x0 + i * bw + bw / 2
          const x = cx - lat / 2
          const tot = totalCos(d)
          return (
            <g key={d.de}>
              {LUNI_STATUS.map((st) => {
                const v = d[st.cod]
                if (!v) return null
                const h = ((yb - yt) * v) / mx
                y -= h
                return <rect key={st.cod} x={x} y={y} width={lat} height={Math.max(h - 1, 1)} rx="2" fill={st.culoare}><title>{`${d.eticheta}${d.sub ? ` ${d.sub}` : ''}: ${st.nume} ${v}`}</title></rect>
              })}
              {tot > 0 && <text x={cx} y={y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#172036">{tot}</text>}
              {afisareEtichete(i) && <text x={cx} y={yb + 14} textAnchor="middle" fontSize="10" fill="#5B6578">{d.eticheta}</text>}
              {afisareEtichete(i) && d.sub && <text x={cx} y={yb + 26} textAnchor="middle" fontSize="9" fill="#8A94A6">{d.sub}</text>}
            </g>
          )
        })}
      </svg>
      {gol && <p className="-mt-1 text-center text-xs text-[#5B6578]">Niciun task cu termen în această perioadă{persoana ? ' pentru persoana aleasă' : ''}.</p>}
      {(nelistate.faraTermen > 0 || nelistate.inAfara > 0) && (
        <p className="mt-1 text-xs text-[#5B6578]">
          Nu apar în grafic:{nelistate.faraTermen > 0 ? ` ${nelistate.faraTermen} fără termen` : ''}{nelistate.faraTermen > 0 && nelistate.inAfara > 0 ? ',' : ''}{nelistate.inAfara > 0 ? ` ${nelistate.inAfara} cu termen în afara acestor luni` : ''}.
        </p>
      )}
    </section>
  )
}
