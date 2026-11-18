import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
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

// ---- Elemente pentru paginile de detaliu (fără carduri: linii subțiri și spațiu) ----

// Titlu de secțiune mic, cu acțiuni opționale în dreapta
export function Sectiune({ titlu, actiuni, children, className = '' }) {
  return (
    <section className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titlu}</h3>
        {actiuni}
      </div>
      {children}
    </section>
  )
}

// Un rând etichetă–valoare dintr-o listă de detalii
export function Rand({ eticheta, children }) {
  return (
    <div className="flex flex-wrap gap-x-4 border-b border-slate-100 py-2.5">
      <dt className="w-40 flex-none text-[13px] font-semibold text-slate-500">{eticheta}</dt>
      <dd className="min-w-0 flex-1 basis-48 text-sm text-slate-800">{children || <span className="text-slate-400">—</span>}</dd>
    </div>
  )
}

// Panoul din dreapta (stare, rezoluție, termen, locație, acțiuni rare)
export function PanouLateral({ children }) {
  return <aside className="w-full rounded-2xl bg-[#f4f7fb] p-5 lg:w-[360px] lg:flex-none">{children}</aside>
}
export function Linie() {
  return <hr className="my-4 border-[#dbe3ee]" />
}

// Pașii de stare, pe verticală. Pasul curent e plin; cei dinaintea lui au bifă.
// onPick(id) se apelează la clic pe un pas permis; fără onPick, pașii sunt doar de citit.
export function PasiStare({ pasi, curent, rosu = false, permis, onPick }) {
  return (
    <ol className="space-y-0.5">
      {pasi.map((p, i) => {
        const plin = i <= curent
        const esteCurent = i === curent
        const clicabil = !!onPick && !esteCurent && (!permis || permis(p.id))
        const culoare = esteCurent && rosu ? 'border-rose-700 bg-rose-700 text-white' : plin ? 'border-accent bg-accent text-white' : 'border-slate-300 bg-white text-slate-500'
        return (
          <li key={p.id}>
            <button
              type="button"
              disabled={!clicabil}
              aria-current={esteCurent ? 'step' : undefined}
              onClick={() => onPick(p.id)}
              className={`flex w-full items-center gap-3 rounded-lg py-1.5 text-left text-sm focus-ring ${clicabil ? 'cursor-pointer hover:bg-white/70' : 'cursor-default'} ${esteCurent ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}
            >
              <span className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-2 text-xs font-bold ${culoare}`}>
                {i < curent ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">{p.label}</span>
              {p.data && <span className="text-xs font-medium text-slate-500">{p.data}</span>}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

// Fereastră (pop-up) deasupra paginii. Se închide doar din X sau cu Escape, nu la clic în afară (ca să nu se piardă ce ai scris).
export function Fereastra({ titlu, subtitlu, children, onInchide, latime = 'max-w-3xl' }) {
  useEffect(() => {
    const tasta = (e) => { if (e.key === 'Escape') onInchide() }
    document.addEventListener('keydown', tasta)
    return () => document.removeEventListener('keydown', tasta)
  }, [onInchide])
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-3 md:p-10">
      <div role="dialog" aria-modal="true" aria-label={titlu} className={`w-full ${latime} rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{titlu}</h2>
            {subtitlu && <p className="mt-0.5 text-[13px] text-slate-500">{subtitlu}</p>}
          </div>
          <button type="button" aria-label="Închide fereastra" onClick={onInchide} className="ml-auto rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-ring">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
