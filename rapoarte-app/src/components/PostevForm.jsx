import { useEffect, useMemo, useState } from 'react'
import { Save, Plus, Trash2, X as XIcon } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { formatData } from '../lib/luni'
import { inputCls, labelCls, btnPrimary, btnGhost, cardCls } from '../lib/ui'
import {
  IMPLICARI, normalizeaza, campuriVizibile, valideaza, curataLocalitati, totalEvenimente,
} from '../lib/postev'

const contactGol = () => ({ institutie: '', persoana: '', telefon: '', email: '' })

// Punctul de plecare: valorile copiate din calendar (sau cele ale raportului existent)
function formularInitial({ eveniment, raport, cfg, angajatCurent }) {
  if (raport) {
    return {
      tipuri: raport.tipuri || [],
      responsabil_angajat_id: raport.responsabil_angajat_id || '',
      data_inceput: raport.data_inceput || '',
      data_sfarsit: raport.data_sfarsit || '',
      localitati: (raport.localitati || []).map((l) => ({ localitate: l.localitate, nr: String(l.nr) })),
      locatie: raport.locatie || '',
      echipa: raport.echipa || [],
      denumire_oficiala: raport.denumire_oficiala || '',
      implicare: raport.implicare || '',
      valori: raport.valori || {},
      bife: raport.bife || {},
      contacte: raport.contacte?.length ? raport.contacte : [contactGol()],
    }
  }
  // responsabil: primul PM al evenimentului din calendar, altfel autorul
  const potrivit = (eveniment?.pm_ids || []).map((id) => cfg.angajati.find((a) => a.id === id)).find(Boolean) || null
  return {
    tipuri: (eveniment?.tipuri_coduri || []).filter((c) => cfg.tipuri.some((t) => t.cod === c && t.activ)),
    responsabil_angajat_id: potrivit?.id || angajatCurent?.id || '',
    data_inceput: eveniment?.data || '',
    data_sfarsit: eveniment?.data_sfarsit || eveniment?.data || '',
    localitati: [{ localitate: '', nr: '1' }],
    locatie: eveniment?.locatie || '',
    echipa: [],
    denumire_oficiala: eveniment?.nume || '',
    implicare: IMPLICARI.includes(eveniment?.implicare) ? eveniment.implicare : '',
    valori: {},
    bife: {},
    contacte: [contactGol()],
  }
}

