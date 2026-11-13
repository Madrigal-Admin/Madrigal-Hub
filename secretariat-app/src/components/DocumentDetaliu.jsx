import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileOutput, Lock, Pencil, Send } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { ETICHETE_CAMPURI, FLUX, MOD_SEMNARE, REGISTRE, STATUSURI, esteStaff, veziTot } from '../lib/roluri'
import { formatData, formatDataOra, mesajEroare } from '../lib/util'
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Card, CasetaMotiv, Eroare, Info, ModSemnareBadge, StareBadge, Titlu, Valoare } from './comun'
import { AngajatiMulti } from './Pickere'
import Fisiere from './Fisiere'
import CircuitSectiune from './CircuitSectiune'
import StergereDocument from './StergereDocument'

function descriereJurnal(j, comune) {
  const d = j.detalii || {}
  switch (j.actiune) {
    case 'inregistrat':
      return 'Document înregistrat'
    case 'status':
      return `Status schimbat: ${STATUSURI[d.status?.de_la]?.label || d.status?.de_la} → ${STATUSURI[d.status?.la]?.label || d.status?.la}`
    case 'modificat': {
      const campuri = Object.keys(d).map((k) => ETICHETE_CAMPURI[k] || k)
      return `Modificat: ${campuri.join(', ')}`
    }
    case 'semnatari_stabiliti':
      return `Semnatari stabiliți (runda ${d.runda}): ${(d.semnatari || []).join(', ') || 'nimeni'}`
    case 'pas_semnare': {
      const verb = { primit: 'a primit documentul', semnat: 'a semnat', refuzat: 'a refuzat', inapoi: 'pas anulat' }[d.actiune] || d.actiune
      return `${d.semnatar}: ${verb}${d.data ? ` (${formatData(d.data)})` : ''}${d.observatii ? ` — ${d.observatii}` : ''}`
    }
    case 'relansat':
      return `Circuit relansat (runda ${d.runda})`
    case 'fisier_adaugat':
      return `Fișier adăugat (versiunea ${d.versiune}: ${d.nume})`
    case 'acces_confidential':
      return d.confidential ? `Marcat confidențial (${(d.persoane || []).length} persoane numite)` : 'Marcajul confidențial a fost scos'
    default:
      return j.actiune
  }
}

