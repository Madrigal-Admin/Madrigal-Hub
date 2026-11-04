import { useMemo, useState } from 'react'
import { riscEveniment, NIVELE, textZile, deAlocat } from '../../lib/taskuri/risc'
import { actualizeaza, optiuniResponsabil } from '../../lib/taskuri/editare'
import { dataScurta } from '../home/date'

export function ChipRisc({ nivel, mic = false }) {
  const n = NIVELE[nivel]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-bold ${mic ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`} style={{ backgroundColor: n.bg, color: n.text }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: n.punct }} />
      {n.eticheta}
    </span>
  )
}

// Evenimentele PM-ului, sortate după risc, cu motivul afișat.
export function ListaRisc({ evenimente, taskuri }) {
  const randuri = useMemo(
    () => evenimente.map((e) => ({ e, r: riscEveniment(e, taskuri) })).sort((a, b) => NIVELE[a.r.nivel].ordine - NIVELE[b.r.nivel].ordine || (a.e.data || '').localeCompare(b.e.data || '')),
    [evenimente, taskuri]
  )
  return (
    <section className="rounded-[14px] border border-[#E1E4EA] bg-white p-4">
      <h3 className="text-sm font-extrabold text-[#172036]">Evenimente la risc</h3>
      <p className="mb-3 text-xs text-[#5B6578]">Roșu: ≤ 14 zile cu taskuri întârziate sau ≤ 7 zile cu taskuri nealocate / fără termen. Galben: întârzieri sau taskuri nealocate / fără termen în ≤ 30 de zile.</p>
      {randuri.length === 0 ? (
        <p className="text-sm text-[#5B6578]">Niciun eveniment ales.</p>
      ) : (
        <ul className="divide-y divide-[#EEF0F4]">
          {randuri.map(({ e, r }) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <ChipRisc nivel={r.nivel} />
              <span className="min-w-0 flex-1 basis-40">
                <span className="block truncate text-sm font-bold text-[#172036]">{e.nume}</span>
                <span className="block text-xs text-[#5B6578]">{dataScurta(e.data)} · {textZile(r.zile)}</span>
              </span>
              <span className={`text-xs font-semibold ${r.nivel === 'verde' ? 'text-[#1E6B43]' : 'text-[#5B6578]'}`}>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Taskurile fără responsabil, cu atribuire rapidă.
export function ListaDeAlocat({ ctx, evenimente, taskuri, onOpen }) {
  const [eroare, setEroare] = useState('')
  const [lucreaza, setLucreaza] = useState('')
  const lista = useMemo(
    () => deAlocat(taskuri, evenimente).sort((a, b) => (a.termen || '9999').localeCompare(b.termen || '9999')),
    [taskuri, evenimente]
  )
  const evNume = (id) => evenimente.find((e) => e.id === id)?.nume || ''

  async function atribuie(t, id) {
    if (!id) return
    setEroare('')
    setLucreaza(t.id)
    const m = await actualizeaza(t.id, { responsabil_id: id })
    setLucreaza('')
    if (m) return setEroare(m)
    await ctx.reload()
  }

  return (
    <section className="rounded-[14px] border border-[#E1E4EA] bg-white p-4">
      <h3 className="text-sm font-extrabold text-[#172036]">De alocat · {lista.length}</h3>
      <p className="mb-3 text-xs text-[#5B6578]">Taskuri deschise, fără responsabil.</p>
      {eroare && <p className="mb-2 text-sm text-[#B4332E]">{eroare}</p>}
      {lista.length === 0 ? (
        <p className="text-sm font-semibold text-[#1E6B43]">Toate taskurile au responsabil.</p>
      ) : (
        <ul className="divide-y divide-[#EEF0F4]">
          {lista.map((t) => {
            const poate = ctx.poateGestiona(t) && !ctx.inghetat(t) && !ctx.evenimentAnulat(t.eveniment_id)
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <button type="button" onClick={() => onOpen?.(t)} className="min-w-0 flex-1 basis-48 text-left">
                  <span className="block truncate text-sm font-bold text-[#172036] hover:underline">{t.titlu}</span>
                  <span className="block truncate text-xs text-[#5B6578]">{evNume(t.eveniment_id)} · {t.termen ? `termen ${dataScurta(t.termen)}` : 'fără termen'}</span>
                </button>
                {poate ? (
                  <select
                    aria-label={`Atribuie responsabil pentru ${t.titlu}`}
                    value=""
                    disabled={lucreaza === t.id}
                    onChange={(e) => atribuie(t, e.target.value)}
                    className="min-h-[40px] max-w-full rounded-lg border border-[#D5DAE3] bg-white px-2 text-sm font-semibold text-accent focus:border-accent focus:outline-none"
                  >
                    <option value="">Atribuie responsabil…</option>
                    {optiuniResponsabil(ctx, t).map((a) => (
                      <option key={a.id} value={a.id}>{a.nume_complet}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-[#5B6578]">Doar PM-ul poate atribui</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
