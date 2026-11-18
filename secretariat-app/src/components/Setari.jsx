import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { REGISTRE } from '../lib/roluri'
import { formatData, mesajEroare } from '../lib/util'
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Card, Eroare, Info, Titlu } from './comun'

// Listă editabilă simplă (canale, tipuri de document). Nu se șterge nimic: se dezactivează.
function ListEditor({ tabel, titlu, descriere, reload }) {
  const [rows, setRows] = useState([])
  const [nou, setNou] = useState('')
  const [eroare, setEroare] = useState('')
  const [busy, setBusy] = useState(false)

  async function incarca() {
    const { data, error } = await supabase.from(tabel).select('*').order('ordine').order('denumire')
    if (error) setEroare(mesajEroare(error))
    setRows(data || [])
  }
  useEffect(() => { incarca() }, [tabel])

  async function ruleaza(actiune) {
    setEroare('')
    setBusy(true)
    const { error } = await actiune()
    setBusy(false)
    if (error) return setEroare(/duplicate|unique/i.test(error.message) ? 'Există deja un element cu acest nume.' : mesajEroare(error))
    await incarca()
    reload()
  }

  const adauga = async (e) => {
    e.preventDefault()
    if (!nou.trim()) return
    const ordine = rows.reduce((m, r) => Math.max(m, r.ordine === 99 ? 0 : r.ordine), 0) + 1
    await ruleaza(() => supabase.from(tabel).insert({ denumire: nou.trim(), ordine }))
    setNou('')
  }

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{titlu}</h3>
        <p className="text-xs text-slate-500">{descriere}</p>
      </div>
      <Eroare>{eroare}</Eroare>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
            <input
              className={`${inputCls} max-w-xs ${r.activ ? '' : 'text-slate-400 line-through'}`}
              defaultValue={r.denumire}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== r.denumire) ruleaza(() => supabase.from(tabel).update({ denumire: v }).eq('id', r.id))
                else e.target.value = r.denumire
              }}
            />
            <button className={btnGhost} disabled={busy} onClick={() => ruleaza(() => supabase.from(tabel).update({ activ: !r.activ }).eq('id', r.id))}>
              {r.activ ? 'Dezactivează' : 'Reactivează'}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={adauga} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1 sm:max-w-xs">
          <label className={labelCls} htmlFor={`nou_${tabel}`}>Element nou</label>
          <input id={`nou_${tabel}`} className={inputCls} value={nou} onChange={(e) => setNou(e.target.value)} />
        </div>
        <button type="submit" className={btnPrimary} disabled={busy || !nou.trim()}>Adaugă</button>
      </form>
    </Card>
  )
}

