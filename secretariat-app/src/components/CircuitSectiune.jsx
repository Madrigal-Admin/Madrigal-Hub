import { Fragment, useCallback, useEffect, useState } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { ORDINE_SEMNARE, esteStaff } from '../lib/roluri'
import { deschideFisier } from '../lib/fisiere'
import { azi, formatData, mesajEroare } from '../lib/util'
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Card, Eroare, Info, StareSemnatarBadge } from './comun'
import SemnatariEditor from './SemnatariEditor'

const ETICHETA_PAS = { primit: 'Marchează primit', semnat: 'Marchează semnat', refuzat: 'Marchează refuz' }

// Semnatarii unui document din Circuit, pașii de semnare, locația hârtiei / linkul fișierului, relansarea.
export default function CircuitSectiune({ doc, role, comune, fisiere, reload }) {
  const staff = esteStaff(role)
  const electronic = doc.mod_semnare === 'electronica'
  const [rows, setRows] = useState(null)
  const [pas, setPas] = useState(null) // { id, actiune, data, obs }
  const [eroare, setEroare] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [busy, setBusy] = useState(false)
  const [locatie, setLocatie] = useState(null) // text cât timp se editează
  const [relansare, setRelansare] = useState(null) // { semnatari, ordine }
  const [istoric, setIstoric] = useState(false)

  const incarca = useCallback(async () => {
    const { data } = await supabase.from('sec_semnatari').select('*').eq('document_id', doc.id).order('runda').order('ordine')
    setRows(data || [])
  }, [doc.id])
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

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">
          Semnatari {doc.runda > 1 ? `· runda ${doc.runda}` : ''}
        </h3>
        <p className="text-xs text-slate-500">{ORDINE_SEMNARE[doc.ordine_semnare]}</p>
      </div>

      {/* Fizic: unde e hârtia. Electronic: linkul spre fișier */}
      {electronic ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm">
          <span className="font-medium text-indigo-800">Document cu semnătură electronică</span>
          {fisierCurent ? (
            <button className={btnGhost} onClick={() => deschideFisier(fisierCurent.path).catch((e) => setEroare(mesajEroare(e)))}>
              <ExternalLink size={14} /> Deschide fișierul
            </button>
          ) : (
            <span className="text-indigo-700">Fișierul de semnat nu a fost încărcat încă (vezi „Fișiere” mai jos).</span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <MapPin size={15} className="text-slate-500" aria-hidden="true" />
          <span className="text-slate-600">Locația hârtiei:</span>
          {locatie === null ? (
            <>
              <strong className="text-slate-800">{doc.locatie_hartie || 'nespecificată'}</strong>
              {staff && doc.status !== 'anulat' && (
                <button className={btnGhost} onClick={() => setLocatie(doc.locatie_hartie || '')}>Schimbă</button>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="locatie_noua">Locația hârtiei</label>
              <input id="locatie_noua" className={`${inputCls} max-w-sm`} value={locatie} maxLength={200} onChange={(e) => setLocatie(e.target.value)}
                placeholder="ex. Trimis la biroul contabilității" />
              <button className={btnPrimary} disabled={busy}
                onClick={async () => { if (await ruleaza(() => supabase.rpc('sec_circuit_locatie', { p_doc: doc.id, p_locatie: locatie }), 'Locația a fost actualizată.')) setLocatie(null) }}>
                Salvează
              </button>
              <button className={btnGhost} onClick={() => setLocatie(null)}>Renunță</button>
            </div>
          )}
        </div>
      )}

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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-semibold">#</th>
                <th className="py-2 pr-3 font-semibold">Semnatar</th>
                <th className="py-2 pr-3 font-semibold">Stare</th>
                <th className="py-2 pr-3 font-semibold">Primit la</th>
                <th className="py-2 pr-3 font-semibold">Semnat la</th>
                <th className="py-2 font-semibold">Observații</th>
              </tr>
            </thead>
            <tbody>
              {curenta.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 text-slate-500">{doc.ordine_semnare === 'pe_rand' ? r.ordine : '•'}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{r.nume}</td>
                    <td className="py-2 pr-3"><StareSemnatarBadge stare={r.stare} /></td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{formatData(r.primit_la)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{r.stare === 'refuzat' ? '' : formatData(r.semnat_la)}</td>
                    <td className="py-2 text-slate-600">{r.stare === 'refuzat' ? `Refuz: ${r.motiv_refuz}` : r.observatii}</td>
                  </tr>
                  {(actiuni(r).length > 0 || poateInapoi(r)) && (
                    <tr className="border-b border-slate-100">
                      <td />
                      <td colSpan={5} className="pb-2">
                        <div className="flex flex-wrap gap-2">
                          {actiuni(r).map((a) => (
                            <button key={a} disabled={busy} onClick={() => porneste(r, a)} className={a === 'refuzat' ? btnDanger : a === 'semnat' ? btnPrimary : btnGhost}>
                              {ETICHETA_PAS[a]}
                            </button>
                          ))}
                          {poateInapoi(r) && (
                            <button className={btnGhost} disabled={busy}
                              onClick={() => ruleaza(() => supabase.rpc('sec_circuit_pas', { p_semnatar: r.id, p_actiune: 'inapoi' }), 'Ultimul pas a fost anulat.')}>
                              Anulează ultimul pas
                            </button>
                          )}
                        </div>
                        {pas?.id === r.id && (
                          <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
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
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
          <button className={btnGhost} onClick={() => setIstoric((v) => !v)}>{istoric ? 'Ascunde rundele anterioare' : `Runde anterioare (${runde.length})`}</button>
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
    </Card>
  )
}
