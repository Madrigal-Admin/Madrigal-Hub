import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { STATUSURI, esteIntarziat, estePrelucrat, inputCls, sorteaza } from '../../lib/taskuri/ui'
import { Gol } from './Mici'
import TabelTaskuri from './TabelTaskuri'
import ButonExport from './ButonExport'

// Lista de taskuri cu filtre. Statusul se schimbă direct din listă (prin funcția din baza de date).
export default function TaskLista({ taskuri, ctx, onOpen, arataEveniment = true, arataResponsabil = true, doarCitire = false, numeFisier = 'taskuri' }) {
  const [text, setText] = useState('')
  const [filtruStatus, setFiltruStatus] = useState('deschise')
  const [resp, setResp] = useState('')
  const [eroare, setEroare] = useState('')

  const responsabili = useMemo(() => {
    const ids = [...new Set(taskuri.map((t) => t.responsabil_id).filter(Boolean))]
    return ids.map((id) => ({ id, nume: ctx.nume(id) })).sort((a, b) => a.nume.localeCompare(b.nume))
  }, [taskuri, ctx])

  const vizibile = useMemo(() => {
    const q = text.trim().toLowerCase()
    return sorteaza(
      taskuri.filter((t) => {
        if (filtruStatus === 'deschise' && !estePrelucrat(t)) return false
        if (filtruStatus === 'intarziate' && !esteIntarziat(t)) return false
        if (!['deschise', 'toate', 'intarziate'].includes(filtruStatus) && t.status !== filtruStatus) return false
        if (resp === '__nimeni' ? t.responsabil_id : resp && t.responsabil_id !== resp) return false
        if (q && !t.titlu.toLowerCase().includes(q) && !(ctx.evMap[t.eveniment_id]?.nume || '').toLowerCase().includes(q)) return false
        return true
      })
    )
  }, [taskuri, text, filtruStatus, resp, ctx])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pl-8`} placeholder="Caută după titlu sau eveniment…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <select className={`${inputCls} !w-auto`} value={filtruStatus} onChange={(e) => setFiltruStatus(e.target.value)} aria-label="Status">
          <option value="deschise">Doar deschise</option>
          <option value="intarziate">Întârziate</option>
          <option value="toate">Toate</option>
          {STATUSURI.map((s) => (
            <option key={s.cod} value={s.cod}>{s.nume}</option>
          ))}
        </select>
        {arataResponsabil && (
          <select className={`${inputCls} !w-auto`} value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsabil">
            <option value="">Toți responsabilii</option>
            <option value="__nimeni">Fără responsabil</option>
            {responsabili.map((r) => (
              <option key={r.id} value={r.id}>{r.nume}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-slate-400">{vizibile.length} din {taskuri.length}</span>
        <ButonExport taskuri={vizibile} ctx={ctx} numeFisier={numeFisier} filtre={[
          ['Status', filtruStatus === 'deschise' ? 'Doar deschise' : filtruStatus === 'toate' ? 'Toate' : filtruStatus === 'intarziate' ? 'Întârziate' : STATUSURI.find((x) => x.cod === filtruStatus)?.nume],
          ['Responsabil', resp === '__nimeni' ? 'Fără responsabil' : resp ? ctx.nume(resp) : 'Toți'],
          ['Căutare text', text.trim() || '—'],
        ]} />
      </div>

      {eroare && <p className="mb-2 text-sm text-rose-600">{eroare}</p>}

      {vizibile.length === 0 ? (
        <Gol>{taskuri.length === 0 ? 'Nu există taskuri aici încă.' : 'Niciun task pentru filtrele alese.'}</Gol>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <TabelTaskuri taskuri={vizibile} ctx={ctx} onOpen={onOpen} onEroare={setEroare} arataEveniment={arataEveniment} doarCitire={doarCitire} />
        </div>
      )}
    </div>
  )
}
