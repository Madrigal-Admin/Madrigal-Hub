import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

// Dropdown cu selecție multiplă. `selectat` este un Set; gol = fără filtru (toate).
// optiuni: [{ valoare, eticheta, culoare? }]
export default function FiltruMulti({ eticheta, toate, optiuni, selectat, onChange }) {
  const [deschis, setDeschis] = useState(false)
  const radacina = useRef(null)

  useEffect(() => {
    if (!deschis) return
    const afara = (e) => { if (radacina.current && !radacina.current.contains(e.target)) setDeschis(false) }
    const tasta = (e) => e.key === 'Escape' && setDeschis(false)
    document.addEventListener('mousedown', afara)
    document.addEventListener('keydown', tasta)
    return () => { document.removeEventListener('mousedown', afara); document.removeEventListener('keydown', tasta) }
  }, [deschis])

  function comuta(v) {
    const nou = new Set(selectat)
    if (nou.has(v)) nou.delete(v)
    else nou.add(v)
    onChange(nou)
  }

  const nr = selectat.size
  const text = nr === 0 ? toate : nr === 1 ? (optiuni.find((o) => o.valoare === [...selectat][0])?.eticheta || toate) : `${eticheta}: ${nr} selectate`

  return (
    <div className="relative" ref={radacina}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={deschis}
        onClick={() => setDeschis((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${nr ? 'border-[#22406B] bg-[#E4ECF8] text-[#22406B]' : 'border-slate-200 bg-white text-slate-600'}`}
      >
        <span className="max-w-[170px] truncate">{text}</span>
        <ChevronDown size={14} />
      </button>
      {deschis && (
        <div role="listbox" aria-multiselectable="true" aria-label={eticheta} className="absolute left-0 z-30 mt-1 max-h-72 min-w-[220px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg sm:left-auto sm:right-0">
          {optiuni.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Nicio opțiune.</p>}
          {optiuni.map((o) => {
            const bifat = selectat.has(o.valoare)
            return (
              <button
                key={o.valoare}
                type="button"
                role="option"
                aria-selected={bifat}
                onClick={() => comuta(o.valoare)}
                className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${bifat ? 'border-[#22406B] bg-[#22406B] text-white' : 'border-slate-300'}`}>
                  {bifat && <Check size={12} />}
                </span>
                {o.culoare && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.culoare }} />}
                <span className="truncate">{o.eticheta}</span>
              </button>
            )
          })}
          {nr > 0 && (
            <button type="button" onClick={() => onChange(new Set())} className="mt-1 w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-[#22406B] hover:bg-slate-50">
              Șterge selecția
            </button>
          )}
        </div>
      )}
    </div>
  )
}
