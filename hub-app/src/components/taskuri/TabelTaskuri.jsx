import { useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { PRIORITATE_DUPA_COD, esteIntarziat, formatData, mesajEroare, sorteaza } from '../../lib/taskuri/ui'
import StatusDropdown from './StatusDropdown'

const COLOANE = 'grid grid-cols-[112px_minmax(0,1fr)_92px_148px_148px_84px] items-center gap-x-3'
const PUNCT = { mare: '#B4332E', medie: '#C77700', mica: '#7A869A' }

// Tabel compact de taskuri (același aspect ca pe homepage); statusul se schimbă direct din rând.
export default function TabelTaskuri({ taskuri, ctx, onOpen, onEroare, arataEveniment = false }) {
  const [suprascrieri, setSuprascrieri] = useState({})
  const randuri = useMemo(() => {
    const cuStatus = taskuri.map((t) => (suprascrieri[t.id] ? { ...t, status: suprascrieri[t.id] } : t))
    const deschise = sorteaza(cuStatus.filter((t) => t.status === 'de_facut' || t.status === 'in_lucru'))
    const restul = sorteaza(cuStatus.filter((t) => t.status === 'terminat' || t.status === 'anulat'))
    return [...deschise, ...restul]
  }, [taskuri, suprascrieri])

  async function seteaza(t, nou) {
    onEroare?.('')
    setSuprascrieri((s) => ({ ...s, [t.id]: nou }))
    const { error } = await supabase.rpc('tsk_schimba_status', { p_task: t.id, p_status: nou })
    if (error) onEroare?.(mesajEroare(error, 'Nu am putut schimba statusul.'))
    await ctx.reload()
    setSuprascrieri((s) => { const n = { ...s }; delete n[t.id]; return n })
  }

  if (randuri.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div className={`${COLOANE} border-t border-[#E1E4EA] bg-[#F6F8FB] px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5B6578]`}>
          <span>Status</span><span>Titlu · tag</span><span>Deadline</span><span>Responsabil</span><span>Deschis de</span><span>Prioritate</span>
        </div>
        {randuri.map((t) => {
          const inchis = t.status === 'terminat' || t.status === 'anulat'
          const nume = t.responsabil_id ? ctx.nume(t.responsabil_id) : ''
          return (
            <div key={t.id} className={`${COLOANE} border-t border-[#EEF0F4] px-5 py-1.5 hover:bg-[#FAFBFD]`}>
              <div>
                <StatusDropdown compact status={t.status} poate={ctx.poateSchimbaStatus(t) && !(ctx.inghetat && ctx.inghetat(t)) && !ctx.evenimentAnulat(t.eveniment_id)} poateAnula={ctx.poateGestiona(t)} onChange={(s) => seteaza(t, s)} />
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <button type="button" onClick={() => onOpen(t)} title={t.titlu} className={`min-w-0 truncate text-left text-sm font-semibold hover:underline ${inchis ? 'text-[#7A869A] line-through' : 'text-[#172036]'}`}>{t.titlu}</button>
                {arataEveniment && t.tip === 'eveniment' && ctx.evMap?.[t.eveniment_id] && <span className="max-w-[200px] shrink-0 truncate rounded-md bg-cream px-2 py-0.5 text-xs font-semibold text-[#172036]" title={ctx.evMap[t.eveniment_id].nume}>{ctx.evMap[t.eveniment_id].nume}</span>}
                {arataEveniment && t.tip === 'operational' && <span className="shrink-0 rounded-md border border-[#9AA6B8] px-2 py-0.5 text-xs font-semibold text-[#3A465C]">{ctx.grupMap?.[t.grup_id]?.nume || 'Operațional'}</span>}
                {t.tag && <span className="shrink-0 rounded-md bg-[#F1F3F7] px-2 py-0.5 text-xs font-semibold text-[#3A465C]">{t.tag}</span>}
              </div>
              <div className={`text-[13px] font-bold ${esteIntarziat(t) ? 'text-[#B4332E]' : 'text-[#172036]'}`}>{t.termen ? formatData(t.termen) : '—'}</div>
              <div className="min-w-0 truncate text-[13px] text-[#172036]" title={nume}>{t.responsabil_id ? nume : <span className="text-[#7A869A]">Fără responsabil</span>}</div>
              <div className="min-w-0 truncate text-[13px] text-[#172036]" title={t.creat_de ? ctx.nume(t.creat_de) : ''}>{t.creat_de ? ctx.nume(t.creat_de) : '—'}</div>
              <div className="flex items-center gap-1.5 text-[13px] text-[#5B6578]">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: PUNCT[t.prioritate] }} />
                {PRIORITATE_DUPA_COD[t.prioritate]?.nume}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
