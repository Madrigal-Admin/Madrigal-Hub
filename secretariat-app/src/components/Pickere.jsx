import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Eroare } from './comun'

const curata = (t) => t.replace(/[,()*%\\:]/g, ' ').trim()

// Alegerea unui contact (expeditor / destinatar) cu autocompletare și adăugare pe loc.
export function ContactPicker({ eticheta, valoare, onChange, poateAdauga }) {
  const [text, setText] = useState(valoare?.denumire || '')
  const [optiuni, setOptiuni] = useState([])
  const [deschis, setDeschis] = useState(false)
  const [nou, setNou] = useState(null) // { denumire, tip, email, telefon }
  const [eroare, setEroare] = useState('')
  const [busy, setBusy] = useState(false)
  const radacina = useRef(null)

  useEffect(() => { if (valoare) setText(valoare.denumire) }, [valoare])

  useEffect(() => {
    if (!deschis) return
    const handle = setTimeout(async () => {
      const t = curata(text)
      let q = supabase.from('sec_contacte').select('id, denumire, tip').eq('activ', true).order('denumire').limit(8)
      if (t) q = q.ilike('denumire', `%${t}%`)
      const { data } = await q
      setOptiuni(data || [])
    }, 200)
    return () => clearTimeout(handle)
  }, [text, deschis])

  useEffect(() => {
    const afara = (e) => { if (radacina.current && !radacina.current.contains(e.target)) setDeschis(false) }
    document.addEventListener('mousedown', afara)
    return () => document.removeEventListener('mousedown', afara)
  }, [])

  function alege(c) {
    onChange(c)
    setText(c.denumire)
    setDeschis(false)
    setNou(null)
  }

  async function salveazaNou() {
    setEroare('')
    if (!nou.denumire.trim()) return setEroare('Scrie denumirea contactului.')
    setBusy(true)
    const { data, error } = await supabase
      .from('sec_contacte')
      .insert({
        denumire: nou.denumire.trim(),
        tip: nou.tip,
        email: nou.email.trim() || null,
        telefon: nou.telefon.trim() || null,
      })
      .select('id, denumire, tip')
      .single()
    setBusy(false)
    if (error) return setEroare(mesajEroare(error))
    alege(data)
  }

  return (
    <div ref={radacina} className="relative">
      <label className={labelCls}>{eticheta} *</label>
      <div className="relative">
        <input
          className={inputCls}
          value={text}
          onChange={(e) => { setText(e.target.value); onChange(null); setDeschis(true) }}
          onFocus={() => setDeschis(true)}
          placeholder="Începe să scrii denumirea…"
          autoComplete="off"
        />
        {valoare && (
          <button type="button" aria-label="Șterge alegerea" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            onClick={() => { onChange(null); setText('') }}>
            <X size={15} />
          </button>
        )}
      </div>
      {deschis && !valoare && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {optiuni.map((c) => (
            <button key={c.id} type="button" onClick={() => alege(c)} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">
              {c.denumire} <span className="text-xs text-slate-400">{c.tip === 'persoana' ? 'persoană' : 'instituție'}</span>
            </button>
          ))}
          {optiuni.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Niciun contact găsit.</p>}
          {poateAdauga && text.trim() && (
            <button type="button" className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-accent hover:bg-slate-50"
              onClick={() => { setNou({ denumire: text.trim(), tip: 'institutie', email: '', telefon: '' }); setDeschis(false) }}>
              + Adaugă contact nou: „{text.trim()}”
            </button>
          )}
        </div>
      )}
      {nou && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">Contact nou</p>
          <Eroare>{eroare}</Eroare>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Denumire *</label>
              <input className={inputCls} value={nou.denumire} onChange={(e) => setNou({ ...nou, denumire: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Tip</label>
              <select className={inputCls} value={nou.tip} onChange={(e) => setNou({ ...nou, tip: e.target.value })}>
                <option value="institutie">Instituție</option>
                <option value="persoana">Persoană</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input className={inputCls} value={nou.telefon} onChange={(e) => setNou({ ...nou, telefon: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>E-mail</label>
              <input type="email" className={inputCls} value={nou.email} onChange={(e) => setNou({ ...nou, email: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={salveazaNou}>Salvează contactul</button>
            <button type="button" className={btnGhost} onClick={() => setNou(null)}>Renunță</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Persoană sau departament (ex. „Repartizat către”, „Inițiator”)
export function RespPicker({ eticheta, angajatId, grupId, onChange, comune, obligatoriu = true }) {
  const [mod, setMod] = useState(grupId ? 'grup' : 'persoana')
  const activi = comune.angajati.filter((a) => a.activ || a.id === angajatId)
  return (
    <div>
      <label className={labelCls}>{eticheta}{obligatoriu ? ' *' : ''}</label>
      <div className="mb-1.5 flex gap-4 text-sm text-slate-600">
        {[['persoana', 'Persoană'], ['grup', 'Departament']].map(([k, l]) => (
          <label key={k} className="inline-flex items-center gap-1.5">
            <input type="radio" checked={mod === k} onChange={() => { setMod(k); onChange({ angajatId: '', grupId: '' }) }} /> {l}
          </label>
        ))}
      </div>
      {mod === 'persoana' ? (
        <select className={inputCls} value={angajatId || ''} onChange={(e) => onChange({ angajatId: e.target.value, grupId: '' })}>
          <option value="">Alege persoana…</option>
          {activi.map((a) => <option key={a.id} value={a.id}>{a.nume_complet}</option>)}
        </select>
      ) : (
        <select className={inputCls} value={grupId || ''} onChange={(e) => onChange({ angajatId: '', grupId: e.target.value })}>
          <option value="">Alege departamentul…</option>
          {comune.grupuri.map((g) => <option key={g.id} value={g.id}>{g.nume}</option>)}
        </select>
      )}
    </div>
  )
}

// Alegerea unui alt document din registre (legătură Intrare ↔ Ieșire), după număr sau obiect
export function DocPicker({ eticheta, valoare, onChange, excludeId }) {
  const [text, setText] = useState('')
  const [optiuni, setOptiuni] = useState([])
  const [deschis, setDeschis] = useState(false)
  const radacina = useRef(null)

  useEffect(() => {
    if (!deschis) return
    const handle = setTimeout(async () => {
      const t = curata(text)
      let q = supabase.from('sec_documente_lista').select('id, numar_afisat, obiect, contact_denumire, status')
        .neq('status', 'anulat').order('created_at', { ascending: false }).limit(8)
      if (excludeId) q = q.neq('id', excludeId)
      if (t) q = q.or(`numar_afisat.ilike.%${t}%,obiect.ilike.%${t}%,contact_denumire.ilike.%${t}%`)
      const { data } = await q
      setOptiuni(data || [])
    }, 250)
    return () => clearTimeout(handle)
  }, [text, deschis, excludeId])

  useEffect(() => {
    const afara = (e) => { if (radacina.current && !radacina.current.contains(e.target)) setDeschis(false) }
    document.addEventListener('mousedown', afara)
    return () => document.removeEventListener('mousedown', afara)
  }, [])

  return (
    <div ref={radacina} className="relative">
      <label className={labelCls}>{eticheta}</label>
      {valoare ? (
        <div className={`${inputCls} flex items-center justify-between`}>
          <span className="truncate">{valoare.numar_afisat} — {valoare.obiect}</span>
          <button type="button" aria-label="Șterge legătura" className="text-slate-400 hover:text-slate-600" onClick={() => onChange(null)}><X size={15} /></button>
        </div>
      ) : (
        <input className={inputCls} value={text} placeholder="Caută după număr, expeditor sau obiect…"
          onChange={(e) => { setText(e.target.value); setDeschis(true) }} onFocus={() => setDeschis(true)} autoComplete="off" />
      )}
      {deschis && !valoare && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {optiuni.map((d) => (
            <button key={d.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => { onChange(d); setDeschis(false); setText('') }}>
              <span className="font-semibold text-accent">{d.numar_afisat}</span> · {d.contact_denumire} · <span className="text-slate-500">{d.obiect}</span>
            </button>
          ))}
          {optiuni.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">Niciun document găsit.</p>}
        </div>
      )}
    </div>
  )
}

// Alegerea mai multor angajați (lista persoanelor numite la un document confidențial)
export function AngajatiMulti({ eticheta, valoare, onChange, comune }) {
  const [alege, setAlege] = useState('')
  const disponibili = comune.angajati.filter((a) => a.activ && !valoare.includes(a.id))
  return (
    <div>
      <label className={labelCls}>{eticheta}</label>
      <div className="flex flex-wrap gap-1.5">
        {valoare.map((id) => {
          const a = comune.angajati.find((x) => x.id === id)
          return (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
              {a?.nume_complet || 'Angajat șters'}
              <button type="button" aria-label="Elimină" onClick={() => onChange(valoare.filter((v) => v !== id))}><X size={12} /></button>
            </span>
          )
        })}
        {valoare.length === 0 && <span className="text-xs text-slate-400">Nimeni numit încă.</span>}
      </div>
      <select className={`${inputCls} mt-2`} value={alege} onChange={(e) => { if (e.target.value) onChange([...valoare, e.target.value]); setAlege('') }}>
        <option value="">Adaugă o persoană…</option>
        {disponibili.map((a) => <option key={a.id} value={a.id}>{a.nume_complet}</option>)}
      </select>
    </div>
  )
}
