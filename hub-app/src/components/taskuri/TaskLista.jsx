import { useMemo, useState } from 'react'
import { Search, CalendarDays, User, Layers } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { STATUSURI, esteIntarziat, estePrelucrat, formatData, inputCls, mesajEroare, sorteaza } from '../../lib/taskuri/ui'
import { Gol, Prioritate, StatusBadge } from './Mici'

// Lista de taskuri cu filtre. Statusul se schimbă direct din listă (prin funcția din baza de date).
export default function TaskLista({ taskuri, ctx, onOpen, arataEveniment = true, arataResponsabil = true }) {
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

  async function schimba(t, status) {
    setEroare('')
    const { error } = await supabase.rpc('tsk_schimba_status', { p_task: t.id, p_status: status })
    if (error) setEroare(mesajEroare(error, 'Nu am putut schimba statusul.'))
    await ctx.reload()
  }

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
      </div>

      {eroare && <p className="mb-2 text-sm text-rose-600">{eroare}</p>}

      {vizibile.length === 0 ? (
        <Gol>{taskuri.length === 0 ? 'Nu există taskuri aici încă.' : 'Niciun task pentru filtrele alese.'}</Gol>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm">
          {vizibile.map((t) => {
            const ev = ctx.evMap[t.eveniment_id]
            const intarziat = esteIntarziat(t)
            const poate = ctx.poateSchimbaStatus(t) && !ctx.inghetat(t) && !(t.tip === 'eveniment' && ctx.evenimentAnulat(t.eveniment_id))
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50">
                <button type="button" onClick={() => onOpen(t)} className="min-w-[220px] flex-1 text-left">
                  <p className={`text-sm font-medium ${t.status === 'terminat' || t.status === 'anulat' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.titlu}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {arataEveniment && t.tip === 'eveniment' && ev && (
                      <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {ev.nume}</span>
                    )}
                    {t.tip === 'operational' && (
                      <span className="inline-flex items-center gap-1"><Layers size={12} /> {ctx.grupMap[t.grup_id]?.nume || 'Operațional'}</span>
                    )}
                    {arataResponsabil && (
                      <span className="inline-flex items-center gap-1"><User size={12} /> {t.responsabil_id ? ctx.nume(t.responsabil_id) : 'Fără responsabil'}</span>
                    )}
                  </p>
                </button>
                <span className={`text-xs ${intarziat ? 'font-semibold text-rose-600' : 'text-slate-500'}`} title={intarziat ? 'Termen depășit' : 'Termen'}>
                  {t.termen ? formatData(t.termen) : 'Fără termen'}
                </span>
                <Prioritate valoare={t.prioritate} />
                {poate ? (
                  <select
                    value={t.status}
                    onChange={(e) => schimba(t, e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                    aria-label="Schimbă statusul"
                  >
                    {STATUSURI.filter((s) => s.cod !== 'anulat' || ctx.poateGestiona(t)).map((s) => (
                      <option key={s.cod} value={s.cod}>{s.nume}</option>
                    ))}
                  </select>
                ) : (
                  <StatusBadge status={t.status} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
