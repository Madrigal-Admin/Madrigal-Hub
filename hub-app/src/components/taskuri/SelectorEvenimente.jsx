import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { formatData } from '../../lib/taskuri/ui'

// Alegi unul, mai multe sau toate evenimentele. `selectate` gol = toate.
export default function SelectorEvenimente({ evenimente, selectate, onChange }) {
  const [deschis, setDeschis] = useState(false)
  const [q, setQ] = useState('')
  const radacina = useRef(null)

  useEffect(() => {
    const la = (e) => { if (radacina.current && !radacina.current.contains(e.target)) setDeschis(false) }
    const tasta = (e) => e.key === 'Escape' && setDeschis(false)
    document.addEventListener('mousedown', la)
    document.addEventListener('keydown', tasta)
    return () => { document.removeEventListener('mousedown', la); document.removeEventListener('keydown', tasta) }
  }, [])

  const vizibile = useMemo(() => {
    const t = q.trim().toLowerCase()
    return evenimente.filter((e) => !t || `${e.nume} ${e.localitate || ''}`.toLowerCase().includes(t))
  }, [evenimente, q])

  const nr = selectate.size
  const eticheta = nr === 0 ? `Toate evenimentele (${evenimente.length})` : nr === 1 ? evenimente.find((e) => selectate.has(e.id))?.nume || '1 eveniment' : `${nr} evenimente alese`
  const comuta = (id) => { const n = new Set(selectate); n.has(id) ? n.delete(id) : n.add(id); onChange(n) }

  return (
    <div ref={radacina} className="relative">
      <button type="button" onClick={() => setDeschis((d) => !d)} aria-expanded={deschis} className="inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-[10px] border border-[#CBD3E0] bg-white px-3.5 text-sm font-semibold text-accent hover:bg-[#F6F8FB] focus-ring">
        <span className="truncate">{eticheta}</span> <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
      </button>
      {deschis && (
        <div className="absolute left-0 z-30 mt-1 w-[min(92vw,380px)] rounded-xl border border-[#E1E4EA] bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută după nume sau oraș…" className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:border-accent focus:outline-none" />
          </div>
          <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm font-semibold hover:bg-[#F6F8FB]">
            <input type="checkbox" checked={nr === 0} onChange={() => onChange(new Set())} /> Toate evenimentele
          </label>
          <ul className="max-h-64 overflow-y-auto">
            {vizibile.map((e) => (
              <li key={e.id}>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2 hover:bg-[#F6F8FB]">
                  <input type="checkbox" checked={selectate.has(e.id)} onChange={() => comuta(e.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#172036]">{e.nume}</span>
                    <span className="block truncate text-xs text-[#5B6578]">{formatData(e.data)}{e.localitate ? ` · ${e.localitate}` : ''}</span>
                  </span>
                </label>
              </li>
            ))}
            {vizibile.length === 0 && <li className="px-2 py-3 text-sm text-slate-400">Niciun eveniment găsit.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
