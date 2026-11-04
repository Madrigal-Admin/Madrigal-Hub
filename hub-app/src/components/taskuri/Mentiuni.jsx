import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { formatData, formatDataOra, inputCls } from '../../lib/taskuri/ui'

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Persoanele care sigur văd taskul (deci pot fi menționate): responsabil, cine l-a deschis, colaboratori, PM-ii evenimentului.
export function candidatiMentiune(ctx, task) {
  const ids = new Set([task.responsabil_id, task.creat_de, ...(ctx.colabDupaTask[task.id] || []), ...(ctx.evMap[task.eveniment_id]?.pm || [])])
  ids.delete(ctx.me.id)
  ids.delete(null)
  ids.delete(undefined)
  return [...ids].map((id) => ({ id, nume: ctx.nume(id) })).filter((c) => c.nume !== '—').sort((a, b) => a.nume.localeCompare(b.nume, 'ro'))
}

// Câmpul de comentariu cu sugestii după @. `mentiuni` = ids alese; la trimitere se păstrează doar cele rămase în text.
export function CampComentariu({ ctx, task, text, setText, mentiuni, setMentiuni }) {
  const [sugestii, setSugestii] = useState([])
  const candidati = candidatiMentiune(ctx, task)

  function schimba(v) {
    setText(v)
    const m = /(^|\s)@([^@\n]*)$/.exec(v)
    if (!m) return setSugestii([])
    const q = norm(m[2])
    setSugestii(candidati.filter((c) => norm(c.nume).includes(q)).slice(0, 6))
  }
  function alege(c) {
    setText(text.replace(/(^|\s)@([^@\n]*)$/, `$1@${c.nume} `))
    setMentiuni([...new Set([...mentiuni, c.id])])
    setSugestii([])
  }
  return (
    <div className="relative min-w-0 flex-1">
      <input className={inputCls} placeholder={candidati.length ? 'Scrie un comentariu… (@ pentru a menționa pe cineva)' : 'Scrie un comentariu…'} maxLength={2000} value={text} onChange={(e) => schimba(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setSugestii([]) }} />
      {sugestii.length > 0 && (
        <ul className="absolute bottom-full left-0 z-10 mb-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#D5DAE3] bg-white py-1 shadow-lg" role="listbox">
          {sugestii.map((c) => (
            <li key={c.id}>
              <button type="button" role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); alege(c) }} className="block w-full px-3 py-2 text-left text-sm text-[#172036] hover:bg-[#EEF3FB]">{c.nume}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const mentiuniRamase = (ctx, text, mentiuni) => mentiuni.filter((id) => text.includes(`@${ctx.nume(id)}`))

// Textul unui comentariu, cu numele menționate evidențiate.
export function TextComentariu({ ctx, c }) {
  const nume = (c.mentiuni || []).map((id) => ctx.nume(id)).filter((n) => n !== '—')
  if (nume.length === 0) return <>{c.text}</>
  const re = new RegExp(`(@(?:${nume.map(esc).join('|')}))`, 'g')
  return c.text.split(re).map((bucata, i) => (i % 2 ? <b key={i} className="rounded bg-[#E4ECF8] px-1 text-accent">{bucata}</b> : bucata))
}

const ETICHETE_STATUS = { de_facut: 'De făcut', in_lucru: 'În lucru', terminat: 'Terminat', anulat: 'Anulat' }

function descrie(r, ctx) {
  const cine = r.angajat_id ? ctx.nume(r.angajat_id) : 'Sistemul'
  const resp = (v) => (v ? ctx.nume(v) : 'fără responsabil')
  if (r.camp === 'status') return [cine, 'a schimbat statusul', `${ETICHETE_STATUS[r.valoare_veche] || r.valoare_veche} → ${ETICHETE_STATUS[r.valoare_noua] || r.valoare_noua}`]
  if (r.camp === 'termen') return [cine, 'a schimbat termenul', `${r.valoare_veche ? formatData(r.valoare_veche) : 'fără termen'} → ${r.valoare_noua ? formatData(r.valoare_noua) : 'fără termen'}`]
  return [cine, 'a schimbat responsabilul', `${resp(r.valoare_veche)} → ${resp(r.valoare_noua)}`]
}

// Istoric pe task: cine a schimbat statusul / termenul / responsabilul și când (se încarcă la deschidere).
export function IstoricTask({ ctx, task }) {
  const [deschis, setDeschis] = useState(false)
  const [randuri, setRanduri] = useState(null)
  useEffect(() => {
    if (!deschis) return
    let activ = true
    supabase.from('tsk_istoric').select('*').eq('task_id', task.id).order('created_at', { ascending: false }).then(({ data }) => { if (activ) setRanduri(data || []) })
    return () => { activ = false }
  }, [deschis, task.id, task.updated_at])
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button type="button" onClick={() => setDeschis((d) => !d)} aria-expanded={deschis} className="text-sm font-semibold text-slate-800 hover:underline">
        {deschis ? '▾' : '▸'} Istoric
      </button>
      {deschis && (
        randuri === null ? <p className="mt-2 text-sm text-slate-400">Se încarcă…</p>
        : randuri.length === 0 ? <p className="mt-2 text-sm text-slate-400">Nicio schimbare înregistrată încă. Istoricul se completează începând de la activarea funcției.</p>
        : (
          <ul className="mt-2 space-y-2">
            {randuri.map((r) => {
              const [cine, ce, detaliu] = descrie(r, ctx)
              return (
                <li key={r.id} className="text-sm text-slate-700">
                  <b>{cine}</b> {ce}: <span className="font-semibold text-slate-900">{detaliu}</span>
                  <span className="block text-xs text-slate-400">{formatDataOra(r.created_at)}</span>
                </li>
              )
            })}
          </ul>
        )
      )}
    </div>
  )
}