export default function DocumentDetaliu({ id, role, comune, onInapoi, onEdit, onDeschide, onNou }) {
  const [doc, setDoc] = useState(undefined) // undefined = se încarcă, null = nu există / fără acces
  const [fisiere, setFisiere] = useState([])
  const [jurnal, setJurnal] = useState(null)
  const [legat, setLegat] = useState(null)
  const [legaturi, setLegaturi] = useState([])
  const [iesiriCircuit, setIesiriCircuit] = useState([]) // Ieșirile create din acest document de Circuit
  const [circuitSursa, setCircuitSursa] = useState(null) // Circuitul din care provine această Ieșire
  const [acces, setAcces] = useState([])
  const [accesNou, setAccesNou] = useState([])
  const [confNou, setConfNou] = useState(false)
  const [eroare, setEroare] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [busy, setBusy] = useState(false)
  const [anuleaza, setAnuleaza] = useState(false)
  const [statusNou, setStatusNou] = useState('')
  const [rez, setRez] = useState(null) // { text, data } cât timp se editează rezoluția
  const [arataJurnal, setArataJurnal] = useState(false)

  const incarca = useCallback(async () => {
    const { data: d } = await supabase.from('sec_documente_lista').select('*').eq('id', id).maybeSingle()
    setDoc(d || null)
    if (!d) return
    const cereri = [
      supabase.from('sec_fisiere').select('*').eq('document_id', id).order('versiune', { ascending: false }),
      supabase.from('sec_documente_lista').select('id, registru, numar_afisat, obiect').eq('legat_de', id),
      supabase.from('sec_documente_lista').select('id, registru, numar_afisat, obiect, status').eq('circuit_id', id).order('created_at'),
    ]
    if (veziTot(role)) {
      cereri.push(supabase.from('sec_jurnal').select('*').eq('document_id', id).order('la', { ascending: false }))
      cereri.push(supabase.from('sec_confidential_acces').select('angajat_id').eq('document_id', id))
    }
    const [fis, leg, ies, jur, acc] = await Promise.all(cereri)
    setFisiere(fis.data || [])
    setLegaturi(leg.data || [])
    setIesiriCircuit(ies.data || [])
    if (jur) setJurnal(jur.data || [])
    if (acc) {
      const ids = (acc.data || []).map((x) => x.angajat_id)
      setAcces(ids)
      setAccesNou(ids)
    }
    setConfNou(d.confidential)
    if (d.circuit_id) {
      const { data: c } = await supabase.from('sec_documente_lista').select('id, registru, numar_afisat, obiect').eq('id', d.circuit_id).maybeSingle()
      setCircuitSursa(c || { id: null, numar_afisat: 'Document la care nu ai acces', obiect: '' })
    } else {
      setCircuitSursa(null)
    }
    if (d.legat_de) {
      const { data: l } = await supabase.from('sec_documente_lista').select('id, registru, numar_afisat, obiect').eq('id', d.legat_de).maybeSingle()
      setLegat(l || { id: null, numar_afisat: 'Document la care nu ai acces', obiect: '' })
    } else {
      setLegat(null)
    }
  }, [id, role])

  useEffect(() => {
    incarca()
  }, [incarca])

  async function ruleaza(actiune, ok) {
    setEroare('')
    setMesaj('')
    setBusy(true)
    const { error } = await actiune()
    setBusy(false)
    if (error) return setEroare(mesajEroare(error))
    if (ok) setMesaj(ok)
    await incarca()
  }

  if (doc === undefined) return <p className="text-sm text-slate-500">Se încarcă…</p>
  if (doc === null) {
    return (
      <div className="space-y-4">
        <button className={btnGhost} onClick={onInapoi}><ArrowLeft size={14} /> Înapoi la registru</button>
        <Eroare>Documentul nu există sau nu ai acces la el.</Eroare>
      </div>
    )
  }

  const info = REGISTRE[doc.registru] || REGISTRE.intrari
  const staff = esteStaff(role)
  const activ = !['anulat', 'arhivat'].includes(doc.status)
  const numeAng = (aid) => comune.angajati.find((a) => a.id === aid)?.nume_complet
  const numeGrup = (gid) => comune.grupuri.find((g) => g.id === gid)?.nume
  const resp = [numeAng(doc.resp_angajat_id), numeGrup(doc.resp_grup_id)].filter(Boolean).join(' · ')
  const circuit = doc.registru === 'circuit'
  const poateRezolutie = doc.registru === 'intrari' && (staff || role === 'conducere') && activ
  const angajatPoateLucra = role === 'angajat' && doc.registru === 'intrari' && ['repartizat', 'in_lucru'].includes(doc.status)
  // Din Intrare → Circuit de semnare (documentul de semnat este răspunsul la această Intrare)
  const trimiteLaSemnare = () =>
    onNou('circuit', {
      legat: { id: doc.id, numar_afisat: doc.numar_afisat, obiect: doc.obiect },
      obiect: doc.obiect,
      tip_id: doc.tip_id || '',
      resp_angajat_id: doc.resp_angajat_id || '',
      resp_grup_id: doc.resp_grup_id || '',
    })
  // Din Circuit finalizat → Ieșire nouă (se pot crea oricâte); fișierul semnat se copiază la salvare
  async function creazaIesire() {
    setEroare('')
    let contact = null
    if (doc.legat_de) {
      const { data: i } = await supabase.from('sec_documente_lista').select('contact_id, contact_denumire').eq('id', doc.legat_de).maybeSingle()
      if (i?.contact_id) contact = { id: i.contact_id, denumire: i.contact_denumire }
    }
    const curent = fisiere.find((x) => x.curenta)
    onNou('iesiri', {
      circuit: { id: doc.id, numar_afisat: doc.numar_afisat },
      legat: legat?.id ? { id: legat.id, numar_afisat: legat.numar_afisat, obiect: legat.obiect } : null,
      contact,
      obiect: doc.obiect,
      tip_id: doc.tip_id || '',
      mod_semnare: doc.mod_semnare,
      resp_angajat_id: doc.resp_angajat_id || '',
      resp_grup_id: doc.resp_grup_id || '',
      confidential: doc.confidential,
      fisier: curent ? { path: curent.path, nume: curent.nume_original } : null,
    })
  }
  const schimba = (status) => ruleaza(() => supabase.rpc('sec_schimba_status', { p_id: doc.id, p_status: status }), 'Statusul a fost actualizat.')

  return (
    <div className="space-y-4">
      <button className={btnGhost} onClick={onInapoi}><ArrowLeft size={14} /> Înapoi la registru</button>

      <Titlu
        actiuni={
          <>
            {staff && doc.registru === 'intrari' && doc.status !== 'anulat' && (
              <button className={btnPrimary} onClick={trimiteLaSemnare}><Send size={14} /> Trimite la semnare</button>
            )}
            {staff && circuit && doc.status === 'semnat' && (
              <button className={btnPrimary} onClick={creazaIesire}><FileOutput size={14} /> Înregistrează în Ieșiri</button>
            )}
            {staff && activ && (!circuit || doc.status === 'ciorna') && (
              <button className={btnGhost} onClick={() => onEdit(doc)}><Pencil size={14} /> Modifică</button>
            )}
          </>
        }
      >
        <span className="mr-2">{doc.numar_afisat}</span>
        <StareBadge stare={doc.status} />
        {circuit && <span className="ml-2 align-middle"><ModSemnareBadge mod={doc.mod_semnare} /></span>}
        {doc.confidential && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 align-middle text-xs font-medium text-white">
            <Lock size={11} /> Confidențial
          </span>
        )}
      </Titlu>

      {doc.status === 'anulat' && (
        <Eroare>
          Document anulat{doc.anulat_la ? ` la ${formatDataOra(doc.anulat_la)}` : ''}. Motiv: {doc.motiv_anulare}. Numărul rămâne în registru.
        </Eroare>
      )}
      <Eroare>{eroare}</Eroare>
      {mesaj && <Info>{mesaj}</Info>}

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Valoare eticheta="Data înregistrării">{formatData(doc.data_inreg)}</Valoare>
          {!circuit && <Valoare eticheta={info.contact}>{doc.contact_denumire}</Valoare>}
          {doc.registru === 'intrari' && <Valoare eticheta="Document primit">{[doc.nr_document_extern, doc.data_document && `din ${formatData(doc.data_document)}`].filter(Boolean).join(' ')}</Valoare>}
          <div className="sm:col-span-2 lg:col-span-3"><Valoare eticheta="Obiect"><span className="whitespace-pre-wrap">{doc.obiect}</span></Valoare></div>
          {!circuit && <Valoare eticheta={info.canal}>{doc.canal_denumire}</Valoare>}
          <Valoare eticheta="Tip document">{doc.tip_denumire}</Valoare>
          <Valoare eticheta="Mod de semnare">{MOD_SEMNARE[doc.mod_semnare]}</Valoare>
          <Valoare eticheta={info.resp}>{resp}</Valoare>
          {doc.registru === 'iesiri' && <Valoare eticheta="Semnatar">{numeAng(doc.semnatar_id)}</Valoare>}
          {doc.registru === 'iesiri' && <Valoare eticheta="Data transmiterii efective">{formatData(doc.data_transmitere)}</Valoare>}
          {doc.registru === 'intrari' && <Valoare eticheta="Termen de răspuns">{formatData(doc.termen_raspuns)}</Valoare>}
          <Valoare eticheta="Înregistrat de">{numeAng(doc.creat_de)}</Valoare>
        </div>

        {(legat || circuitSursa || legaturi.length > 0 || iesiriCircuit.length > 0) && (
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
            {legat && (
              <p>
                <span className="text-xs font-medium text-slate-500">Legat de: </span>
                {legat.id ? (
                  <button className="font-semibold text-accent hover:underline" onClick={() => onDeschide(legat.registru, legat.id)}>{legat.numar_afisat}</button>
                ) : <span className="text-slate-500">{legat.numar_afisat}</span>}
                {legat.obiect && <span className="text-slate-500"> — {legat.obiect}</span>}
              </p>
            )}
            {circuitSursa && (
              <p>
                <span className="text-xs font-medium text-slate-500">Creat din documentul semnat: </span>
                {circuitSursa.id ? (
                  <button className="font-semibold text-accent hover:underline" onClick={() => onDeschide('circuit', circuitSursa.id)}>{circuitSursa.numar_afisat}</button>
                ) : <span className="text-slate-500">{circuitSursa.numar_afisat}</span>}
                {circuitSursa.obiect && <span className="text-slate-500"> — {circuitSursa.obiect}</span>}
              </p>
            )}
            {iesiriCircuit.map((l) => (
              <p key={l.id}>
                <span className="text-xs font-medium text-slate-500">Înregistrat în Ieșiri ca: </span>
                <button className="font-semibold text-accent hover:underline" onClick={() => onDeschide('iesiri', l.id)}>{l.numar_afisat}</button>
                <span className="text-slate-500"> — {l.obiect}</span>
              </p>
            ))}
            {legaturi.filter((l) => !iesiriCircuit.some((x) => x.id === l.id)).map((l) => (
              <p key={l.id}>
                <span className="text-xs font-medium text-slate-500">Document legat: </span>
                <button className="font-semibold text-accent hover:underline" onClick={() => onDeschide(l.registru, l.id)}>{l.numar_afisat}</button>
                <span className="text-slate-500"> — {l.obiect}</span>
              </p>
            ))}
          </div>
        )}
      </Card>

      {circuit && <CircuitSectiune doc={doc} role={role} comune={comune} fisiere={fisiere} reload={incarca} />}

      {/* Acțiuni de status */}
      {(staff && doc.status !== 'anulat') || angajatPoateLucra ? (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">{circuit ? 'Anulare' : 'Status'}</h3>
          {angajatPoateLucra && (
            <div className="flex flex-wrap gap-2">
              {doc.status === 'repartizat' && <button className={btnPrimary} disabled={busy} onClick={() => schimba('in_lucru')}>Preiau în lucru</button>}
              <button className={btnGhost} disabled={busy} onClick={() => schimba('solutionat')}>Marchează soluționat</button>
            </div>
          )}
          {staff && (
            <div className="flex flex-wrap items-end gap-2">
              {!circuit && (<>
              <div>
                <label className={labelCls} htmlFor="statusNou">Schimbă statusul în</label>
                <select id="statusNou" className={inputCls} value={statusNou} onChange={(e) => setStatusNou(e.target.value)}>
                  <option value="">Alege…</option>
                  {FLUX[doc.registru].filter((s) => s !== doc.status).map((s) => <option key={s} value={s}>{STATUSURI[s].label}</option>)}
                </select>
              </div>
              <button className={btnPrimary} disabled={!statusNou || busy} onClick={async () => { await schimba(statusNou); setStatusNou('') }}>Schimbă</button>
              </>)}
              <button className={btnDanger} disabled={busy} onClick={() => setAnuleaza(true)}>Anulează documentul</button>
            </div>
          )}
          {anuleaza && (
            <CasetaMotiv
              titlu="Anularea păstrează numărul în registru, marcat „Anulat”. Nu se poate desface."
              eticheta="Motivul anulării (ex. dublură, înregistrat din greșeală)"
              busy={busy}
              onRenunta={() => setAnuleaza(false)}
              onConfirma={async (motiv) => {
                await ruleaza(() => supabase.rpc('sec_schimba_status', { p_id: doc.id, p_status: 'anulat', p_motiv: motiv }), 'Documentul a fost anulat.')
                setAnuleaza(false)
              }}
            />
          )}
        </Card>
      ) : null}

      {/* Rezoluția conducerii (Intrări) */}
      {doc.registru === 'intrari' && (doc.rezolutie || poateRezolutie) && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Rezoluția conducerii</h3>
            {poateRezolutie && !rez && (
              <button className={btnGhost} onClick={() => setRez({ text: doc.rezolutie || '', data: doc.rezolutie_data || '' })}>
                {doc.rezolutie ? 'Modifică' : 'Adaugă rezoluție'}
              </button>
            )}
          </div>
          {rez ? (
            <div className="space-y-2">
              <textarea rows={3} className={inputCls} value={rez.text} onChange={(e) => setRez({ ...rez, text: e.target.value })} />
              <div className="max-w-xs">
                <label className={labelCls} htmlFor="rez_data">Data rezoluției</label>
                <input id="rez_data" type="date" className={inputCls} value={rez.data} onChange={(e) => setRez({ ...rez, data: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button className={btnPrimary} disabled={busy}
                  onClick={async () => {
                    await ruleaza(() => supabase.rpc('sec_actualizeaza', { p_id: doc.id, p_date: { rezolutie: rez.text, rezolutie_data: rez.data } }), 'Rezoluția a fost salvată.')
                    setRez(null)
                  }}>Salvează</button>
                <button className={btnGhost} onClick={() => setRez(null)}>Renunță</button>
              </div>
            </div>
          ) : doc.rezolutie ? (
            <p className="whitespace-pre-wrap text-sm text-slate-800">
              {doc.rezolutie}
              {doc.rezolutie_data && <span className="block text-xs text-slate-500">din {formatData(doc.rezolutie_data)}</span>}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Nicio rezoluție înregistrată.</p>
          )}
        </Card>
      )}

      <Fisiere doc={doc} fisiere={fisiere} poateIncarca={staff} comune={comune} reload={incarca} />

      {/* Confidențial (doar Secretariat / Admin) */}
      {staff && activ && (
        <Card className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Confidențialitate</h3>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={confNou} onChange={(e) => setConfNou(e.target.checked)} /> Document confidențial
          </label>
          {confNou && (
            <>
              <p className="text-xs text-slate-500">
                Îl văd Secretariatul, Conducerea, Adminul Hub, persoana repartizată/inițiatoare și semnatarul, plus persoanele numite mai jos. Un șef de departament nu îl vede decât dacă este numit.
              </p>
              <AngajatiMulti eticheta="Persoane numite" valoare={accesNou} onChange={setAccesNou} comune={comune} />
            </>
          )}
          <button className={btnPrimary} disabled={busy || (confNou === doc.confidential && JSON.stringify([...accesNou].sort()) === JSON.stringify([...acces].sort()))}
            onClick={() => ruleaza(() => supabase.rpc('sec_seteaza_confidential', { p_id: doc.id, p_conf: confNou, p_angajati: confNou ? accesNou : [] }), 'Setările de confidențialitate au fost salvate.')}>
            Salvează
          </button>
        </Card>
      )}

      {/* Ștergere definitivă (doar Admin Hub) */}
      {role === 'admin' && <StergereDocument doc={doc} onSters={onInapoi} />}

      {/* Jurnal (Secretariat / Conducere / Admin) */}
      {veziTot(role) && (
        <Card className="space-y-2">
          <button className={btnGhost} onClick={() => setArataJurnal((v) => !v)}>
            {arataJurnal ? 'Ascunde jurnalul' : 'Jurnal de modificări'}
          </button>
          {arataJurnal && (
            <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {(jurnal || []).map((j) => (
                <li key={j.id}>
                  <span className="text-slate-400">{formatDataOra(j.la)}</span> · {descriereJurnal(j, comune)}
                  {j.angajat_id ? ` · ${numeAng(j.angajat_id) || 'angajat șters'}` : ''}
                </li>
              ))}
              {jurnal && jurnal.length === 0 && <li>Nicio intrare în jurnal.</li>}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
