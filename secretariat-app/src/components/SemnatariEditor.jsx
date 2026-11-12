import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { ORDINE_SEMNARE } from '../lib/roluri'
import { inputCls, labelCls } from '../lib/ui'

// Lista semnatarilor (angajați din Hub), în ordinea în care vor semna, plus ordinea de semnare.
export default function SemnatariEditor({ valoare, onChange, ordine, onOrdine, comune }) {
  const [alege, setAlege] = useState('')
  const disponibili = comune.angajati.filter((a) => a.activ && !valoare.includes(a.id))
  const nume = (id) => comune.angajati.find((a) => a.id === id)?.nume_complet || 'Angajat șters'

  const muta = (i, d) => {
    const j = i + d
    if (j < 0 || j >= valoare.length) return
    const v = [...valoare]
    ;[v[i], v[j]] = [v[j], v[i]]
    onChange(v)
  }

  return (
    <div className="space-y-3">
      <div>
        <p className={labelCls}>Ordinea de semnare</p>
        <div className="space-y-1 text-sm text-slate-700">
          {Object.entries(ORDINE_SEMNARE).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2">
              <input type="radio" name="ordine_semnare" checked={ordine === k} onChange={() => onOrdine(k)} /> {l}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className={labelCls}>Semnatari *</p>
        {valoare.length === 0 ? (
          <p className="text-xs text-slate-500">Niciun semnatar adăugat încă.</p>
        ) : (
          <ol className="space-y-1">
            {valoare.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
                <span className="w-5 text-xs font-semibold text-slate-500">{ordine === 'pe_rand' ? `${i + 1}.` : '•'}</span>
                <span className="flex-1">{nume(id)}</span>
                {ordine === 'pe_rand' && (
                  <>
                    <button type="button" aria-label={`Mută ${nume(id)} mai sus`} disabled={i === 0} onClick={() => muta(i, -1)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 focus-ring"><ChevronUp size={14} /></button>
                    <button type="button" aria-label={`Mută ${nume(id)} mai jos`} disabled={i === valoare.length - 1} onClick={() => muta(i, 1)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 focus-ring"><ChevronDown size={14} /></button>
                  </>
                )}
                <button type="button" aria-label={`Elimină ${nume(id)}`} onClick={() => onChange(valoare.filter((v) => v !== id))}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-ring"><X size={14} /></button>
              </li>
            ))}
          </ol>
        )}
        <label className="sr-only" htmlFor="adauga_semnatar">Adaugă un semnatar</label>
        <select id="adauga_semnatar" className={`${inputCls} mt-2`} value={alege}
          onChange={(e) => { if (e.target.value) onChange([...valoare, e.target.value]); setAlege('') }}>
          <option value="">Adaugă un semnatar…</option>
          {disponibili.map((a) => <option key={a.id} value={a.id}>{a.nume_complet}</option>)}
        </select>
      </div>
    </div>
  )
}
