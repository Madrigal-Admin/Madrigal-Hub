import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { MOD_SEMNARE, REGISTRE, esteStaff } from '../lib/roluri'
import { azi, formatData, mesajEroare } from '../lib/util'
import { BUCKET } from '../lib/fisiere'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Eroare, Info } from './comun'
import { SerieSelect } from './Serii'
import { AngajatiMulti, ContactPicker, DocPicker, RespPicker } from './Pickere'

const FARA_NUMAR = 'fără număr'

// Formular de înregistrare (doc = null) sau de modificare (doc = documentul existent).
export default function DocumentForm({ registru, doc, prefill, serieImplicita, role, comune, onSalvat, onRenunta }) {
  const info = REGISTRE[registru]
  const editare = !!doc
  const completare = doc?.status === 'liber' // loc liber rezervat, care se completează acum
  const intrari = registru === 'intrari'
  const [f, setF] = useState(() => ({
    serie_id: doc?.serie_id || prefill?.serie_id || serieImplicita || '',
    data_inreg: completare ? doc.data_inreg : azi(),
    data_document: doc?.data_document || '',
    nr_document_extern: doc?.nr_document_extern || '',
    fara_numar: doc?.nr_document_extern === FARA_NUMAR,
    contact: doc?.contact_id ? { id: doc.contact_id, denumire: doc.contact_denumire } : prefill?.contact || null,
    obiect: doc?.obiect || prefill?.obiect || '',
    canal_id: doc?.canal_id || '',
    tip_id: doc?.tip_id || prefill?.tip_id || '',
    mod_semnare: doc?.mod_semnare || prefill?.mod_semnare || 'fizica',
    resp_angajat_id: doc?.resp_angajat_id || prefill?.resp_angajat_id || '',
    resp_grup_id: doc?.resp_grup_id || prefill?.resp_grup_id || '',
    semnatar_id: doc?.semnatar_id || '',
    data_transmitere: doc?.data_transmitere || '',
    termen_raspuns: doc?.termen_raspuns || '',
    legat: prefill?.legat || null,
    confidential: prefill?.confidential || false,
    acces: [],
  }))
  const [eroare, setEroare] = useState('')
  const [busy, setBusy] = useState(false)
  const [avertisment, setAvertisment] = useState(null) // { id, mesaj }
  const circuit = prefill?.circuit || null // documentul din Circuit din care se creează Ieșirea

  // Documentul la care e legat (dacă există), pentru afișare
  useEffect(() => {
    if (!doc?.legat_de) return
    supabase.from('sec_documente_lista').select('id, numar_afisat, obiect').eq('id', doc.legat_de).maybeSingle()
      .then(({ data }) => setF((v) => ({ ...v, legat: data || { id: doc.legat_de, numar_afisat: '(document la care nu ai acces)', obiect: '' } })))
  }, [doc?.legat_de])

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const anCurent = new Date().getFullYear()

  async function salveaza(e) {
    e.preventDefault()
    setEroare('')
    if (!editare && !f.serie_id) return setEroare('Alege seria documentului.')
    setBusy(true)
    const payload = {
      contact_id: f.contact?.id || '',
      obiect: f.obiect,
      canal_id: f.canal_id,
      tip_id: f.tip_id,
      mod_semnare: f.mod_semnare,
      resp_angajat_id: f.resp_angajat_id,
      resp_grup_id: f.resp_grup_id,
      legat_de: f.legat?.id || '',
    }
    if (intrari) {
      payload.data_document = f.data_document
      payload.nr_document_extern = f.fara_numar ? FARA_NUMAR : f.nr_document_extern
      payload.termen_raspuns = f.termen_raspuns
    } else {
      payload.semnatar_id = f.semnatar_id
      payload.data_transmitere = f.data_transmitere
    }
    let res
    if (editare) {
      if (completare) payload.data_inreg = f.data_inreg
      res = await supabase.rpc('sec_actualizeaza', { p_id: doc.id, p_date: payload })
      if (!res.error && completare && f.confidential) {
        const c = await supabase.rpc('sec_seteaza_confidential', { p_id: doc.id, p_conf: true, p_angajati: f.acces })
        if (c.error) {
          setBusy(false)
          return setAvertisment({ id: doc.id, mesaj: `Documentul a fost completat, dar marcajul „confidențial” nu a putut fi salvat: ${mesajEroare(c.error)}. Deschide documentul și setează-l din secțiunea Confidențialitate.` })
        }
      }
    } else {
      payload.serie_id = f.serie_id
      payload.data_inreg = f.data_inreg
      payload.confidential = f.confidential
      payload.acces = f.confidential ? f.acces : []
      if (circuit) payload.circuit_id = circuit.id
      res = await supabase.rpc('sec_inregistreaza', { p_registru: registru, p_date: payload })
    }
    if (res.error) { setBusy(false); return setEroare(mesajEroare(res.error)) }
    // Ieșire creată din Circuit: se copiază fișierul semnat (originalul rămâne neatins la documentul din Circuit)
    if (!editare && circuit && prefill?.fisier) {
      const nou = res.data
      const ext = (prefill.fisier.path.split('.').pop() || 'pdf').toLowerCase()
      const dest = `${nou.id}/${crypto.randomUUID()}.${ext}`
      const c = await supabase.storage.from(BUCKET).copy(prefill.fisier.path, dest)
      const v = c.error ? c : await supabase.rpc('sec_adauga_versiune', { p_doc: nou.id, p_path: dest, p_nume: prefill.fisier.nume })
      if (v.error) {
        setBusy(false)
        return setAvertisment({ id: nou.id, mesaj: `Ieșirea a fost înregistrată (${nou.nr}/${nou.an}), dar fișierul semnat nu a putut fi copiat: ${mesajEroare(v.error)}. Deschide documentul și încarcă fișierul manual.` })
      }
    }
    setBusy(false)
    onSalvat(res.data.id, res.data)
  }

  const canaleActive = comune.canale.filter((c) => c.activ || c.id === f.canal_id)
  const tipuriActive = comune.tipuri.filter((t) => t.activ || t.id === f.tip_id)
  const activi = comune.angajati.filter((a) => a.activ || a.id === f.semnatar_id)

  return (
    <form onSubmit={salveaza} className="space-y-4">
      {!esteStaff(role) && <Eroare>Nu ai dreptul să înregistrezi sau să modifici documente.</Eroare>}
      {completare && (
        <Info>Loc liber rezervat la {formatData(doc.data_inreg)}. Completează detaliile documentului; numărul rămâne {doc.numar_afisat}.</Info>
      )}
      {circuit && (
        <Info>
          Ieșire creată din documentul semnat {circuit.numar_afisat}.{prefill.fisier ? ' Fișierul semnat se copiază automat în această Ieșire la salvare.' : ' Documentul din Circuit nu are fișier încărcat, deci nu se copiază nimic.'}
        </Info>
      )}
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
            <p className="mt-1 text-xs text-slate-500">Implicit azi. Poți pune o dată din trecut (din anul curent).</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <ContactPicker eticheta={info.contact} valoare={f.contact} onChange={(c) => set('contact', c)} poateAdauga />

          {intrari && (
            <div>
              <label className={labelCls} htmlFor="nr_ext">Număr document primit *</label>
              <input id="nr_ext" className={inputCls} value={f.fara_numar ? FARA_NUMAR : f.nr_document_extern} disabled={f.fara_numar}
                onChange={(e) => set('nr_document_extern', e.target.value)} />
              <label className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={f.fara_numar} onChange={(e) => set('fara_numar', e.target.checked)} /> Documentul nu are număr
              </label>
            </div>
          )}
          {intrari && (
            <div>
              <label className={labelCls} htmlFor="data_doc">Data documentului primit *</label>
              <input id="data_doc" type="date" className={inputCls} value={f.data_document} max={azi()} onChange={(e) => set('data_document', e.target.value)} />
            </div>
          )}

          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="obiect">Obiect (rezumat scurt) *</label>
            <textarea id="obiect" rows={2} className={inputCls} value={f.obiect} onChange={(e) => set('obiect', e.target.value)} />
          </div>

          <div>
            <label className={labelCls} htmlFor="canal">{info.canal} *</label>
            <select id="canal" className={inputCls} value={f.canal_id} onChange={(e) => set('canal_id', e.target.value)}>
              <option value="">Alege…</option>
              {canaleActive.map((c) => <option key={c.id} value={c.id}>{c.denumire}</option>)}
            </select>
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

          {intrari ? (
            <div>
              <label className={labelCls} htmlFor="termen">Termen de răspuns (opțional)</label>
              <input id="termen" type="date" className={inputCls} value={f.termen_raspuns} onChange={(e) => set('termen_raspuns', e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls} htmlFor="semnatar">Semnatar (opțional)</label>
                <select id="semnatar" className={inputCls} value={f.semnatar_id} onChange={(e) => set('semnatar_id', e.target.value)}>
                  <option value="">—</option>
                  {activi.map((a) => <option key={a.id} value={a.id}>{a.nume_complet}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="data_tr">Data transmiterii efective (opțional)</label>
                <input id="data_tr" type="date" className={inputCls} value={f.data_transmitere} onChange={(e) => set('data_transmitere', e.target.value)} />
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <DocPicker
              eticheta={intrari ? 'Legătură cu alt document (opțional)' : 'Răspuns la o intrare / legătură cu alt document (opțional)'}
              valoare={f.legat}
              onChange={(d) => set('legat', d)}
              excludeId={doc?.id}
            />
          </div>
        </div>

        {(!editare || completare) && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={f.confidential} onChange={(e) => set('confidential', e.target.checked)} /> Document confidențial
            </label>
            {f.confidential && (
              <>
                <p className="text-xs text-slate-500">
                  Îl văd Secretariatul, Conducerea, Adminul Hub, persoana repartizată și semnatarul, plus cei numiți mai jos.
                </p>
                <AngajatiMulti eticheta="Persoane numite" valoare={f.acces} onChange={(v) => set('acces', v)} comune={comune} />
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={busy || !esteStaff(role)}>{completare ? 'Completează' : editare ? 'Salvează modificările' : 'Salvează'}</button>
        <button type="button" className={btnGhost} onClick={onRenunta}>Renunță</button>
      </div>
    </form>
  )
}
