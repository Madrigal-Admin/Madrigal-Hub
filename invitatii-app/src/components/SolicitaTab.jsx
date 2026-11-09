import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatData, formatOra, mesajEroare } from '../lib/format'
import { Btn, Card, Pill } from './ui'

const STATUS = {
  in_asteptare: { label: 'În așteptarea aprobării', culoare: 'galben' },
  aprobata: { label: 'Aprobată', culoare: 'verde' },
  refuzata: { label: 'Refuzată', culoare: 'rosu' },
}

// Pagina angajatului: cere invitați la evenimentele deschise și își vede cererile
export default function SolicitaTab() {
  const [evenimente, setEvenimente] = useState(null)
  const [cereri, setCereri] = useState(null)
  const [eroare, setEroare] = useState('')

  async function load() {
    const [ev, ce] = await Promise.all([
      supabase.rpc('solicitari_evenimente_disponibile'),
      supabase.rpc('solicitari_ale_mele'),
    ])
    if (ev.error || ce.error) {
      setEroare(mesajEroare(ev.error || ce.error))
      return
    }
    setEvenimente(ev.data || [])
    setCereri(ce.data || [])
  }

  useEffect(() => {
    load()
  }, [])

  if (eroare) return <p className="text-sm text-rose-600">{eroare}</p>
  if (!evenimente || !cereri) return <p className="text-sm text-slate-500">Se încarcă…</p>

  const limita = evenimente[0]?.limita

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-extrabold text-slate-900">Solicită invitații</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          Aici apar doar evenimentele pentru care se pot cere invitații.
          {limita != null ? ` Poți invita până la ${limita} persoane la fiecare eveniment.` : ''} Un administrator
          aprobă cererea, iar apoi primești invitația de trimis mai departe.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-bold text-slate-600">Evenimente deschise pentru solicitări</p>
        {evenimente.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">Momentan nu există evenimente deschise pentru solicitări.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {evenimente.map((e) => (
              <EvenimentSolicitari key={e.id} eveniment={e} onTrimis={load} />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[13px] font-bold text-slate-600">Cererile mele</p>
        {cereri.length === 0 ? (
          <p className="text-sm text-slate-400">Nu ai trimis nicio cerere încă.</p>
        ) : (
          <div className="space-y-2.5">
            {cereri.map((c) => (
              <CerereMea key={c.id} cerere={c} />
            ))}
          </div>
        )}
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
          Statusuri posibile: <Pill culoare="galben">În așteptarea aprobării</Pill> (se numără la limită) ·{' '}
          <Pill culoare="verde">Aprobată</Pill> · <Pill culoare="rosu">Refuzată</Pill> (locul se eliberează).
        </p>
      </div>
    </div>
  )
}

