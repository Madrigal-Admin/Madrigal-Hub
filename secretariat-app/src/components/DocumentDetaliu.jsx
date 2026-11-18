import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, FileOutput, Lock, Pencil, Send } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { ETICHETE_CAMPURI, MOD_SEMNARE, ORDINE_SEMNARE, REGISTRE, STATUSURI, esteStaff, veziTot } from '../lib/roluri'
import { formatData, formatDataOra, mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { CasetaMotiv, Eroare, Info, Linie, ModSemnareBadge, PanouLateral, PasiStare, Rand, Sectiune, StareBadge } from './comun'
import { AngajatiMulti } from './Pickere'
import Fisiere from './Fisiere'
import { CircuitLocatie, CircuitSemnatari, useCircuit } from './CircuitSectiune'
import StergereDocument from './StergereDocument'

const PASI_FLUX = {
  intrari: ['inregistrat', 'repartizat', 'in_lucru', 'solutionat'],
  iesiri: ['inregistrat', 'transmis'],
}
const NUME_REGISTRU = { intrari: 'Intrare', iesiri: 'Ieșire', circuit: 'Circuit de semnare' }
const linkCls = 'text-sm font-semibold text-accent hover:underline focus-ring'

function descriereJurnal(j) {
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

// Câte zile mai sunt până la termen (negativ = depășit)
function zileLaTermen(termen) {
  if (!termen) return null
  const t = new Date(`${termen}T12:00:00`)
  const azi = new Date()
  azi.setHours(12, 0, 0, 0)
  return Math.round((t - azi) / 86400000)
}
function textTermen(zile) {
  if (zile === 0) return 'astăzi'
  if (zile === 1) return 'mâine'
  if (zile > 1) return `în ${zile} zile`
  if (zile === -1) return 'depășit cu o zi'
  return `depășit cu ${-zile} zile`
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

  const incarca = useCallback(async () => {
    const { data: d } = await supabase.from('sec_documente_lista').select('*').eq('id', id).maybeSingle()
    setDoc(d || null)
    if (!d) return
    const cereri = [
      supabase.from('sec_fisiere').select('*').eq('document_id', id).order('versiune', { ascending: false }),
      supabase.from('sec_documente_lista').select('id, registru, numar_afisat, obiect, status').eq('legat_de', id),
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
    if (acc) setAcces((acc.data || []).map((x) => x.angajat_id))
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

  if (doc === undefined) return <p className="text-sm text-slate-500">Se încarcă…</p>
  if (doc === null) {
    return (
      <div className="space-y-4">
        <button className={btnGhost} onClick={onInapoi}><ArrowLeft size={14} /> Înapoi la registru</button>
        <Eroare>Documentul nu există sau nu ai acces la el.</Eroare>
      </div>
    )
  }
  if (doc.status === 'liber') {
    return (
      <div className="space-y-4">
        <button className={btnGhost} onClick={onInapoi}><ArrowLeft size={14} /> Înapoi la registru</button>
        <h2 className="text-[28px] font-extrabold tracking-tight text-slate-900">{doc.numar_afisat}</h2>
        <Info>Acesta este un loc liber, rezervat la {formatData(doc.data_inreg)}. Nu conține încă niciun document.</Info>
        {esteStaff(role) && <button className={btnPrimary} onClick={() => onEdit(doc)}><Pencil size={14} /> Completează</button>}
      </div>
    )
  }
  return (
    <Pagina
      doc={doc} fisiere={fisiere} jurnal={jurnal} legat={legat} legaturi={legaturi} iesiriCircuit={iesiriCircuit} circuitSursa={circuitSursa} acces={acces}
      role={role} comune={comune} incarca={incarca} onInapoi={onInapoi} onEdit={onEdit} onDeschide={onDeschide} onNou={onNou}
    />
  )
}

function Pagina({ doc, fisiere, jurnal, legat, legaturi, iesiriCircuit, circuitSursa, acces, role, comune, incarca, onInapoi, onEdit, onDeschide, onNou }) {
  const [eroare, setEroare] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [busy, setBusy] = useState(false)
  const [anuleaza, setAnuleaza] = useState(false)
  const [arataJurnal, setArataJurnal] = useState(false)
  const [arataAcces, setArataAcces] = useState(false)
  const [accesNou, setAccesNou] = useState(acces)
  const [confNou, setConfNou] = useState(doc.confidential)
  const [rez, setRez] = useState({ text: doc.rezolutie || '', data: doc.rezolutie_data || '' })
  const [dataTr, setDataTr] = useState(doc.data_transmitere || '')

  // După o reîncărcare, câmpurile editabile se aliniază cu ce e salvat
  useEffect(() => { setRez({ text: doc.rezolutie || '', data: doc.rezolutie_data || '' }) }, [doc.rezolutie, doc.rezolutie_data])
  useEffect(() => { setDataTr(doc.data_transmitere || '') }, [doc.data_transmitere])
  useEffect(() => { setAccesNou(acces); setConfNou(doc.confidential) }, [acces, doc.confidential])

  const c = useCircuit({ doc, role, comune, fisiere, reload: incarca })

  async function ruleaza(actiune, ok) {
    setEroare('')
    setMesaj('')
    setBusy(true)
    const { error } = await actiune()
    setBusy(false)
    if (error) { setEroare(mesajEroare(error)); return false }
    if (ok) setMesaj(ok)
    await incarca()
    return true
  }

  const info = REGISTRE[doc.registru] || REGISTRE.intrari
  const staff = esteStaff(role)
  const circuit = doc.registru === 'circuit'
  const intrare = doc.registru === 'intrari'
  const iesire = doc.registru === 'iesiri'
  const activ = !['anulat', 'arhivat'].includes(doc.status)
  const numeAng = (aid) => comune.angajati.find((a) => a.id === aid)?.nume_complet
  const numeGrup = (gid) => comune.grupuri.find((g) => g.id === gid)?.nume
  const resp = [numeAng(doc.resp_angajat_id), numeGrup(doc.resp_grup_id)].filter(Boolean).join(' · ')
  const poateRezolutie = intrare && (staff || role === 'conducere') && activ
  const angajatPoateLucra = role === 'angajat' && intrare && ['repartizat', 'in_lucru'].includes(doc.status)
  const schimba = (status) => ruleaza(() => supabase.rpc('sec_schimba_status', { p_id: doc.id, p_status: status }), 'Statusul a fost actualizat.')

  // ---- Pașii de stare din panou ----
  const dataStatus = (s) => {
    if (s === 'inregistrat' || s === 'ciorna') return formatData(doc.data_inreg)
    const j = (jurnal || []).find((x) => x.actiune === 'status' && x.detalii?.status?.la === s)
    return j ? formatData(j.la) : ''
  }
  const idsPasi = circuit ? ['ciorna', 'in_circuit', doc.status === 'refuzat' ? 'refuzat' : 'semnat'] : PASI_FLUX[doc.registru]
  const pasi = idsPasi.map((s) => ({ id: s, label: STATUSURI[s]?.label || s, data: dataStatus(s) }))
  const curent = doc.status === 'anulat' ? -1 : doc.status === 'arhivat' ? pasi.length : idsPasi.indexOf(doc.status)
  const poateClic = !circuit && ((staff && doc.status !== 'anulat') || angajatPoateLucra)
  const permis = (sid) => staff || (sid === 'in_lucru' ? doc.status === 'repartizat' : sid === 'solutionat')

  const zile = intrare && activ && !['solutionat'].includes(doc.status) ? zileLaTermen(doc.termen_raspuns) : null
  const rezModificata = rez.text !== (doc.rezolutie || '') || rez.data !== (doc.rezolutie_data || '')
  const dataTrModificata = dataTr !== (doc.data_transmitere || '')

  // ---- Documente legate ----
  const chips = []
  if (legat && !circuit) chips.push({ ...legat, rol: 'Legat de' })
  if (circuitSursa) chips.push({ ...circuitSursa, registru: 'circuit', rol: 'Creat din circuitul de semnare' })
  iesiriCircuit.forEach((l) => chips.push({ ...l, rol: 'Înregistrat în Ieșiri' }))
  legaturi.filter((l) => !iesiriCircuit.some((x) => x.id === l.id)).forEach((l) => chips.push({ ...l, rol: NUME_REGISTRU[l.registru] || 'Document legat' }))

  // Circuitul activ (neanulat) al acestei Intrări: un singur circuit pe document
  const circuitActiv = intrare ? legaturi.find((l) => l.registru === 'circuit' && l.status !== 'anulat') : null

  // ---- Acțiuni către alte registre ----
  const trimiteLaSemnare = () =>
    onNou('circuit', {
      legat: { id: doc.id, numar_afisat: doc.numar_afisat, obiect: doc.obiect },
      serie_id: doc.serie_id,
      obiect: doc.obiect,
      tip_id: doc.tip_id || '',
      resp_angajat_id: doc.resp_angajat_id || '',
      resp_grup_id: doc.resp_grup_id || '',
    })
  async function creazaIesire() {
    setEroare('')
    let contact = null
    if (doc.legat_de) {
      const { data: i } = await supabase.from('sec_documente_lista').select('contact_id, contact_denumire').eq('id', doc.legat_de).maybeSingle()
      if (i?.contact_id) contact = { id: i.contact_id, denumire: i.contact_denumire }
    }
    const curenta = fisiere.find((x) => x.curenta)
    onNou('iesiri', {
      circuit: { id: doc.id, numar_afisat: doc.numar_afisat },
      legat: legat?.id ? { id: legat.id, numar_afisat: legat.numar_afisat, obiect: legat.obiect } : null,
      contact,
      serie_id: doc.serie_id,
      obiect: doc.obiect,
      tip_id: doc.tip_id || '',
      mod_semnare: doc.mod_semnare,
      resp_angajat_id: doc.resp_angajat_id || '',
      resp_grup_id: doc.resp_grup_id || '',
      confidential: doc.confidential,
      fisier: curenta ? { path: curenta.path, nume: curenta.nume_original } : null,
    })
  }

  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="min-w-0 flex-[999_1_30rem] space-y-6">
        <div>
          <button className="text-[13px] text-slate-500 hover:underline focus-ring" onClick={onInapoi}>
            <ArrowLeft size={13} className="mr-1 inline" aria-hidden="true" />Înapoi la {info.label.toLowerCase()}
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-[28px] font-extrabold tracking-tight text-slate-900">{doc.numar_afisat}</h2>
            {circuit && <ModSemnareBadge mod={doc.mod_semnare} />}
            {doc.confidential && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-white">
                <Lock size={11} /> Confidențial
              </span>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {staff && intrare && doc.status !== 'anulat' && !circuitActiv && (
                <button className={btnPrimary} onClick={trimiteLaSemnare}><Send size={14} /> Trimite la semnare</button>
              )}
              {intrare && circuitActiv && (
                <button className={btnGhost} onClick={() => onDeschide('circuit', circuitActiv.id)}><Send size={14} /> Circuit deschis: {circuitActiv.numar_afisat}</button>
              )}
              {staff && circuit && ['in_circuit', 'semnat'].includes(doc.status) && (
                <button className={btnPrimary} disabled={doc.status !== 'semnat'} onClick={creazaIesire}><FileOutput size={14} /> Înregistrează în Ieșiri</button>
              )}
              {staff && activ && (!circuit || doc.status === 'ciorna') && (
                <button className={btnGhost} onClick={() => onEdit(doc)}><Pencil size={14} /> Modifică</button>
              )}
            </div>
          </div>
          {staff && circuit && doc.status === 'in_circuit' && (
            <p className="mt-1 text-xs text-slate-500">„Înregistrează în Ieșiri” se activează când documentul este Finalizat și se poate folosi de mai multe ori.</p>
          )}
        </div>

        {doc.status === 'anulat' && (
          <Eroare>
            Document anulat{doc.anulat_la ? ` la ${formatDataOra(doc.anulat_la)}` : ''}. Motiv: {doc.motiv_anulare}. Numărul rămâne în registru.
          </Eroare>
        )}
        <Eroare>{eroare}</Eroare>
        {mesaj && <Info>{mesaj}</Info>}

        <div>
          <p className="whitespace-pre-wrap text-xl font-bold text-slate-900">{doc.obiect}</p>
          <dl className="mt-4 border-t border-slate-100">
            {circuit && legat && (
              <Rand eticheta="Legat de">
                {legat.id ? (
                  <button className="font-bold text-accent hover:underline" onClick={() => onDeschide(legat.registru, legat.id)}>{legat.numar_afisat}</button>
                ) : <span className="text-slate-500">{legat.numar_afisat}</span>}
                {legat.obiect && <span className="text-slate-500"> · {legat.obiect}</span>}
              </Rand>
            )}
            {intrare && circuitActiv && (
              <Rand eticheta="Circuit de semnare">
                <button className="font-bold text-accent hover:underline focus-ring" onClick={() => onDeschide('circuit', circuitActiv.id)}>{circuitActiv.numar_afisat}</button>
                <span className="ml-2 align-middle"><StareBadge stare={circuitActiv.status} /></span>
                <span className="ml-2 text-xs text-slate-500">Un singur circuit pe document.</span>
              </Rand>
            )}
            {!circuit && <Rand eticheta={info.contact}>{doc.contact_denumire}</Rand>}
            {intrare && <Rand eticheta="Document primit">{[doc.nr_document_extern, doc.data_document && `din ${formatData(doc.data_document)}`].filter(Boolean).join(' ')}</Rand>}
            {!circuit && <Rand eticheta={info.canal}>{doc.canal_denumire}</Rand>}
            <Rand eticheta="Tip document">{doc.tip_denumire}</Rand>
            <Rand eticheta={info.resp}>{resp}</Rand>
            {iesire && <Rand eticheta="Semnatar">{numeAng(doc.semnatar_id)}</Rand>}
            <Rand eticheta="Mod de semnare">{MOD_SEMNARE[doc.mod_semnare]}</Rand>
            {circuit && <Rand eticheta="Ordine">{ORDINE_SEMNARE[doc.ordine_semnare]}</Rand>}
            <Rand eticheta="Serie">{doc.serie_cod} — {doc.serie_denumire}</Rand>
            <Rand eticheta="Înregistrat">{[formatData(doc.data_inreg), numeAng(doc.creat_de) && `de ${numeAng(doc.creat_de)}`].filter(Boolean).join(', ')}</Rand>
          </dl>
        </div>

        {circuit && <CircuitSemnatari c={c} />}

        <Fisiere doc={doc} fisiere={fisiere} poateIncarca={staff} comune={comune} reload={incarca} />

        {chips.length > 0 && (
          <Sectiune titlu="Documente legate">
            <div className="flex flex-wrap gap-2">
              {chips.map((l) => (
                l.id ? (
                  <button key={`${l.rol}-${l.id}`} className="inline-flex items-baseline gap-2 rounded-[10px] border border-slate-300 px-3 py-1.5 text-left hover:bg-slate-50 focus-ring"
                    onClick={() => onDeschide(l.registru, l.id)}>
                    <strong className="text-sm text-accent">{l.numar_afisat}</strong>
                    <span className="text-[13px] text-slate-500">{l.rol}{l.obiect ? ` · ${l.obiect}` : ''}</span>
                  </button>
                ) : (
                  <span key={l.rol} className="rounded-[10px] border border-slate-200 px-3 py-1.5 text-[13px] text-slate-500">{l.numar_afisat}</span>
                )
              ))}
            </div>
          </Sectiune>
        )}

        {/* Confidențialitate (doar Secretariat / Admin), deschis din panou */}
        {staff && activ && arataAcces && (
          <Sectiune titlu="Confidențialitate" className="space-y-3">
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
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={busy || (confNou === doc.confidential && JSON.stringify([...accesNou].sort()) === JSON.stringify([...acces].sort()))}
                onClick={async () => {
                  if (await ruleaza(() => supabase.rpc('sec_seteaza_confidential', { p_id: doc.id, p_conf: confNou, p_angajati: confNou ? accesNou : [] }), 'Setările de confidențialitate au fost salvate.')) setArataAcces(false)
                }}>
                Salvează
              </button>
              <button className={btnGhost} onClick={() => setArataAcces(false)}>Renunță</button>
            </div>
          </Sectiune>
        )}

        {/* Jurnal (Secretariat / Conducere / Admin), deschis din panou */}
        {veziTot(role) && arataJurnal && (
          <Sectiune titlu="Jurnal de modificări">
            <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {(jurnal || []).map((j) => (
                <li key={j.id}>
                  <span className="text-slate-400">{formatDataOra(j.la)}</span> · {descriereJurnal(j)}
                  {j.angajat_id ? ` · ${numeAng(j.angajat_id) || 'angajat șters'}` : ''}
                </li>
              ))}
              {jurnal && jurnal.length === 0 && <li>Nicio intrare în jurnal.</li>}
            </ul>
          </Sectiune>
        )}
      </div>

      <PanouLateral>
        <Sectiune titlu="Stare">
          <PasiStare pasi={pasi} curent={curent} rosu={doc.status === 'refuzat'} permis={permis} onPick={poateClic ? (sid) => schimba(sid) : undefined} />
          <p className="mt-2 text-xs text-slate-500">
            {circuit
              ? 'Se actualizează singură din pașii de semnare. La refuz poți relansa documentul.'
              : angajatPoateLucra
                ? 'Apasă „În lucru” ca să preiei documentul, apoi „Soluționat” când ai terminat.'
                : poateClic ? 'Apasă pe un pas ca să schimbi statusul.' : ''}
            {doc.status === 'arhivat' && ' Documentul este arhivat; apasă pe un pas ca să-l readuci în lucru.'}
          </p>
        </Sectiune>

        {intrare && (
          <>
            <Linie />
            <Sectiune titlu="Rezoluția conducerii">
              {poateRezolutie ? (
                <div className="space-y-2">
                  <textarea aria-label="Textul rezoluției" rows={3} className={inputCls} placeholder="Scrie rezoluția…" value={rez.text} onChange={(e) => setRez({ ...rez, text: e.target.value })} />
                  <div>
                    <label className={labelCls} htmlFor="rez_data">Data rezoluției</label>
                    <input id="rez_data" type="date" className={`${inputCls} max-w-[11rem]`} value={rez.data} onChange={(e) => setRez({ ...rez, data: e.target.value })} />
                  </div>
                  {rezModificata && (
                    <button className={btnPrimary} disabled={busy}
                      onClick={() => ruleaza(() => supabase.rpc('sec_actualizeaza', { p_id: doc.id, p_date: { rezolutie: rez.text, rezolutie_data: rez.data } }), 'Rezoluția a fost salvată.')}>
                      Salvează rezoluția
                    </button>
                  )}
                </div>
              ) : doc.rezolutie ? (
                <p className="whitespace-pre-wrap text-sm text-slate-800">
                  {doc.rezolutie}
                  {doc.rezolutie_data && <span className="block text-xs text-slate-500">din {formatData(doc.rezolutie_data)}</span>}
                </p>
              ) : (
                <p className="text-sm text-slate-500">Nicio rezoluție înregistrată.</p>
              )}
            </Sectiune>
            {doc.termen_raspuns && (
              <>
                <Linie />
                <Sectiune titlu="Termen de răspuns">
                  <p className="text-sm">
                    <strong className={zile !== null && zile <= 2 ? 'text-amber-700' : 'text-slate-800'}>{formatData(doc.termen_raspuns)}</strong>
                    {zile !== null && <span className={zile < 0 ? 'font-semibold text-rose-700' : 'text-slate-600'}> · {textTermen(zile)}</span>}
                  </p>
                </Sectiune>
              </>
            )}
          </>
        )}

        {iesire && (
          <>
            <Linie />
            <Sectiune titlu="Data transmiterii efective">
              {staff && activ ? (
                <div className="space-y-2">
                  <label className="sr-only" htmlFor="data_tr">Data transmiterii efective</label>
                  <input id="data_tr" type="date" className={`${inputCls} max-w-[11rem]`} value={dataTr} onChange={(e) => setDataTr(e.target.value)} />
                  {dataTrModificata && (
                    <div>
                      <button className={btnPrimary} disabled={busy}
                        onClick={() => ruleaza(() => supabase.rpc('sec_actualizeaza', { p_id: doc.id, p_date: { data_transmitere: dataTr } }), 'Data transmiterii a fost salvată.')}>
                        Salvează data
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-800">{formatData(doc.data_transmitere) || <span className="text-slate-400">—</span>}</p>
              )}
            </Sectiune>
          </>
        )}

        {circuit && (
          <>
            <Linie />
            <Sectiune titlu={doc.mod_semnare === 'electronica' ? 'Fișierul de semnat' : 'Unde este documentul acum'}>
              <CircuitLocatie c={c} />
            </Sectiune>
          </>
        )}

        <Linie />
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            {doc.confidential
              ? 'Confidențial: îl văd Secretariatul, Conducerea, Adminul Hub, persoana repartizată / inițiatoare, semnatarii și cei numiți.'
              : 'Nu este confidențial.'}
            {staff && activ && <> <button className={linkCls} onClick={() => setArataAcces((v) => !v)}>Modifică accesul</button></>}
          </p>
          <div className="flex flex-col items-start gap-1.5">
            {veziTot(role) && (
              <button className={linkCls} onClick={() => setArataJurnal((v) => !v)}>{arataJurnal ? 'Ascunde jurnalul' : 'Jurnal de modificări'}</button>
            )}
            {staff && activ && !circuit && (
              <button className={linkCls} disabled={busy} onClick={() => schimba('arhivat')}>Arhivează</button>
            )}
            {staff && doc.status !== 'anulat' && (
              <button className="text-sm font-semibold text-rose-700 hover:underline focus-ring" onClick={() => setAnuleaza(true)}>Anulează documentul…</button>
            )}
            {role === 'admin' && <StergereDocument doc={doc} onSters={onInapoi} />}
          </div>
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
        </div>
      </PanouLateral>
    </div>
  )
}
