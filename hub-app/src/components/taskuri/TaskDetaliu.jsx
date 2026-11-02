import { useEffect, useState } from 'react'
import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { STATUSURI, esteIntarziat, formatData, formatDataOra, inputCls, mesajEroare } from '../../lib/taskuri/ui'
import { Modal, Prioritate, StatusBadge } from './Mici'

export default function TaskDetaliu({ taskId, ctx, onClose, onEdit }) {
  const task = ctx.taskuri.find((t) => t.id === taskId)
  const [comentarii, setComentarii] = useState([])
  const [text, setText] = useState('')
  const [eroare, setEroare] = useState('')
  const [busy, setBusy] = useState(false)

  async function incarcaComentarii() {
    const { data } = await supabase.from('tsk_comentarii').select('*').eq('task_id', taskId).order('created_at')
    setComentarii(data || [])
  }
  useEffect(() => { incarcaComentarii() }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <Modal titlu="Task" onClose={onClose}>
        <p className="text-sm text-slate-500">Taskul nu mai există sau nu mai ai acces la el.</p>
      </Modal>
    )
  }

  const ev = ctx.evMap[task.eveniment_id]
  const evAnulat = task.tip === 'eveniment' && ctx.evenimentAnulat(task.eveniment_id)
  const gestioneaza = ctx.poateGestiona(task) && !evAnulat
  const poateStatus = ctx.poateSchimbaStatus(task) && !evAnulat
  const colab = ctx.colabDupaTask[task.id] || []

  async function status(s) {
    setEroare('')
    const { error } = await supabase.rpc('tsk_schimba_status', { p_task: task.id, p_status: s })
    if (error) setEroare(mesajEroare(error, 'Nu am putut schimba statusul.'))
    await ctx.reload()
  }

  async function trimite(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    const { error } = await supabase.from('tsk_comentarii').insert({ task_id: task.id, autor_id: ctx.me.id, text: text.trim() })
    setBusy(false)
    if (error) return setEroare(mesajEroare(error, 'Nu am putut trimite comentariul.'))
    setText('')
    incarcaComentarii()
  }

  async function stergeComentariu(id) {
    await supabase.from('tsk_comentarii').delete().eq('id', id)
    incarcaComentarii()
  }

  async function stergeTask() {
    if (!window.confirm(`Ștergi definitiv taskul „${task.titlu}"? Nu se poate reveni. Dacă vrei doar să-l oprești, folosește „Anulează".`)) return
    const { error } = await supabase.from('tsk_taskuri').delete().eq('id', task.id)
    if (error) return setEroare(mesajEroare(error, 'Nu am putut șterge taskul.'))
    await ctx.reload()
    onClose()
  }

  const rand = (eticheta, continut) => (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-28 shrink-0 text-slate-500">{eticheta}</span>
      <span className="min-w-0 flex-1 text-slate-800">{continut}</span>
    </div>
  )

  return (
    <Modal titlu={task.titlu} onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={task.status} />
        <Prioritate valoare={task.prioritate} />
        {esteIntarziat(task) && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Întârziat</span>}
        {evAnulat && <span className="text-xs text-rose-600">Evenimentul este anulat — taskul e înghețat.</span>}
      </div>

      <div className="divide-y divide-slate-100">
        {rand('Tip', task.tip === 'eveniment' ? 'Task de eveniment' : 'Task operațional')}
        {task.tip === 'eveniment' && rand('Eveniment', ev ? `${ev.nume} · ${formatData(ev.data)}` : '—')}
        {task.grup_id && rand('Departament', ctx.grupMap[task.grup_id]?.nume)}
        {rand('Responsabil', task.responsabil_id ? ctx.nume(task.responsabil_id) : 'Fără responsabil')}
        {colab.length > 0 && rand('Colaboratori', colab.map(ctx.nume).join(', '))}
        {rand('Termen', task.termen ? formatData(task.termen) : 'Fără termen')}
        {task.descriere && rand('Descriere', <span className="whitespace-pre-wrap">{task.descriere}</span>)}
        {task.link_document && rand('Document', (
          <a href={task.link_document} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
            Deschide <ExternalLink size={12} />
          </a>
        ))}
        {rand('Creat de', `${task.creat_de ? ctx.nume(task.creat_de) : '—'} · ${formatDataOra(task.created_at)}`)}
      </div>

      {poateStatus && (
        <div className="mt-4 flex flex-wrap gap-2">
          {STATUSURI.filter((s) => s.cod !== task.status && (s.cod !== 'anulat' || ctx.poateGestiona(task))).map((s) => (
            <button key={s.cod} type="button" onClick={() => status(s.cod)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {s.cod === 'terminat' ? '✓ Marchează terminat' : s.cod === 'anulat' ? 'Anulează taskul' : `Treci în „${s.nume}"`}
            </button>
          ))}
        </div>
      )}

      {gestioneaza && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onEdit(task)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            <Pencil size={14} /> Editează
          </button>
          <button type="button" onClick={stergeTask} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
            <Trash2 size={14} /> Șterge
          </button>
        </div>
      )}

      {eroare && <p className="mt-3 text-sm text-rose-600">{eroare}</p>}

      <div className="mt-6 border-t border-slate-100 pt-4">
        <p className="mb-3 text-sm font-semibold text-slate-800">Comentarii ({comentarii.length})</p>
        <ul className="mb-3 space-y-3">
          {comentarii.map((c) => (
            <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span><b className="text-slate-700">{c.autor_id ? ctx.nume(c.autor_id) : '—'}</b> · {formatDataOra(c.created_at)}</span>
                {(c.autor_id === ctx.me.id || ctx.admin) && (
                  <button type="button" onClick={() => stergeComentariu(c.id)} className="text-slate-400 hover:text-rose-600" title="Șterge comentariul">✕</button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{c.text}</p>
            </li>
          ))}
          {comentarii.length === 0 && <li className="text-sm text-slate-400">Niciun comentariu încă.</li>}
        </ul>
        <form onSubmit={trimite} className="flex gap-2">
          <input className={inputCls} placeholder="Scrie un comentariu…" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" disabled={busy || !text.trim()} className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
            Trimite
          </button>
        </form>
      </div>
    </Modal>
  )
}
