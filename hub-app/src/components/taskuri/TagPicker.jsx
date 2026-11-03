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
// plutitor: lista se desenează peste tot (nu e tăiată de tabele/carduri) – pentru editarea în listă.
// onAlege(t): apelat când alegi/creezi un tag din listă; onEnter(v)/onBlur(v)/onEsc pentru editarea directă.
export default function TagPicker({ ctx, valoare, onChange, plutitor = false, autoFocus = false, placeholder = 'Alege un tag sau scrie unul nou…', ariaLabel, className, onAlege, onEnter, onBlur, onEsc, disabled }) {
  const [deschis, setDeschis] = useState(false)
  const [poz, setPoz] = useState(null)
  const radacina = useRef(null)
  const camp = useRef(null)
  const toate = useMemo(() => tagurileCunoscute(ctx), [ctx])
  const q = valoare.trim().toLowerCase()
  const potrivite = toate.filter((t) => !q || t.toLowerCase().includes(q))
  const exact = toate.some((t) => t.toLowerCase() === q)

  useEffect(() => {
    const la = (e) => { if (radacina.current && !radacina.current.contains(e.target)) setDeschis(false) }
    document.addEventListener('mousedown', la)
    return () => document.removeEventListener('mousedown', la)
  }, [])

  // în modul plutitor, lista stă fixă sub câmp; se închide dacă pagina se mișcă
  useEffect(() => {
    if (!plutitor || !deschis) return
    const r = camp.current.getBoundingClientRect()
    const jos = window.innerHeight - r.bottom
    setPoz(jos < 240 && r.top > jos ? { bottom: window.innerHeight - r.top + 4, left: r.left, width: Math.max(r.width, 200) } : { top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) })
    const inchide = () => setDeschis(false)
    window.addEventListener('scroll', inchide, true)
    window.addEventListener('resize', inchide)
    return () => { window.removeEventListener('scroll', inchide, true); window.removeEventListener('resize', inchide) }
  }, [plutitor, deschis])

  const alege = (t) => { onChange(t); setDeschis(false); onAlege?.(t) }
  const arataLista = deschis && (potrivite.length > 0 || (q && !exact))
  const stilLista = plutitor ? { position: 'fixed', top: poz?.top, bottom: poz?.bottom, left: poz?.left, width: poz?.width, visibility: poz ? 'visible' : 'hidden' } : undefined
  const clasaLista = `${plutitor ? 'z-50' : 'absolute z-10 w-full'} mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg`

  return (
    <div ref={radacina} className="relative">
      <input
        ref={camp}
        className={className || inputCls}
        value={valoare}
        maxLength={60}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => { onChange(e.target.value); setDeschis(true) }}
        onFocus={() => setDeschis(true)}
        onBlur={(e) => onBlur?.(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.stopPropagation(); if (deschis && !onEsc) setDeschis(false); else onEsc?.() }
          if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(e.currentTarget.value) }
        }}
        onClick={(e) => e.stopPropagation()}
        role="combobox"
        aria-expanded={deschis}
        aria-autocomplete="list"
      />
      {arataLista && (
        <ul className={clasaLista} style={stilLista}>
          {potrivite.map((t) => (
            <li key={t}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => alege(t)} className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50">{t}</button>
            </li>
          ))}
          {q && !exact && (
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => alege(valoare.trim())} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-accent hover:bg-slate-50">
                <Plus size={14} /> Creează tagul „{valoare.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
