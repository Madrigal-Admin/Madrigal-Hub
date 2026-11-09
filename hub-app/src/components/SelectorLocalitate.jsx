import { useEffect, useRef, useState } from 'react'
import { STRAINATATE, cauta, etichetaLocalitate, incarcaSiruta, potriveste } from '../lib/siruta'

// Județ + localitate din lista oficială (SIRUTA). Valoare: { judet, localitate, siruta, scris }.
//  - `scris` = text tastat care nu a fost ales din listă (formularul nu se salvează cât timp e nenul)
//  - „În afara României": județul devine „În afara României", iar localitatea se scrie liber (oraș, țară)
export default function SelectorLocalitate({ valoare, onChange, inputCls, labelCls }) {
  const [date, setDate] = useState(null)
  const [eroareDate, setEroareDate] = useState(false)
  const [text, setText] = useState(valoare.localitate || '')
  const [deschis, setDeschis] = useState(false)
  const [activ, setActiv] = useState(0)
  const [auto, setAuto] = useState('') // mesaj după potrivirea automată a unei valori vechi
  const radacina = useRef(null)
  const initial = useRef(valoare)
  const strain = valoare.judet === STRAINATATE

  useEffect(() => {
    incarcaSiruta().then(setDate).catch(() => setEroareDate(true))
  }, [])

  // valoare veche, scrisă liber: o potrivim automat dacă e fără dubiu
  useEffect(() => {
    const v = initial.current
    if (!date || !v.localitate || v.siruta || v.judet === STRAINATATE) return
    const e = potriveste(date, v.localitate, v.judet)
    if (e) {
      setText(e.nume)
      setAuto(`Potrivit automat din „${v.localitate}". Verifică și salvează.`)
      onChange({ judet: e.judet, localitate: e.nume, siruta: e.siruta, scris: '' })
    }
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const inchide = (ev) => { if (radacina.current && !radacina.current.contains(ev.target)) setDeschis(false) }
    document.addEventListener('mousedown', inchide)
    return () => document.removeEventListener('mousedown', inchide)
  }, [])

  const sugestii = date && deschis && !strain ? cauta(date, text, valoare.judet) : []

  function alege(e) {
    setText(e.nume)
    setDeschis(false)
    setAuto('')
    onChange({ judet: e.judet, localitate: e.nume, siruta: e.siruta, scris: '' })
  }
  function schimbaText(t) {
    setText(t)
    setAuto('')
    setDeschis(true)
    setActiv(0)
    if (strain) return onChange({ ...valoare, localitate: t, siruta: '', scris: '' })
    // tastare liberă: nimic ales până nu apeși pe o sugestie; textul rămâne „scris" și blochează salvarea
    onChange({ ...valoare, localitate: '', siruta: '', scris: t.trim() })
  }
  function schimbaJudet(j) {
    setAuto('')
    if (j === STRAINATATE) {
      setText('')
      return onChange({ judet: STRAINATATE, localitate: '', siruta: '', scris: '' })
    }
    const schimbatDeJudet = strain || (valoare.judet && j !== valoare.judet)
    if (schimbatDeJudet) setText('')
    // textul vechi/tastat rămâne ca „nealeas" (blochează salvarea) – nu-l pierdem pe tăcute
    onChange({ judet: j, localitate: '', siruta: '', scris: schimbatDeJudet ? '' : text.trim() })
  }
  function tasta(ev) {
    if (!sugestii.length) return
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActiv((a) => Math.min(a + 1, sugestii.length - 1)) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActiv((a) => Math.max(a - 1, 0)) }
    else if (ev.key === 'Enter') { ev.preventDefault(); alege(sugestii[activ]) }
    else if (ev.key === 'Escape') { ev.stopPropagation(); setDeschis(false) }
  }

  const veche = !auto && !valoare.siruta && !strain && valoare.localitate && !valoare.scris
  return (
    <>
      <div>
        <label className={labelCls}>Județ</label>
        <select className={inputCls} value={valoare.judet || ''} onChange={(e) => schimbaJudet(e.target.value)}>
          <option value="">— alege —</option>
          {(date?.judete || []).map((j) => <option key={j} value={j}>{j}</option>)}
          <option value={STRAINATATE}>{STRAINATATE}</option>
        </select>
      </div>
      <div ref={radacina} className="relative">
        <label className={labelCls}>{strain ? 'Oraș, țară' : 'Localitate'}</label>
        <input
          className={inputCls}
          value={text}
          maxLength={100}
          autoComplete="off"
          role={strain ? undefined : 'combobox'}
          aria-expanded={!strain && deschis && sugestii.length > 0}
          placeholder={strain ? 'ex: Viena, Austria' : date ? 'Scrie primele litere, ex: Cluj' : 'Se încarcă lista…'}
          disabled={!strain && !date && !eroareDate}
          onChange={(e) => schimbaText(e.target.value)}
          onFocus={() => setDeschis(true)}
          onKeyDown={tasta}
        />
        {sugestii.length > 0 && (
          <ul role="listbox" className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#D5DAE3] bg-white py-1 shadow-lg">
            {sugestii.map((e, i) => (
              <li key={e.siruta + e.nume}>
                <button type="button" role="option" aria-selected={i === activ} onMouseDown={(ev) => { ev.preventDefault(); alege(e) }} onMouseEnter={() => setActiv(i)} className={`block w-full px-3 py-2 text-left text-sm text-[#172036] ${i === activ ? 'bg-[#EEF3FB]' : ''}`}>
                  {etichetaLocalitate(e)} <span className="text-xs text-[#5B6578]">· {e.judet}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {deschis && !strain && date && text.trim() && sugestii.length === 0 && (
          <p className="mt-1 text-xs text-[#8A4B12]">Nicio localitate găsită. Dacă evenimentul e în afara țării, alege „{STRAINATATE}" la județ.</p>
        )}
        {eroareDate && <p className="mt-1 text-xs text-rose-600">Nu am putut încărca lista de localități. Reîncarcă pagina.</p>}
        {auto && <p className="mt-1 text-xs text-[#1E6B43]">{auto}</p>}
        {veche && <p className="mt-1 text-xs text-[#8A4B12]">Valoare veche, scrisă liber: „{valoare.localitate}". Alege localitatea din listă ca să fie corectă.</p>}
        {valoare.scris && !strain && <p className="mt-1 text-xs text-[#8A4B12]">Alege localitatea dintre sugestii.</p>}
      </div>
    </>
  )
}
