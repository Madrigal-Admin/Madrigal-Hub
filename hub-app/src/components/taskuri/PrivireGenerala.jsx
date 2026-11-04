import { useMemo, useState } from 'react'
import { Modal } from './Mici'
import TaskLista from './TaskLista'
import { esteIntarziat, estePrelucrat, formatData, inputCls } from '../../lib/taskuri/ui'

// „Privire Generală": imagine de ansamblu doar pentru vizualizare (nimic nu se poate modifica de aici).
export default function PrivireGenerala({ ctx, onClose }) {
  const [tab, setTab] = useState('evenimente')
  const [arataToate, setArataToate] = useState(false)

  const evenimente = useMemo(() => {
    const lista = ctx.evenimente
      .filter((e) => ctx.comportament(e.id) !== 'anulat')
      .filter((e) => arataToate || ['deschis', 'organizare'].includes(ctx.comportament(e.id)))
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
    return lista.map((e) => {
      const taskuri = ctx.taskuri.filter((t) => t.eveniment_id === e.id && t.status !== 'anulat')
      return {
        ...e,
        total: taskuri.length,
        gata: taskuri.filter((t) => t.status === 'terminat').length,
        deschise: taskuri.filter(estePrelucrat).length,
        intarziate: taskuri.filter(esteIntarziat).length,
        faraResp: taskuri.filter((t) => estePrelucrat(t) && !t.responsabil_id).length,
      }
    })
  }, [ctx, arataToate])

  const deschise = ctx.taskuri.filter(estePrelucrat)
  const kpi = [
    ['Evenimente active', ctx.evenimente.filter((e) => ['deschis', 'organizare'].includes(ctx.comportament(e.id))).length, ''],
    ['Taskuri deschise', deschise.length, ''],
    ['Întârziate', deschise.filter(esteIntarziat).length, 'text-[#B4332E]'],
    ['Fără responsabil', deschise.filter((t) => !t.responsabil_id).length, ''],
  ]

  const tabBtn = (k, l) => (
    <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{l}</button>
  )

  return (
    <Modal titlu="Privire Generală" onClose={onClose} lat="max-w-6xl">
      <p className="-mt-2 mb-4 text-sm text-slate-500">Toate evenimentele și taskurile, doar pentru vizualizare. Nimic nu se modifică din această fereastră.</p>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpi.map(([e, n, cls]) => (
          <div key={e} className="rounded-xl border border-[#E1E4EA] px-4 py-3">
            <div className="text-xs font-semibold text-[#5B6578]">{e}</div>
            <div className={`text-2xl font-extrabold ${cls}`}>{n}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">{tabBtn('evenimente', 'Evenimente')}{tabBtn('taskuri', 'Taskuri')}</div>
        {tab === 'evenimente' && (
          <select className={`${inputCls} !w-auto`} value={arataToate ? 'toate' : 'active'} onChange={(e) => setArataToate(e.target.value === 'toate')} aria-label="Evenimente afișate">
            <option value="active">Doar active (deschise și în organizare)</option>
            <option value="toate">Toate (fără cele anulate)</option>
          </select>
        )}
      </div>

      {tab === 'taskuri' && <TaskLista taskuri={ctx.taskuri} ctx={ctx} doarCitire numeFisier="privire-generala-taskuri" />}

      {tab === 'evenimente' && (
        <div className="overflow-x-auto rounded-xl border border-[#E1E4EA]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#F6F8FB] text-[11px] font-bold uppercase tracking-wider text-[#5B6578]">
              <tr>
                <th className="px-4 py-2">Eveniment</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">PM</th>
                <th className="px-3 py-2">Progres taskuri</th><th className="px-3 py-2">Întârziate</th><th className="px-3 py-2">Fără responsabil</th>
              </tr>
            </thead>
            <tbody>
              {evenimente.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Niciun eveniment.</td></tr>}
              {evenimente.map((e) => (
                <tr key={e.id} className="border-t border-[#EEF0F4]">
                  <td className="px-4 py-2 font-semibold text-[#172036]">{e.nume}</td>
                  <td className="px-3 py-2 text-[13px] text-[#172036]">{e.data ? formatData(e.data) : '—'}</td>
                  <td className="px-3 py-2 text-[13px]">{ctx.statusMap[e.status]?.nume || e.status}</td>
                  <td className="px-3 py-2 text-[13px]">{e.pm.length ? e.pm.map((id) => ctx.nume(id)).join(', ') : '—'}</td>
                  <td className="px-3 py-2">
                    {e.total ? (
                      <div className="min-w-[120px]">
                        <div className="h-2 overflow-hidden rounded-full bg-[#E9EDF3]"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round((e.gata / e.total) * 100)}%` }} /></div>
                        <div className="mt-1 text-xs text-[#5B6578]">{e.gata} din {e.total}</div>
                      </div>
                    ) : <span className="text-xs text-slate-400">fără taskuri</span>}
                  </td>
                  <td className={`px-3 py-2 text-[13px] font-semibold ${e.intarziate ? 'text-[#B4332E]' : 'text-slate-400'}`}>{e.intarziate}</td>
                  <td className={`px-3 py-2 text-[13px] font-semibold ${e.faraResp ? 'text-[#C77700]' : 'text-slate-400'}`}>{e.faraResp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
