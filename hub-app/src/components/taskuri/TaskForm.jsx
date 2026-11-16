import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { PRIORITATI, inputCls, labelCls, mesajEroare } from '../../lib/taskuri/ui'
import AngajatiPicker from './AngajatiPicker'
import EvenimentPicker from './EvenimentPicker'
import TagPicker from './TagPicker'
import { Modal } from './Mici'
import CampuriSolicitare from './CampuriSolicitare'
import { COD_EV, construiestePerechi, locatieEveniment, titluAuto, valideazaCampuri } from '../../lib/taskuri/solicitari'

// Creare task nou. (Taskurile existente se modifică direct, din fereastra taskului sau din liste.)
export default function TaskForm({ ctx, evenimentImplicit, onClose, onSaved }) {
  // Tipurile pe care am voie să le creez: Eveniment (PM/admin), Operațional (coordonator/admin), Media (oricine poate crea taskuri)
  const categoriiMedia = ctx.poateCreaSolicitare && !evenimentImplicit ? ctx.categoriiActive : []
  const tipuriPosibile = [ctx.poateEveniment && 'eveniment', ctx.poateOperational && 'operational'].filter(Boolean)
  const toateTipurile = [
    ...(ctx.poateEveniment ? [{ k: 'eveniment', tip: 'eveniment', titlu: 'Eveniment', desc: 'Legat de un eveniment din calendar' }] : []),
    ...(ctx.poateOperational ? [{ k: 'operational', tip: 'operational', titlu: 'Operațional', desc: 'Activitate curentă de birou, fără eveniment' }] : []),
    ...categoriiMedia.map((c) => ({ k: `cat:${c.id}`, tip: 'solicitare', categorie_id: c.id, titlu: c.nume, desc: c.cod === 'design_grafic' ? 'Afiș, pliant, banner, program de sală…' : c.cod === 'foto_video' ? 'Fotografiere, filmare, interviuri…' : 'Cerere către Media', grup: 'media' })),
  ]

  const evenimenteAlegere = useMemo(
    () =>
      (ctx.admin ? ctx.evenimente : ctx.evenimenteMele)
        .filter((e) => ctx.comportament(e.id) !== 'anulat')
        .sort((a, b) => (a.data || '').localeCompare(b.data || '')),
    [ctx]
  )
  const grupuriAlegere = ctx.grupuri.filter((g) => g.activ && (ctx.admin || ctx.grupuriCoordonate.has(g.id)))

  const [f, setF] = useState(() => ({
    tip: evenimentImplicit ? 'eveniment' : toateTipurile[0]?.tip,
    categorie_id: !evenimentImplicit && toateTipurile[0]?.categorie_id ? toateTipurile[0].categorie_id : '',
    valori: {},
    titluManual: false,
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
  // cu mai multe tipuri posibile, întâi o fereastră mică: „Ce fel de task creezi?"
  const [pas, setPas] = useState(toateTipurile.length > 1 && !evenimentImplicit ? 'alege' : 'form')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  // --- taskuri Media (solicitări) ---
  const esteSolicitare = f.tip === 'solicitare'
  const categorie = esteSolicitare ? ctx.categMap[f.categorie_id] : null
  const campuri = useMemo(() => (esteSolicitare ? ctx.campuriCategorie(f.categorie_id) : []), [ctx, esteSolicitare, f.categorie_id])
  const evSolicitare = esteSolicitare && f.eveniment_id ? ctx.evMap[f.eveniment_id] : null
  const evenimenteSolicitare = useMemo(
    () => ctx.evenimente.filter((e) => ctx.comportament(e.id) !== 'anulat').sort((a, b) => (a.data || '').localeCompare(b.data || '')),
    [ctx]
  )
  const setValoare = (cheie, v) => setF((p) => ({ ...p, valori: { ...p.valori, [cheie]: v } }))
  const alegeTip = (t) => {
    setF((p) => ({
      ...p,
      tip: t.tip,
      categorie_id: t.categorie_id || '',
      valori: {},
      titluManual: false,
      titlu: t.tip === 'solicitare' ? '' : p.titlu,
      eveniment_id: t.tip === 'eveniment' || t.tip === 'solicitare' ? p.eveniment_id : '',
      // la Media, responsabilul implicit al categoriei vine precompletat
      responsabil: t.tip === 'solicitare' ? [ctx.responsabiliCategorie(t.categorie_id).find((r) => r.implicit)?.angajat_id].filter(Boolean) : [],
    }))
    setPas('form')
  }
  const responsabiliMedia = esteSolicitare ? ctx.responsabiliCategorie(f.categorie_id).map((r) => r.angajat_id) : []
  // câmpurile suplimentare ale tipului (la Media: ale categoriei; la Eveniment / Operațional: ale tipului)
  const campuriTip = useMemo(() => {
    const idCateg = esteSolicitare ? f.categorie_id : ctx.categorieTip(f.tip)?.id
    return idCateg ? ctx.campuriCategorie(idCateg) : []
  }, [ctx, esteSolicitare, f.tip, f.categorie_id])
  // La alegerea evenimentului se preiau data, ora și locul în câmpurile care le au (rămân editabile)
  const alegeEvenimentSolicitare = (id) =>
    setF((p) => {
      const ev = id ? ctx.evMap[id] : null
      const valori = { ...p.valori }
      const are = (cheie) => campuri.some((c) => c.cheie === cheie && c.activ)
      if (ev) {
        if (are('data_filmarii') && ev.data) valori.data_filmarii = ev.data
        if (are('ora_inceput') && ev.ora_inceput) valori.ora_inceput = ev.ora_inceput.slice(0, 5)
        if (are('ora_sfarsit') && ev.ora_sfarsit) valori.ora_sfarsit = ev.ora_sfarsit.slice(0, 5)
        if (are('locatie') && locatieEveniment(ev)) valori.locatie = COD_EV
      } else if (valori.locatie === COD_EV) delete valori.locatie
      return { ...p, eveniment_id: id, valori }
    })
  // titlul se generează singur până îl modifici tu
  const titluSugerat = esteSolicitare ? titluAuto(campuri, f.valori, ctx, evSolicitare, categorie) : ''
  useEffect(() => {
    if (esteSolicitare && !f.titluManual) setF((p) => (p.titlu === titluSugerat ? p : { ...p, titlu: titluSugerat }))
  }, [esteSolicitare, f.titluManual, titluSugerat])

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
    if (esteSolicitare) {
      const eroareCampuri = valideazaCampuri(campuri, f.valori)
      if (eroareCampuri) return setError(eroareCampuri)
      if (!f.responsabil[0]) return setError(responsabiliMedia.length ? 'Alege responsabilul.' : 'Nu e setat niciun responsabil pentru această categorie. Adminul îl setează în Setări → Structură task.')
      if (!f.termen) return setError('Alege termenul (data limită).')
      if (!f.descriere.trim()) return setError('Scrie descrierea.')
      setBusy(true)
      const { error: errS } = await supabase.from('tsk_taskuri').insert({
        tip: 'solicitare',
        titlu: f.titlu.trim(),
        descriere: f.descriere.trim(),
        termen: f.termen,
        prioritate: f.prioritate,
        categorie_id: categorie.id,
        responsabil_id: f.responsabil[0],
        eveniment_id: f.eveniment_id || null,
        date_campuri: construiestePerechi(campuri, f.valori, ctx, evSolicitare),
        creat_de: ctx.me.id,
      })
      setBusy(false)
      if (errS) return setError(mesajEroare(errS))
      return onSaved()
    }
    const eroareCampuri2 = valideazaCampuri(campuriTip, f.valori)
    if (eroareCampuri2) return setError(eroareCampuri2)
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
      date_campuri: construiestePerechi(campuriTip, f.valori, ctx, null),
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

  if (toateTipurile.length === 0) {
    return (
      <Modal titlu="Task nou" onClose={onClose}>
        <p className="text-sm text-slate-600">Nu poți crea taskuri: nu ești PM la niciun eveniment și nici coordonator de departament.</p>
      </Modal>
    )
  }

  if (pas === 'alege') {
    const grupe = [
      ['Pentru echipa noastră', toateTipurile.filter((t) => t.tip !== 'solicitare'), '📅🗂'],
      ['Cerere către Media', toateTipurile.filter((t) => t.tip === 'solicitare'), '🎨🎥'],
    ].filter(([, l]) => l.length)
    const pictograma = (t) => (t.tip === 'eveniment' ? '📅' : t.tip === 'operational' ? '🗂' : t.cod === 'foto_video' ? '🎥' : '🎨')
    return (
      <Modal titlu="Task nou" onClose={onClose} lat="max-w-md">
        <p className="mb-3 text-[15px] font-semibold text-slate-700">Ce fel de task creezi?</p>
        {grupe.map(([nume, lista]) => (
          <div key={nume} className="mb-3">
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{nume}</p>
            <div className="space-y-2">
              {lista.map((t) => (
                <button key={t.k} type="button" onClick={() => alegeTip(t)} className="flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left hover:border-accent hover:bg-[#F6F9FE]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E4ECF8] text-lg" aria-hidden="true">{pictograma({ ...t, cod: ctx.categMap[t.categorie_id]?.cod })}</span>
                  <span>
                    <span className="block text-[15px] font-bold text-slate-900">{t.titlu}</span>
                    <span className="block text-[13px] font-medium text-slate-500">{t.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </Modal>
    )
  }

  return (
    <Modal titlu="Task nou" onClose={onClose} esc={false}>
      <form onSubmit={salveaza} className="space-y-4">
        {toateTipurile.length > 1 && !evenimentImplicit && (() => {
          const curent = toateTipurile.find((t) => t.tip === f.tip && (t.tip !== 'solicitare' || t.categorie_id === f.categorie_id))
          return (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#E4ECF8] px-3.5 py-1.5 text-sm font-extrabold text-[#22406B]">
                {curent?.grup === 'media' ? `Media · ${curent.titlu}` : curent?.titlu}
              </span>
              <button type="button" onClick={() => setPas('alege')} className="text-sm font-semibold text-slate-500 underline hover:text-slate-800">Schimbă</button>
            </div>
          )
        })()}

        {esteSolicitare ? (
          <>
            <div>
              <label className={labelCls}>Eveniment (opțional)</label>
              <EvenimentPicker evenimente={evenimenteSolicitare} ctx={ctx} valoare={f.eveniment_id} onChange={alegeEvenimentSolicitare} />
              <p className="mt-1 text-xs text-slate-400">Dacă alegi un eveniment, data, ora și locul se completează singure. Taskul Media nu blochează finalizarea evenimentului.</p>
            </div>
            <CampuriSolicitare campuri={campuri} valori={f.valori} setValoare={setValoare} ctx={ctx} eveniment={evSolicitare} />
            <div>
              <label className={labelCls}>Titlu *</label>
              <input className={inputCls} maxLength={200} value={f.titlu} onChange={(e) => setF((p) => ({ ...p, titlu: e.target.value, titluManual: true }))} />
              <p className="mt-1 text-xs text-slate-400">Generat automat din ce ai ales; îl poți modifica.</p>
            </div>
            <div>
              <label className={labelCls}>Responsabil *</label>
              {responsabiliMedia.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Nu e setat niciun responsabil pentru această categorie. Adminul îl setează în Setări → Structură task.</p>
              ) : (
                <select className={inputCls} value={f.responsabil[0] || ''} onChange={(e) => set('responsabil', e.target.value ? [e.target.value] : [])}>
                  <option value="">— alege responsabilul —</option>
                  {responsabiliMedia.map((id) => <option key={id} value={id}>{ctx.nume(id)}</option>)}
                </select>
              )}
              <p className="mt-1 text-xs text-slate-400">Contul din Hub care lucrează taskul: schimbă statusul și adaugă linkul de livrare.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Prioritate *</label>
                <select className={inputCls} value={f.prioritate} onChange={(e) => set('prioritate', e.target.value)}>
                  {PRIORITATI.map((p) => <option key={p.cod} value={p.cod}>{p.nume}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-400">Precompletată „Medie”; o poți schimba.</p>
              </div>
              <div>
                <label className={labelCls}>Termen (data limită) *</label>
                <input type="date" className={inputCls} value={f.termen} onChange={(e) => set('termen', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Descriere *</label>
              <textarea className={inputCls} rows={3} maxLength={4000} value={f.descriere} onChange={(e) => set('descriere', e.target.value)} />
            </div>
            <p className="text-xs text-slate-500">Deschis de: <b className="text-slate-700">{ctx.me.nume_complet}</b>. După salvare, titlul, descrierea, termenul, prioritatea și câmpurile se blochează; orice schimbare se cere prin comentariu.</p>
          </>
        ) : (
        <>
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

        <CampuriSolicitare campuri={campuriTip} valori={f.valori} setValoare={setValoare} ctx={ctx} eveniment={null} />

        <div>
          <label className={labelCls}>Colaboratori (opțional)</label>
          <AngajatiPicker angajati={ctx.angajatiCuAcces.filter((a) => a.id !== f.responsabil[0])} valoare={f.colaboratori} onChange={(v) => set('colaboratori', v)} />
        </div>

        </>
        )}

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
