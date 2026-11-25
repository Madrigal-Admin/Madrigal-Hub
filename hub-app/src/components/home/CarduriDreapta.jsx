import { useState } from 'react'
import { luna, zi } from './date'
import { ChipRisc } from '../taskuri/RiscEvenimente'

const carcasa = 'rounded-[14px] border border-[#E1E4EA] bg-white px-5 py-[18px]'

export function EvenimenteleMele({ evenimente, progres, statusuri, onStart, onToate, raportLipsa = [], risc = {} }) {
  if (evenimente.length === 0 && raportLipsa.length === 0) return null
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
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${organizare ? 'bg-[#E4ECF8] text-accent' : 'bg-[#EEF1F6] text-[#3A465C]'}`}>{st?.nume || e.status}</span>
                  {organizare && risc[e.id] && <ChipRisc nivel={risc[e.id]} mic />}
                </span>
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
        {raportLipsa.map((e) => (
          <a key={e.id} href={`/rapoarte/?postev=${e.id}`} className="block rounded-xl border border-[#F0D9A8] bg-[#FFF8E8] p-3.5 hover:bg-[#FFF1D6]">
            <div className="flex items-start justify-between gap-2.5">
              <div className="text-[15px] font-bold leading-snug text-[#172036]">{e.nume}</div>
              <span className="shrink-0 rounded-full bg-[#FCE5B8] px-2.5 py-1 text-xs font-bold text-[#8A4B12]">Raport lipsă</span>
            </div>
            <div className="mt-1 text-[13px] text-[#5B6578]">{e.data ? `${zi(e.data)} ${luna(e.data)}` : ''} · eveniment încheiat</div>
            <div className="mt-2 text-sm font-bold text-accent">Completează raportul →</div>
          </a>
        ))}
      </div>
      <button type="button" onClick={onToate} className="mt-2 inline-block py-3 text-sm font-bold text-accent hover:underline">Vezi toate evenimentele mele →</button>
    </section>
  )
}

const HASURI = 'repeating-linear-gradient(45deg, #C9D1DF 0 4px, #E9EDF3 4px 8px)'

export function EchipaMea({ departamente, onToate }) {
  const [arataRestul, setArataRestul] = useState(true)
  if (departamente.length === 0) return null
  const existaAfara = departamente.some((d) => d.membri.some((m) => m.afara > 0))
  return (
    <section aria-label="Echipa mea" className={carcasa}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-extrabold">Echipa mea</h2>
        {existaAfara && (
          <button type="button" role="switch" aria-checked={arataRestul} onClick={() => setArataRestul((v) => !v)} className="inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-[#5B6578]">
            <span className={`relative inline-block h-[18px] w-[30px] rounded-full transition-colors ${arataRestul ? 'bg-accent' : 'bg-[#CBD3E0]'}`}>
              <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all ${arataRestul ? 'left-[14px]' : 'left-[2px]'}`} />
            </span>
            Și restul
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-[#5B6578]">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-3 rounded-sm bg-accent" />în departament</span>
        {arataRestul && existaAfara && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-3 rounded-sm" style={{ background: HASURI }} />în afara departamentului</span>}
      </div>
      {departamente.map((d) => {
        const max = Math.max(1, ...d.membri.map((m) => m.nr + (arataRestul ? m.afara : 0)))
        return (
          <div key={d.id} className="mt-4">
            <div className="flex justify-between gap-3 border-b border-[#E1E4EA] pb-1.5 text-xs font-bold uppercase tracking-wide text-[#5B6578]">
              <span className="truncate">{d.nume}</span>
              <span className="shrink-0 normal-case tracking-normal">taskuri deschise</span>
            </div>
            {d.membri.map((m) => (
              <div key={m.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                  <span className="truncate" title={m.nume}>{m.nume}</span>
                  <span className="shrink-0 font-extrabold">
                    {m.nr}
                    {arataRestul && m.afara > 0 && <small className="ml-1.5 text-xs font-semibold text-[#5B6578]" title="în afara departamentului">+{m.afara}</small>}
                  </span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-[#E9EDF3]">
                  <div className="h-1.5 bg-accent" style={{ width: `${(m.nr / max) * 100}%` }} />
                  {arataRestul && m.afara > 0 && <div className="h-1.5" style={{ width: `${(m.afara / max) * 100}%`, background: HASURI }} />}
                </div>
              </div>
            ))}
          </div>
        )
      })}
      <button type="button" onClick={onToate} className="mt-2 inline-block py-3 text-sm font-bold text-accent hover:underline">Vezi echipa mea →</button>
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
