import { useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { mesajEroare } from '../../lib/taskuri/ui'
import { Modal } from './Mici'

// mod 'start': trecerea din „Deschis" în „În organizare" + generarea checklistului (o singură dată)
// mod 'adauga': adaugă din checklist doar ce nu e deja pe eveniment
export default function ChecklistAlege({ mod, eveniment, ctx, onClose, onDone }) {
  const deja = useMemo(
    () => new Set(ctx.taskuri.filter((t) => t.eveniment_id === eveniment.id && t.checklist_item_id).map((t) => t.checklist_item_id)),
    [ctx.taskuri, eveniment.id]
  )
  const ceaGenerat = mod === 'start' && eveniment.checklist_generat
  const [alese, setAlese] = useState(() => new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const itemiPeSectiune = useMemo(() => {
    const m = {}
    for (const i of ctx.itemi) (m[i.sectiune_id] ||= []).push(i)
    return m
  }, [ctx.itemi])

  const disponibili = (sid) => (itemiPeSectiune[sid] || []).filter((i) => !deja.has(i.id))

  function comuta(id) {
    setAlese((p) => {
      const n = new Set(p)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function sectiune(sid, bifat) {
    setAlese((p) => {
      const n = new Set(p)
      for (const i of disponibili(sid)) bifat ? n.add(i.id) : n.delete(i.id)
      return n
    })
  }
  function toate(bifat) {
    setAlese(new Set(bifat ? ctx.itemi.filter((i) => !deja.has(i.id)).map((i) => i.id) : []))
  }

  async function confirma() {
    setError('')
    if (mod === 'adauga' && alese.size === 0) return setError('Bifează cel puțin un item.')
    setBusy(true)
    const { error: err } =
      mod === 'start'
        ? await supabase.rpc('tsk_eveniment_incepe_organizarea', { p_eveniment: eveniment.id, p_items: [...alese] })
        : await supabase.rpc('tsk_adauga_din_checklist', { p_eveniment: eveniment.id, p_items: [...alese] })
    setBusy(false)
    if (err) return setError(mesajEroare(err, 'Nu am putut face această operație.'))
    await onDone()
  }

  const titlu = mod === 'start' ? `Începe organizarea — ${eveniment.nume}` : `Adaugă din checklist — ${eveniment.nume}`

  return (
    <Modal titlu={titlu} onClose={onClose} lat="max-w-3xl">
      {ceaGenerat ? (
        <p className="mb-4 text-sm text-slate-600">
          Checklistul a fost deja generat pentru acest eveniment, deci nu se mai generează. Evenimentul trece doar în „În organizare". Poți adăuga oricând
          alte taskuri din checklist, cu butonul „Adaugă din checklist".
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600">
            {mod === 'start'
              ? 'Bifează ce vrei să devină task pe acest eveniment. Se creează o singură dată; ce lipsește poți adăuga mai târziu. Responsabilii și termenele se completează apoi, la fiecare task.'
              : 'Sunt afișate doar itemii care nu sunt deja pe eveniment.'}
          </p>
          <div className="mb-3 flex gap-2 text-sm">
            <button type="button" onClick={() => toate(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Selectează tot</button>
            <button type="button" onClick={() => toate(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Deselectează tot</button>
            <span className="ml-auto self-center text-xs text-slate-500">{alese.size} bifate</span>
          </div>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {ctx.sectiuni.map((s) => {
              const lista = itemiPeSectiune[s.id] || []
              if (lista.length === 0) return null
              const disp = disponibili(s.id)
              const toateBifate = disp.length > 0 && disp.every((i) => alese.has(i.id))
              return (
                <div key={s.id} className="rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between gap-2 rounded-t-xl bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-700">{s.nume}</p>
                    {disp.length > 0 && (
                      <button type="button" onClick={() => sectiune(s.id, !toateBifate)} className="text-xs font-medium text-accent hover:underline">
                        {toateBifate ? 'Deselectează secțiunea' : 'Selectează toată secțiunea'}
                      </button>
                    )}
                  </div>
                  <ul className="divide-y divide-slate-50">
                    {lista.map((i) => {
                      const existent = deja.has(i.id)
                      return (
                        <li key={i.id}>
                          <label className={`flex items-start gap-2 px-3 py-2 text-sm ${existent ? 'text-slate-400' : 'cursor-pointer text-slate-700 hover:bg-slate-50'}`}>
                            <input type="checkbox" className="mt-0.5" disabled={existent} checked={existent || alese.has(i.id)} onChange={() => comuta(i.id)} />
                            <span>{i.titlu}{existent && ' (deja adăugat)'}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </>
      )}
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Renunță</button>
        <button type="button" disabled={busy} onClick={confirma} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
          {busy ? 'Se face…' : mod === 'start' ? (ceaGenerat ? 'Trece în organizare' : `Începe organizarea (${alese.size} taskuri)`) : `Adaugă ${alese.size} taskuri`}
        </button>
      </div>
    </Modal>
  )
}
