import { useEffect, useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { esteIntarziat, formatData, formatDataOra, inputCls, mesajEroare } from '../../lib/taskuri/ui'
import { dataRo } from '../../lib/taskuri/solicitari'
import { actualizeaza } from '../../lib/taskuri/editare'
import { Modal } from './Mici'
import StatusDropdown from './StatusDropdown'
import CelulaEditabila from './CelulaEditabila'
import AngajatiPicker from './AngajatiPicker'
import { CampComentariu, IstoricTask, TextComentariu, mentiuniRamase } from './Mentiuni'

// Descriere: text pe mai multe rânduri, editabil la click, se salvează când ieși din câmp.
function Descriere({ task, ctx, poate, onEroare }) {
  const [edit, setEdit] = useState(false)
  const [text, setText] = useState('')
  async function salveaza() {
    setEdit(false)
    const nou = text.trim()
    if (nou === (task.descriere || '')) return
    const err = await actualizeaza(task.id, { descriere: nou || null })
    if (err) onEroare(err)
    else await ctx.reload()
  }
  if (!poate) return task.descriere ? <span className="whitespace-pre-wrap">{task.descriere}</span> : <span className="text-slate-400">—</span>
  if (!edit) {
    return (
      <button type="button" onClick={() => { setText(task.descriere || ''); setEdit(true) }} title="Click pentru a modifica" className="-mx-1.5 block w-full rounded-md px-1.5 py-0.5 text-left hover:bg-[#EEF1F6]">
        {task.descriere ? <span className="whitespace-pre-wrap">{task.descriere}</span> : <span className="text-slate-400">Adaugă o descriere…</span>}
      </button>
    )
  }
  return <textarea autoFocus rows={4} className={inputCls} value={text} onChange={(e) => setText(e.target.value)} onBlur={salveaza} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEdit(false) } }} />
}

