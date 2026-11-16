import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { inputCls, mesajEroare } from '../../lib/taskuri/ui'
import AngajatiPicker from './AngajatiPicker'
import { Modal, Gol } from './Mici'

const TIPURI = [
  ['lista', 'Listă (o alegere)'],
  ['multi', 'Selecție multiplă'],
  ['text', 'Text scurt'],
  ['paragraf', 'Paragraf'],
  ['numar', 'Număr'],
  ['data', 'Dată'],
  ['ora', 'Oră'],
  ['link', 'Link'],
  ['persoana', 'Persoană din Hub'],
]
const NUME_TIP = Object.fromEntries(TIPURI)

const slug = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'camp'

// Editorul listei de opțiuni a unui câmp. Opțiunile nu se șterg: se dezactivează (rămân vizibile în taskurile vechi).
function EditorOptiuni({ camp, onClose, onSalveaza }) {
  const [lista, setLista] = useState(() => (camp.optiuni || []).map((o) => ({ ...o })))
  const [nou, setNou] = useState('')
  const [busy, setBusy] = useState(false)
  const muta = (i, d) => setLista((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n })
  const schimba = (i, patch) => setLista((l) => l.map((o, k) => (k === i ? { ...o, ...patch } : o)))
  function adauga(e) {
    e.preventDefault()
    const t = nou.trim()
    if (!t) return
    if (lista.some((o) => o.eticheta.toLowerCase() === t.toLowerCase())) return
    setLista((l) => [...l, { cod: 'o' + Date.now().toString(36), eticheta: t, activ: true }])
    setNou('')
  }
  async function salveaza() {
    setBusy(true)
    await onSalveaza(lista.filter((o) => o.eticheta.trim()).map((o) => ({ ...o, eticheta: o.eticheta.trim() })))
    setBusy(false)
  }
  return (
    <Modal titlu={`Opțiuni: ${camp.eticheta}`} onClose={onClose} lat="max-w-lg" esc={false}>
      <p className="mb-3 text-xs text-slate-500">Opțiunile dezactivate dispar din formularele noi, dar rămân vizibile în taskurile vechi. Nu se șterg.</p>
      <ul className="mb-3 space-y-1.5">
        {lista.map((o, i) => (
          <li key={o.cod} className="flex items-center gap-2">
            <span className="flex flex-col">
              <button type="button" onClick={() => muta(i, -1)} className="text-slate-400 hover:text-slate-700" aria-label="Mută în sus"><ArrowUp size={13} /></button>
              <button type="button" onClick={() => muta(i, 1)} className="text-slate-400 hover:text-slate-700" aria-label="Mută în jos"><ArrowDown size={13} /></button>
            </span>
            <input className={`${inputCls} ${o.activ === false ? 'opacity-50' : ''}`} value={o.eticheta} onChange={(e) => schimba(i, { eticheta: e.target.value })} />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-[#22406B]" checked={o.activ !== false} onChange={(e) => schimba(i, { activ: e.target.checked })} /> Activ
            </label>
          </li>
        ))}
        {lista.length === 0 && <li className="text-sm text-slate-400">Nicio opțiune încă.</li>}
      </ul>
      <form onSubmit={adauga} className="mb-4 flex gap-2">
        <input className={inputCls} placeholder="Opțiune nouă…" value={nou} onChange={(e) => setNou(e.target.value)} />
        <button type="submit" className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus size={14} /> Adaugă</button>
      </form>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Renunță</button>
        <button type="button" disabled={busy} onClick={salveaza} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">{busy ? 'Se salvează…' : 'Salvează'}</button>
      </div>
    </Modal>
  )
}

function CampuriCategorie({ ctx, categorie, ruleaza }) {
  const campuri = ctx.campuriCategorie(categorie.id)
  const [editOpt, setEditOpt] = useState(null)
  const [nou, setNou] = useState({ eticheta: '', tip: 'lista', obligatoriu: false })
  const upd = (id, patch, msg) => ruleaza(supabase.from('tsk_sabloane_campuri').update(patch).eq('id', id), msg || 'Nu am putut salva câmpul.')

  async function muta(c, d) {
    const i = campuri.findIndex((x) => x.id === c.id)
    const alt = campuri[i + d]
    if (!alt) return
    await ruleaza(supabase.from('tsk_sabloane_campuri').upsert([{ ...c, ordine: alt.ordine }, { ...alt, ordine: c.ordine }]), 'Nu am putut muta câmpul.')
  }
  async function adauga(e) {
    e.preventDefault()
    const eticheta = nou.eticheta.trim()
    if (!eticheta) return
    const ordine = campuri.reduce((m, c) => Math.max(m, c.ordine), 0) + 1
    const cheie = `${slug(eticheta)}_${Math.random().toString(36).slice(2, 5)}`
    await ruleaza(supabase.from('tsk_sabloane_campuri').insert({ categorie_id: categorie.id, cheie, eticheta, tip: nou.tip, obligatoriu: nou.obligatoriu, ordine, optiuni: [] }), 'Nu am putut adăuga câmpul.')
    setNou({ eticheta: '', tip: 'lista', obligatoriu: false })
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr><th className="w-16 px-3 py-2">Ordine</th><th className="px-3 py-2">Etichetă</th><th className="px-3 py-2">Tip</th><th className="px-3 py-2">Obligatoriu</th><th className="px-3 py-2">Opțiuni</th><th className="px-3 py-2">Activ</th></tr>
          </thead>
          <tbody>
            {campuri.map((c, i) => (
              <tr key={c.id} className={`border-t border-slate-100 ${c.activ ? '' : 'bg-slate-50 text-slate-400'}`}>
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <button type="button" disabled={i === 0} onClick={() => muta(c, -1)} className="hover:text-slate-700 disabled:opacity-30" aria-label="Mută în sus"><ArrowUp size={14} /></button>
                    <button type="button" disabled={i === campuri.length - 1} onClick={() => muta(c, 1)} className="hover:text-slate-700 disabled:opacity-30" aria-label="Mută în jos"><ArrowDown size={14} /></button>
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <input className={inputCls} defaultValue={c.eticheta} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.eticheta) upd(c.id, { eticheta: v }) }} />
                </td>
                <td className="px-3 py-1.5 text-slate-600">{NUME_TIP[c.tip]}</td>
                <td className="px-3 py-1.5"><input type="checkbox" className="h-4 w-4 accent-[#22406B]" checked={c.obligatoriu} onChange={(e) => upd(c.id, { obligatoriu: e.target.checked })} aria-label={`Obligatoriu: ${c.eticheta}`} /></td>
                <td className="px-3 py-1.5">
                  {c.tip === 'lista' || c.tip === 'multi'
                    ? <button type="button" onClick={() => setEditOpt(c)} className="font-semibold text-accent hover:underline">{(c.optiuni || []).filter((o) => o.activ !== false).length} opțiuni – editează</button>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5"><input type="checkbox" className="h-4 w-4 accent-[#22406B]" checked={c.activ} onChange={(e) => upd(c.id, { activ: e.target.checked })} aria-label={`Activ: ${c.eticheta}`} /></td>
              </tr>
            ))}
            {campuri.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Niciun câmp încă.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Un câmp dezactivat dispare din formularele noi, dar rămâne vizibil în taskurile vechi. Câmpurile nu se șterg.</p>

      <form onSubmit={adauga} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600">Câmp nou</label>
          <input className={inputCls} placeholder="Etichetă (ex. Format fișier)" value={nou.eticheta} onChange={(e) => setNou({ ...nou, eticheta: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Tip</label>
          <select className={inputCls} value={nou.tip} onChange={(e) => setNou({ ...nou, tip: e.target.value })}>
            {TIPURI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <label className="flex min-h-[40px] items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-[#22406B]" checked={nou.obligatoriu} onChange={(e) => setNou({ ...nou, obligatoriu: e.target.checked })} /> Obligatoriu
        </label>
        <button type="submit" className="flex min-h-[40px] items-center gap-1 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"><Plus size={14} /> Adaugă câmp</button>
      </form>

      {editOpt && (
        <EditorOptiuni
          camp={editOpt}
          onClose={() => setEditOpt(null)}
          onSalveaza={async (optiuni) => {
            await upd(editOpt.id, { optiuni }, 'Nu am putut salva opțiunile.')
            setEditOpt(null)
          }}
        />
      )}
    </div>
  )
}

// Setări Taskuri → Structură task: pentru fiecare tip (Eveniment, Operațional, categoriile Media) câmpurile suplimentare din formular;
// la categoriile Media, și conturile care pot primi taskul (responsabilii permiși).
export default function StructuraTask({ ctx }) {
  const [eroare, setEroare] = useState('')
  const [aleasa, setAleasa] = useState('')
  const [catNoua, setCatNoua] = useState('')

  async function ruleaza(promisiune, mesaj) {
    setEroare('')
    const { error } = await promisiune
    if (error) setEroare(mesajEroare(error, mesaj))
    await ctx.reload()
  }

  const tipuri = useMemo(() => [...(ctx.categorii || [])].sort((a, b) => a.ordine - b.ordine), [ctx.categorii])
  const cat = tipuri.find((c) => c.id === aleasa) || tipuri[0]

  if (!tipuri.length) {
    return <Gol>Structura taskurilor nu e disponibilă. Rulează migrarea 23 în Supabase (vezi instrucțiunile livrate).</Gol>
  }

  const media = cat?.tip === 'solicitare'
  const membriDept = media && cat.grup_id ? ctx.responsabiliCategorie(cat.id).map((r) => r.angajat_id) : []
  const grupuriActive = ctx.grupuri.filter((g) => g.activ)

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Câmpurile suplimentare din formularul „Task nou”, pentru fiecare tip de task. Câmpurile de bază (titlu, descriere, responsabil, termen, prioritate, tag, link, colaboratori) rămân neschimbate. Nimic nu se șterge, doar se dezactivează.
      </p>
      {eroare && <p className="text-sm text-rose-600">{eroare}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {tipuri.map((c) => (
          <button key={c.id} type="button" aria-pressed={cat?.id === c.id} onClick={() => setAleasa(c.id)} className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold ${cat?.id === c.id ? 'border-accent bg-accent text-white' : 'border-[#CBD3E0] bg-white text-accent'} ${c.activ ? '' : 'line-through opacity-60'}`}>
            {c.tip === 'solicitare' ? `Media · ${c.nume}` : c.nume}
          </button>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const nume = catNoua.trim()
            if (!nume) return
            const ordine = tipuri.reduce((m, c) => Math.max(m, c.ordine), 0) + 1
            await ruleaza(supabase.from('tsk_categorii').insert({ cod: `${slug(nume)}_${Math.random().toString(36).slice(2, 5)}`, nume, tip: 'solicitare', ordine }), 'Nu am putut adăuga categoria.')
            setCatNoua('')
          }}
          className="flex items-center gap-1.5"
        >
          <input className={`${inputCls} w-52`} placeholder="Categorie Media nouă…" value={catNoua} onChange={(e) => setCatNoua(e.target.value)} />
          <button type="submit" className="flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus size={14} /> Adaugă</button>
        </form>
      </div>

      {cat && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          {media && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <input className={`${inputCls} max-w-xs font-semibold`} defaultValue={cat.nume} key={cat.id + cat.nume} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== cat.nume) ruleaza(supabase.from('tsk_categorii').update({ nume: v }).eq('id', cat.id), 'Nu am putut redenumi.') }} />
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-[#22406B]" checked={cat.activ} onChange={(e) => ruleaza(supabase.from('tsk_categorii').update({ activ: e.target.checked }).eq('id', cat.id), 'Nu am putut salva.')} /> Categorie activă (apare în „Task nou”)
                </label>
              </div>
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Departament destinatar *</label>
                  <select className={inputCls} value={cat.grup_id || ''} onChange={(e) => ruleaza(supabase.from('tsk_categorii').update({ grup_id: e.target.value || null, responsabil_implicit_id: null }).eq('id', cat.id), 'Nu am putut salva.')}>
                    <option value="">— alege departamentul —</option>
                    {grupuriActive.map((g) => <option key={g.id} value={g.id}>{g.nume}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">Membrii departamentului (conturile din Hub cu acces la Taskuri) pot fi aleși ca responsabili. Departamentele se gestionează în tab-ul „Departamente”. Coordonatorul departamentului vede toate taskurile categoriei. Fără departament, categoria nu apare în „Task nou”.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Responsabil implicit (precompletat în formular)</label>
                  <select className={inputCls} value={cat.responsabil_implicit_id || ''} disabled={!cat.grup_id} onChange={(e) => ruleaza(supabase.from('tsk_categorii').update({ responsabil_implicit_id: e.target.value || null }).eq('id', cat.id), 'Nu am putut salva.')}>
                    <option value="">— fără implicit —</option>
                    {membriDept.map((id) => <option key={id} value={id}>{ctx.nume(id)}</option>)}
                  </select>
                  {cat.grup_id && membriDept.length === 0 && <p className="mt-1 text-xs text-amber-700">Departamentul nu are încă membri cu acces la Taskuri.</p>}
                </div>
              </div>
            </>
          )}
          <p className="mb-2 text-sm font-semibold text-slate-800">Câmpuri suplimentare</p>
          <CampuriCategorie ctx={ctx} categorie={cat} ruleaza={ruleaza} />
        </section>
      )}
    </div>
  )
}
