import { useEffect, useMemo, useState } from 'react'
import { X as XIcon, Save, Send, Copy, Calendar, MapPin, Mail, UserMinus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { CATEGORII } from './PersoaneTab'

const STATUS_TAG = {
  azi: { label: 'AZI', className: 'bg-accent text-white' },
  viitor: { label: 'Viitor', className: 'bg-accent/10 text-accent' },
  incheiat: { label: 'Încheiat', className: 'bg-slate-100 text-slate-500' },
}

const RSVP_BADGE = {
  confirmat: { label: 'Confirmat', className: 'bg-green-50 text-green-700' },
  refuzat: { label: 'Refuzat', className: 'bg-rose-50 text-rose-600' },
  in_asteptare: { label: 'În așteptare', className: 'bg-amber-50 text-amber-700' },
}

function formatData(dataStr) {
  if (!dataStr) return '—'
  return new Date(dataStr).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function EvenimenteTab({ role, session }) {
  const [evenimente, setEvenimente] = useState([])
  const [stats, setStats] = useState({})
  const [cautare, setCautare] = useState('')
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data }, { data: invitatiiRows }] = await Promise.all([
      supabase
        .from('evenimente')
        .select('*, invitatii_profil_eveniment(*)')
        .eq('necesita_rsvp', true)
        .order('data', { ascending: true }),
      supabase.from('invitatii').select('eveniment_id, status_rsvp, prezent'),
    ])

    const s = {}
    for (const r of invitatiiRows || []) {
      if (!s[r.eveniment_id]) {
        s[r.eveniment_id] = { total: 0, confirmate: 0, refuzate: 0, in_asteptare: 0, prezenti: 0 }
      }
      s[r.eveniment_id].total += 1
      if (r.status_rsvp === 'confirmat') s[r.eveniment_id].confirmate += 1
      else if (r.status_rsvp === 'refuzat') s[r.eveniment_id].refuzate += 1
      else s[r.eveniment_id].in_asteptare += 1
      if (r.prezent) s[r.eveniment_id].prezenti += 1
    }

    setEvenimente(data || [])
    setStats(s)
    setLoading(false)
  }

  const azi = new Date().toISOString().slice(0, 10)

  const filtrate = useMemo(() => {
    const q = cautare.toLowerCase()
    if (!q) return evenimente
    return evenimente.filter((e) => e.nume?.toLowerCase().includes(q) || e.locatie?.toLowerCase().includes(q))
  }, [evenimente, cautare])

  const viitoare = filtrate.filter((e) => e.data && e.data >= azi)
  const incheiate = filtrate.filter((e) => !e.data || e.data < azi).reverse()

  const evenimentDeschis = evenimente.find((e) => e.id === openId) || null

  if (loading) return <p className="text-sm text-slate-500">Se încarcă...</p>

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <input
          value={cautare}
          onChange={(e) => setCautare(e.target.value)}
          placeholder="Caută după numele evenimentului sau locație..."
          className="w-full sm:w-96 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <p className="mb-4 text-xs text-slate-400">
        Evenimentele vin din calendarul central al Hub-ului — cele marcate „necesită RSVP". Dacă lipsește
        unul, verifică bifa din Hub → Calendar.
      </p>

      <Sectiune
        titlu="Evenimente viitoare"
        evenimente={viitoare}
        role={role}
        onOpen={setOpenId}
        stats={stats}
        azi={azi}
        gol="Niciun eveniment viitor cu RSVP activ."
      />
      <Sectiune
        titlu="Evenimente încheiate"
        evenimente={incheiate}
        role={role}
        onOpen={setOpenId}
        stats={stats}
        azi={azi}
        gol="Niciun eveniment încheiat."
      />

      {evenimentDeschis && (
        <EvenimentModal eveniment={evenimentDeschis} session={session} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </div>
  )
}

