import { useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { PRIORITATI, inputCls, labelCls, mesajEroare } from '../../lib/taskuri/ui'
import AngajatiPicker from './AngajatiPicker'
import EvenimentPicker from './EvenimentPicker'
import TagPicker from './TagPicker'
import { Modal } from './Mici'

// Creare task nou. (Taskurile existente se modifică direct, din fereastra taskului sau din liste.)
export default function TaskForm({ ctx, evenimentImplicit, onClose, onSaved }) {
  const tipuriPosibile = [ctx.poateEveniment && 'eveniment', ctx.poateOperational && 'operational'].filter(Boolean)

  const evenimenteAlegere = useMemo(
    () =>
      (ctx.admin ? ctx.evenimente : ctx.evenimenteMele)
        .filter((e) => ctx.comportament(e.id) !== 'anulat')
        .sort((a, b) => (a.data || '').localeCompare(b.data || '')),
    [ctx]
  )
  const grupuriAlegere = ctx.grupuri.filter((g) => g.activ && (ctx.admin || ctx.grupuriCoordonate.has(g.id)))

  const [f, setF] = useState(() => ({
    tip: evenimentImplicit ? 'eveniment' : tipuriPosibile[0],
    titlu: '',
    descriere: '',
    eveniment_id: evenimentImplicit || '',
    grup_id: grupuriAlegere.length === 1 ? grupuriAlegere[0].id : '',
    responsabil: [],
    colaboratori: [],
    termen: '',
    prioritate: 'medie',
    link_document: '',
    tag: '',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  // Taskul operațional al unui coordonator (nu admin) poate merge doar la oameni din departamentul lui.
  const optiuniResponsabil = useMemo(() => {
    let lista = ctx.angajatiCuAcces
    if (f.tip === 'operational' && f.grup_id && !ctx.admin) {
      const ids = new Set(ctx.membri.filter((m) => m.grup_id === f.grup_id).map((m) => m.angajat_id))
      lista = lista.filter((a) => ids.has(a.id))
    }
    return lista
  }, [ctx, f.tip, f.grup_id])

  async function salveaza(e) {
    e.preventDefault()
    setError('')
    if (!f.titlu.trim()) return setError('Scrie titlul taskului.')
    if (f.tip === 'eveniment' && !f.eveniment_id) return setError('Alege evenimentul.')
    if (f.tip === 'operational' && !f.grup_id && !ctx.admin) return setError('Alege departamentul.')
    if (f.link_document.trim() && !/^https?:\/\/\S+$/i.test(f.link_document.trim())) {
      return setError('Linkul trebuie să înceapă cu http:// sau https://.')
    }
    setBusy(true)
    const date = {
      titlu: f.titlu.trim(),
      descriere: f.descriere.trim() || null,
      responsabil_id: f.responsabil[0] || null,
      termen: f.termen || null,
      prioritate: f.prioritate,
      link_document: f.link_document.trim() || null,
      tag: f.tag.trim() || null,
      ...(f.tip === 'operational' ? { grup_id: f.grup_id || null } : {}),
    }
    const { data, error: err } = await supabase
      .from('tsk_taskuri')
      .insert({ ...date, tip: f.tip, eveniment_id: f.tip === 'eveniment' ? f.eveniment_id : null, creat_de: ctx.me.id })
      .select('id')
      .single()
    if (err) { setBusy(false); return setError(mesajEroare(err)) }
    const id = data.id

    // colaboratori
    if (f.colaboratori.length) {
      const { error: err2 } = await supabase.from('tsk_colaboratori').insert(f.colaboratori.map((angajat_id) => ({ task_id: id, angajat_id })))
      if (err2) { setBusy(false); await onSaved(); return setError('Taskul s-a salvat, dar colaboratorii nu: ' + mesajEroare(err2, 'eroare necunoscută')) }
    }
    setBusy(false)
    await onSaved()
  }

  if (tipuriPosibile.length === 0) {
    return (
      <Modal titlu="Task nou" onClose={onClose}>
        <p className="text-sm text-slate-600">Nu poți crea taskuri: nu ești PM la niciun eveniment și nici coordonator de departament.</p>
      </Modal>
    )
  }

  return (
    <Modal titlu="Task nou" onClose={onClose} esc={false}>
      <form onSubmit={salveaza} className="space-y-4">
        {tipuriPosibile.length > 1 && !evenimentImplicit && (
          <div>
            <label className={labelCls}>Tip task</label>
            <div className="flex flex-wrap gap-2.5">
              {[['eveniment', 'Task de eveniment', 'Legat de un eveniment din calendar'], ['operational', 'Task operațional', 'Activitate curentă de birou, fără eveniment']].filter(([k]) => tipuriPosibile.includes(k)).map(([k, l, d]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={f.tip === k}
                  onClick={() => set('tip', k)}
                  className={`flex min-h-[64px] flex-1 basis-52 flex-col gap-0.5 rounded-xl border px-3.5 py-2.5 text-left ${f.tip === k ? 'border-2 border-accent bg-[#EEF3FB]' : 'border-slate-300 bg-white'}`}
                >
                  <span className="text-[15px] font-bold text-slate-900">{l}</span>
                  <span className="text-[13px] font-medium text-slate-500">{d}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>Titlu *</label>
          <input className={inputCls} value={f.titlu} onChange={(e) => set('titlu', e.target.value)} />
        </div>

        {f.tip === 'eveniment' ? (
          <div>
            <label className={labelCls}>Eveniment *</label>
            <EvenimentPicker evenimente={evenimenteAlegere} ctx={ctx} valoare={f.eveniment_id} dezactivat={!!evenimentImplicit} onChange={(v) => set('eveniment_id', v)} />
          </div>
        ) : (
          <div>
            <label className={labelCls}>Departament {ctx.admin ? '(opțional)' : '*'}</label>
            <select className={inputCls} value={f.grup_id} onChange={(e) => set('grup_id', e.target.value)}>
              <option value="">{ctx.admin ? '— fără departament —' : '— alege departamentul —'}</option>
              {grupuriAlegere.map((g) => (
                <option key={g.id} value={g.id}>{g.nume}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>Tag (opțional)</label>
          <TagPicker ctx={ctx} valoare={f.tag} onChange={(v) => set('tag', v)} />
          <p className="mt-1 text-xs text-slate-400">Categoria taskului (ex. Comunicare, Organizare). Poți alege din listă sau crea un tag nou.</p>
        </div>

        <div>
          <label className={labelCls}>Descriere</label>
          <textarea className={inputCls} rows={3} value={f.descriere} onChange={(e) => set('descriere', e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Responsabil</label>
          <AngajatiPicker single angajati={optiuniResponsabil} valoare={f.responsabil} onChange={(v) => set('responsabil', v)} />
          <p className="mt-1 text-xs text-slate-400">
            Apar doar angajații care au acces la Taskuri
            {f.tip === 'operational' && !ctx.admin ? ' și fac parte din departament' : ''}.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Termen</label>
            <input type="date" className={inputCls} value={f.termen} onChange={(e) => set('termen', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Prioritate</label>
            <select className={inputCls} value={f.prioritate} onChange={(e) => set('prioritate', e.target.value)}>
              {PRIORITATI.map((p) => (
                <option key={p.cod} value={p.cod}>{p.nume}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Link către document (opțional)</label>
          <input className={inputCls} placeholder="https://…" value={f.link_document} onChange={(e) => set('link_document', e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Colaboratori (opțional)</label>
          <AngajatiPicker angajati={ctx.angajatiCuAcces.filter((a) => a.id !== f.responsabil[0])} valoare={f.colaboratori} onChange={(v) => set('colaboratori', v)} />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Renunță</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
            {busy ? 'Se salvează…' : 'Salvează'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