// Seriile (RU, CTB, …): numerotare proprie pe serie. Doar Admin Hub le poate adăuga, redenumi, dezactiva sau șterge (cât timp nu au documente).
function SeriiEditor({ admin, serii, reload }) {
  const an = new Date().getFullYear()
  const [contoare, setContoare] = useState([])
  const [nou, setNou] = useState({ cod: '', denumire: '' })
  const [edit, setEdit] = useState(null) // { id, cod, denumire }
  const [sterge, setSterge] = useState(null)
  const [eroare, setEroare] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('sec_contoare').select('serie_id, registru, ultim_nr').eq('an', an).then(({ data }) => setContoare(data || []))
  }, [serii, an])

  const numere = (id) => {
    const c = contoare.filter((x) => x.serie_id === id)
    const val = (reg) => c.find((x) => x.registru === reg)?.ultim_nr || 0
    return `Numere acordate în ${an}: Intrări ${val('intrari')} · Ieșiri ${val('iesiri')} · Circuit ${val('circuit')}`
  }

  async function ruleaza(actiune, ok) {
    setEroare('')
    setMesaj('')
    setBusy(true)
    const { error } = await actiune()
    setBusy(false)
    if (error) { setEroare(mesajEroare(error)); return false }
    setMesaj(ok)
    await reload()
    return true
  }

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Serii</h3>
        <p className="text-xs text-slate-500">
          Fiecare serie are numerotare proprie pe an (INT RU 1/2026, INT CTB 1/2026…) în fiecare registru. O serie cu documente nu se șterge, doar se dezactivează:
          nu mai apare la „Adaugă”, dar documentele ei rămân. Codul nu se mai schimbă după primul document.
        </p>
      </div>
      <Eroare>{eroare}</Eroare>
      {mesaj && <Info>{mesaj}</Info>}
      <ul className="divide-y divide-slate-100 text-sm">
        {serii.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 py-2">
            {edit?.id === x.id ? (
              <>
                <input aria-label="Cod serie" className={`${inputCls} !w-24`} value={edit.cod} maxLength={8} onChange={(e) => setEdit({ ...edit, cod: e.target.value.toUpperCase() })} />
                <input aria-label="Denumire serie" className={`${inputCls} !w-64`} value={edit.denumire} onChange={(e) => setEdit({ ...edit, denumire: e.target.value })} />
                <button className={btnPrimary} disabled={busy} onClick={async () => { if (await ruleaza(() => supabase.rpc('sec_serie_salveaza', { p_id: x.id, p_cod: edit.cod, p_denumire: edit.denumire }), 'Seria a fost salvată.')) setEdit(null) }}>Salvează</button>
                <button className={btnGhost} onClick={() => setEdit(null)}>Renunță</button>
              </>
            ) : (
              <>
                <strong className="w-16 text-slate-800">{x.cod}</strong>
                <span className="min-w-[10rem] flex-1 text-slate-700">{x.denumire}</span>
                <span className="text-xs text-slate-500">{numere(x.id)}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${x.activ ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{x.activ ? 'Activă' : 'Dezactivată'}</span>
                {admin && (
                  <span className="flex flex-wrap gap-2">
                    <button className={btnGhost} onClick={() => setEdit({ id: x.id, cod: x.cod, denumire: x.denumire })}>Redenumește</button>
                    <button className={btnGhost} disabled={busy} onClick={() => ruleaza(() => supabase.rpc('sec_serie_activeaza', { p_id: x.id, p_activ: !x.activ }), x.activ ? 'Seria a fost dezactivată.' : 'Seria a fost reactivată.')}>
                      {x.activ ? 'Dezactivează' : 'Reactivează'}
                    </button>
                    {sterge === x.id ? (
                      <button className={btnDanger} disabled={busy} onClick={async () => { await ruleaza(() => supabase.rpc('sec_serie_sterge', { p_id: x.id }), 'Seria a fost ștearsă.'); setSterge(null) }}>Confirmă ștergerea</button>
                    ) : (
                      <button className={btnDanger} onClick={() => setSterge(x.id)}>Șterge</button>
                    )}
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {admin ? (
        <form
          onSubmit={async (e) => { e.preventDefault(); if (await ruleaza(() => supabase.rpc('sec_serie_salveaza', { p_id: null, p_cod: nou.cod, p_denumire: nou.denumire }), 'Seria a fost adăugată.')) setNou({ cod: '', denumire: '' }) }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="w-28">
            <label className={labelCls} htmlFor="serie_cod_nou">Cod (ex. JUR)</label>
            <input id="serie_cod_nou" className={inputCls} value={nou.cod} maxLength={8} onChange={(e) => setNou({ ...nou, cod: e.target.value.toUpperCase() })} />
          </div>
          <div className="min-w-[14rem] flex-1 sm:max-w-xs">
            <label className={labelCls} htmlFor="serie_den_nou">Denumire</label>
            <input id="serie_den_nou" className={inputCls} value={nou.denumire} onChange={(e) => setNou({ ...nou, denumire: e.target.value })} />
          </div>
          <button type="submit" className={btnPrimary} disabled={busy || !nou.cod.trim() || !nou.denumire.trim()}>Adaugă serie</button>
        </form>
      ) : (
        <p className="text-xs text-slate-500">Seriile le administrează adminul Hub.</p>
      )}
    </Card>
  )
}

// Numărul de start al fiecărui registru, pe anul curent (doar Admin Hub, doar cât timp nu există documente)
function Numerotare({ admin, serii }) {
  const an = new Date().getFullYear()
  const [serieId, setSerieId] = useState('')
  const serie = serii.find((x) => x.id === serieId)
  useEffect(() => { if (!serieId && serii.length) setSerieId((serii.find((x) => x.cod === 'SEC') || serii[0]).id) }, [serii, serieId])
  const [stare, setStare] = useState({})
  const [valori, setValori] = useState({ intrari: { nr: '', data: '' }, iesiri: { nr: '', data: '' }, circuit: { nr: '', data: '' } })
  const [eroare, setEroare] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [busy, setBusy] = useState(false)

  async function incarca() {
    if (!serieId) return
    const out = {}
    for (const reg of ['intrari', 'iesiri', 'circuit']) {
      const [{ data: c }, { count }] = await Promise.all([
        supabase.from('sec_contoare').select('*').eq('registru', reg).eq('serie_id', serieId).eq('an', an).maybeSingle(),
        supabase.from('sec_documente').select('id', { count: 'exact', head: true }).eq('registru', reg).eq('serie_id', serieId).eq('an', an),
      ])
      out[reg] = { contor: c, documente: count || 0 }
    }
    setStare(out)
  }
  useEffect(() => { setStare({}); incarca() }, [serieId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function seteaza(reg) {
    setEroare('')
    setMesaj('')
    const v = valori[reg]
    if (!v.nr || Number(v.nr) < 1) return setEroare('Scrie numărul cu care începe registrul (cel puțin 1).')
    if (!v.data) return setEroare('Alege data de la care Hub-ul ține registrul.')
    setBusy(true)
    const { error } = await supabase.rpc('sec_seteaza_start', { p_registru: reg, p_serie: serieId, p_an: an, p_urmatorul: Number(v.nr), p_data: v.data })
    setBusy(false)
    if (error) return setEroare(mesajEroare(error))
    setMesaj(`Seria ${serie?.cod}: registrul de ${REGISTRE[reg].label.toLowerCase()} va începe de la numărul ${v.nr}.`)
    incarca()
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Numerotarea pe {an}</h3>
        <p className="text-xs text-slate-500">
          Fiecare serie are numerotare proprie, care reîncepe la 1 în fiecare an. Dacă registrul de hârtie a ajuns deja la un număr, setează aici numărul de la care continuă Hub-ul
          și data de start. Se poate face doar cât timp nu există nicio înregistrare în registrul și seria respectivă pe {an}.
        </p>
        <div className="mt-3 max-w-xs">
          <label className={labelCls} htmlFor="serie_start">Serie</label>
          <select id="serie_start" className={inputCls} value={serieId} onChange={(e) => setSerieId(e.target.value)}>
            {serii.map((x) => <option key={x.id} value={x.id}>{x.cod} — {x.denumire}</option>)}
          </select>
        </div>
      </div>
      <Eroare>{eroare}</Eroare>
      {mesaj && <Info>{mesaj}</Info>}
      <div className="grid gap-4 md:grid-cols-2">
        {['intrari', 'iesiri', 'circuit'].map((reg) => {
          const s = stare[reg]
          if (!s) return <p key={reg} className="text-sm text-slate-400">Se încarcă…</p>
          const blocat = s.documente > 0
          return (
            <div key={reg} className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-700">{REGISTRE[reg].label} ({REGISTRE[reg].prefix} {serie?.cod})</p>
              <p className="text-sm text-slate-600">
                {s.contor
                  ? `Ultimul număr acordat: ${s.contor.ultim_nr}${s.contor.inceput_la ? ` · start: ${formatData(s.contor.inceput_la)}` : ''}`
                  : 'Încă neînceput (primul număr va fi 1).'}
              </p>
              <p className="text-xs text-slate-500">{s.documente} {s.documente === 1 ? 'document înregistrat' : 'documente înregistrate'} pe {an}.</p>
              {admin && !blocat && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls} htmlFor={`nr_${reg}`}>Următorul număr</label>
                      <input id={`nr_${reg}`} type="number" min="1" className={inputCls} value={valori[reg].nr}
                        onChange={(e) => setValori({ ...valori, [reg]: { ...valori[reg], nr: e.target.value } })} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor={`data_${reg}`}>Data de start</label>
                      <input id={`data_${reg}`} type="date" className={inputCls} value={valori[reg].data}
                        onChange={(e) => setValori({ ...valori, [reg]: { ...valori[reg], data: e.target.value } })} />
                    </div>
                  </div>
                  <button className={btnPrimary} disabled={busy} onClick={() => seteaza(reg)}>Setează</button>
                </div>
              )}
              {admin && blocat && <p className="text-xs text-amber-700">Numărul de start nu mai poate fi schimbat: există deja documente. Dacă sunt doar documente de test, șterge-le din pagina fiecărui document (secțiunea „Ștergere definitivă”); după ce registrul și seria rămân goale, câmpul se deblochează.</p>}
              {!admin && !blocat && <p className="text-xs text-slate-500">Numărul de start îl setează adminul Hub.</p>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// Urma ștergerilor definitive (doar Admin Hub): număr, cine, când, motiv — fără conținutul documentelor
function JurnalStergeri() {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    supabase.from('sec_sters_jurnal').select('*').order('sters_la', { ascending: false }).limit(200).then(({ data }) => setRows(data || []))
  }, [])
  if (!rows || rows.length === 0) return null
  return (
    <Card className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">Jurnalul ștergerilor</h3>
      <p className="text-xs text-slate-500">Numerele care lipsesc din registre. Se păstrează doar numărul, nu și conținutul documentului.</p>
      <ul className="divide-y divide-slate-100 text-sm text-slate-700">
        {rows.map((r) => (
          <li key={r.id} className="py-1.5">
            <span className="font-semibold">{r.numar_afisat}</span> · șters la {formatData(r.sters_la)} de {r.sters_de_nume || 'cont șters'} · {r.nr_fisiere} {r.nr_fisiere === 1 ? 'fișier' : 'fișiere'} · motiv: {r.motiv}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function Setari({ role, comune, reload }) {
  return (
    <div className="space-y-4">
      <Titlu>Setări Secretariat</Titlu>
      <SeriiEditor admin={role === 'admin'} serii={comune.serii} reload={reload} />
      <Numerotare admin={role === 'admin'} serii={comune.serii} />
      {role === 'admin' && <JurnalStergeri />}
      <div className="grid gap-4 lg:grid-cols-2">
        <ListEditor tabel="sec_canale" titlu="Canale de primire / moduri de transmitere" descriere="Ex. Poștă, Curier, E-mail. Se folosesc la Intrări și la Ieșiri." reload={reload} />
        <ListEditor tabel="sec_tipuri_document" titlu="Tipuri de document" descriere="Ex. Adresă, Cerere, Factură. Un element dezactivat rămâne la documentele vechi." reload={reload} />
      </div>
    </div>
  )
}
