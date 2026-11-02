import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { LUNI, PALETA, culoareText, incarcaTot } from '../lib/evenimente'

const selectCls = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700'

// Inel / "plăcintă" desenat direct în SVG (fără biblioteci).
function Inel({ felii, total, gaura = 0.6 }) {
  const r = 15.9155 // circumferința = 100
  let acumulat = 0
  return (
    <svg viewBox="0 0 42 42" className="h-44 w-44 shrink-0">
      <circle cx="21" cy="21" r={r} fill="none" stroke="#f1f5f9" strokeWidth={r * (1 - gaura) * 2 * 0.5 + 2} />
      {total > 0 &&
        felii.map((f) => {
          const pct = (f.valoare / total) * 100
          const el = (
            <circle
              key={f.nume}
              cx="21"
              cy="21"
              r={r}
              fill="none"
              stroke={f.culoare}
              strokeWidth={r * (1 - gaura) * 2 * 0.5 + 2}
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={25 - acumulat}
            />
          )
          acumulat += pct
          return el
        })}
      <text x="21" y="22.5" textAnchor="middle" className="fill-slate-800" style={{ fontSize: '6px', fontWeight: 700 }}>
        {total}
      </text>
    </svg>
  )
}

function CardInel({ titlu, felii, nota }) {
  const total = felii.reduce((s, f) => s + f.valoare, 0)
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-slate-800">{titlu}</p>
      {total === 0 ? (
        <p className="text-sm text-slate-400">Nicio dată pentru filtrele alese.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Inel felii={felii} total={total} />
          <ul className="min-w-[140px] flex-1 space-y-1.5 text-sm">
            {felii.map((f) => (
              <li key={f.nume} className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.culoare }} />
                <span className="flex-1 truncate">{f.nume}</span>
                <span className="font-medium text-slate-800">{f.valoare}</span>
                <span className="w-10 text-right text-xs text-slate-400">{Math.round((f.valoare / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {nota && <p className="mt-3 text-xs text-slate-400">{nota}</p>}
    </div>
  )
}

function Bare({ elemente }) {
  const max = Math.max(1, ...elemente.map((e) => e.valoare))
  return (
    <div className="space-y-2">
      {elemente.map((e) => (
        <div key={e.nume} className="flex items-center gap-3 text-sm">
          <span className="w-36 shrink-0 truncate text-slate-600" title={e.nume}>{e.nume}</span>
          <div className="h-5 flex-1 rounded bg-slate-100">
            <div className="h-5 rounded" style={{ width: `${(e.valoare / max) * 100}%`, backgroundColor: e.culoare }} />
          </div>
          <span className="w-8 text-right font-medium text-slate-800">{e.valoare}</span>
        </div>
      ))}
    </div>
  )
}

export default function StatisticiEvenimente() {
  const [date, setDate] = useState(null)
  const [eroare, setEroare] = useState('')
  const [an, setAn] = useState(String(new Date().getFullYear()))
  const [localitate, setLocalitate] = useState('')
  const [tip, setTip] = useState('')
  const [cuAnulate, setCuAnulate] = useState(false)

  useEffect(() => {
    incarcaTot().then((r) => {
      setEroare(r.eroare)
      setDate(r)
    })
  }, [])

  const evenimente = date?.evenimente || []
  const tipuri = date?.tipuri || []
  const statusuri = date?.statusuri || []
  const angajati = date?.angajati || []

  const ani = useMemo(
    () => [...new Set(evenimente.map((e) => (e.data || '').slice(0, 4)).filter(Boolean))].sort().reverse(),
    [evenimente]
  )
  const localitati = useMemo(
    () => [...new Set(evenimente.map((e) => (e.localitate || '').trim()).filter(Boolean))].sort(),
    [evenimente]
  )
  const statusDupaCod = useMemo(() => Object.fromEntries(statusuri.map((s) => [s.cod, s])), [statusuri])

  // Evenimentele care intră în grafice. Anularea nu se numără, decât dacă bifezi.
  const selectie = useMemo(
    () =>
      evenimente.filter(
        (e) =>
          (!an || (e.data || '').startsWith(an)) &&
          (!localitate || (e.localitate || '').trim() === localitate) &&
          (!tip || e.tipuri.includes(tip)) &&
          (cuAnulate || statusDupaCod[e.status]?.comportament !== 'anulat')
      ),
    [evenimente, an, localitate, tip, cuAnulate, statusDupaCod]
  )

  // Un eveniment cu mai multe tipuri se numără la fiecare tip.
  const peTip = tipuri
    .map((t) => ({ nume: t.nume, culoare: t.culoare, valoare: selectie.filter((e) => e.tipuri.includes(t.cod)).length }))
    .filter((x) => x.valoare > 0)

  const pePm = useMemo(() => {
    const mapa = new Map()
    let fara = 0
    for (const e of selectie) {
      if (e.pm.length === 0) fara++
      for (const id of e.pm) mapa.set(id, (mapa.get(id) || 0) + 1)
    }
    const lista = [...mapa.entries()].map(([id, valoare]) => ({ nume: angajati.find((a) => a.id === id)?.nume_complet || '—', valoare }))
    lista.sort((a, b) => b.valoare - a.valoare)
    if (fara > 0) lista.push({ nume: 'Fără PM', valoare: fara })
    return lista.map((x, i) => ({ ...x, culoare: x.nume === 'Fără PM' ? '#cbd5e1' : PALETA[i % PALETA.length] }))
  }, [selectie, angajati])

  const peImplicare = ['Organizator', 'Partener', 'Invitat'].map((i, k) => ({
    nume: i,
    culoare: ['#f76808', '#ffc53d', '#30a46c'][k],
    valoare: selectie.filter((e) => e.implicare === i).length,
  })).filter((x) => x.valoare > 0)

  const pePeStatus = statusuri.map((s) => ({
    ...s,
    valoare: evenimente.filter(
      (e) => e.status === s.cod && (!an || (e.data || '').startsWith(an)) && (!localitate || (e.localitate || '').trim() === localitate) && (!tip || e.tipuri.includes(tip))
    ).length,
  }))

  const peLuna = LUNI.map((nume, i) => ({
    nume: nume.slice(0, 3),
    valoare: selectie.filter((e) => (e.data || '').slice(5, 7) === String(i + 1).padStart(2, '0')).length,
  }))
  const maxLuna = Math.max(1, ...peLuna.map((l) => l.valoare))

  // Lista de jos: aceleași evenimente ca în grafice (respectă filtrele de sus).
  const [sortare, setSortare] = useState({ cheie: 'data', dir: 1 })
  const numeTip = useMemo(() => Object.fromEntries(tipuri.map((t) => [t.cod, t.nume])), [tipuri])
  const numePm = (e) => e.pm.map((id) => angajati.find((a) => a.id === id)?.nume_complet).filter(Boolean).join(', ')
  const randuri = useMemo(() => {
    const val = {
      nume: (e) => (e.nume || '').toLowerCase(),
      data: (e) => e.data || '',
      pm: (e) => numePm(e).toLowerCase(),
      tip: (e) => e.tipuri.map((c) => numeTip[c] || c).join(', ').toLowerCase(),
      localitate: (e) => (e.localitate || '').toLowerCase(),
    }[sortare.cheie]
    return [...selectie].sort((a, b) => (val(a) < val(b) ? -sortare.dir : val(a) > val(b) ? sortare.dir : 0))
  }, [selectie, sortare, numeTip, angajati]) // eslint-disable-line react-hooks/exhaustive-deps
  const comutaSortare = (cheie) => setSortare((s) => (s.cheie === cheie ? { cheie, dir: -s.dir } : { cheie, dir: 1 }))
  const dataScurta = (d) => (d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '—')
  const coloane = [['nume', 'Eveniment'], ['data', 'Data'], ['pm', 'Responsabil'], ['tip', 'Tip eveniment'], ['localitate', 'Localitate']]

  return (
    <div>
      <main className="w-full px-4 py-5 sm:px-6">
        {eroare && <p className="mb-4 text-sm text-rose-600">{eroare}</p>}

        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
          <select className={selectCls} value={an} onChange={(e) => setAn(e.target.value)} aria-label="An">
            <option value="">Toți anii</option>
            {ani.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select className={selectCls} value={localitate} onChange={(e) => setLocalitate(e.target.value)} aria-label="Localitate">
            <option value="">Toate localitățile</option>
            {localitati.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select className={selectCls} value={tip} onChange={(e) => setTip(e.target.value)} aria-label="Tip">
            <option value="">Toate tipurile</option>
            {tipuri.map((t) => (
              <option key={t.cod} value={t.cod}>{t.nume}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={cuAnulate} onChange={(e) => setCuAnulate(e.target.checked)} />
            Include evenimentele anulate în grafice
          </label>
          <span className="ml-auto text-sm text-slate-500">{selectie.length} evenimente în selecție</span>
        </div>

        {!date ? (
          <p className="text-sm text-slate-400">Se încarcă...</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {pePeStatus.map((s) => (
                <div key={s.cod} className="rounded-2xl bg-white p-4 shadow-sm" style={{ borderTop: `3px solid ${s.culoare}` }}>
                  <p className="text-xs font-medium" style={{ color: culoareText(s.culoare) }}>{s.nume}</p>
                  <p className="mt-1 text-3xl font-bold text-slate-800">{s.valoare}</p>
                  <p className="text-xs text-slate-400">evenimente</p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <CardInel titlu="Responsabili (PM)" felii={pePm} nota="Un eveniment cu mai mulți PM se numără la fiecare dintre ei." />
              <CardInel titlu="Implicare" felii={peImplicare} />
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-800">Tip eveniment</p>
              {peTip.length === 0 ? <p className="text-sm text-slate-400">Nicio dată pentru filtrele alese.</p> : <Bare elemente={peTip} />}
              <p className="mt-3 text-xs text-slate-400">
                Un eveniment cu mai multe tipuri (de ex. Madrigal + Cantus Mundi) se numără la fiecare tip, deci suma barelor poate depăși numărul de evenimente.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-4 text-sm font-semibold text-slate-800">Evenimente pe lună{an ? ` — ${an}` : ''}</p>
              <div className="flex h-44 items-end gap-2">
                {peLuna.map((l) => (
                  <div key={l.nume} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs font-medium text-slate-700">{l.valoare || ''}</span>
                    <div className="w-full rounded-t bg-accent/80" style={{ height: `${(l.valoare / maxLuna) * 100}%`, minHeight: l.valoare ? 4 : 0 }} />
                    <span className="text-[11px] text-slate-400">{l.nume}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <p className="px-5 pt-4 text-sm font-semibold text-slate-800">Lista evenimentelor <span className="font-normal text-slate-400">({randuri.length})</span></p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      {coloane.map(([k, l]) => (
                        <th key={k} scope="col" className="px-5 py-2 font-semibold" aria-sort={sortare.cheie === k ? (sortare.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                          <button type="button" onClick={() => comutaSortare(k)} className="inline-flex items-center gap-1 uppercase hover:text-slate-800">
                            {l}
                            {sortare.cheie === k && (sortare.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {randuri.map((e) => (
                      <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-2 font-medium text-slate-800">{e.nume}</td>
                        <td className="whitespace-nowrap px-5 py-2 text-slate-600">
                          {dataScurta(e.data)}{e.data_sfarsit && e.data_sfarsit !== e.data ? ` – ${dataScurta(e.data_sfarsit)}` : ''}
                        </td>
                        <td className="px-5 py-2 text-slate-600">{numePm(e) || '—'}</td>
                        <td className="px-5 py-2 text-slate-600">{e.tipuri.map((c) => numeTip[c] || c).join(', ') || '—'}</td>
                        <td className="px-5 py-2 text-slate-600">{e.localitate || '—'}</td>
                      </tr>
                    ))}
                    {randuri.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">Niciun eveniment pentru filtrele alese.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  )
}
