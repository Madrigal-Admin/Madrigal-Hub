import { useState } from 'react'
import { X as XIcon, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { IMPLICARI, culoareText } from '../lib/evenimente'
import AngajatiPicker from './AngajatiPicker'
import SelectorLocalitate from './SelectorLocalitate'

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none'
const labelCls = 'mb-1 block text-xs font-medium text-slate-600'

// Formular de creare / editare eveniment. Salvarea se face într-un singur pas
// (funcția eveniment_salveaza din baza de date): ori se salvează tot, ori nimic.
export default function EvenimentForm({ eveniment, tipuri, statusuri, angajati, onClose, onSaved }) {
  const editare = !!eveniment
  const [f, setF] = useState(() => ({
    nume: eveniment?.nume || '',
    tipuri: eveniment?.tipuri || [],
    status: eveniment?.status || 'deschis',
    data: eveniment?.data || '',
    data_sfarsit: eveniment?.data_sfarsit || '',
    ora_inceput: eveniment?.ora_inceput || '',
    ora_sfarsit: eveniment?.ora_sfarsit || '',
    locatie: eveniment?.locatie || '',
    localitate: eveniment?.localitate || '',
    judet: eveniment?.judet || '',
    siruta: eveniment?.siruta || '',
    scris: '', // text de localitate tastat dar nealeas din listă
    organizator: eveniment?.organizator || '',
    implicare: eveniment?.implicare || '',
    bilete: eveniment?.bilete === true ? 'da' : eveniment?.bilete === false ? 'nu' : '',
    pm: eveniment?.pm || [],
    necesita_rsvp: eveniment?.necesita_rsvp || false,
    necesita_costume: eveniment?.necesita_costume || false,
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }))
  const statusAles = statusuri.find((s) => s.cod === f.status)
  const esteAnulat = statusAles?.comportament === 'anulat'

  function toggleTip(cod) {
    set('tipuri', f.tipuri.includes(cod) ? f.tipuri.filter((c) => c !== cod) : [...f.tipuri, cod])
  }

  function mesajEroare(err) {
    const m = err?.message || ''
    if (m.includes('row-level security') || m.includes('permission denied')) return 'Nu ai dreptul să modifici evenimente.'
    if (m.includes('anulat') || m.includes('raport') || m.includes('invitații')) return m
    return 'Nu am putut salva evenimentul. Încearcă din nou.'
  }

  async function salveaza(e) {
    e.preventDefault()
    setError('')
    if (!f.nume.trim()) return setError('Scrie numele evenimentului.')
    if (f.tipuri.length === 0) return setError('Alege cel puțin un tip de eveniment.')
    if (!f.data) return setError('Alege data de început.')
    if (f.scris) return setError('Alege localitatea din lista de sugestii (sau șterge textul).')
    if (f.data_sfarsit && f.data_sfarsit < f.data) return setError('Data de sfârșit nu poate fi înaintea celei de început.')
    if (esteAnulat && !(eveniment?.status === f.status)) {
      const ok = window.confirm(
        'Anulezi evenimentul? Își pierde legăturile cu celelalte tool-uri (RSVP, costume, rapoarte) și nu mai poate primi rapoarte. Invitațiile existente rămân înghețate, ca istoric.'
      )
      if (!ok) return
    }
    setBusy(true)
    const { error: err } = await supabase.rpc('eveniment_salveaza', {
      p_id: eveniment?.id || null,
      p_ev: {
        nume: f.nume.trim(),
        data: f.data,
        data_sfarsit: f.data_sfarsit || f.data,
        ora_inceput: f.ora_inceput,
        ora_sfarsit: f.ora_sfarsit,
        status: f.status,
        locatie: f.locatie.trim(),
        localitate: f.localitate.trim(),
        judet: f.judet,
        siruta: f.siruta,
        organizator: f.organizator.trim(),
        implicare: f.implicare,
        bilete: f.bilete === 'da' ? true : f.bilete === 'nu' ? false : null,
        necesita_rsvp: f.necesita_rsvp,
        necesita_costume: f.necesita_costume,
      },
      p_tipuri: f.tipuri,
      p_pm: f.pm,
    })
    setBusy(false)
    if (err) return setError(mesajEroare(err))
    // Dacă s-a mutat data unui eveniment existent, anunțăm calendarul (care poate propune decalarea termenelor).
    const mutat = editare && eveniment.data && eveniment.data !== f.data && !esteAnulat
    onSaved(mutat ? { id: eveniment.id, de: eveniment.data, la: f.data } : null)
  }

  async function sterge() {
    setError('')
    if (!window.confirm(`Ștergi definitiv evenimentul „${eveniment.nume}"? Nu se poate reveni.`)) return
    setBusy(true)
    const { error: err } = await supabase.from('evenimente').delete().eq('id', eveniment.id)
    setBusy(false)
    if (err) {
      const m = err.message || ''
      if (m.includes('invitații')) return setError(m)
      if (err.code === '23503') return setError('Evenimentul are un raport post-eveniment legat. Șterge mai întâi raportul din Rapoarte.')
      return setError('Nu am putut șterge evenimentul.')
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8">
      <form onSubmit={salveaza} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{editare ? 'Editează evenimentul' : 'Eveniment nou'}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <XIcon size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>Nume *</label>
            <input className={inputCls} value={f.nume} onChange={(e) => set('nume', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Tip eveniment * (poți alege mai multe)</label>
            <div className="flex flex-wrap gap-2">
              {tipuri
                .filter((t) => t.activ || f.tipuri.includes(t.cod))
                .map((t) => {
                  const activ = f.tipuri.includes(t.cod)
                  return (
                    <button
                      key={t.cod}
                      type="button"
                      onClick={() => toggleTip(t.cod)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
                      style={{
                        backgroundColor: activ ? `${t.culoare}26` : '#f1f5f9',
                        color: activ ? culoareText(t.culoare) : '#94a3b8',
                        boxShadow: activ ? `inset 0 0 0 1.5px ${t.culoare}` : 'none',
                      }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activ ? t.culoare : '#cbd5e1' }} />
                      {t.nume}
                      {!t.activ && ' (dezactivat)'}
                    </button>
                  )
                })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Data de început *</label>
              <input type="date" className={inputCls} value={f.data} onChange={(e) => set('data', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Data de sfârșit (dacă durează mai multe zile)</label>
              <input type="date" className={inputCls} value={f.data_sfarsit} min={f.data || undefined} onChange={(e) => set('data_sfarsit', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Ora de început (opțional)</label>
              <input type="time" className={inputCls} value={f.ora_inceput} onChange={(e) => set('ora_inceput', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Ora de sfârșit (opțional)</label>
              <input type="time" className={inputCls} value={f.ora_sfarsit} onChange={(e) => set('ora_sfarsit', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Locație</label>
              <input className={inputCls} value={f.locatie} onChange={(e) => set('locatie', e.target.value)} placeholder="ex: Sala Radio" />
            </div>
            <SelectorLocalitate
              valoare={{ judet: f.judet, localitate: f.localitate, siruta: f.siruta, scris: f.scris }}
              onChange={(v) => setF((x) => ({ ...x, ...v }))}
              inputCls={inputCls}
              labelCls={labelCls}
            />
            <div>
              <label className={labelCls}>Organizator</label>
              <input className={inputCls} value={f.organizator} onChange={(e) => set('organizator', e.target.value)} placeholder="ex: Madrigal, Arcub…" />
            </div>
            <div>
              <label className={labelCls}>Implicare</label>
              <select className={inputCls} value={f.implicare} onChange={(e) => set('implicare', e.target.value)}>
                <option value="">— nespecificat —</option>
                {IMPLICARI.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Vânzare bilete</label>
              <select className={inputCls} value={f.bilete} onChange={(e) => set('bilete', e.target.value)}>
                <option value="">— nespecificat —</option>
                <option value="da">Da</option>
                <option value="nu">Nu</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>
                {statusuri.map((s) => (
                  <option key={s.cod} value={s.cod}>{s.nume}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Coordonator / PM (unul sau mai mulți)</label>
            <AngajatiPicker angajati={angajati} valoare={f.pm} onChange={(v) => set('pm', v)} />
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.necesita_rsvp && !esteAnulat} disabled={esteAnulat} onChange={(e) => set('necesita_rsvp', e.target.checked)} />
              Necesită RSVP (Invitații)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.necesita_costume && !esteAnulat} disabled={esteAnulat} onChange={(e) => set('necesita_costume', e.target.checked)} />
              Necesită costume
            </label>
            {esteAnulat && <span className="text-xs text-rose-600">Un eveniment anulat nu are RSVP, costume sau rapoarte.</span>}
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            {editare && (
              <button type="button" onClick={sterge} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                <Trash2 size={14} /> Șterge
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Renunță
            </button>
            <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
              {busy ? 'Se salvează…' : 'Salvează'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
