import { useRef, useState } from 'react'
import { PRIORITATI, PRIORITATE_DUPA_COD, esteIntarziat, formatData } from '../../lib/taskuri/ui'
import { actualizeaza, optiuniResponsabil } from '../../lib/taskuri/editare'
import TagPicker from './TagPicker'

const PUNCT = { mare: '#B4332E', medie: '#C77700', mica: '#7A869A' }
const camp = 'w-full rounded-md border border-[#9AA6B8] bg-white px-2 py-1 text-[13px] text-[#172036] focus:border-accent focus:outline-none'

// O valoare dintr-un task care devine câmp de editare la click (dacă `poate`).
// tip: titlu | data | prioritate | responsabil | tag | link
export default function CelulaEditabila({ tip, task, ctx, poate, onEroare, clasa = '' }) {
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const gata = useRef(false)

  const nume = task.responsabil_id ? ctx.nume(task.responsabil_id) : ''
  const afisare = {
    titlu: <span>{task.titlu}</span>,
    data: <span className={esteIntarziat(task) ? 'font-bold text-[#B4332E]' : ''}>{task.termen ? formatData(task.termen) : '—'}</span>,
    prioritate: (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: PUNCT[task.prioritate] }} />
        {PRIORITATE_DUPA_COD[task.prioritate]?.nume}
      </span>
    ),
    responsabil: nume ? <span>{nume}</span> : <span className="text-[#7A869A]">Fără responsabil</span>,
    tag: task.tag ? <span className="rounded-md bg-[#F1F3F7] px-2 py-0.5 text-xs font-semibold text-[#3A465C]">{task.tag}</span> : <span className="text-[#7A869A]">—</span>,
    link: task.link_document ? <span className="break-all text-accent">{task.link_document}</span> : <span className="text-[#7A869A]">—</span>,
  }[tip]

  if (!poate) return <span className={`min-w-0 ${clasa}`}>{afisare}</span>

  async function salveaza(patch) {
    if (gata.current) return
    gata.current = true
    setBusy(true)
    onEroare?.('')
    const err = await actualizeaza(task.id, patch)
    if (err) onEroare?.(err)
    else await ctx.reload()
    setBusy(false)
    setEdit(false)
    gata.current = false
  }
  const renunta = () => { gata.current = true; setEdit(false); setTimeout(() => { gata.current = false }, 0) }
  const tasta = (e) => { if (e.key === 'Escape') { e.stopPropagation(); renunta() } }

  if (!edit) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setEdit(true) }} title="Click pentru a modifica" className={`-mx-1.5 min-w-0 max-w-full rounded-md px-1.5 py-0.5 text-left hover:bg-[#EEF1F6] hover:outline hover:outline-1 hover:outline-dashed hover:outline-[#CBD3E0] ${clasa}`}>
        {afisare}
      </button>
    )
  }

  const comun = { autoFocus: true, disabled: busy, onKeyDown: tasta, onClick: (e) => e.stopPropagation() }
  if (tip === 'data') {
    return <input type="date" className={camp} defaultValue={task.termen || ''} {...comun} onChange={(e) => salveaza({ termen: e.target.value || null })} onBlur={renunta} />
  }
  if (tip === 'prioritate') {
    return (
      <select className={camp} defaultValue={task.prioritate} {...comun} onChange={(e) => salveaza({ prioritate: e.target.value })} onBlur={renunta}>
        {PRIORITATI.map((p) => <option key={p.cod} value={p.cod}>{p.nume}</option>)}
      </select>
    )
  }
  if (tip === 'responsabil') {
    return (
      <select className={camp} defaultValue={task.responsabil_id || ''} {...comun} onChange={(e) => salveaza({ responsabil_id: e.target.value || null })} onBlur={renunta}>
        <option value="">— fără responsabil —</option>
        {optiuniResponsabil(ctx, task).map((a) => <option key={a.id} value={a.id}>{a.nume_complet}</option>)}
      </select>
    )
  }
  if (tip === 'tag') {
    return <TagEdit ctx={ctx} task={task} camp={camp} disabled={busy} salveaza={salveaza} renunta={renunta} />
  }
  // titlu, link: text pe o linie, se salvează la Enter sau la părăsirea câmpului
  const camp_ = tip === 'titlu' ? 'titlu' : 'link_document'
  const comite = (v) => {
    const nou = v.trim()
    if (tip === 'titlu' && !nou) { onEroare?.('Titlul nu poate fi gol.'); return renunta() }
    if (tip === 'link' && nou && !/^https?:\/\/\S+$/i.test(nou)) { onEroare?.('Linkul trebuie să înceapă cu http:// sau https://.'); return renunta() }
    if (nou === (task[camp_] || '')) return renunta()
    salveaza({ [camp_]: nou || null })
  }
  return (
    <input className={`${camp} ${tip === 'titlu' ? 'text-base font-semibold' : ''}`} defaultValue={task[camp_] || ''} maxLength={tip === 'titlu' ? 200 : 500} {...comun}
      onKeyDown={(e) => { if (e.key === 'Enter') comite(e.currentTarget.value); else tasta(e) }}
      onBlur={(e) => comite(e.currentTarget.value)} />
  )
}

// Editare tag direct în listă: alegi din lista tagurilor sau scrii unul nou; se salvează la alegere, Enter sau la ieșirea din câmp.
function TagEdit({ ctx, task, camp, disabled, salveaza, renunta }) {
  const [v, setV] = useState(task.tag || '')
  const comite = (val) => {
    const nou = val.trim()
    if (nou === (task.tag || '')) return renunta()
    salveaza({ tag: nou || null })
  }
  return (
    <TagPicker ctx={ctx} valoare={v} onChange={setV} plutitor autoFocus disabled={disabled} className={camp} placeholder="Alege sau scrie un tag" ariaLabel="Tag" onAlege={comite} onEnter={comite} onBlur={comite} onEsc={renunta} />
  )
}
