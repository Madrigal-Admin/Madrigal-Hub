import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportaTaskuri } from '../../lib/taskuri/exportExcel'

// Buton „Export Excel": descarcă exact lista afișată, cu filtrele aplicate.
export default function ButonExport({ taskuri, ctx, filtre, numeFisier, clasa = '' }) {
  const [busy, setBusy] = useState(false)
  const [eroare, setEroare] = useState('')
  async function click() {
    setBusy(true)
    setEroare('')
    try {
      await exportaTaskuri(taskuri, ctx, filtre, numeFisier)
    } catch {
      setEroare('Nu am putut crea fișierul Excel.')
    }
    setBusy(false)
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={click} disabled={busy || taskuri.length === 0} title={taskuri.length === 0 ? 'Nu e nimic de exportat' : 'Descarcă lista de mai jos în Excel'} className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 ${clasa}`}>
        <Download size={15} aria-hidden="true" /> {busy ? 'Se creează…' : 'Export Excel'}
      </button>
      {eroare && <span className="text-xs text-rose-600">{eroare}</span>}
    </span>
  )
}
