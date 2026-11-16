import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, X as XIcon } from 'lucide-react'
import { inputCls } from '../../lib/taskuri/ui'

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Selecție multiplă: un singur rând în formular, listă cu căutare și casete bifate; ce ai ales apare ca etichete mici cu ✕.
export default function SelectieMultipla({ optiuni, valoare, onChange, placeholder = 'Alege din listă…', id }) {
  const [deschis, setDeschis] = useState(false)
  const [q, setQ] = useState('')
  const radacina = useRef(null)

  useEffect(() => {
    if (!deschis) return
    const afara = (e) => { if (radacina.current && !radacina.current.contains(e.target)) setDeschis(false) }
    const tasta = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setDeschis(false) } }
    document.addEventListener('mousedown', afara)
    window.addEventListener('keydown', tasta, true)
    return () => { document.removeEventListener('mousedown', afara); window.removeEventListener('keydown', tasta, true) }
  }, [deschis])

  const vizibile = useMemo(() => optiuni.filter((o) => !q.trim() || norm(o.eticheta).includes(norm(q))), [optiuni, q])
  const alese = valoare.map((cod) => optiuni.find((o) => o.cod === cod)).filter(Boolean)
  const comuta = (cod) => onChange(valoare.includes(cod) ? valoare.filter((x) => x !== cod) : [...valoare, cod])

  return (
    <div ref={radacina} className="relative">
      <button
        type="button"
        id={id}
        aria-expanded={deschis}
        onClick={() => setDeschis((d) => !d)}
        className={`${inputCls} flex min-h-[42px] items-center justify-between gap-2 text-left`}
      >
        <span className={alese.length ? 'text-slate-800' : 'text-slate-400'}>{alese.length ? `${alese.length} selectate` : placeholder}</span>
        {deschis ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
      {deschis && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input autoFocus className={inputCls} placeholder="Caută…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="max-h-52 overflow-y-auto px-2 py-1">
            {vizibile.length === 0 && <p className="px-2 py-3 text-center text-sm text-slate-400">Nimic găsit.</p>}
            {vizibile.map((o) => (
              <label key={o.cod} className="flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <input type="checkbox" className="h-[18px] w-[18px] accent-[#22406B]" checked={valoare.includes(o.cod)} onChange={() => comuta(o.cod)} />
                {o.eticheta}
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>{valoare.length} din {optiuni.length} selectate</span>
            <button type="button" onClick={() => onChange([])} disabled={valoare.length === 0} className="font-bold text-accent disabled:opacity-40">Șterge selecția</button>
          </div>
        </div>
      )}
      {alese.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {alese.map((o) => (
            <span key={o.cod} className="inline-flex items-center gap-1 rounded-md bg-[#E4ECF8] px-2 py-0.5 text-xs font-bold text-[#22406B]">
              {o.eticheta}
              <button type="button" onClick={() => comuta(o.cod)} className="rounded p-0.5 hover:bg-white/60" aria-label={`Scoate „${o.eticheta}”`}><XIcon size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
