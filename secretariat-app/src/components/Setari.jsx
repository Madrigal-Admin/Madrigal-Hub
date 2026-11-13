import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { REGISTRE } from '../lib/roluri'
import { formatData, mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
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

// Numărul de start al fiecărui registru, pe anul curent (doar Admin Hub, doar cât timp nu există documente)
function Numerotare({ admin }) {
  const an = new Date().getFullYear()
  const [stare, setStare] = useState({})
  const [valori, setValori] = useState({ intrari: { nr: '', data: '' }, iesiri: { nr: '', data: '' }, circuit: { nr: '', data: '' } })
  const [eroare, setEroare] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [busy, setBusy] = useState(false)

  async function incarca() {
    const out = {}
    for (const reg of ['intrari', 'iesiri', 'circuit']) {
      const [{ data: c }, { count }] = await Promise.all([
        supabase.from('sec_contoare').select('*').eq('registru', reg).eq('an', an).maybeSingle(),
        supabase.from('sec_documente').select('id', { count: 'exact', head: true }).eq('registru', reg).eq('an', an),
      ])
      out[reg] = { contor: c, documente: count || 0 }
    }
    setStare(out)
  }
  useEffect(() => { incarca() }, [])

  async function seteaza(reg) {
    setEroare('')
    setMesaj('')
    const v = valori[reg]
    if (!v.nr || Number(v.nr) < 1) return setEroare('Scrie numărul cu care începe registrul (cel puțin 1).')
    if (!v.data) return setEroare('Alege data de la care Hub-ul ține registrul.')
    setBusy(true)
    const { error } = await supabase.rpc('sec_seteaza_start', { p_registru: reg, p_an: an, p_urmatorul: Number(v.nr), p_data: v.data })
    setBusy(false)
    if (error) return setEroare(mesajEroare(error))
    setMesaj(`Registrul de ${REGISTRE[reg].label.toLowerCase()} va începe de la numărul ${v.nr}.`)
    incarca()
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Numerotarea pe {an}</h3>
        <p className="text-xs text-slate-500">
          Numerotarea reîncepe la 1 în fiecare an. Dacă registrul de hârtie a ajuns deja la un număr, setează aici numărul de la care continuă Hub-ul
          și data de start. Se poate face doar cât timp nu există nicio înregistrare în registrul respectiv pe {an}.
        </p>
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
              <p className="text-sm font-semibold text-slate-700">{REGISTRE[reg].label} ({REGISTRE[reg].prefix})</p>
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
              {admin && blocat && <p className="text-xs text-amber-700">Numărul de start nu mai poate fi schimbat: există deja documente. Dacă sunt doar documente de test, șterge-le din pagina fiecărui document (secțiunea „Ștergere definitivă”); după ce registrul rămâne gol, câmpul se deblochează.</p>}
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

export default function Setari({ role, reload }) {
  return (
    <div className="space-y-4">
      <Titlu>Setări Secretariat</Titlu>
      <Numerotare admin={role === 'admin'} />
      {role === 'admin' && <JurnalStergeri />}
      <div className="grid gap-4 lg:grid-cols-2">
        <ListEditor tabel="sec_canale" titlu="Canale de primire / moduri de transmitere" descriere="Ex. Poștă, Curier, E-mail. Se folosesc la Intrări și la Ieșiri." reload={reload} />
        <ListEditor tabel="sec_tipuri_document" titlu="Tipuri de document" descriere="Ex. Adresă, Cerere, Factură. Un element dezactivat rămâne la documentele vechi." reload={reload} />
      </div>
    </div>
  )
}
