import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { MOD_SEMNARE, REGISTRE, esteStaff } from '../lib/roluri'
import { azi, mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Card, Eroare, Info, Titlu } from './comun'
import { AngajatiMulti, ContactPicker, DocPicker, RespPicker } from './Pickere'

const FARA_NUMAR = 'fără număr'

// Formular de înregistrare (doc = null) sau de modificare (doc = documentul existent).
export default function DocumentForm({ registru, doc, role, comune, onSalvat, onRenunta }) {
  const info = REGISTRE[registru]
  const editare = !!doc
  const intrari = registru === 'intrari'
  const [f, setF] = useState(() => ({
    data_inreg: azi(),
    data_document: doc?.data_document || '',
    nr_document_extern: doc?.nr_document_extern || '',
    fara_numar: doc?.nr_document_extern === FARA_NUMAR,
    contact: doc?.contact_id ? { id: doc.contact_id, denumire: doc.contact_denumire } : null,
    obiect: doc?.obiect || '',
    canal_id: doc?.canal_id || '',
    tip_id: doc?.tip_id || '',
    mod_semnare: doc?.mod_semnare || 'fizica',
    resp_angajat_id: doc?.resp_angajat_id || '',
    resp_grup_id: doc?.resp_grup_id || '',
    semnatar_id: doc?.semnatar_id || '',
    data_transmitere: doc?.data_transmitere || '',
    termen_raspuns: doc?.termen_raspuns || '',
    legat: null,
    confidential: false,
    acces: [],
  }))
  const [eroare, setEroare] = useState('')
  const [busy, setBusy] = useState(false)

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
      res = await supabase.rpc('sec_actualizeaza', { p_id: doc.id, p_date: payload })
    } else {
      payload.data_inreg = f.data_inreg
      payload.confidential = f.confidential
      payload.acces = f.confidential ? f.acces : []
      res = await supabase.rpc('sec_inregistreaza', { p_registru: registru, p_date: payload })
    }
    setBusy(false)
    if (res.error) return setEroare(mesajEroare(res.error))
    onSalvat(res.data.id)
  }

  const canaleActive = comune.canale.filter((c) => c.activ || c.id === f.canal_id)
  const tipuriActive = comune.tipuri.filter((t) => t.activ || t.id === f.tip_id)
  const activi = comune.angajati.filter((a) => a.activ || a.id === f.semnatar_id)

  return (
    <form onSubmit={salveaza} className="space-y-4">
      <Titlu>{editare ? `Modificare ${doc.numar_afisat}` : info.nou}</Titlu>
      {!esteStaff(role) && <Eroare>Nu ai dreptul să înregistrezi sau să modifici documente.</Eroare>}
      {!editare && (
        <Info>Numărul se acordă automat la salvare. După înregistrare poți încărca scanul documentului.</Info>
      )}
      <Eroare>{eroare}</Eroare>

      <Card className="space-y-4">
        {!editare && (
          <div className="max-w-xs">
            <label className={labelCls} htmlFor="data_inreg">Data înregistrării</label>
            <input id="data_inreg" type="date" className={inputCls} value={f.data_inreg} min={`${anCurent}-01-01`} max={azi()}
              onChange={(e) => set('data_inreg', e.target.value)} required />
            <p className="mt-1 text-xs text-slate-500">Implicit azi. Poți pune o dată din trecut (din anul curent) pentru un document primit mai demult.</p>
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

        {!editare && (
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
      </Card>

      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={busy || !esteStaff(role)}>{editare ? 'Salvează modificările' : 'Înregistrează'}</button>
        <button type="button" className={btnGhost} onClick={onRenunta}>Renunță</button>
      </div>
    </form>
  )
}
