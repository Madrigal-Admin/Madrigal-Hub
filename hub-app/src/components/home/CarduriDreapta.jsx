import { luna, zi } from './date'

const carcasa = 'rounded-[14px] border border-[#E1E4EA] bg-white px-5 py-[18px]'

export function EvenimenteleMele({ evenimente, progres, statusuri, onStart, onToate }) {
  if (evenimente.length === 0) return null
  return (
    <section aria-label="Evenimentele mele" className={carcasa}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[19px] font-extrabold">Evenimentele mele</h2>
        <span className="text-xs font-semibold text-[#5B6578]">Eu sunt PM</span>
      </div>
      <div className="mt-3.5 flex flex-col gap-3">
        {evenimente.map((e) => {
          const p = progres[e.id] || { total: 0, gata: 0 }
          const st = statusuri.find((s) => s.cod === e.status)
          const organizare = e.comportament === 'organizare'
          return (
            <div key={e.id} className="rounded-xl border border-[#E1E4EA] p-3.5">
              <div className="flex items-start justify-between gap-2.5">
                <div className="text-[15px] font-bold leading-snug">{e.nume}</div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${organizare ? 'bg-[#E4ECF8] text-accent' : 'bg-[#EEF1F6] text-[#3A465C]'}`}>{st?.nume || e.status}</span>
              </div>
              <div className="mt-1 text-[13px] text-[#5B6578]">
                {e.data ? `${zi(e.data)} ${luna(e.data)}` : ''}{e.localitate ? ` · ${e.localitate}` : ''}
              </div>
              {organizare ? (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-[#E9EDF3]">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${p.total ? Math.round((p.gata / p.total) * 100) : 0}%` }} />
                  </div>
                  <div className="mt-1.5 text-[13px] text-[#5B6578]">{p.gata} din {p.total} taskuri finalizate</div>
                </div>
              ) : (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => onStart(e)}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-[10px] bg-accent text-sm font-bold text-white hover:bg-accent-hover"
                  >
                    Trece în „În organizare”
                  </button>
                  <div className="mt-1.5 text-xs text-[#5B6578]">Vei alege din checklist taskurile necesare.</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button type="button" onClick={onToate} className="mt-2 inline-block py-3 text-sm font-bold text-accent hover:underline">Vezi toate evenimentele mele →</button>
    </section>
  )
}

export function EchipaMea({ departamente, onToate }) {
  if (departamente.length === 0) return null
  return (
    <section aria-label="Echipa mea" className={carcasa}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-[19px] font-extrabold">Echipa mea</h2>
        <span className="text-xs font-semibold text-[#5B6578]">Sunt coordonator departament</span>
      </div>
      {departamente.map((d) => {
        const max = Math.max(1, ...d.membri.map((m) => m.nr))
        return (
          <div key={d.id} className="mt-3.5">
            <div className="text-[13px] font-semibold text-[#5B6578]">{d.nume} · taskuri deschise pe persoană</div>
            <div className="mt-2.5 flex flex-col gap-3">
              {d.membri.map((m) => (
                <div key={m.id}>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{m.nume}</span>
                    <span>{m.nr} {m.nr === 1 ? 'task' : 'taskuri'}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E9EDF3]">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round((m.nr / max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <button type="button" onClick={onToate} className="mt-3.5 inline-block py-3 text-sm font-bold text-accent hover:underline">Vezi echipa mea →</button>
    </section>
  )
}

export function UrmatoareleEvenimente({ evenimente, onOpenCalendar }) {
  return (
    <section aria-label="Următoarele evenimente" className={carcasa}>
      <h2 className="text-[19px] font-extrabold">Următoarele evenimente</h2>
      <div className="mt-3.5 flex flex-col gap-3">
        {evenimente.length === 0 && <p className="text-sm text-[#5B6578]">Niciun eveniment programat.</p>}
        {evenimente.map((u) => (
          <div key={u.id} className="flex items-center gap-3">
            <div className="w-[52px] shrink-0 rounded-[10px] bg-cream py-1.5 text-center text-[#172036]">
              <div className="text-lg font-extrabold leading-tight">{zi(u.data)}</div>
              <div className="text-[11px] font-bold uppercase tracking-wide">{luna(u.data)}</div>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-snug">{u.nume}</div>
              <div className="text-[13px] text-[#5B6578]">{u.localitate || u.locatie || ''}</div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onOpenCalendar} className="mt-2.5 inline-block py-3 text-sm font-bold text-accent hover:underline">Deschide calendarul →</button>
    </section>
  )
}
