import { useMemo, useRef, useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { inputCls } from '../../lib/taskuri/ui'

// Tagurile cunoscute: secțiunile din checklist + tagurile deja folosite pe taskuri (fără dubluri).
export function tagurileCunoscute(ctx) {
  const mapa = new Map()
  const adauga = (t) => {
    const v = (t || '').trim()
    if (v && !mapa.has(v.toLowerCase())) mapa.set(v.toLowerCase(), v)
  }
  ctx.sectiuni.forEach((s) => adauga(s.nume))
  ctx.taskuri.forEach((t) => adauga(t.tag))
  return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'ro'))
}

// Câmp „Tag": alegi din listă sau scrii unul nou.
export default function TagPicker({ ctx, valoare, onChange }) {
  const [deschis, setDeschis] = useState(false)
  const radacina = useRef(null)
  const toate = useMemo(() => tagurileCunoscute(ctx), [ctx])
  const q = valoare.trim().toLowerCase()
  const potrivite = toate.filter((t) => !q || t.toLowerCase().includes(q))
  const exact = toate.some((t) => t.toLowerCase() === q)

  useEffect(() => {
    const la = (e) => { if (radacina.current && !radacina.current.contains(e.target)) setDeschis(false) }
    document.addEventListener('mousedown', la)
    return () => document.removeEventListener('mousedown', la)
  }, [])

  const alege = (t) => { onChange(t); setDeschis(false) }

  return (
    <div ref={radacina} className="relative">
      <input
        className={inputCls}
        value={valoare}
        maxLength={60}
        placeholder="Alege un tag sau scrie unul nou…"
        onChange={(e) => { onChange(e.target.value); setDeschis(true) }}
        onFocus={() => setDeschis(true)}
        onKeyDown={(e) => { if (e.key === 'Escape' && deschis) { e.stopPropagation(); setDeschis(false) } }}
        role="combobox"
        aria-expanded={deschis}
        aria-autocomplete="list"
      />
      {deschis && (potrivite.length > 0 || (q && !exact)) && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {potrivite.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => alege(t)} className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">{t}</button>
            </li>
          ))}
          {q && !exact && (
            <li>
              <button type="button" onClick={() => alege(valoare.trim())} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-accent hover:bg-slate-50">
                <Plus size={14} /> Creează tagul „{valoare.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
