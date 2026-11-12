import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { MOD_SEMNARE, REGISTRE, esteStaff } from '../lib/roluri'
import { azi, mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Card, Eroare, Info, Titlu } from './comun'
import { AngajatiMulti, DocPicker, RespPicker } from './Pickere'
import SemnatariEditor from './SemnatariEditor'

// Formular pentru un document din Circuitul de semnare: înregistrare nouă (doc = null) sau modificare în Ciornă.
export default function CircuitForm({ doc, prefill, role, comune, onSalvat, onRenunta }) {
  const info = REGISTRE.circuit
  const editare = !!doc
  const [f, setF] = useState(() => ({
    data_inreg: azi(),
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
    if (lanseaza && f.semnatari.length === 0) return setEroare('Adaugă cel puțin un semnatar înainte de a trimite documentul la semnare.')
    setBusy(true)
    const payload = {
      obiect: f.obiect,
      tip_id: f.tip_id,
      mod_semnare: f.mod_semnare,
      resp_angajat_id: f.resp_angajat_id,
      resp_grup_id: f.resp_grup_id,
      legat_de: f.legat?.id || '',
      ordine_semnare: f.ordine_semnare,
      locatie_hartie: f.mod_semnare === 'fizica' ? f.locatie_hartie : '',
    }
    let id = doc?.id
    let numar = doc?.numar_afisat
    if (editare) {
      const r = await supabase.rpc('sec_actualizeaza', { p_id: doc.id, p_date: payload })
      if (r.error) { setBusy(false); return setEroare(mesajEroare(r.error)) }
    } else {
      payload.data_inreg = f.data_inreg
      payload.confidential = f.confidential
      payload.acces = f.confidential ? f.acces : []
      const r = await supabase.rpc('sec_inregistreaza', { p_registru: 'circuit', p_date: payload })
      if (r.error) { setBusy(false); return setEroare(mesajEroare(r.error)) }
      id = r.data.id
      numar = `CS ${r.data.nr}/${r.data.an}`
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
    onSalvat(id)
  }

  const tipuriActive = comune.tipuri.filter((t) => t.activ || t.id === f.tip_id)

  return (
    <form onSubmit={(e) => { e.preventDefault(); salveaza(false) }} className="space-y-4">
      <Titlu>{editare ? `Modificare ${doc.numar_afisat}` : info.nou}</Titlu>
      {!esteStaff(role) && <Eroare>Nu ai dreptul să înregistrezi sau să modifici documente.</Eroare>}
      {!editare && prefill?.legat && <Info>Document pornit din Intrarea {prefill.legat.numar_afisat}. Poți schimba sau șterge legătura mai jos.</Info>}
      {!editare && <Info>Numărul (CS) se acordă automat la salvare. Documentul pornește ca Ciornă și ajunge „În lucru” când îl trimiți la semnare.</Info>}
      <Eroare>{eroare}</Eroare>
      {avertisment && (
        <div className="space-y-2">
          <Eroare>{avertisment.mesaj}</Eroare>
          <button type="button" className={btnGhost} onClick={() => onSalvat(avertisment.id)}>Deschide documentul</button>
        </div>
      )}

      <Card className="space-y-4">
        {!editare && (
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
          <div className="md:col-span-2">
            <DocPicker
              eticheta="Legat de o Intrare (opțional) — pentru un document nou al instituției, lasă gol"
              registru="intrari"
              valoare={f.legat}
              onChange={(d) => set('legat', d)}
            />
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
      </Card>

      <Card>
        <SemnatariEditor valoare={f.semnatari} onChange={(v) => set('semnatari', v)} ordine={f.ordine_semnare} onOrdine={(o) => set('ordine_semnare', o)} comune={comune} />
      </Card>

      {!editare && (
        <Card className="space-y-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={f.confidential} onChange={(e) => set('confidential', e.target.checked)} /> Document confidențial
          </label>
          {f.confidential && (
            <>
              <p className="text-xs text-slate-500">Îl văd Secretariatul, Conducerea, Adminul Hub, inițiatorul, semnatarii și persoanele numite mai jos.</p>
              <AngajatiMulti eticheta="Persoane numite" valoare={f.acces} onChange={(v) => set('acces', v)} comune={comune} />
            </>
          )}
        </Card>
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
