import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { inputCls, mesajEroare } from '../../lib/taskuri/ui'

// Checklistul master: secțiuni și itemi, complet editabile. Modificările nu schimbă taskurile deja create.
export default function ChecklistAdmin({ ctx }) {
  const [sectiuneNoua, setSectiuneNoua] = useState('')
  const [itemNou, setItemNou] = useState({})
  const [eroare, setEroare] = useState('')

  async function ruleaza(promisiune, mesaj) {
    setEroare('')
    const { error } = await promisiune
    if (error) setEroare(mesajEroare(error, mesaj))
    await ctx.reload()
  }

  // Renumerotează o listă în ordinea dorită, ca mutările sus/jos să meargă mereu.
  async function muta(tabel, lista, id, dir) {
    const i = lista.findIndex((x) => x.id === id)
    const j = i + dir
    if (j < 0 || j >= lista.length) return
    const nou = [...lista]
    ;[nou[i], nou[j]] = [nou[j], nou[i]]
    setEroare('')
    const rezultate = await Promise.all(nou.map((x, k) => (x.ordine === k + 1 ? null : supabase.from(tabel).update({ ordine: k + 1 }).eq('id', x.id))))
    if (rezultate.some((r) => r?.error)) setEroare('Nu am putut muta elementul.')
    await ctx.reload()
  }

  async function adaugaSectiune(e) {
    e.preventDefault()
    const nume = sectiuneNoua.trim()
    if (!nume) return
    const ordine = Math.max(0, ...ctx.sectiuni.map((s) => s.ordine)) + 1
    await ruleaza(supabase.from('tsk_checklist_sectiuni').insert({ nume, ordine }), 'Nu am putut adăuga secțiunea.')
    setSectiuneNoua('')
  }

  async function adaugaItem(sid) {
    const titlu = (itemNou[sid] || '').trim()
    if (!titlu) return
    const ordine = Math.max(0, ...ctx.itemi.filter((i) => i.sectiune_id === sid).map((i) => i.ordine)) + 1
    await ruleaza(supabase.from('tsk_checklist_itemi').insert({ sectiune_id: sid, titlu, ordine }), 'Nu am putut adăuga itemul.')
    setItemNou((p) => ({ ...p, [sid]: '' }))
  }

  async function stergeSectiune(s, nr) {
    if (!window.confirm(`Ștergi secțiunea „${s.nume}" cu cei ${nr} itemi ai ei? Taskurile deja create pe evenimente rămân.`)) return
    await ruleaza(supabase.from('tsk_checklist_sectiuni').delete().eq('id', s.id), 'Nu am putut șterge secțiunea.')
  }

  async function mutaInSectiune(item, sid) {
    const ordine = Math.max(0, ...ctx.itemi.filter((i) => i.sectiune_id === sid).map((i) => i.ordine)) + 1
    await ruleaza(supabase.from('tsk_checklist_itemi').update({ sectiune_id: sid, ordine }).eq('id', item.id), 'Nu am putut muta itemul.')
  }

  const butonMic = 'rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30'

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Lista din care PM-ul alege ce taskuri creează pe un eveniment. Orice modificare de aici se aplică evenimentelor viitoare; taskurile deja create nu se schimbă.
      </p>
      {eroare && <p className="mb-3 text-sm text-rose-600">{eroare}</p>}

      <div className="space-y-4">
        {ctx.sectiuni.map((s, si) => {
          const itemi = ctx.itemi.filter((i) => i.sectiune_id === s.id)
          return (
            <div key={s.id} className="rounded-xl bg-white shadow-sm">
              <div className="flex items-center gap-2 rounded-t-xl bg-slate-50 px-3 py-2">
                <input
                  className={`${inputCls} !w-auto min-w-0 flex-1 font-semibold`}
                  defaultValue={s.nume}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== s.nume) ruleaza(supabase.from('tsk_checklist_sectiuni').update({ nume: v }).eq('id', s.id), 'Nu am putut redenumi.')
                    else e.target.value = s.nume
                  }}
                />
                <span className="text-xs text-slate-400">{itemi.length} itemi</span>
                <button type="button" className={butonMic} disabled={si === 0} onClick={() => muta('tsk_checklist_sectiuni', ctx.sectiuni, s.id, -1)} title="Mută sus"><ArrowUp size={15} /></button>
                <button type="button" className={butonMic} disabled={si === ctx.sectiuni.length - 1} onClick={() => muta('tsk_checklist_sectiuni', ctx.sectiuni, s.id, 1)} title="Mută jos"><ArrowDown size={15} /></button>
                <button type="button" className={`${butonMic} hover:!text-rose-600`} onClick={() => stergeSectiune(s, itemi.length)} title="Șterge secțiunea"><Trash2 size={15} /></button>
              </div>
              <ul className="divide-y divide-slate-50">
                {itemi.map((it, ii) => (
                  <li key={it.id} className="flex items-center gap-2 px-3 py-1.5">
                    <input
                      className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-accent focus:outline-none"
                      defaultValue={it.titlu}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v && v !== it.titlu) ruleaza(supabase.from('tsk_checklist_itemi').update({ titlu: v }).eq('id', it.id), 'Nu am putut salva.')
                        else e.target.value = it.titlu
                      }}
                    />
                    <select className="w-28 rounded border border-slate-200 bg-white px-1 py-1 text-xs text-slate-500" value="" onChange={(e) => e.target.value && mutaInSectiune(it, e.target.value)} aria-label="Mută în altă secțiune">
                      <option value="">Mută în…</option>
                      {ctx.sectiuni.filter((x) => x.id !== s.id).map((x) => (
                        <option key={x.id} value={x.id}>{x.nume}</option>
                      ))}
                    </select>
                    <button type="button" className={butonMic} disabled={ii === 0} onClick={() => muta('tsk_checklist_itemi', itemi, it.id, -1)} title="Mută sus"><ArrowUp size={14} /></button>
                    <button type="button" className={butonMic} disabled={ii === itemi.length - 1} onClick={() => muta('tsk_checklist_itemi', itemi, it.id, 1)} title="Mută jos"><ArrowDown size={14} /></button>
                    <button type="button" className={`${butonMic} hover:!text-rose-600`} onClick={() => window.confirm(`Ștergi „${it.titlu}"?`) && ruleaza(supabase.from('tsk_checklist_itemi').delete().eq('id', it.id), 'Nu am putut șterge.')} title="Șterge"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 border-t border-slate-100 p-3">
                <input
                  className={inputCls}
                  placeholder="Item nou în această secțiune…"
                  value={itemNou[s.id] || ''}
                  onChange={(e) => setItemNou((p) => ({ ...p, [s.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adaugaItem(s.id) } }}
                />
                <button type="button" onClick={() => adaugaItem(s.id)} className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Plus size={14} /> Adaugă
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={adaugaSectiune} className="mt-5 flex gap-2">
        <input className={inputCls} placeholder="Secțiune nouă (ex: Hotel și cazare)" value={sectiuneNoua} onChange={(e) => setSectiuneNoua(e.target.value)} />
        <button type="submit" className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          <Plus size={14} /> Adaugă secțiune
        </button>
      </form>
    </div>
  )
}
