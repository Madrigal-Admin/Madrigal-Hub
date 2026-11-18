import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { MOD_SEMNARE, REGISTRE, esteStaff } from '../lib/roluri'
import { azi, formatData, mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Eroare, Info } from './comun'
import { SerieSelect } from './Serii'
import { AngajatiMulti, DocPicker, RespPicker } from './Pickere'
import SemnatariEditor from './SemnatariEditor'

// Formular pentru un document din Circuitul de semnare: înregistrare nouă (doc = null) sau modificare în Ciornă.
export default function CircuitForm({ doc, prefill, serieImplicita, role, comune, onSalvat, onRenunta }) {
  const info = REGISTRE.circuit
  const editare = !!doc
  const completare = doc?.status === 'liber' // loc liber rezervat, care se completează acum
  const [f, setF] = useState(() => ({
    serie_id: doc?.serie_id || prefill?.serie_id || serieImplicita || '',
    data_inreg: completare ? doc.data_inreg : azi(),
    sursa: prefill?.legat || doc?.legat_de || !doc || completare ? 'intrare' : 'nou', // pornește de la o Intrare sau document nou
    obiect: doc?.obiect || prefill?.obiect || '',
    tip_id: doc?.tip_id || prefill?.tip_id || '',
    mod_semnare: doc?.mod_semnare || 'fizica',
    resp_angajat_id: doc?.resp_angajat_id || prefill?.resp_angajat_id || '',
    resp_grup_id: doc?.resp_grup_id || prefill?.resp_grup_id || '',
    legat: prefill?.legat || null,
    ordine_semnare: doc?.ordine_semnare || 'pe_rand',
    locatie_hartie: doc ? doc.locatie_hartie || '' : 'La secretariat',
    semnatari: [],
    confidential: false,
    acces: [],
  }))
  const [eroare, setEroare] = useState('')
  const [avertisment, setAvertisment] = useState(null) // { id, mesaj } dacă documentul a fost înregistrat, dar un pas următor a eșuat
  const [busy, setBusy] = useState(false)

  // Intrarea la care e legat documentul (dacă există), pentru afișare
  useEffect(() => {
    if (!doc?.legat_de) return
    supabase.from('sec_documente_lista').select('id, numar_afisat, obiect').eq('id', doc.legat_de).maybeSingle()
      .then(({ data }) => setF((v) => ({ ...v, legat: data || { id: doc.legat_de, numar_afisat: '(document la care nu ai acces)', obiect: '' } })))
  }, [doc?.legat_de])

  useEffect(() => {
    if (!doc) return
    supabase.from('sec_semnatari').select('angajat_id, ordine').eq('document_id', doc.id).eq('runda', doc.runda).order('ordine')
      .then(({ data }) => setF((v) => ({ ...v, semnatari: (data || []).map((x) => x.angajat_id).filter(Boolean) })))
  }, [doc])

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const anCurent = new Date().getFullYear()

  async function salveaza(lanseaza) {
    setEroare('')
    setAvertisment(null)
    if (!editare && !f.serie_id) return setEroare('Alege seria documentului.')
    if (f.sursa === 'intrare' && !f.legat) return setEroare('Alege Intrarea de la care pornește circuitul sau bifează „Document nou”.')
    if (lanseaza && f.semnatari.length === 0) return setEroare('Adaugă cel puțin un semnatar înainte de a trimite documentul la semnare.')
    setBusy(true)
    const payload = {
      obiect: f.obiect,
      tip_id: f.tip_id,
      mod_semnare: f.mod_semnare,
      resp_angajat_id: f.resp_angajat_id,
      resp_grup_id: f.resp_grup_id,
      legat_de: f.sursa === 'intrare' ? f.legat?.id || '' : '',
      ordine_semnare: f.ordine_semnare,
      locatie_hartie: f.mod_semnare === 'fizica' ? f.locatie_hartie : '',
    }
    let id = doc?.id
    let numar = doc?.numar_afisat
    let createdRow = null
    if (editare) {
      if (completare) payload.data_inreg = f.data_inreg
      const r = await supabase.rpc('sec_actualizeaza', { p_id: doc.id, p_date: payload })
      if (r.error) { setBusy(false); return setEroare(mesajEroare(r.error)) }
      if (completare && f.confidential) {
        const c = await supabase.rpc('sec_seteaza_confidential', { p_id: doc.id, p_conf: true, p_angajati: f.acces })
        if (c.error) setAvertisment({ id, mesaj: `Documentul a fost completat, dar marcajul „confidențial” nu a putut fi salvat: ${mesajEroare(c.error)}.` })
      }
    } else {
      payload.serie_id = f.serie_id
      payload.data_inreg = f.data_inreg
      payload.confidential = f.confidential
      payload.acces = f.confidential ? f.acces : []
      const r = await supabase.rpc('sec_inregistreaza', { p_registru: 'circuit', p_date: payload })
      if (r.error) { setBusy(false); return setEroare(mesajEroare(r.error)) }
      id = r.data.id
      createdRow = r.data
      numar = `${r.data.nr}/${r.data.an}`
    }
    // Pașii următori: dacă unul eșuează, documentul rămâne înregistrat (numărul a fost deja acordat)
    const s = await supabase.rpc('sec_circuit_semnatari', { p_doc: id, p_semnatari: f.semnatari, p_ordine: f.ordine_semnare })
    if (s.error) {
      setBusy(false)
      return setAvertisment({ id, mesaj: `Documentul a fost înregistrat ca ${numar}, dar semnatarii nu au putut fi salvați: ${mesajEroare(s.error)}` })
    }
    if (lanseaza) {
      const l = await supabase.rpc('sec_circuit_lanseaza', { p_doc: id })
      if (l.error) {
        setBusy(false)
        return setAvertisment({ id, mesaj: `Documentul ${numar} a fost salvat ca ciornă, dar nu a putut fi trimis la semnare: ${mesajEroare(l.error)}` })
      }
    }
    setBusy(false)
    onSalvat(id, { id, serie_id: f.serie_id || doc?.serie_id, nr: doc?.nr, an: doc?.an, ...(createdRow || {}) })
  }

  const tipuriActive = comune.tipuri.filter((t) => t.activ || t.id === f.tip_id)

  return (
    <form onSubmit={(e) => { e.preventDefault(); salveaza(false) }} className="space-y-4">
      {!esteStaff(role) && <Eroare>Nu ai dreptul să înregistrezi sau să modifici documente.</Eroare>}
      {!editare && prefill?.legat && <Info>Document pornit din Intrarea {prefill.legat.numar_afisat}. Poți alege altă Intrare mai jos.</Info>}
      {completare && <Info>Loc liber rezervat la {formatData(doc.data_inreg)}. Completează detaliile; numărul rămâne {doc.numar_afisat}.</Info>}
      {!editare && <Info>Documentul pornește ca Ciornă și ajunge „În lucru” când îl trimiți la semnare.</Info>}
      <Eroare>{eroare}</Eroare>
      {avertisment && (
        <div className="space-y-2">
          <Eroare>{avertisment.mesaj}</Eroare>
          <button type="button" className={btnGhost} onClick={() => onSalvat(avertisment.id)}>Deschide documentul</button>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {editare ? (
            <div>
              <label className={labelCls} htmlFor="serie_fix">Serie</label>
              <input id="serie_fix" className={inputCls} value={`${doc.serie_cod} — ${doc.serie_denumire}`} disabled />
            </div>
          ) : (
            <SerieSelect serii={comune.serii} valoare={f.serie_id} onChange={(v) => set('serie_id', v)} />
          )}
        </div>
        {(!editare || completare) && (
          <div className="max-w-xs">
            <label className={labelCls} htmlFor="data_inreg">Data înregistrării</label>
            <input id="data_inreg" type="date" className={inputCls} value={f.data_inreg} min={`${anCurent}-01-01`} max={azi()}
              onChange={(e) => set('data_inreg', e.target.value)} required />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="obiect">Obiect (rezumat scurt) *</label>
            <textarea id="obiect" rows={2} className={inputCls} value={f.obiect} onChange={(e) => set('obiect', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="tip">Tip document</label>
            <select id="tip" className={inputCls} value={f.tip_id} onChange={(e) => set('tip_id', e.target.value)}>
              <option value="">—</option>
              {tipuriActive.map((t) => <option key={t.id} value={t.id}>{t.denumire}</option>)}
            </select>
          </div>
          <RespPicker
            eticheta={info.resp}
            angajatId={f.resp_angajat_id}
            grupId={f.resp_grup_id}
            comune={comune}
            onChange={({ angajatId, grupId }) => setF((x) => ({ ...x, resp_angajat_id: angajatId, resp_grup_id: grupId }))}
          />
          <div className="space-y-2 md:col-span-2">
            <p className={labelCls}>Pornește de la</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[['intrare', 'O Intrare din registru', 'Circuitul rămâne legat de Intrare, iar titlul se preia din ea.'], ['nou', 'Document nou', 'Fără legătură cu o Intrare (document al instituției).']].map(([k, t, d]) => (
                <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${f.sursa === k ? 'border-accent bg-sky-50/50' : 'border-slate-200'}`}>
                  <input type="radio" name="sursa" className="mt-1" checked={f.sursa === k} onChange={() => set('sursa', k)} />
                  <span><strong className="block text-sm text-slate-800">{t}</strong><span className="text-[13px] text-slate-500">{d}</span></span>
                </label>
              ))}
            </div>
            {f.sursa === 'intrare' && (
              <>
                <DocPicker
                  eticheta="Alege Intrarea *"
                  registru="intrari"
                  faraCircuit
                  permiteId={doc?.legat_de || null}
                  valoare={f.legat}
                  onChange={(d) => setF((x) => ({ ...x, legat: d, obiect: d && !x.obiect.trim() ? d.obiect : x.obiect }))}
                />
                <p className="text-xs text-slate-500">O Intrare poate avea un singur circuit activ; cele care au deja unul nu apar în listă. Dacă circuitul este anulat, Intrarea poate primi altul.</p>
              </>
            )}
          </div>
          <div>
            <p className={labelCls}>Mod de semnare</p>
            <div className="space-y-1 text-sm text-slate-700">
              {Object.entries(MOD_SEMNARE).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="mod_semnare" checked={f.mod_semnare === k} onChange={() => set('mod_semnare', k)} /> {l}
                </label>
              ))}
            </div>
          </div>
          {f.mod_semnare === 'fizica' && (
            <div>
              <label className={labelCls} htmlFor="locatie">Locația documentului (hârtie)</label>
              <input id="locatie" className={inputCls} value={f.locatie_hartie} maxLength={200} onChange={(e) => set('locatie_hartie', e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Se actualizează automat când notezi că cineva a primit sau a semnat documentul. O poți schimba oricând (ex. „Trimis la biroul contabilității”).</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <SemnatariEditor valoare={f.semnatari} onChange={(v) => set('semnatari', v)} ordine={f.ordine_semnare} onOrdine={(o) => set('ordine_semnare', o)} comune={comune} />
      </div>

      {(!editare || completare) && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={f.confidential} onChange={(e) => set('confidential', e.target.checked)} /> Document confidențial
          </label>
          {f.confidential && (
            <>
              <p className="text-xs text-slate-500">Îl văd Secretariatul, Conducerea, Adminul Hub, inițiatorul, semnatarii și persoanele numite mai jos.</p>
              <AngajatiMulti eticheta="Persoane numite" valoare={f.acces} onChange={(v) => set('acces', v)} comune={comune} />
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnGhost} disabled={busy || !esteStaff(role) || !f.obiect.trim()}>
          {busy ? 'Se salvează…' : 'Salvează ca ciornă'}
        </button>
        <button type="button" className={btnPrimary} disabled={busy || !esteStaff(role) || !f.obiect.trim()} onClick={() => salveaza(true)}>
          Salvează și trimite la semnare
        </button>
        <button type="button" className={btnGhost} onClick={onRenunta}>Renunță</button>
      </div>
    </form>
  )
}
