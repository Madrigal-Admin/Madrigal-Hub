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

// felii: [{ nume, valoare, culoare }]
export function Placinta({ titlu, felii, gol = 'Nu sunt taskuri.' }) {
  const vizibile = felii.filter((f) => f.valoare > 0)
  const total = vizibile.reduce((s, f) => s + f.valoare, 0)
  let unghi = 0
  return (
    <section className="min-w-0 rounded-[14px] border border-[#E1E4EA] bg-white p-4 sm:p-5" aria-label={titlu}>
      <h3 className="text-[15px] font-extrabold text-[#172036]">{titlu}</h3>
      {total === 0 ? (
        <p className="mt-4 text-sm text-[#5B6578]">{gol}</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          <svg viewBox="0 0 100 100" className="h-36 w-36 shrink-0" role="img" aria-label={`${titlu}: ${vizibile.map((f) => `${f.nume} ${f.valoare}`).join(', ')}`}>
            {vizibile.length === 1 ? (
              <circle cx="50" cy="50" r="46" fill={vizibile[0].culoare} />
            ) : (
              vizibile.map((f) => {
                const a0 = unghi
                unghi += (f.valoare / total) * Math.PI * 2
                return <path key={f.nume} d={felieSvg(50, 50, 46, a0, unghi)} fill={f.culoare} stroke="#fff" strokeWidth="1.2" />
              })
            )}
          </svg>
          <ul className="min-w-[150px] flex-1 space-y-1.5 text-sm">
            {vizibile.map((f) => (
              <li key={f.nume} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.culoare }} />
                <span className="min-w-0 flex-1 truncate text-[#3A465C]" title={f.nume}>{f.nume}</span>
                <span className="font-bold text-[#172036]">{f.valoare}</span>
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
