import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { fetchAll } from '../lib/fetchAll'
import { mesajEroare, profilul } from '../lib/format'
import { Btn, Pill } from './ui'

const INPUT = 'w-full rounded-[10px] border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent'
const AFISARE_LINKURI = 50

function csvCelula(v) {
  const t = String(v ?? '')
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

export default function TabContinut({ eveniment, inchis, session, onChanged }) {
  const existing = profilul(eveniment)

  const [subiect, setSubiect] = useState(existing?.subiect_email || '')
  const [mesaj, setMesaj] = useState(existing?.mesaj_intro || '')
  const [afisUrl, setAfisUrl] = useState(existing?.afis_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [salvat, setSalvat] = useState(false)
  const [error, setError] = useState('')
  const [stare, setStare] = useState(null)
  const [trimitand, setTrimitand] = useState(false)
  const [progres, setProgres] = useState(null)
  const [rezultatTrimitere, setRezultatTrimitere] = useState(null)
  const [testStatus, setTestStatus] = useState('')

  const incarcaStare = useCallback(async () => {
    const { data } = await fetchAll((a, b) =>
      supabase
        .from('invitatii')
        .select('id, token, status_rsvp, trimis_la, eroare_trimitere, persoana_id, persoane(nume, prenume, email, abonat_invitatii)')
        .eq('eveniment_id', eveniment.id)
        .eq('sursa', 'trimitere')
        .order('id')
        .range(a, b)
    )
    const randuri = data || []
    const cuPersoana = randuri.filter((i) => i.persoane)
    const nume = (i) => `${i.persoane.prenume} ${i.persoane.nume}`
    setStare({
      total: randuri.length,
      deTrimis: cuPersoana.filter((i) => !i.trimis_la && !i.eroare_trimitere && i.persoane.abonat_invitatii && i.status_rsvp === 'in_asteptare').length,
      trimise: randuri.filter((i) => i.trimis_la).length,
      dezabonati: cuPersoana.filter((i) => !i.trimis_la && !i.persoane.abonat_invitatii && i.status_rsvp === 'in_asteptare').length,
      faraEmail: randuri.filter((i) => !i.persoana_id && !i.trimis_la && i.status_rsvp === 'in_asteptare').length,
      esuate: cuPersoana
        .filter((i) => !i.trimis_la && i.eroare_trimitere)
        .map((i) => ({ id: i.id, nume: nume(i), email: i.persoane.email, eroare: i.eroare_trimitere })),
      // pentru trimiterea manuală: abonați, fără răspuns
      linkuri: cuPersoana
        .filter((i) => i.persoane.abonat_invitatii && i.status_rsvp === 'in_asteptare')
        .map((i) => ({
          id: i.id,
          nume: nume(i),
          email: i.persoane.email || '',
          trimis: !!i.trimis_la,
          link: `${window.location.origin}/invitatii/?rsvp=${i.token}`,
        })),
    })
  }, [eveniment.id])

  useEffect(() => {
    incarcaStare()
  }, [incarcaStare])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Afișul trebuie să fie JPEG sau PNG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Afișul depășește 5 MB. Alege o imagine mai mică.')
      return
    }
    setUploading(true)
    setError('')
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const path = `${eveniment.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('afise').upload(path, file, { upsert: true })
    setUploading(false)
    if (uploadError) {
      setError('Nu am putut încărca afișul. Folosește o imagine JPEG sau PNG de maximum 5 MB.')
      return
    }
    const { data } = supabase.storage.from('afise').getPublicUrl(path)
    setAfisUrl(`${data.publicUrl}?v=${Date.now()}`)
    setSalvat(false)
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
      setError(mesajEroare(error))
      return false
    }
    setSalvat(true)
    onChanged()
    return true
  }

  async function apeleazaTrimitere(corp) {
    const res = await fetch('/.netlify/functions/send-brevo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corp),
    })
    const result = await res.json().catch(() => ({}))
    return { ok: res.ok, result }
  }

  // Emailul de test: doar către adresa adminului, fără nicio schimbare de status
  async function handleTest() {
    setTestStatus('')
    setError('')
    if (!(await handleSave())) return
    setTestStatus('Se trimite…')
    try {
      const { ok, result } = await apeleazaTrimitere({ eveniment_id: eveniment.id, test: true })
      setTestStatus(ok ? `Email de test trimis la ${result.adresa}.` : '')
      if (!ok) setError(result.error || 'Emailul de test nu a putut fi trimis.')
    } catch {
      setTestStatus('')
      setError('Nu am putut contacta funcția de trimitere.')
    }
  }

  // Funcția de pe server trimite câte un lot; o apelăm până nu mai rămâne nimic de trimis.
  async function handleTrimite(reseteaza = false) {
    setTrimitand(true)
    setError('')
    setRezultatTrimitere(null)
    const total = { trimise: 0, esuate: 0, oprit_limita: false }
    setProgres(0)
    try {
      for (let ciclu = 0; ciclu < 100; ciclu += 1) {
        const { ok, result } = await apeleazaTrimitere({ eveniment_id: eveniment.id, reseteaza_erori: reseteaza && ciclu === 0 })
        if (!ok) {
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

  const blocat = inchis

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="subiect" className="mb-1.5 block text-xs font-bold text-slate-600">Subiect email</label>
        <input id="subiect" value={subiect} onChange={(e) => { setSubiect(e.target.value); setSalvat(false) }} disabled={blocat}
          placeholder="Ex: Invitație la concertul de Crăciun, {{prenume}}" className={INPUT} />
      </div>

      <div>
        <label htmlFor="mesaj" className="mb-1.5 block text-xs font-bold text-slate-600">Mesaj</label>
        <p className="mb-1.5 text-xs leading-relaxed text-slate-500">
          Câmpuri înlocuite automat: <code>{'{{nume}}'}</code>, <code>{'{{prenume}}'}</code>, <code>{'{{nume_familie}}'}</code>,{' '}
          <code>{'{{institutie}}'}</code>, <code>{'{{functie}}'}</code>. Pe pagina de răspuns se vede același mesaj, personalizat la fel.
        </p>
        <textarea id="mesaj" value={mesaj} onChange={(e) => { setMesaj(e.target.value); setSalvat(false) }} rows={4} disabled={blocat} className={INPUT} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold text-slate-600">Afiș (același pentru toți invitații)</p>
        <div className="flex flex-wrap items-center gap-3.5">
          {afisUrl ? (
            <img src={afisUrl} alt="Afiș" className="max-h-28 rounded-[10px] border border-slate-200" />
          ) : (
            <div className="flex h-24 w-44 items-center justify-center rounded-[10px] bg-slate-100 text-xs text-slate-500">Fără afiș</div>
          )}
          <div>
            <label className={`inline-block cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 ${blocat || uploading ? 'pointer-events-none opacity-50' : ''}`}>
              {uploading ? 'Se încarcă…' : afisUrl ? 'Încarcă alt afiș' : 'Încarcă afiș'}
              <input type="file" accept="image/jpeg,image/png" onChange={handleUpload} disabled={blocat || uploading} className="sr-only" />
            </label>
            <p className="mt-1.5 text-xs text-slate-500">JPEG sau PNG, maximum 5 MB.</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!blocat && (
        <div className="flex items-center gap-3">
          <Btn onClick={handleSave} disabled={saving}>{saving ? 'Se salvează…' : 'Salvează conținutul'}</Btn>
          {salvat && <span className="text-xs text-green-700">Salvat.</span>}
        </div>
      )}

      <div className="rounded-[14px] border border-slate-200 p-4">
        <p className="text-[15px] text-slate-900"><strong>{stare?.deTrimis ?? '…'}</strong> invitați vor primi acest mesaj</p>
        {stare && (
          <p className="mb-3 mt-1 text-xs text-slate-500">
            {stare.total} în total · {stare.trimise} trimise deja · {stare.esuate.length} cu eroare · {stare.dezabonati} dezabonați (nu primesc email)
            {stare.faraEmail > 0 ? ` · ${stare.faraEmail} fără adresă de email` : ''}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="primary" onClick={() => handleTrimite(false)} disabled={blocat || trimitand || !stare?.deTrimis}>
            {trimitand ? `Se trimite… (${progres ?? 0})` : `Trimite invitațiile (${stare?.deTrimis ?? 0})`}
          </Btn>
          <Btn onClick={handleTest} disabled={blocat || trimitand || testStatus === 'Se trimite…'}>
            Trimite-mi un email de test
          </Btn>
          {stare?.esuate.length > 0 && (
            <Btn onClick={() => handleTrimite(true)} disabled={blocat || trimitand}>Retrimite cele cu eroare ({stare.esuate.length})</Btn>
          )}
        </div>
        {testStatus && <p className="mt-2 text-xs text-green-700">{testStatus}</p>}
        {trimitand && <p className="mt-2 text-xs text-slate-500">Nu închide pagina până se termină trimiterea.</p>}
        <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
          Emailul de test ajunge doar la adresa ta de cont, nu la invitați, și nu schimbă statusul nimănui. Trimiterea se
          face în loturi; dacă limita zilnică a contului de email se atinge, se oprește și continui a doua zi.
        </p>

        {rezultatTrimitere && (
          <p className={`mt-3 text-sm ${rezultatTrimitere.oprit_limita ? 'text-amber-700' : 'text-green-700'}`}>
            {rezultatTrimitere.trimise} emailuri trimise{rezultatTrimitere.esuate > 0 ? `, ${rezultatTrimitere.esuate} eșuate` : ''}.
            {rezultatTrimitere.oprit_limita
              ? ' Trimiterea s-a oprit: contul Brevo a atins limita de trimitere. Cei rămași nu au fost marcați ca eșuați; apasă din nou „Trimite invitațiile” când limita se reînnoiește (de regulă a doua zi).'
              : ''}
          </p>
        )}

        {stare?.esuate.length > 0 && (
          <details className="mt-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">Vezi invitațiile cu eroare</summary>
            <ul className="mt-2 space-y-1">
              {stare.esuate.map((e) => (
                <li key={e.id}><strong>{e.nume}</strong> ({e.email}): <span className="text-rose-600">{e.eroare}</span></li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <LinkuriManuale stare={stare} inchis={inchis} onMarcat={async () => { await incarcaStare(); onChanged() }} />
    </div>
  )
}

// -------------------------------------------------------------------------
// Linkuri RSVP pentru trimitere manuală
// -------------------------------------------------------------------------
function LinkuriManuale({ stare, inchis, onMarcat }) {
  const [doarNetrimisi, setDoarNetrimisi] = useState(true)
  const [afisate, setAfisate] = useState(AFISARE_LINKURI)
  const [copiat, setCopiat] = useState('')
  const [eroare, setEroare] = useState('')

  const lista = (stare?.linkuri || []).filter((l) => !doarNetrimisi || !l.trimis)

  async function copiaza(text, cheie) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiat(cheie)
      setTimeout(() => setCopiat(''), 2000)
    } catch {
      window.prompt('Copiază textul:', text)
    }
  }

  function descarcaCsv() {
    const randuri = ['nume,email,link', ...lista.map((l) => [l.nume, l.email, l.link].map(csvCelula).join(','))]
    const blob = new Blob(['﻿' + randuri.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'linkuri-rsvp.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function marcheaza(ids) {
    if (ids.length === 0) return
    setEroare('')
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase
        .from('invitatii')
        .update({ trimis_la: new Date().toISOString() })
        .in('id', ids.slice(i, i + 200))
      if (error) {
        setEroare(mesajEroare(error))
        return
      }
    }
    onMarcat()
  }

  async function marcheazaToate() {
    if (!confirm(`Marchezi ${lista.length} persoane ca „trimis”? Nu vor mai primi email automat de la sistem.`)) return
    marcheaza(lista.filter((l) => !l.trimis).map((l) => l.id))
  }

  return (
    <div className="rounded-[14px] border border-slate-200 p-4">
      <p className="text-[15px] font-bold text-slate-900">Linkuri RSVP pentru trimitere manuală</p>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">
        Fiecare invitat are propriul link. Copiezi linkul unei persoane sau exporți tot într-un fișier.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="small" onClick={descarcaCsv} disabled={lista.length === 0}>Descarcă CSV (nume, email, link)</Btn>
        <Btn variant="small" onClick={() => copiaza(lista.map((l) => `${l.nume}\t${l.email}\t${l.link}`).join('\n'), 'toate')} disabled={lista.length === 0}>
          {copiat === 'toate' ? 'Copiat' : 'Copiază toate'}
        </Btn>
        <label className="flex items-center gap-1.5 text-[13px]">
          <input type="checkbox" checked={doarNetrimisi} onChange={(e) => { setDoarNetrimisi(e.target.checked); setAfisate(AFISARE_LINKURI) }} />
          Doar cei netrimiși
        </label>
      </div>

      {!stare ? (
        <p className="mt-3 text-sm text-slate-400">Se încarcă…</p>
      ) : lista.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Nicio persoană de afișat.</p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-[10px] border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_auto] gap-2.5 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <span>Nume</span><span>Status</span><span>Link</span>
          </div>
          {lista.slice(0, afisate).map((l) => (
            <div key={l.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_auto] items-center gap-2.5 border-t border-slate-100 px-3 py-2 text-[13px]">
              <span className="truncate">{l.nume}</span>
              <span><Pill culoare={l.trimis ? 'albastru' : 'gri'}>{l.trimis ? 'Trimis' : 'Netrimis'}</Pill></span>
              <span className="flex gap-1.5">
                <button type="button" onClick={() => copiaza(l.link, l.id)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-accent hover:bg-slate-50">
                  {copiat === l.id ? 'Copiat' : 'Copiază link'}
                </button>
                {!l.trimis && !inchis && (
                  <button type="button" onClick={() => marcheaza([l.id])} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    Marchează trimis
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {lista.length > afisate && (
        <p className="mt-2 text-xs text-slate-500">
          Se văd primele {afisate} din {lista.length}.{' '}
          <button type="button" onClick={() => setAfisate((a) => a + 100)} className="font-semibold text-accent underline">Arată mai multe</button>
          {' '}CSV-ul și „Copiază toate” le includ pe toate.
        </p>
      )}
      {eroare && <p className="mt-2 text-sm text-rose-600">{eroare}</p>}
      {!inchis && lista.some((l) => !l.trimis) && (
        <div className="mt-3">
          <Btn variant="small" onClick={marcheazaToate}>Marchează toate cele {lista.filter((l) => !l.trimis).length} ca trimise</Btn>
        </div>
      )}
      <div className="mt-3 rounded-[10px] bg-amber-100 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
        Când copiezi un link pentru trimitere manuală, persoana rămâne „Netrimis” până o marchezi tu ca trimisă, ca să nu o pierzi din vedere.
      </div>
    </div>
  )
}
