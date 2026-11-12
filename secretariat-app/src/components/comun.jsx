import { useState } from 'react'
import { MOD_SEMNARE_SCURT, STARE_SEMNATAR, STATUSURI } from '../lib/roluri'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'

export function StareBadge({ stare }) {
  const s = STATUSURI[stare] || { label: stare, clasa: 'bg-slate-100 text-slate-600' }
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.clasa}`}>{s.label}</span>
}

export function StareSemnatarBadge({ stare }) {
  const s = STARE_SEMNATAR[stare] || { label: stare, clasa: 'bg-slate-100 text-slate-600' }
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.clasa}`}>{s.label}</span>
}

// Modul de semnare (fizică / electronică) — se arată în orice status
export function ModSemnareBadge({ mod }) {
  const electronic = mod === 'electronica'
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${electronic ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-300 bg-white text-slate-600'}`}>
      {MOD_SEMNARE_SCURT[mod] || mod}
    </span>
  )
}

export function Card({ children, className = '' }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
}

export function Titlu({ children, actiuni }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-slate-800">{children}</h2>
      {actiuni && <div className="flex flex-wrap gap-2">{actiuni}</div>}
    </div>
  )
}

export function Eroare({ children }) {
  if (!children) return null
  return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{children}</p>
}

export function Info({ children }) {
  return <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{children}</p>
}

export function Valoare({ eticheta, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{eticheta}</p>
      <div className="mt-0.5 text-sm text-slate-800">{children || <span className="text-slate-400">—</span>}</div>
    </div>
  )
}

// Casetă pentru acțiuni care cer un motiv (anulare)
export function CasetaMotiv({ titlu, eticheta = 'Motiv', onConfirma, onRenunta, busy }) {
  const [motiv, setMotiv] = useState('')
  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-800">{titlu}</p>
      <label className={labelCls}>{eticheta}</label>
      <textarea rows={2} className={inputCls} value={motiv} onChange={(e) => setMotiv(e.target.value)} />
      <div className="flex gap-2">
        <button disabled={!motiv.trim() || busy} onClick={() => onConfirma(motiv.trim())} className={btnPrimary}>
          Confirmă
        </button>
        <button onClick={onRenunta} className={btnGhost}>Renunță</button>
      </div>
    </div>
  )
}