function EvenimentSolicitari({ eveniment: e, onTrimis }) {
  const ramase = Math.max(0, e.limita - e.folosite)
  const [invitati, setInvitati] = useState([{ nume: '', email: '' }])
  const [trimitand, setTrimitand] = useState(false)
  const [eroare, setEroare] = useState('')
  const [ok, setOk] = useState(false)

  const ora = formatOra(e)
  const blocat = ramase === 0 || e.plafon_atins

  function seteaza(i, camp, valoare) {
    setInvitati((prev) => prev.map((x, idx) => (idx === i ? { ...x, [camp]: valoare } : x)))
  }

  async function trimite() {
    setEroare('')
    setOk(false)
    const completati = invitati.filter((x) => x.nume.trim() || x.email.trim())
    if (completati.length === 0) {
      setEroare('Completează numele și emailul a cel puțin unui invitat.')
      return
    }
    if (completati.some((x) => !x.nume.trim() || !x.email.trim())) {
      setEroare('Fiecare invitat are nevoie de nume și de email.')
      return
    }
    setTrimitand(true)
    const { error } = await supabase.rpc('solicitare_creeaza', { p_eveniment_id: e.id, p_invitati: completati })
    setTrimitand(false)
    if (error) {
      setEroare(mesajEroare(error))
      return
    }
    setOk(true)
    setInvitati([{ nume: '', email: '' }])
    onTrimis()
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[17px] font-bold text-slate-900">{e.nume}</p>
          <p className="mt-0.5 text-[13px] text-slate-600">
            {formatData(e.data)}
            {ora ? ` · ${ora}` : ''}
            {e.locatie ? ` · ${e.locatie}` : ''}
          </p>
        </div>
        <Pill culoare="albastru" className="!text-xs">Ai folosit {e.folosite} din {e.limita} invitații</Pill>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        {e.plafon_atins ? (
          <p className="text-sm text-amber-800">
            Evenimentul a atins numărul maxim de persoane, deci nu se mai pot trimite solicitări noi.
          </p>
        ) : ramase === 0 ? (
          <p className="text-sm text-slate-600">
            Ți-ai folosit toate invitațiile pentru acest eveniment. Dacă ai nevoie de mai multe, discută cu un
            administrator.
          </p>
        ) : (
          <>
            <p className="mb-3 text-[13px] font-bold text-slate-600">
              Cerere nouă: mai poți invita {ramase} {ramase === 1 ? 'persoană' : 'persoane'}
            </p>
            {invitati.map((inv, i) => (
              <div key={i} className="mb-2.5 flex flex-wrap gap-2.5">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-bold text-slate-600" htmlFor={`n-${e.id}-${i}`}>Nume și prenume</label>
                  <input
                    id={`n-${e.id}-${i}`}
                    value={inv.nume}
                    onChange={(ev) => seteaza(i, 'nume', ev.target.value)}
                    placeholder="Ex: Ioana Popescu"
                    maxLength={120}
                    className="w-full rounded-[10px] border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-bold text-slate-600" htmlFor={`e-${e.id}-${i}`}>Email</label>
                  <input
                    id={`e-${e.id}-${i}`}
                    type="email"
                    value={inv.email}
                    onChange={(ev) => seteaza(i, 'email', ev.target.value)}
                    placeholder="ioana@exemplu.ro"
                    maxLength={200}
                    className="w-full rounded-[10px] border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            ))}
            {invitati.length < ramase && (
              <button
                type="button"
                onClick={() => setInvitati((p) => [...p, { nume: '', email: '' }])}
                className="mb-3 text-[13px] font-semibold text-accent underline"
              >
                + Adaugă încă un invitat
              </button>
            )}
            {eroare && <p className="mb-2 text-sm text-rose-600">{eroare}</p>}
            {ok && <p className="mb-2 text-sm text-green-700">Cererea a fost trimisă. O vezi mai jos, la „Cererile mele”.</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-slate-600">
                Dacă ai nevoie de mai mult de {e.limita} invitații, discută cu un administrator.
              </span>
              <Btn variant="primary" onClick={trimite} disabled={trimitand}>
                {trimitand ? 'Se trimite…' : 'Trimite cererea'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

function CerereMea({ cerere: c }) {
  const st = STATUS[c.status] || STATUS.in_asteptare
  const [copiat, setCopiat] = useState(false)

  async function copiaza() {
    try {
      await navigator.clipboard.writeText(c.link)
      setCopiat(true)
      setTimeout(() => setCopiat(false), 2000)
    } catch {
      window.prompt('Copiază linkul:', c.link)
    }
  }

  const aprobataFaraInvitatie = c.status === 'aprobata' && !c.fisier_url && !c.link

  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm text-slate-900">
          {(c.invitati || []).map((i) => i.nume).join(', ')}
          <span className="block text-xs text-slate-500">
            {(c.invitati || []).map((i) => i.email).filter(Boolean).join(', ')} · {c.eveniment_nume}
          </span>
        </div>
        <Pill culoare={st.culoare}>{st.label}</Pill>
      </div>
      {c.status === 'aprobata' && (c.fisier_url || c.link) && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-[#F6EEDB] px-3.5 py-3 text-[13px] text-[#4a3710]">
          <strong>Invitația e gata:</strong>
          {c.fisier_url && (
            <a
              href={c.fisier_url}
              target="_blank"
              rel="noreferrer"
              download
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-accent hover:bg-slate-50"
            >
              Descarcă invitația{c.fisier_nume ? ` (${c.fisier_nume.split('.').pop().toUpperCase()})` : ''}
            </a>
          )}
          {c.link && <Btn onClick={copiaza}>{copiat ? 'Link copiat' : 'Copiază linkul de distribuire'}</Btn>}
        </div>
      )}
      {aprobataFaraInvitatie && (
        <p className="text-xs text-slate-500">Invitația nu a fost încă adăugată de administrator. O vei vedea aici când e gata.</p>
      )}
    </div>
  )
}
