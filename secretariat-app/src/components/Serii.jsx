import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { REGISTRE, esteStaff } from '../lib/roluri'
import { azi, mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Eroare, Fereastra } from './comun'

// „INT RU 7/2026” — același format ca în baza de date
export function numarDin(registru, doc, serii) {
  const serie = serii.find((s) => s.id === doc.serie_id)
  return `${REGISTRE[registru].prefix} ${serie?.cod || '?'} ${doc.nr}/${doc.an}`
}

// Filtrul cu serii deasupra listei (Toate · RU · CTB …)
export function SerieChips({ serii, valoare, onChange }) {
  const chip = (activ) =>
    `rounded-full border px-3.5 py-1 text-[13px] font-semibold focus-ring ${activ ? 'border-accent bg-accent text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Serie">
      <button type="button" className={chip(!valoare)} aria-pressed={!valoare} onClick={() => onChange('')}>Toate</button>
      {serii.map((s) => (
        <button key={s.id} type="button" title={`${s.denumire}${s.activ ? '' : ' (dezactivată)'}`} aria-pressed={valoare === s.id}
          className={`${chip(valoare === s.id)} ${s.activ ? '' : 'opacity-60'}`} onClick={() => onChange(s.id)}>
          {s.cod}
        </button>
      ))}
    </div>
  )
}

// Lista de alegere a seriei într-un formular (doar serii active; seria deja aleasă rămâne vizibilă)
export function SerieSelect({ serii, valoare, onChange, dezactivat = false, id = 'serie' }) {
  const vizibile = serii.filter((s) => s.activ || s.id === valoare)
  return (
    <div>
      <label className={labelCls} htmlFor={id}>Serie *</label>
      <select id={id} className={inputCls} value={valoare} disabled={dezactivat} onChange={(e) => onChange(e.target.value)}>
        <option value="">Alege seria…</option>
        {vizibile.map((s) => <option key={s.id} value={s.id}>{s.cod} — {s.denumire}</option>)}
      </select>
    </div>
  )
}

// Butonul „Adaugă loc liber”: rezervă una sau mai multe numere goale, completate mai târziu cu „Completează”
export function LocLiber({ registru, role, serii, serieImplicita, onGata }) {
  const info = REGISTRE[registru]
  const [deschis, setDeschis] = useState(false)
  const [serie, setSerie] = useState('')
  const [cate, setCate] = useState(1)
  const [data, setData] = useState(azi())
  const [urmator, setUrmator] = useState(null)
  const [eroare, setEroare] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!deschis || !serie) { setUrmator(null); return }
    let anulat = false
    supabase.from('sec_contoare').select('ultim_nr').eq('registru', registru).eq('serie_id', serie).eq('an', Number(data.slice(0, 4)))
      .maybeSingle().then(({ data: c }) => { if (!anulat) setUrmator((c?.ultim_nr || 0) + 1) })
    return () => { anulat = true }
  }, [deschis, serie, data, registru])

  if (!esteStaff(role)) return null
  const codSerie = serii.find((s) => s.id === serie)?.cod

  function deschide() {
    setSerie(serieImplicita || '')
    setCate(1)
    setData(azi())
    setEroare('')
    setDeschis(true)
  }

  async function rezerva(e) {
    e.preventDefault()
    setEroare('')
    if (!serie) return setEroare('Alege seria.')
    setBusy(true)
    const { data: rez, error } = await supabase.rpc('sec_rezerva_locuri', { p_registru: registru, p_serie: serie, p_cate: Number(cate), p_data: data })
    setBusy(false)
    if (error) return setEroare(mesajEroare(error))
    const numere = (rez || []).map((d) => numarDin(registru, d, serii))
    setDeschis(false)
    onGata(numere.length === 1 ? `Loc liber rezervat: ${numere[0]}.` : `Locuri libere rezervate: ${numere.join(', ')}.`)
  }

  return (
    <>
      <button type="button" className={btnGhost} onClick={deschide}>Adaugă loc liber</button>
      {deschis && (
        <Fereastra titlu="Adaugă loc liber" subtitlu={`${info.label} · rezervă numere goale, pe care le completezi mai târziu`} latime="max-w-md" onInchide={() => setDeschis(false)}>
          <form onSubmit={rezerva} className="space-y-4">
            <Eroare>{eroare}</Eroare>
            <SerieSelect serii={serii} valoare={serie} onChange={setSerie} id="serie_liber" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="cate_liber">Câte locuri</label>
                <input id="cate_liber" type="number" min="1" max="20" className={inputCls} value={cate} onChange={(e) => setCate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="data_liber">Data rezervării</label>
                <input id="data_liber" type="date" className={inputCls} value={data} max={azi()} min={`${new Date().getFullYear()}-01-01`} onChange={(e) => setData(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {serie && urmator
                ? <>Se rezervă începând cu <strong className="text-slate-800">{info.prefix} {codSerie} {urmator}/{data.slice(0, 4)}</strong>. </>
                : null}
              Rândul rămâne gol până îl completezi cu „Completează”. Dacă nu se folosește, îl anulezi, iar numărul rămâne în registru.
            </p>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={busy}>{busy ? 'Se rezervă…' : 'Rezervă'}</button>
              <button type="button" className={btnGhost} onClick={() => setDeschis(false)}>Renunță</button>
            </div>
          </form>
        </Fereastra>
      )}
    </>
  )
}
