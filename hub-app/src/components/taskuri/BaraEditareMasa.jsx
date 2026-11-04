import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { PRIORITATI, STATUSURI, mesajEroare } from '../../lib/taskuri/ui'
import { actualizeaza, optiuniResponsabil, poateEditaInLista, poateSterge, stergeTaskuri } from '../../lib/taskuri/editare'
import TagPicker from './TagPicker'

const camp = 'rounded-md border border-white/40 bg-white px-2 py-1 text-xs text-[#172036] focus:outline-none'

// Bara care apare când sunt taskuri selectate: o schimbare aplicată tuturor.
// Câmpuri: status, responsabil, termen, tag, prioritate. (Evenimentul unui task nu se poate schimba.)
export default function BaraEditareMasa({ taskuri, ctx, onGata }) {
  const [camp_, setCamp] = useState('status')
  const [valoare, setValoare] = useState('')
  const [busy, setBusy] = useState(false)
  const [mesaj, setMesaj] = useState('')

  const schimbaCamp = (c) => { setCamp(c); setValoare(c === 'status' ? 'in_lucru' : c === 'prioritate' ? 'medie' : '') }

  async function aplica() {
    setBusy(true)
    setMesaj('')
    let reusite = 0
    let sarite = 0
    const erori = new Set()
    for (const t of taskuri) {
      if (camp_ === 'status') {
        const permis = ctx.poateSchimbaStatus(t) && !ctx.inghetat(t) && !(t.tip === 'eveniment' && ctx.evenimentAnulat(t.eveniment_id)) && (valoare !== 'anulat' || ctx.poateGestiona(t))
        if (!permis) { sarite++; continue }
        if (t.status === valoare) { reusite++; continue }
        const { error } = await supabase.rpc('tsk_schimba_status', { p_task: t.id, p_status: valoare })
        if (error) { erori.add(mesajEroare(error, 'Nu am putut schimba statusul.')); sarite++ } else reusite++
      } else {
        if (!poateEditaInLista(ctx, t)) { sarite++; continue }
        const patch = {
          responsabil: { responsabil_id: valoare || null },
          termen: { termen: valoare || null },
          tag: { tag: valoare.trim() || null },
          prioritate: { prioritate: valoare },
        }[camp_]
        const err = await actualizeaza(t.id, patch)
        if (err) { erori.add(err); sarite++ } else reusite++
      }
    }
    await ctx.reload()
    setBusy(false)
    if (sarite === 0) return onGata()
    setMesaj(`Modificate: ${reusite}. Sărite: ${sarite}${camp_ === 'status' ? '' : ' (nu sunt deschise de tine)'}${erori.size ? ` — ${[...erori].join(' ')}` : ''}`)
  }

  async function sterge() {
    const permise = taskuri.filter((t) => poateSterge(ctx, t))
    if (permise.length === 0) return setMesaj('Nu ai dreptul să ștergi niciunul dintre taskurile selectate.')
    const nr = permise.length
    if (!window.confirm(`Ștergi definitiv ${nr} ${nr === 1 ? 'task' : 'taskuri'}? Nu se poate reveni.${nr < taskuri.length ? ` (Celelalte ${taskuri.length - nr} nu pot fi șterse de tine și rămân.)` : ''}`)) return
    setBusy(true)
    setMesaj('')
    const err = await stergeTaskuri(permise.map((t) => t.id))
    await ctx.reload()
    setBusy(false)
    if (err) return setMesaj(err)
    if (nr === taskuri.length) return onGata()
    setMesaj(`Șterse: ${nr}. Rămase (fără drept de ștergere): ${taskuri.length - nr}.`)
  }

  const optResp = [...new Map(taskuri.flatMap((t) => optiuniResponsabil(ctx, t)).map((a) => [a.id, a])).values()]

  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#22406B] px-4 py-2 text-xs font-semibold text-white sm:px-5">
      <span>{taskuri.length} {taskuri.length === 1 ? 'selectat' : 'selectate'}</span>
      <label className="flex items-center gap-1.5">Modifică
        <select className={camp} value={camp_} onChange={(e) => schimbaCamp(e.target.value)} aria-label="Câmp de modificat">
          <option value="status">Status</option>
          <option value="responsabil">Responsabil</option>
          <option value="termen">Termen</option>
          <option value="tag">Tag</option>
          <option value="prioritate">Prioritate</option>
        </select>
      </label>
      {camp_ === 'status' && (
        <select className={camp} value={valoare} onChange={(e) => setValoare(e.target.value)} aria-label="Status nou">
          {STATUSURI.map((s) => <option key={s.cod} value={s.cod}>{s.nume}</option>)}
        </select>
      )}
      {camp_ === 'prioritate' && (
        <select className={camp} value={valoare} onChange={(e) => setValoare(e.target.value)} aria-label="Prioritate nouă">
          {PRIORITATI.map((p) => <option key={p.cod} value={p.cod}>{p.nume}</option>)}
        </select>
      )}
      {camp_ === 'responsabil' && (
        <select className={camp} value={valoare} onChange={(e) => setValoare(e.target.value)} aria-label="Responsabil nou">
          <option value="">— fără responsabil —</option>
          {optResp.map((a) => <option key={a.id} value={a.id}>{a.nume_complet}</option>)}
        </select>
      )}
      {camp_ === 'termen' && <input type="date" className={camp} value={valoare} onChange={(e) => setValoare(e.target.value)} aria-label="Termen nou (gol = fără termen)" />}
      {camp_ === 'tag' && (
        <>
          <TagPicker ctx={ctx} valoare={valoare} onChange={setValoare} plutitor className={camp} placeholder="Tag (gol = fără tag)" ariaLabel="Tag nou" />
        </>
      )}
      <button type="button" disabled={busy} onClick={aplica} className="rounded-md bg-white px-3 py-1 text-xs font-bold text-[#22406B] hover:bg-[#E4ECF8] disabled:opacity-60">{busy ? 'Se aplică…' : 'Aplică'}</button>
      <button type="button" disabled={busy} onClick={sterge} className="rounded-md border border-white/60 px-3 py-1 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-60">Șterge selecția</button>
      <button type="button" onClick={onGata} className="underline">Renunță</button>
      {mesaj && <span className="basis-full font-medium text-[#FDE8D2]">{mesaj}</span>}
    </div>
  )
}
