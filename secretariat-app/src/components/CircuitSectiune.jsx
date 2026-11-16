import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { ORDINE_SEMNARE, esteStaff } from '../lib/roluri'
import { deschideFisier } from '../lib/fisiere'
import { azi, formatData, mesajEroare } from '../lib/util'
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Eroare, Info, Sectiune, StareSemnatarBadge } from './comun'
import SemnatariEditor from './SemnatariEditor'

const ETICHETA_PAS = { primit: 'Marchează primit', semnat: 'Marchează semnat', refuzat: 'Marchează refuz' }

// Starea și acțiunile unui document din Circuit. Folosit de pagina de detaliu, care arată semnatarii
// în coloana principală (CircuitSemnatari) și locația / linkul fișierului în panoul din dreapta (CircuitLocatie).
export function useCircuit({ doc, role, comune, fisiere, reload }) {
  const circuit = doc.registru === 'circuit'
  const staff = esteStaff(role)
  const electronic = doc.mod_semnare === 'electronica'
  const [rows, setRows] = useState(null)
  const [pas, setPas] = useState(null) // { id, actiune, data, obs }
  const [eroare, setEroare] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [busy, setBusy] = useState(false)
  const [locatie, setLocatie] = useState(null) // text cât timp se editează
  const [relansare, setRelansare] = useState(null) // { semnatari }
  const [istoric, setIstoric] = useState(false)

  const incarca = useCallback(async () => {
    if (!circuit) return
    const { data } = await supabase.from('sec_semnatari').select('*').eq('document_id', doc.id).order('runda').order('ordine')
    setRows(data || [])
  }, [doc.id, circuit])
  useEffect(() => { incarca() }, [incarca, doc.status, doc.runda, doc.updated_at])

  async function ruleaza(actiune, ok) {
    setEroare('')
    setMesaj('')
    setBusy(true)
    const { error } = await actiune()
    setBusy(false)
    if (error) { setEroare(mesajEroare(error)); return false }
    if (ok) setMesaj(ok)
    await incarca()
    await reload()
    return true
  }

  const curenta = (rows || []).filter((r) => r.runda === doc.runda)
  const anterioare = (rows || []).filter((r) => r.runda < doc.runda)
  const runde = [...new Set(anterioare.map((r) => r.runda))]
  const fisierCurent = fisiere.find((x) => x.curenta)
  const inCurs = doc.status === 'in_circuit'
  const poatePasi = staff && (inCurs || doc.status === 'semnat')
  const refuzul = curenta.find((r) => r.stare === 'refuzat')
  const numeAng = (id) => comune.angajati.find((a) => a.id === id)?.nume_complet

  // Care pași are sens să apară pentru un semnatar (regulile exacte le verifică baza de date)
  function actiuni(r) {
    if (!poatePasi) return []
    const out = []
    if (inCurs) {
      if (r.stare === 'asteapta' && !electronic) out.push('primit')
      if (r.stare === 'primit' || (electronic && r.stare === 'asteapta')) { out.push('semnat'); out.push('refuzat') }
    }
    return out
  }
  const poateInapoi = (r) => poatePasi && ['primit', 'semnat'].includes(r.stare)

  const porneste = (r, actiune) => setPas({ id: r.id, actiune, data: azi(), obs: '' })
  const confirma = async () => {
    const ok = await ruleaza(() => supabase.rpc('sec_circuit_pas', { p_semnatar: pas.id, p_actiune: pas.actiune, p_data: pas.data, p_obs: pas.obs }), 'Pasul a fost notat.')
    if (ok) setPas(null)
  }

  return {
    doc, staff, electronic, rows, pas, setPas, eroare, setEroare, mesaj, busy, locatie, setLocatie, relansare, setRelansare, istoric, setIstoric,
    ruleaza, curenta, anterioare, runde, fisierCurent, refuzul, numeAng, actiuni, poateInapoi, porneste, confirma, comune,
  }
}