function Sectiune({ titlu, evenimente, role, onOpen, stats, azi, gol }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-sm font-medium text-slate-500">{titlu}</h2>
      {evenimente.length === 0 ? (
        <p className="text-sm text-slate-400">{gol}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {evenimente.map((e) => {
            const profil = Array.isArray(e.invitatii_profil_eveniment)
              ? e.invitatii_profil_eveniment[0]
              : e.invitatii_profil_eveniment
            const s = stats[e.id] || { confirmate: 0, refuzate: 0, in_asteptare: 0, prezenti: 0 }

            const tagKey = !e.data || e.data < azi ? 'incheiat' : e.data === azi ? 'azi' : 'viitor'
            const tag = STATUS_TAG[tagKey]

            return (
              <div key={e.id} className="flex flex-col rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="font-display text-lg font-semibold leading-snug text-slate-800">{e.nume}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tag.className}`}>
                    {tag.label}
                  </span>
                </div>

                <div className="mb-4 space-y-1.5 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    {formatData(e.data)}
                  </div>
                  {e.locatie && (
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400" />
                      {e.locatie}
                    </div>
                  )}
                </div>

                <div className="mb-4 grid grid-cols-4 gap-1 border-y border-slate-100 py-3 text-center">
                  <Stat valoare={s.confirmate} eticheta="conf." culoare="text-green-600" />
                  <Stat valoare={s.refuzate} eticheta="ref." culoare="text-rose-500" />
                  <Stat valoare={s.in_asteptare} eticheta="aștept." culoare="text-amber-500" />
                  <Stat valoare={s.prezenti} eticheta="prez." culoare="text-slate-700" />
                </div>

                {!profil?.subiect_email && (
                  <p className="mb-2 text-xs text-amber-600">Fără conținut de email încă</p>
                )}

                {role === 'full' && (
                  <button
                    onClick={() => onOpen(e.id)}
                    className="mt-auto flex items-center justify-center gap-1.5 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-medium px-3 py-2.5 transition"
                  >
                    <Mail size={13} /> Conținut &amp; trimitere invitații
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ valoare, eticheta, culoare }) {
  return (
    <div>
      <p className={`font-display text-xl font-bold ${culoare}`}>{valoare}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{eticheta}</p>
    </div>
  )
}

// =========================================================================
// Modalul unificat — Invitați / Conținut & trimitere
// =========================================================================

function EvenimentModal({ eveniment, session, onClose, onChanged }) {
  const [tab, setTab] = useState('invitati')

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-6 pb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-800">{eveniment.nume}</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatData(eveniment.data)}
              {eveniment.locatie ? ` · ${eveniment.locatie}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 focus-ring">
            <XIcon size={16} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-6">
          <button
            onClick={() => setTab('invitati')}
            className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              tab === 'invitati' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Invitați
          </button>
          <button
            onClick={() => setTab('continut')}
            className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              tab === 'continut' ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Conținut &amp; trimitere
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {tab === 'invitati' ? (
            <TabInvitati eveniment={eveniment} onChanged={onChanged} />
          ) : (
            <TabContinut eveniment={eveniment} session={session} onChanged={onChanged} />
          )}
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Tab Invitați — listă existentă (cu status) + adăugare pe categorii,
// cu excludere individuală
// -------------------------------------------------------------------------

function TabInvitati({ eveniment, onChanged }) {
  const [invitatii, setInvitatii] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectate, setSelectate] = useState([])
  const [potentiali, setPotentiali] = useState([])
  const [excluse, setExcluse] = useState(new Set())
  const [adaugand, setAdaugand] = useState(false)

  useEffect(() => {
    loadInvitatii()
  }, [])

  useEffect(() => {
    loadPotentiali()
  }, [selectate, invitatii])

  async function loadInvitatii() {
    setLoading(true)
    const { data } = await supabase
      .from('invitatii')
      .select('*, persoane(nume, prenume, email, categorie)')
      .eq('eveniment_id', eveniment.id)
    setInvitatii(data || [])
    setLoading(false)
  }

  async function loadPotentiali() {
    if (selectate.length === 0) {
      setPotentiali([])
      return
    }
    const dejaInvitati = new Set(invitatii.map((i) => i.persoana_id).filter(Boolean))
    const { data } = await supabase
      .from('persoane')
      .select('id, nume, prenume, email, categorie')
      .in('categorie', selectate)
      .eq('abonat_invitatii', true)
    setPotentiali((data || []).filter((p) => !dejaInvitati.has(p.id)))
    setExcluse(new Set())
  }

  function toggleCategorie(c) {
    setSelectate((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  function toggleExclus(id) {
    setExcluse((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const deAdaugat = potentiali.filter((p) => !excluse.has(p.id))

  async function handleAdauga() {
    if (deAdaugat.length === 0) return
    setAdaugand(true)
    const payload = deAdaugat.map((p) => ({
      eveniment_id: eveniment.id,
      persoana_id: p.id,
      sursa: 'trimitere',
    }))
    await supabase.from('invitatii').insert(payload)
    setAdaugand(false)
    setSelectate([])
    setPotentiali([])
    loadInvitatii()
    onChanged()
  }

  async function handleSterge(invitatieId) {
    if (!confirm('Elimini această persoană din lista de invitați la acest eveniment?')) return
    await supabase.from('invitatii').delete().eq('id', invitatieId)
    loadInvitatii()
    onChanged()
  }

  return (
    <div>
      <div className="mb-5 rounded-xl border border-slate-200 p-4">
        <p className="mb-2 text-xs font-medium text-slate-600">Adaugă invitați din categorii</p>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {CATEGORII.map((c) => (
            <label key={c} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" checked={selectate.includes(c)} onChange={() => toggleCategorie(c)} />
              {c}
            </label>
          ))}
        </div>

        {potentiali.length > 0 && (
          <div className="mb-3 max-h-48 overflow-y-auto rounded-lg border border-slate-100">
            {potentiali.map((p) => (
              <label
                key={p.id}
                className={`flex items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 text-sm last:border-b-0 ${
                  excluse.has(p.id) ? 'opacity-40' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={!excluse.has(p.id)} onChange={() => toggleExclus(p.id)} />
                  {p.prenume} {p.nume}
                  <span className="text-xs text-slate-400">{p.categorie}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {selectate.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {deAdaugat.length} din {potentiali.length} vor fi adăugați
            </p>
            <button
              onClick={handleAdauga}
              disabled={deAdaugat.length === 0 || adaugand}
              className="flex items-center gap-1.5 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-medium px-3 py-1.5 transition disabled:opacity-50"
            >
              {adaugand ? 'Se adaugă...' : `Adaugă ${deAdaugat.length} invitați`}
            </button>
          </div>
        )}
      </div>

      <p className="mb-2 text-xs font-medium text-slate-600">
        Invitați existenți {loading ? '' : `(${invitatii.length})`}
      </p>

      {loading ? (
        <p className="text-sm text-slate-400">Se încarcă...</p>
      ) : invitatii.length === 0 ? (
        <p className="text-sm text-slate-400">Niciun invitat adăugat încă.</p>
      ) : (
        <div className="space-y-1.5">
          {invitatii.map((i) => {
            const nume = i.persoane ? `${i.persoane.prenume} ${i.persoane.nume}` : i.nume_complet_invitat
            const badge = RSVP_BADGE[i.status_rsvp] || RSVP_BADGE.in_asteptare
            return (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{nume}</p>
                  <p className="text-xs text-slate-400">{i.persoane?.categorie || (i.sursa === 'nominalizare' ? 'Nominalizare' : '—')}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
                  <button onClick={() => handleSterge(i.id)} className="text-slate-300 hover:text-rose-500" title="Elimină">
                    <UserMinus size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------------------
// Tab Conținut & trimitere
// -------------------------------------------------------------------------

function TabContinut({ eveniment, session, onChanged }) {
  const existing = Array.isArray(eveniment.invitatii_profil_eveniment)
    ? eveniment.invitatii_profil_eveniment[0]
    : eveniment.invitatii_profil_eveniment

  const [subiect, setSubiect] = useState(existing?.subiect_email || '')
  const [mesaj, setMesaj] = useState(existing?.mesaj_intro || '')
  const [afisUrl, setAfisUrl] = useState(existing?.afis_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [stare, setStare] = useState(null)
  const [linkuri, setLinkuri] = useState(null)
  const [trimitand, setTrimitand] = useState(false)
  const [progres, setProgres] = useState(null)
  const [rezultatTrimitere, setRezultatTrimitere] = useState(null)
  const [generatingLinks, setGeneratingLinks] = useState(false)

  useEffect(() => {
    incarcaStare()
  }, [])

  // Starea trimiterii: câți au de primit email, câți au primit deja, câți au eșuat, câți sunt dezabonați
  async function incarcaStare() {
    const { data } = await supabase
      .from('invitatii')
      .select('id, status_rsvp, trimis_la, eroare_trimitere, persoana_id, persoane(nume, prenume, email, abonat_invitatii)')
      .eq('eveniment_id', eveniment.id)

    const randuri = data || []
    const cuPersoana = randuri.filter((i) => i.persoane)
    setStare({
      deTrimis: cuPersoana.filter((i) => !i.trimis_la && !i.eroare_trimitere && i.persoane.abonat_invitatii && i.status_rsvp === 'in_asteptare').length,
      trimise: randuri.filter((i) => i.trimis_la).length,
      dezabonati: cuPersoana.filter((i) => !i.trimis_la && !i.persoane.abonat_invitatii && i.status_rsvp === 'in_asteptare').length,
      faraEmail: randuri.filter((i) => !i.persoana_id && !i.trimis_la && i.status_rsvp === 'in_asteptare').length,
      esuate: cuPersoana
        .filter((i) => !i.trimis_la && i.eroare_trimitere)
        .map((i) => ({ id: i.id, nume: `${i.persoane.prenume} ${i.persoane.nume}`, email: i.persoane.email, eroare: i.eroare_trimitere })),
    })
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Afișul depășește 5 MB. Alege o imagine mai mică.')
      e.target.value = ''
      return
    }
    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${eveniment.id}.${ext}`

    const { error: uploadError } = await supabase.storage.from('afise').upload(path, file, { upsert: true })

    if (uploadError) {
      setUploading(false)
      setError('Nu am putut încărca afișul. Folosește o imagine JPEG sau PNG de maximum 5 MB.')
      return
    }

    const { data } = supabase.storage.from('afise').getPublicUrl(path)
    setAfisUrl(`${data.publicUrl}?v=${Date.now()}`)
    setUploading(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const { error } = await supabase.from('invitatii_profil_eveniment').upsert({
      eveniment_id: eveniment.id,
      subiect_email: subiect.trim() || null,
      mesaj_intro: mesaj.trim() || null,
      afis_url: afisUrl.split('?')[0] || null,
    })

    setSaving(false)
    if (error) {
      setError('Nu am putut salva conținutul.')
      return
    }
    onChanged()
  }

  // Funcția de pe server trimite câte un lot; o apelăm până nu mai rămâne nimic de trimis.
  // `reseteaza` = reîncearcă și invitațiile care au eșuat anterior.
  async function handleTrimite(reseteaza = false) {
    setTrimitand(true)
    setError('')
    setRezultatTrimitere(null)

    const total = { trimise: 0, esuate: 0, oprit_limita: false }
    setProgres(0)

    try {
      for (let ciclu = 0; ciclu < 100; ciclu += 1) {
        const res = await fetch('/.netlify/functions/send-brevo', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ eveniment_id: eveniment.id, reseteaza_erori: reseteaza && ciclu === 0 }),
        })
        const result = await res.json()

        if (!res.ok) {
          setError(result.error || 'Trimiterea a eșuat.')
          break
        }

        total.trimise += result.trimise
        total.esuate += result.esuate
        setProgres(total.trimise + total.esuate)

        if (result.oprit_limita) {
          total.oprit_limita = true
          break
        }
        if (result.ramase === 0 || result.trimise + result.esuate === 0) break
      }
    } catch {
      setError('Nu am putut contacta funcția de trimitere.')
    }

    setRezultatTrimitere(total)
    setProgres(null)
    await incarcaStare()
    onChanged()
    setTrimitand(false)
  }

  async function handleGenereazaLinkuri() {
    setGeneratingLinks(true)
    const { data } = await supabase
      .from('invitatii')
      .select('token, persoane(nume, prenume, email), nume_complet_invitat')
      .eq('eveniment_id', eveniment.id)
      .eq('status_rsvp', 'in_asteptare')

    const rows = (data || []).map((i) => {
      const nume = i.persoane ? `${i.persoane.prenume} ${i.persoane.nume}` : i.nume_complet_invitat
      const email = i.persoane?.email || ''
      return `${nume}${email ? ` <${email}>` : ''} — ${window.location.origin}/invitatii/?rsvp=${i.token}`
    })
    setLinkuri(rows)
    setGeneratingLinks(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Subiect email <span className="text-slate-400">(poți folosi câmpurile de mai jos)</span>
        </label>
        <input
          value={subiect}
          onChange={(e) => setSubiect(e.target.value)}
          placeholder="Ex: Invitație la concertul de Crăciun"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Mesaj
        </label>
        <p className="mb-1.5 text-[11px] leading-relaxed text-slate-400">
          Câmpuri înlocuite automat pentru fiecare persoană, în subiect și în mesaj:{' '}
          <code>{'{{nume}}'}</code> (nume complet), <code>{'{{prenume}}'}</code>, <code>{'{{nume_familie}}'}</code>,{' '}
          <code>{'{{institutie}}'}</code>, <code>{'{{functie}}'}</code>. Ex: „Stimate {'{{nume}}'}, de la {'{{institutie}}'}...”
        </p>
        <textarea
          value={mesaj}
          onChange={(e) => setMesaj(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Afiș (același pentru toți invitații)</label>
        {afisUrl && <img src={afisUrl} alt="Afiș" className="mb-2 max-h-40 rounded-lg border border-slate-200" />}
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleUpload}
          disabled={uploading}
          className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2"
        />
        {uploading && <p className="mt-1 text-xs text-slate-400">Se încarcă...</p>}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 transition disabled:opacity-50"
      >
        <Save size={14} /> {saving ? 'Se salvează...' : 'Salvează conținutul'}
      </button>

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="mb-1 text-sm text-slate-600">
          <strong>{stare?.deTrimis ?? '…'}</strong> invitați vor primi acest mesaj.
        </p>
        {stare && (
          <p className="mb-3 text-xs text-slate-400">
            {stare.trimise} trimise deja
            {stare.esuate.length > 0 ? ` · ${stare.esuate.length} cu eroare` : ''}
            {stare.dezabonati > 0 ? ` · ${stare.dezabonati} dezabonați (nu primesc email)` : ''}
            {stare.faraEmail > 0 ? ` · ${stare.faraEmail} nominalizați fără adresă de email` : ''}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleTrimite(false)}
            disabled={trimitand || !stare?.deTrimis}
            className="flex items-center gap-1.5 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2.5 transition disabled:opacity-50"
          >
            <Send size={14} /> {trimitand ? `Se trimite... (${progres ?? 0})` : 'Trimite invitații'}
          </button>

          {stare?.esuate.length > 0 && (
            <button
              onClick={() => handleTrimite(true)}
              disabled={trimitand}
              className="flex items-center gap-1.5 rounded-full border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium px-4 py-2.5 transition disabled:opacity-50"
            >
              <Send size={14} /> Retrimite cele cu eroare ({stare.esuate.length})
            </button>
          )}
        </div>

        {trimitand && (
          <p className="mt-2 text-xs text-slate-500">Nu închide pagina până se termină trimiterea.</p>
        )}

        {rezultatTrimitere && (
          <p className={`mt-3 text-sm ${rezultatTrimitere.oprit_limita ? 'text-amber-700' : 'text-green-700'}`}>
            {rezultatTrimitere.trimise} emailuri trimise
            {rezultatTrimitere.esuate > 0 ? `, ${rezultatTrimitere.esuate} eșuate` : ''}.
            {rezultatTrimitere.oprit_limita
              ? ' Trimiterea s-a oprit: contul Brevo a atins limita de trimitere. Cei rămași nu au fost marcați ca eșuați; apasă din nou „Trimite invitații” când limita se reînnoiește (de regulă a doua zi).'
              : ''}
          </p>
        )}

        {stare?.esuate.length > 0 && (
          <details className="mt-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">Vezi invitațiile cu eroare</summary>
            <ul className="mt-2 space-y-1">
              {stare.esuate.map((e) => (
                <li key={e.id}>
                  <strong>{e.nume}</strong> ({e.email}): <span className="text-rose-600">{e.eroare}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            onClick={handleGenereazaLinkuri}
            disabled={generatingLinks}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <Copy size={12} /> {generatingLinks ? 'Se generează...' : 'Sau generează linkurile de RSVP, pentru trimitere manuală'}
          </button>

          {linkuri && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-600">Linkuri de RSVP</p>
                <button
                  onClick={() => navigator.clipboard.writeText(linkuri.join('\n'))}
                  className="flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Copy size={12} /> Copiază tot
                </button>
              </div>
              <textarea readOnly value={linkuri.join('\n')} rows={5} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
