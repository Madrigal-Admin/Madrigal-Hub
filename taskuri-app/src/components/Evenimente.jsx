import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ListChecks, Plus, PlayCircle, CheckCircle2, RotateCcw } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { estePrelucrat, formatData, mesajEroare, esteIntarziat } from '../lib/ui'
import { culoareText } from '../lib/culori'
import { Gol } from './Mici'
import TaskLista from './TaskLista'

// „Evenimentele mele": progresul fiecărui eveniment la care ești PM (adminul le vede pe toate).
export default function Evenimente({ ctx, onOpen, onTaskNou, onChecklist }) {
  const [toate, setToate] = useState(false)
  const [deschise, setDeschise] = useState(() => new Set())
  const [eroare, setEroare] = useState('')

  const lista = useMemo(() => {
    const baza = ctx.admin ? ctx.evenimente : ctx.evenimenteMele
    return baza
      .filter((e) => toate || ['deschis', 'organizare'].includes(ctx.comportament(e.id)))
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
  }, [ctx, toate])

  async function status(e, cod) {
    setEroare('')
    const { error } = await supabase.rpc('tsk_eveniment_schimba_status', { p_eveniment: e.id, p_status: cod })
    if (error) setEroare(mesajEroare(error, 'Nu am putut schimba statusul evenimentului.'))
    await ctx.reload()
  }

  const codOrganizare = ctx.statusuri.find((s) => s.comportament === 'organizare')?.cod
  const codFinalizat = ctx.statusuri.find((s) => s.comportament === 'finalizat')?.cod

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-500">
          {ctx.admin ? 'Toate evenimentele.' : 'Evenimentele la care ești PM.'}
        </p>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={toate} onChange={(e) => setToate(e.target.checked)} />
          Arată și evenimentele finalizate / anulate
        </label>
      </div>
      {eroare && <p className="mb-3 whitespace-pre-wrap text-sm text-rose-600">{eroare}</p>}

      {lista.length === 0 ? (
        <Gol>{ctx.admin ? 'Nu există evenimente active.' : 'Nu ești PM la niciun eveniment activ.'}</Gol>
      ) : (
        <div className="space-y-3">
          {lista.map((e) => {
            const st = ctx.statusMap[e.status]
            const comp = st?.comportament
            const taskuri = ctx.taskuri.filter((t) => t.eveniment_id === e.id)
            const valide = taskuri.filter((t) => t.status !== 'anulat')
            const gata = valide.filter((t) => t.status === 'terminat').length
            const deschiseNr = taskuri.filter(estePrelucrat).length
            const intarziate = taskuri.filter(esteIntarziat).length
            const procent = valide.length ? Math.round((gata / valide.length) * 100) : 0
            const desch = deschise.has(e.id)
            const poate = ctx.admin || ctx.pmLaEveniment(e.id)
            return (
              <div key={e.id} className="rounded-xl bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setDeschise((p) => { const n = new Set(p); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })}
                    className="flex min-w-[220px] flex-1 items-center gap-2 text-left"
                  >
                    {desch ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{e.nume}</span>
                      <span className="block text-xs text-slate-500">
                        {formatData(e.data)}{e.localitate ? ` · ${e.localitate}` : ''}
                      </span>
                    </span>
                  </button>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${st?.culoare}26`, color: culoareText(st?.culoare) }}>
                    {st?.nume || e.status}
                  </span>
                  <div className="w-40">
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${procent}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {gata}/{valide.length} terminate{intarziate > 0 && <span className="font-semibold text-rose-600"> · {intarziate} întârziate</span>}
                    </p>
                  </div>
                </div>

                {poate && comp !== 'anulat' && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2">
                    {comp === 'deschis' && (
                      <button type="button" onClick={() => onChecklist('start', e)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover">
                        <PlayCircle size={14} /> Trece în „În organizare"
                      </button>
                    )}
                    <button type="button" onClick={() => onTaskNou(e.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <Plus size={14} /> Task nou
                    </button>
                    {comp === 'organizare' && (
                      <button type="button" onClick={() => onChecklist('adauga', e)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        <ListChecks size={14} /> Adaugă din checklist
                      </button>
                    )}
                    {comp === 'organizare' && codFinalizat && (
                      <button
                        type="button"
                        onClick={() => status(e, codFinalizat)}
                        title={deschiseNr > 0 ? `Mai ai ${deschiseNr} taskuri deschise` : 'Marchează evenimentul ca finalizat'}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        <CheckCircle2 size={14} /> Marchează finalizat
                      </button>
                    )}
                    {comp === 'finalizat' && codOrganizare && (
                      <button type="button" onClick={() => status(e, codOrganizare)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        <RotateCcw size={14} /> Redeschide în organizare
                      </button>
                    )}
                  </div>
                )}
                {comp === 'anulat' && <p className="border-t border-slate-100 px-4 py-2 text-xs text-rose-600">Eveniment anulat — taskurile lui sunt înghețate.</p>}

                {desch && (
                  <div className="border-t border-slate-100 p-4">
                    <TaskLista taskuri={taskuri} ctx={ctx} onOpen={onOpen} arataEveniment={false} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