// Locația hârtiei (fizic) sau linkul spre fișier (electronic) — în panoul din dreapta
export function CircuitLocatie({ c }) {
  const { doc, staff, electronic, fisierCurent, locatie, setLocatie, busy, ruleaza, setEroare } = c
  return (
    <div className="space-y-2 text-sm">
      {electronic ? (
        <>
          <p className="text-slate-700">Document cu semnătură electronică.</p>
          {fisierCurent ? (
            <button className={btnGhost} onClick={() => deschideFisier(fisierCurent.path).catch((e) => setEroare(mesajEroare(e)))}>
              <ExternalLink size={14} /> Deschide fișierul
            </button>
          ) : (
            <p className="text-xs text-slate-500">Fișierul de semnat nu a fost încărcat încă (vezi „Fișiere”).</p>
          )}
        </>
      ) : locatie === null ? (
        <>
          <p className="flex items-center gap-2 font-semibold text-slate-800">
            <MapPin size={15} className="text-slate-500" aria-hidden="true" /> {doc.locatie_hartie || 'nespecificată'}
          </p>
          {staff && doc.status !== 'anulat' && (
            <button className="text-sm font-semibold text-accent hover:underline focus-ring" onClick={() => setLocatie(doc.locatie_hartie || '')}>Schimbă locația</button>
          )}
          <p className="text-xs text-slate-500">Se completează singură la fiecare pas (ex. „La Contabil șef”).</p>
        </>
      ) : (
        <div className="space-y-2">
          <label className="sr-only" htmlFor="locatie_noua">Locația hârtiei</label>
          <input id="locatie_noua" className={inputCls} value={locatie} maxLength={200} onChange={(e) => setLocatie(e.target.value)}
            placeholder="ex. Trimis la biroul contabilității" />
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={busy}
              onClick={async () => { if (await ruleaza(() => supabase.rpc('sec_circuit_locatie', { p_doc: doc.id, p_locatie: locatie }), 'Locația a fost actualizată.')) setLocatie(null) }}>
              Salvează
            </button>
            <button className={btnGhost} onClick={() => setLocatie(null)}>Renunță</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Semnatarii, pașii de semnare, trimiterea la semnare, relansarea, rundele anterioare — în coloana principală
export function CircuitSemnatari({ c }) {
  const { doc, staff, rows, pas, setPas, eroare, mesaj, busy, relansare, setRelansare, istoric, setIstoric, ruleaza, curenta, anterioare, runde,
    refuzul, numeAng, actiuni, poateInapoi, porneste, confirma, comune } = c
  return (
    <Sectiune
      titlu={`Semnatari${doc.runda > 1 ? ` · runda ${doc.runda}` : ''}`}
      className="space-y-3"
      actiuni={<span className="text-xs text-slate-500">{ORDINE_SEMNARE[doc.ordine_semnare]}</span>}
    >
      {mesaj && <Info>{mesaj}</Info>}
      <Eroare>{eroare}</Eroare>
      {doc.status === 'refuzat' && refuzul && (
        <Eroare>Refuzat de {refuzul.nume}{refuzul.semnat_la ? ` la ${formatData(refuzul.semnat_la)}` : ''}. Motiv: {refuzul.motiv_refuz}</Eroare>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500">Se încarcă…</p>
      ) : curenta.length === 0 ? (
        <p className="text-sm text-slate-500">
          Niciun semnatar adăugat încă.{staff && doc.status === 'ciorna' ? ' Apasă „Modifică” ca să alegi semnatarii.' : ''}
        </p>
      ) : (
        <ul className="border-t border-slate-100">
          {curenta.map((r) => (
            <li key={r.id} className="border-b border-slate-100 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#e8edf5] text-xs font-bold text-accent">
                  {doc.ordine_semnare === 'pe_rand' ? r.ordine : '•'}
                </span>
                <div className="min-w-0 flex-1 basis-44">
                  <p className="font-semibold text-slate-800">{r.nume}</p>
                  <p className="text-xs text-slate-500">
                    {[r.primit_la && `primit ${formatData(r.primit_la)}`, r.stare === 'semnat' && r.semnat_la && `semnat ${formatData(r.semnat_la)}`,
                      r.stare === 'refuzat' && `refuz: ${r.motiv_refuz}`, r.stare !== 'refuzat' && r.observatii].filter(Boolean).join(' · ') || 'Încă nu a primit documentul'}
                  </p>
                </div>
                <StareSemnatarBadge stare={r.stare} />
                {actiuni(r).map((a) => (
                  <button key={a} disabled={busy} onClick={() => porneste(r, a)} className={a === 'refuzat' ? btnDanger : a === 'semnat' ? btnPrimary : btnGhost}>
                    {ETICHETA_PAS[a]}
                  </button>
                ))}
                {poateInapoi(r) && (
                  <button className="text-sm font-semibold text-slate-500 hover:underline focus-ring" disabled={busy}
                    onClick={() => ruleaza(() => supabase.rpc('sec_circuit_pas', { p_semnatar: r.id, p_actiune: 'inapoi' }), 'Ultimul pas a fost anulat.')}>
                    Anulează ultimul pas
                  </button>
                )}
              </div>
              {pas?.id === r.id && (
                <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-700">{ETICHETA_PAS[pas.actiune]} · {r.nume}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className={labelCls} htmlFor="pas_data">{pas.actiune === 'primit' ? 'Data primirii' : pas.actiune === 'semnat' ? 'Data semnării' : 'Data refuzului'}</label>
                      <input id="pas_data" type="date" className={inputCls} value={pas.data} max={azi()} onChange={(e) => setPas({ ...pas, data: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="pas_obs">{pas.actiune === 'refuzat' ? 'Motivul refuzului *' : 'Observații (opțional)'}</label>
                      <input id="pas_obs" className={inputCls} value={pas.obs} onChange={(e) => setPas({ ...pas, obs: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className={btnPrimary} disabled={busy || !pas.data || (pas.actiune === 'refuzat' && !pas.obs.trim())} onClick={confirma}>Confirmă</button>
                    <button className={btnGhost} onClick={() => setPas(null)}>Renunță</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Trimitere la semnare (din Ciornă) */}
      {staff && doc.status === 'ciorna' && (
        <div className="flex flex-wrap items-center gap-3">
          <button className={btnPrimary} disabled={busy || curenta.length === 0}
            onClick={() => ruleaza(() => supabase.rpc('sec_circuit_lanseaza', { p_doc: doc.id }), 'Documentul este acum „În lucru”.')}>
            Trimite la semnare
          </button>
          {curenta.length === 0 && <span className="text-xs text-slate-500">Adaugă mai întâi cel puțin un semnatar.</span>}
        </div>
      )}

      {/* Relansare după refuz */}
      {staff && doc.status === 'refuzat' && (
        relansare ? (
          <div className="space-y-3 rounded-lg bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Relansare: începe o rundă nouă. Runda anterioară rămâne în istoric.</p>
            <SemnatariEditor valoare={relansare.semnatari} onChange={(v) => setRelansare({ ...relansare, semnatari: v })} ordine="pe_rand" onOrdine={() => {}} comune={comune} />
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={busy || relansare.semnatari.length === 0}
                onClick={async () => { if (await ruleaza(() => supabase.rpc('sec_circuit_relanseaza', { p_doc: doc.id, p_semnatari: relansare.semnatari }), 'Circuitul a fost relansat.')) setRelansare(null) }}>
                Relansează circuitul
              </button>
              <button className={btnGhost} onClick={() => setRelansare(null)}>Renunță</button>
            </div>
          </div>
        ) : (
          <button className={btnPrimary} onClick={() => setRelansare({ semnatari: curenta.map((r) => r.angajat_id).filter(Boolean) })}>
            Relansează circuitul
          </button>
        )
      )}

      {/* Runde anterioare */}
      {runde.length > 0 && (
        <div>
          <button className="text-sm font-semibold text-accent hover:underline focus-ring" onClick={() => setIstoric((v) => !v)}>
            {istoric ? 'Ascunde rundele anterioare' : `Runde anterioare (${runde.length})`}
          </button>
          {istoric && (
            <div className="mt-2 space-y-3">
              {runde.map((nr) => (
                <div key={nr} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <p className="mb-1 font-medium text-slate-700">Runda {nr}</p>
                  <ul className="space-y-0.5">
                    {anterioare.filter((r) => r.runda === nr).map((r) => (
                      <li key={r.id}>
                        {r.ordine}. {r.nume} · {r.stare === 'refuzat' ? `refuzat la ${formatData(r.semnat_la)} (${r.motiv_refuz})` : r.stare === 'semnat' ? `semnat la ${formatData(r.semnat_la)}` : r.stare === 'primit' ? `primit la ${formatData(r.primit_la)}` : 'nu a ajuns la el'}
                        {r.angajat_id && !numeAng(r.angajat_id) ? ' (angajat șters)' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Sectiune>
  )
}
