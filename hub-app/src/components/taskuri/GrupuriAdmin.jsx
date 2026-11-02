import { useState } from 'react'
import { Plus, Trash2, X as XIcon } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { inputCls, mesajEroare } from '../../lib/taskuri/ui'
import AngajatiPicker from './AngajatiPicker'
import { Gol } from './Mici'

// Departamentele pentru taskuri (separate de departamentele din HR): membri și coordonatori.
export default function GrupuriAdmin({ ctx }) {
  const [nou, setNou] = useState('')
  const [eroare, setEroare] = useState('')

  async function ruleaza(promisiune, mesaj) {
    setEroare('')
    const { error } = await promisiune
    if (error) setEroare(mesajEroare(error, mesaj))
    await ctx.reload()
  }

  async function adauga(e) {
    e.preventDefault()
    const nume = nou.trim()
    if (!nume) return
    if (ctx.grupuri.some((g) => g.nume.toLowerCase() === nume.toLowerCase())) return setEroare('Există deja un departament cu acest nume.')
    await ruleaza(supabase.from('tsk_grupuri').insert({ nume }), 'Nu am putut adăuga departamentul.')
    setNou('')
  }

  async function stergeGrup(g) {
    const nr = ctx.taskuri.filter((t) => t.grup_id === g.id).length
    const msg = nr
      ? `Ștergi departamentul „${g.nume}"? ${nr} taskuri rămân, dar nu vor mai avea departament. Dacă vrei doar să-l ascunzi, dezactivează-l.`
      : `Ștergi departamentul „${g.nume}"?`
    if (window.confirm(msg)) await ruleaza(supabase.from('tsk_grupuri').delete().eq('id', g.id), 'Nu am putut șterge departamentul.')
  }

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Un coordonator de departament vede taskurile departamentului și poate crea taskuri operaționale pentru membrii lui. Un departament poate avea mai mulți coordonatori.
      </p>
      {eroare && <p className="mb-3 text-sm text-rose-600">{eroare}</p>}

      <form onSubmit={adauga} className="mb-5 flex gap-2">
        <input className={inputCls} placeholder="Departament nou (ex: Ticketing)" value={nou} onChange={(e) => setNou(e.target.value)} />
        <button type="submit" className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          <Plus size={14} /> Adaugă
        </button>
      </form>

      {ctx.grupuri.length === 0 ? (
        <Gol>Nu ai creat încă niciun departament.</Gol>
      ) : (
        <div className="space-y-4">
          {ctx.grupuri.map((g) => {
            const membri = ctx.membri.filter((m) => m.grup_id === g.id)
            const ids = membri.map((m) => m.angajat_id)
            return (
              <div key={g.id} className={`rounded-xl bg-white p-4 shadow-sm ${g.activ ? '' : 'opacity-60'}`}>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <input
                    className={`${inputCls} !w-auto min-w-[200px] flex-1 font-medium`}
                    defaultValue={g.nume}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== g.nume) ruleaza(supabase.from('tsk_grupuri').update({ nume: v }).eq('id', g.id), 'Nu am putut redenumi (poate există deja acest nume).')
                      else e.target.value = g.nume
                    }}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={g.activ} onChange={(e) => ruleaza(supabase.from('tsk_grupuri').update({ activ: e.target.checked }).eq('id', g.id), 'Nu am putut salva.')} />
                    Activ
                  </label>
                  <button type="button" onClick={() => stergeGrup(g)} className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Șterge departamentul">
                    <Trash2 size={15} />
                  </button>
                </div>

                <ul className="mb-3 divide-y divide-slate-50">
                  {membri.length === 0 && <li className="py-2 text-sm text-slate-400">Niciun membru încă.</li>}
                  {membri
                    .sort((a, b) => Number(b.e_coordonator) - Number(a.e_coordonator) || ctx.nume(a.angajat_id).localeCompare(ctx.nume(b.angajat_id)))
                    .map((m) => (
                      <li key={m.angajat_id} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className="flex-1 text-slate-800">{ctx.nume(m.angajat_id)}</span>
                        {!ctx.acces[m.angajat_id] && <span className="text-xs text-amber-600" title="Nu poate vedea taskurile până nu primește acces din Hub">fără acces la Taskuri</span>}
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={m.e_coordonator}
                            onChange={(e) => ruleaza(supabase.from('tsk_grup_membri').update({ e_coordonator: e.target.checked }).eq('grup_id', g.id).eq('angajat_id', m.angajat_id), 'Nu am putut salva.')}
                          />
                          Coordonator
                        </label>
                        <button type="button" onClick={() => ruleaza(supabase.from('tsk_grup_membri').delete().eq('grup_id', g.id).eq('angajat_id', m.angajat_id), 'Nu am putut scoate persoana.')} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" title="Scoate din departament">
                          <XIcon size={14} />
                        </button>
                      </li>
                    ))}
                </ul>

                <AngajatiPicker
                  single
                  angajati={ctx.angajati.filter((a) => a.activ)}
                  valoare={[]}
                  placeholder="Adaugă un membru (caută după nume)…"
                  onChange={(v) => {
                    const id = v[0]
                    if (id && !ids.includes(id)) ruleaza(supabase.from('tsk_grup_membri').insert({ grup_id: g.id, angajat_id: id, e_coordonator: false }), 'Nu am putut adăuga persoana.')
                  }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
