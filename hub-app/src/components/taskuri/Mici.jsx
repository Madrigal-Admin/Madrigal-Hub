import { useEffect } from 'react'
import { Flag } from 'lucide-react'
import { PRIORITATE_DUPA_COD, STATUS_DUPA_COD } from '../../lib/taskuri/ui'

export function StatusBadge({ status }) {
  const s = STATUS_DUPA_COD[status]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s?.cls}`}>{s?.nume}</span>
}

export function Prioritate({ valoare }) {
  const p = PRIORITATE_DUPA_COD[valoare]
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${p?.cls}`} title={`Prioritate ${p?.nume.toLowerCase()}`}>
      <Flag size={12} /> {p?.nume}
    </span>
  )
}

export function Modal({ titlu, onClose, children, lat = 'max-w-2xl', esc = true }) {
  // Esc închide fereastra (ultima deschisă)
  useEffect(() => {
    const la = (e) => esc && e.key === 'Escape' && onClose()
    window.addEventListener('keydown', la)
    return () => window.removeEventListener('keydown', la)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8">
      <div className={`w-full ${lat} rounded-2xl bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-800">{titlu}</h3>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Închide">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Gol({ children }) {
  return <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">{children}</p>
}
