import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { BUCKET } from '../lib/fisiere'
import { REGISTRE } from '../lib/roluri'
import { mesajEroare } from '../lib/util'
import { btnDanger, btnGhost, inputCls, labelCls } from '../lib/ui'
import { Card, Eroare } from './comun'

// Ștergerea definitivă a unui document (doar Admin Hub). Arată lanțul de documente legate
// (Intrare ↔ Circuit ↔ Ieșire), cere motivul, șterge ÎNTÂI fișierele din Storage, apoi documentele.
export default function StergereDocument({ doc, onSters }) {
  const [lant, setLant] = useState(null) // null = închis
  const [mod, setMod] = useState('unul') // 'unul' | 'tot'
  const [motiv, setMotiv] = useState('')
  const [eroare, setEroare] = useState('')
  const [busy, setBusy] = useState(false)

  async function deschide() {
    setEroare('')
    setBusy(true)
    const { data, error } = await supabase.rpc('sec_lant_legat', { p_id: doc.id })
    setBusy(false)
    if (error) return setEroare(mesajEroare(error))
    setMod('unul')
    setMotiv('')
    setLant(data || [])
  }

  const alese = lant ? (mod === 'tot' ? lant : lant.filter((d) => d.id === doc.id)) : []
  const nrFisiere = alese.reduce((s, d) => s + (d.cai || []).length, 0)
  const legate = lant ? lant.filter((d) => d.id !== doc.id) : []

  async function sterge() {
    setEroare('')
    setBusy(true)
    // 1. Fișierele din spațiul de stocare (dacă eșuează aici, nu s-a șters niciun document)
    const cai = alese.flatMap((d) => d.cai || [])
    if (cai.length > 0) {
      const { error } = await supabase.storage.from(BUCKET).remove(cai)
      if (error) {
        setBusy(false)
        return setEroare(`Fișierele nu au putut fi șterse: ${mesajEroare(error)}. Nu s-a șters niciun document; poți reîncerca.`)
      }
    }
    // 2. Documentele (funcția refuză dacă au rămas fișiere în Storage)
    const { error } = await supabase.rpc('sec_sterge_documente', { p_ids: alese.map((d) => d.id), p_motiv: motiv })
    setBusy(false)
    if (error) return setEroare(mesajEroare(error))
    onSters(alese.length)
  }

  if (!lant) {
    return (
      <Card className="space-y-2 border-red-200">
        <h3 className="text-sm font-semibold text-red-800">Ștergere definitivă (doar admin Hub)</h3>
        <p className="text-xs text-slate-500">
          Pentru înregistrări de test sau făcute din greșeală. Documentele reale se anulează, ca numărul să rămână în registru.
        </p>
        <Eroare>{eroare}</Eroare>
        <button className={btnDanger} disabled={busy} onClick={deschide}><Trash2 size={14} /> Șterge definitiv…</button>
      </Card>
    )
  }

  return (
    <Card className="space-y-3 border-red-300">
      <h3 className="text-sm font-semibold text-red-800">Ștergere definitivă — nu se poate desface</h3>
      {legate.length > 0 ? (
        <>
          <p className="text-sm text-slate-700">Acest document este legat de {legate.length} {legate.length === 1 ? 'alt document' : 'alte documente'}:</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {lant.map((d) => (
              <li key={d.id}>
                <span className="font-semibold">{d.numar_afisat}</span> ({REGISTRE[d.registru]?.label}) — {d.obiect}
                {d.id === doc.id && <span className="text-xs text-slate-500"> · acesta</span>}
                <span className="text-xs text-slate-500"> · {(d.cai || []).length} {(d.cai || []).length === 1 ? 'fișier' : 'fișiere'}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 text-sm text-slate-700">
            <label className="flex items-start gap-2">
              <input type="radio" name="mod_sters" className="mt-1" checked={mod === 'unul'} onChange={() => setMod('unul')} />
              <span>Șterge doar {doc.numar_afisat}. Celelalte rămân, iar legăturile cu documentul șters dispar.</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="mod_sters" className="mt-1" checked={mod === 'tot'} onChange={() => setMod('tot')} />
              <span>Șterge tot lanțul legat ({lant.length} documente).</span>
            </label>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-700">Documentul {doc.numar_afisat} nu este legat de alte documente.</p>
      )}
      <p className="text-sm text-slate-700">
        Se vor șterge definitiv: {alese.map((d) => d.numar_afisat).join(', ')} și {nrFisiere} {nrFisiere === 1 ? 'fișier' : 'fișiere'} din spațiul de stocare.
        Numerele rămân goale în registru; în Setări rămâne o urmă (număr, cine, când, motiv), fără conținut.
      </p>
      <div className="max-w-md">
        <label className={labelCls} htmlFor="motiv_sters">Motivul ștergerii *</label>
        <input id="motiv_sters" className={inputCls} value={motiv} maxLength={300} onChange={(e) => setMotiv(e.target.value)} placeholder="ex. înregistrare de test" />
      </div>
      <Eroare>{eroare}</Eroare>
      <div className="flex flex-wrap gap-2">
        <button className={btnDanger} disabled={busy || motiv.trim().length < 3} onClick={sterge}>
          {busy ? 'Se șterge…' : `Șterge definitiv ${alese.length} ${alese.length === 1 ? 'document' : 'documente'}`}
        </button>
        <button className={btnGhost} disabled={busy} onClick={() => setLant(null)}>Renunță</button>
      </div>
    </Card>
  )
}