export default function PostevForm({ eveniment, raport, cfg, angajatCurent, onSaved, onCancel }) {
  const editare = !!raport
  const [f, setF] = useState(() => formularInitial({ eveniment, raport, cfg, angajatCurent }))
  const [sugestiiLocalitati, setSugestiiLocalitati] = useState([])
  const [externi, setExterni] = useState([])
  const [angajatEchipa, setAngajatEchipa] = useState('')
  const [externNou, setExternNou] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('rap_localitati').then(({ data }) => setSugestiiLocalitati((data || []).map((r) => r.localitate)))
    supabase.from('rap_echipa_externi').select('nume').order('nume').then(({ data }) => setExterni((data || []).map((r) => r.nume)))
  }, [])

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const vizibile = useMemo(
    () => campuriVizibile(cfg.campuri, cfg.matrice, f.tipuri, f.implicare),
    [cfg, f.tipuri, f.implicare]
  )
  const total = totalEvenimente(f.localitati)

  function comutaTip(cod) {
    set('tipuri', f.tipuri.includes(cod) ? f.tipuri.filter((t) => t !== cod) : [...f.tipuri, cod])
  }

  function adaugaAngajat() {
    if (!angajatEchipa) return
    const a = cfg.angajati.find((x) => x.id === angajatEchipa)
    if (!a || f.echipa.some((p) => p.angajat_id === a.id)) return
    set('echipa', [...f.echipa, { tip: 'angajat', angajat_id: a.id, nume: a.nume_complet }])
    setAngajatEchipa('')
  }

  function adaugaExtern() {
    const nume = externNou.trim()
    if (!nume) return
    if (f.echipa.some((p) => p.tip === 'extern' && normalizeaza(p.nume) === normalizeaza(nume))) return
    set('echipa', [...f.echipa, { tip: 'extern', nume }])
    setExternNou('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const err = valideaza(f, vizibile)
    if (err) return setError(err)

    setSaving(true)
    const payload = {
      responsabil_angajat_id: f.responsabil_angajat_id,
      tipuri: f.tipuri,
      data_inceput: f.data_inceput,
      data_sfarsit: f.data_sfarsit,
      localitati: curataLocalitati(f.localitati),
      locatie: f.locatie.trim(),
      echipa: f.echipa,
      denumire_oficiala: f.denumire_oficiala.trim(),
      implicare: f.implicare,
      valori: f.valori,
      bife: f.bife,
      contacte: f.contacte.filter((r) => Object.values(r).some((x) => String(x).trim())),
    }

    const res = editare
      ? await supabase.from('rap_postev').update(payload).eq('id', raport.id)
      : await supabase.from('rap_postev').insert({ ...payload, eveniment_id: eveniment?.id || null })

    if (res.error) {
      setSaving(false)
      setError(
        res.error.code === '23505'
          ? 'Pentru acest eveniment există deja un raport.'
          : res.error.message || 'Nu am putut salva raportul.'
      )
      return
    }

    // reținem colaboratorii externi noi pentru rapoartele următoare
    for (const p of f.echipa.filter((x) => x.tip === 'extern' && !externi.some((n) => normalizeaza(n) === normalizeaza(x.nume)))) {
      await supabase.from('rap_echipa_externi').insert({ nume: p.nume })
    }
    setSaving(false)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className={cardCls}>
        <h3 className="font-display text-base font-semibold text-slate-800">
          {editare ? 'Corectează raportul post-eveniment' : 'Raport post-eveniment'}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {editare
            ? raport.eveniment_manual ? 'Eveniment introdus manual (nu e în calendar).' : `Eveniment din calendar: ${raport.eveniment_nume}`
            : eveniment
              ? `Eveniment din calendar: ${eveniment.nume} · ${formatData(eveniment.data)}${eveniment.data_sfarsit && eveniment.data_sfarsit !== eveniment.data ? ` – ${formatData(eveniment.data_sfarsit)}` : ''}`
              : 'Eveniment care nu e în calendar — raportul va fi marcat ca introdus manual.'}
        </p>
        <p className="mt-1 text-xs text-slate-400">Valorile din calendar sunt precompletate; le poți corecta.</p>
      </div>

      {/* ---- Câmpuri comune ---- */}
      <div className={`${cardCls} space-y-4`}>
        <p className="text-sm font-semibold text-slate-700">Informații generale</p>

        <div>
          <label className={labelCls}>Responsabil de eveniment *</label>
          <select className={inputCls} value={f.responsabil_angajat_id} onChange={(e) => set('responsabil_angajat_id', e.target.value)}>
            <option value="">— Alege —</option>
            {cfg.angajati.filter((a) => a.activ || a.id === f.responsabil_angajat_id).map((a) => (
              <option key={a.id} value={a.id}>{a.nume_complet}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Tipul evenimentului * (poți bifa mai multe)</label>
          <div className="flex flex-wrap gap-2">
            {cfg.tipuri.filter((t) => t.activ || f.tipuri.includes(t.cod)).map((t) => (
              <label
                key={t.cod}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                  f.tipuri.includes(t.cod) ? 'border-accent bg-accent/10 text-accent' : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                <input type="checkbox" className="hidden" checked={f.tipuri.includes(t.cod)} onChange={() => comutaTip(t.cod)} />
                {t.nume}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Tipurile vin din etichetele din calendar; le poți corecta. Fiecare tip deschide câmpurile lui.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Data de început a evenimentului *</label>
            <input type="date" className={inputCls} value={f.data_inceput} onChange={(e) => set('data_inceput', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Data de încheiere a evenimentului *</label>
            <input type="date" className={inputCls} value={f.data_sfarsit} min={f.data_inceput || undefined} onChange={(e) => set('data_sfarsit', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Localitățile și numărul de evenimente din fiecare *</label>
          <p className="mb-2 text-xs text-slate-500">
            O linie pentru fiecare localitate, cu numărul de evenimente (zile efective în care are loc evenimentul, fără
            perioada de organizare). Dacă evenimentul se desfășoară într-o singură zi și într-o singură localitate, se
            menționează „1".
          </p>
          <datalist id="localitati-sugestii">
            {sugestiiLocalitati.map((l) => <option key={l} value={l} />)}
          </datalist>
          <div className="space-y-2">
            {f.localitati.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    list="localitati-sugestii"
                    placeholder="Localitate"
                    className={inputCls}
                    value={l.localitate}
                    onChange={(e) => set('localitati', f.localitati.map((x, j) => (j === i ? { ...x, localitate: e.target.value } : x)))}
                  />
                </div>
                <div className="w-24 shrink-0">
                  <input
                    type="number" min="1" step="1" className={inputCls}
                    value={l.nr}
                    onChange={(e) => set('localitati', f.localitati.map((x, j) => (j === i ? { ...x, nr: e.target.value } : x)))}
                  />
                </div>
                {f.localitati.length > 1 && (
                  <button type="button" onClick={() => set('localitati', f.localitati.filter((_, j) => j !== i))}
                    className="rounded-full p-1.5 text-rose-500 hover:bg-rose-50" title="Șterge linia">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={() => set('localitati', [...f.localitati, { localitate: '', nr: '1' }])} className={btnGhost}>
              <Plus size={14} /> Adaugă localitate
            </button>
            <span className="text-sm text-slate-600">Total evenimente: <strong>{total}</strong></span>
          </div>
        </div>

        <div>
          <label className={labelCls}>Locația *</label>
          <input className={inputCls} value={f.locatie} onChange={(e) => set('locatie', e.target.value)} />
          <p className="mt-1 text-xs text-slate-400">Locația exactă a evenimentului (sală, teatru, spațiu).</p>
        </div>

        <div>
          <label className={labelCls}>Echipa de organizare a evenimentului *</label>
          {f.echipa.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {f.echipa.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                  {p.nume}{p.tip === 'extern' ? ' (extern)' : ''}
                  <button type="button" onClick={() => set('echipa', f.echipa.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-500">
                    <XIcon size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex gap-2">
              <select className={inputCls} value={angajatEchipa} onChange={(e) => setAngajatEchipa(e.target.value)}>
                <option value="">Angajat din Madrigal…</option>
                {cfg.angajati.filter((a) => a.activ).map((a) => <option key={a.id} value={a.id}>{a.nume_complet}</option>)}
              </select>
              <button type="button" onClick={adaugaAngajat} disabled={!angajatEchipa} className={btnGhost}>Adaugă</button>
            </div>
            <div className="flex gap-2">
              <datalist id="externi-sugestii">{externi.map((n) => <option key={n} value={n} />)}</datalist>
              <input list="externi-sugestii" className={inputCls} placeholder="Persoană din afară…" value={externNou}
                onChange={(e) => setExternNou(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adaugaExtern() } }} />
              <button type="button" onClick={adaugaExtern} disabled={!externNou.trim()} className={btnGhost}>Adaugă</button>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Persoanele din afară introduse o dată se rețin și apar ca sugestii în rapoartele următoare.
          </p>
        </div>

        <div>
          <label className={labelCls}>Denumirea oficială a evenimentului *</label>
          <input className={inputCls} value={f.denumire_oficiala} onChange={(e) => set('denumire_oficiala', e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Calitatea CNCM-MC în cadrul evenimentului *</label>
          <select className={inputCls} value={f.implicare} onChange={(e) => set('implicare', e.target.value)}>
            <option value="">— Alege —</option>
            {IMPLICARI.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>

      {/* ---- Câmpuri specifice tipurilor bifate ---- */}
      {vizibile.length > 0 && (
        <div className={`${cardCls} space-y-4`}>
          <p className="text-sm font-semibold text-slate-700">
            Detalii specifice ({f.tipuri.map((c) => cfg.tipuri.find((t) => t.cod === c)?.nume).filter(Boolean).join(', ')})
          </p>

          {vizibile.map((c) => {
            if (c.tip === 'contacte') {
              return (
                <div key={c.cod}>
                  <label className={labelCls}>{c.eticheta} *</label>
                  {c.ajutor && <p className="mb-2 text-xs text-slate-500">{c.ajutor}</p>}
                  <div className="space-y-2">
                    {f.contacte.map((r, i) => (
                      <div key={i} className="grid gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                        {[['institutie', 'Instituție'], ['persoana', 'Persoană de contact'], ['telefon', 'Telefon'], ['email', 'E-mail']].map(([k, ph]) => (
                          <input key={k} placeholder={ph} className={inputCls} value={r[k]}
                            onChange={(e) => set('contacte', f.contacte.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                        ))}
                        {f.contacte.length > 1 && (
                          <button type="button" onClick={() => set('contacte', f.contacte.filter((_, j) => j !== i))}
                            className="rounded-full p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => set('contacte', [...f.contacte, contactGol()])} className={`${btnGhost} mt-2`}>
                    <Plus size={14} /> Adaugă contact
                  </button>
                </div>
              )
            }

            const val = f.valori[c.cod] ?? ''
            const setVal = (v) => set('valori', { ...f.valori, [c.cod]: v })
            const blocat = c.mod === 'B' && !f.bife[c.cod]
            return (
              <div key={c.cod}>
                <label className={labelCls}>
                  {c.eticheta} {c.mod === 'O' && '*'}
                </label>
                {c.ajutor && <p className="mb-1.5 text-xs text-slate-500">{c.ajutor}</p>}
                {c.mod === 'B' && (
                  <label className="mb-1.5 flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={!!f.bife[c.cod]} onChange={(e) => set('bife', { ...f.bife, [c.cod]: e.target.checked })} />
                    A fost cazul
                  </label>
                )}
                {c.tip === 'numar' && (
                  <input type="number" min="1" step="1" className={inputCls} value={val} disabled={blocat} onChange={(e) => setVal(e.target.value)} />
                )}
                {c.tip === 'text' && <input className={inputCls} value={val} disabled={blocat} onChange={(e) => setVal(e.target.value)} />}
                {c.tip === 'text_lung' && <textarea rows={3} className={inputCls} value={val} disabled={blocat} onChange={(e) => setVal(e.target.value)} />}
                {c.tip === 'link' && (
                  <input type="url" placeholder="https://…" className={inputCls} value={val} disabled={blocat} onChange={(e) => setVal(e.target.value)} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          <Save size={14} /> {saving ? 'Se salvează…' : editare ? 'Salvează și retrimite' : 'Trimite raportul'}
        </button>
        <button type="button" onClick={onCancel} className={btnGhost}>Anulează</button>
      </div>
    </form>
  )
}