// Zona „Livrare" a unui task Media: echipa Media (și adminul) pune linkul; cel care a deschis taskul îl vede imediat.
function Livrare({ task, ctx, poate, onEroare }) {
  const [link, setLink] = useState(task.link_livrare || '')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setLink(task.link_livrare || '') }, [task.link_livrare])
  async function salveaza(e) {
    e.preventDefault()
    const v = link.trim()
    if (!/^https?:\/\/\S+$/i.test(v)) return onEroare('Linkul de livrare trebuie să înceapă cu http:// sau https://.')
    onEroare('')
    setBusy(true)
    const patch = { link_livrare: v, ...(task.status !== 'terminat' ? { status: 'terminat' } : {}) }
    const err = await actualizeaza(task.id, patch)
    setBusy(false)
    if (err) return onEroare(err)
    await ctx.reload()
  }
  if (!poate && !task.link_livrare) {
    return <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">Materialele nu au fost încă livrate. Linkul apare aici când echipa Media îl adaugă.</p>
  }
  return (
    <div className="rounded-xl border border-[#D5DAE3] bg-[#F6F8FB] p-3.5">
      <p className="mb-1.5 text-sm font-semibold text-slate-800">Link livrare materiale</p>
      {task.link_livrare && (
        <p className="mb-2 text-sm">
          <a href={task.link_livrare} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-semibold text-accent hover:underline">{task.link_livrare} <ExternalLink size={13} /></a>
          {task.livrat_la && <span className="ml-2 text-xs text-slate-500">adăugat la {formatDataOra(task.livrat_la)}</span>}
        </p>
      )}
      {poate && (
        <form onSubmit={salveaza} className="flex flex-wrap gap-2">
          <input className={`${inputCls} min-w-0 flex-1`} placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button type="submit" disabled={busy || !link.trim()} className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
            {task.status === 'terminat' ? 'Actualizează linkul' : 'Salvează și marchează „Terminat”'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function TaskDetaliu({ taskId, ctx, onClose }) {
  const task = ctx.taskuri.find((t) => t.id === taskId)
  const [comentarii, setComentarii] = useState([])
  const [text, setText] = useState('')
  const [eroare, setEroare] = useState('')
  const [busy, setBusy] = useState(false)
  const [mentiuni, setMentiuni] = useState([])

  async function incarcaComentarii() {
    const { data } = await supabase.from('tsk_comentarii').select('*').eq('task_id', taskId).order('created_at')
    setComentarii(data || [])
  }
  useEffect(() => { incarcaComentarii() }, [taskId]) // eslint-disable-line react-hooks/exhaustive-deps
  // deschiderea taskului scoate eticheta Nou / Menționat
  const esteNou = !!ctx.necitite?.[taskId]
  useEffect(() => { if (esteNou) ctx.marcheazaCitit(taskId) }, [taskId, esteNou]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <Modal titlu="Task" onClose={onClose}>
        <p className="text-sm text-slate-500">Taskul nu mai există sau nu mai ai acces la el.</p>
      </Modal>
    )
  }

  const ev = ctx.evMap[task.eveniment_id]
  const evAnulat = task.tip === 'eveniment' && ctx.evenimentAnulat(task.eveniment_id)
  const esteSol = task.tip === 'solicitare'
  const gestioneaza = (esteSol ? ctx.admin : ctx.poateGestiona(task)) && !evAnulat
  const poateStatus = ctx.poateSchimbaStatus(task) && !evAnulat
  const colab = ctx.colabDupaTask[task.id] || []

  async function status(s) {
    setEroare('')
    const { error } = await supabase.rpc('tsk_schimba_status', { p_task: task.id, p_status: s })
    if (error) setEroare(mesajEroare(error, 'Nu am putut schimba statusul.'))
    await ctx.reload()
  }

  // colaboratori: se salvează imediat, adăugând ce lipsește și scoțând ce nu mai e
  async function seteazaColaboratori(noi) {
    setEroare('')
    const vechi = new Set(colab)
    const deAdaugat = noi.filter((x) => !vechi.has(x))
    const deScos = colab.filter((x) => !noi.includes(x))
    if (deAdaugat.length) {
      const { error } = await supabase.from('tsk_colaboratori').insert(deAdaugat.map((angajat_id) => ({ task_id: task.id, angajat_id })))
      if (error) return setEroare(mesajEroare(error))
    }
    if (deScos.length) {
      const { error } = await supabase.from('tsk_colaboratori').delete().eq('task_id', task.id).in('angajat_id', deScos)
      if (error) return setEroare(mesajEroare(error))
    }
    await ctx.reload()
  }

  async function trimite(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    const { error } = await supabase.from('tsk_comentarii').insert({ task_id: task.id, autor_id: ctx.me.id, text: text.trim(), ...(mentiuniRamase(ctx, text, mentiuni).length ? { mentiuni: mentiuniRamase(ctx, text, mentiuni) } : {}) })
    setBusy(false)
    if (error) return setEroare(mesajEroare(error, 'Nu am putut trimite comentariul.'))
    setText('')
    setMentiuni([])
    incarcaComentarii()
  }

  async function stergeComentariu(id) {
    await supabase.from('tsk_comentarii').delete().eq('id', id)
    incarcaComentarii()
  }

  async function anuleazaSolicitare() {
    if (!window.confirm('Anulezi acest task Media? Echipa Media va vedea un comentariu că taskul a fost anulat.')) return
    await status('anulat')
    incarcaComentarii()
  }

  async function stergeTask() {
    if (!window.confirm(`Ștergi definitiv taskul „${task.titlu}"? Nu se poate reveni. Dacă vrei doar să-l oprești, folosește „Anulează".`)) return
    const { error } = await supabase.from('tsk_taskuri').delete().eq('id', task.id)
    if (error) return setEroare(mesajEroare(error, 'Nu am putut șterge taskul.'))
    await ctx.reload()
    onClose()
  }

  const rand = (eticheta, continut, cheie) => (
    <div key={cheie} className="flex gap-3 py-1.5 text-sm">
      <span className="w-28 shrink-0 text-slate-500">{eticheta}</span>
      <span className="min-w-0 flex-1 text-slate-800">{continut}</span>
    </div>
  )

  const camp = (tip) => <CelulaEditabila tip={tip} task={task} ctx={ctx} poate={gestioneaza} onEroare={setEroare} />

  return (
    <Modal titlu={<CelulaEditabila tip="titlu" task={task} ctx={ctx} poate={gestioneaza} onEroare={setEroare} />} onClose={onClose}>
      {(esteIntarziat(task) || evAnulat) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {esteIntarziat(task) && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Întârziat</span>}
          {evAnulat && <span className="text-xs text-rose-600">Evenimentul este anulat — taskul e înghețat.</span>}
        </div>
      )}
      {gestioneaza && <p className="mb-2 text-xs text-slate-400">Click pe un câmp ca să-l modifici; se salvează singur.</p>}

      {esteSol ? (
        <div className="divide-y divide-slate-100">
          {rand('Status', <StatusDropdown status={task.status} poate={poateStatus} poateAnula={ctx.poateAnula(task)} onChange={status} />)}
          {rand('Tip', ctx.eticheta(task))}
          {rand('Termen', camp('data'))}
          {rand('Prioritate', camp('prioritate'))}
          {task.eveniment_id && rand('Eveniment', ev ? `${ev.nume} · ${formatData(ev.data)}` : '—')}
          {(task.date_solicitare || []).map((p) => rand(p.eticheta, <span className="whitespace-pre-wrap">{p.tip === 'link' ? <a href={p.valoare} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">{p.valoare}</a> : p.valoare}</span>, p.cheie))}
          {rand('Descriere', <Descriere task={task} ctx={ctx} poate={gestioneaza} onEroare={setEroare} />)}
          {rand('Deschis de', `${task.creat_de ? ctx.nume(task.creat_de) : '—'} · ${dataRo(task.created_at?.slice(0, 10))}`)}
        </div>
      ) : (
      <div className="divide-y divide-slate-100">
        {rand('Status', <StatusDropdown status={task.status} poate={poateStatus && !ctx.inghetat(task)} poateAnula={ctx.poateGestiona(task)} onChange={status} />)}
        {rand('Responsabil', camp('responsabil'))}
        {rand('Termen', camp('data'))}
        {rand('Tag', camp('tag'))}
        {rand('Descriere', <Descriere task={task} ctx={ctx} poate={gestioneaza} onEroare={setEroare} />)}
        {rand('Prioritate', camp('prioritate'))}
        {rand('Tip', task.tip === 'eveniment' ? 'Task de eveniment' : 'Task operațional')}
        {task.tip === 'eveniment' && rand('Eveniment', ev ? `${ev.nume} · ${formatData(ev.data)}` : '—')}
        {task.grup_id && rand('Departament', ctx.grupMap[task.grup_id]?.nume)}
        {rand('Colaboratori', gestioneaza
          ? <AngajatiPicker angajati={ctx.angajatiCuAcces.filter((a) => a.id !== task.responsabil_id)} valoare={colab} onChange={seteazaColaboratori} />
          : (colab.length ? colab.map(ctx.nume).join(', ') : <span className="text-slate-400">—</span>))}
        {rand('Document', (
          <span className="flex flex-wrap items-center gap-2">
            {camp('link')}
            {task.link_document && (
              <a href={task.link_document} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Deschide <ExternalLink size={12} /></a>
            )}
          </span>
        ))}
        {rand('Creat de', `${task.creat_de ? ctx.nume(task.creat_de) : '—'} · ${formatDataOra(task.created_at)}`)}
      </div>

      )}

      {esteSol && (
        <div className="mt-4 space-y-3">
          <Livrare task={task} ctx={ctx} poate={(ctx.admin || ctx.eMembru(task)) && task.status !== 'anulat'} onEroare={setEroare} />
          {ctx.poateAnula(task) && !ctx.admin && (
            <button type="button" onClick={anuleazaSolicitare} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50">Anulează taskul</button>
          )}
        </div>
      )}

      {gestioneaza && (
        <div className="mt-3 flex gap-2">
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
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800"><TextComentariu ctx={ctx} c={c} /></p>
            </li>
          ))}
          {comentarii.length === 0 && <li className="text-sm text-slate-400">Niciun comentariu încă.</li>}
        </ul>
        <form onSubmit={trimite} className="flex gap-2">
          <CampComentariu ctx={ctx} task={task} text={text} setText={setText} mentiuni={mentiuni} setMentiuni={setMentiuni} />
          <button type="submit" disabled={busy || !text.trim()} className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
            Trimite
          </button>
        </form>
        <IstoricTask ctx={ctx} task={task} />
      </div>
    </Modal>
  )
}
