import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { fetchAll } from '../lib/fetchAll'
import { useCategorii } from '../lib/useCategorii'
import { mesajEroare } from '../lib/format'
import { Btn, FilterChip, Pill } from './ui'

const AFISARE_INITIALA = 50

// Starea unui invitat din lista fixă, ca etichetă (statusul include și faptul că emailul a plecat)
export function stareInvitat(i) {
  if (i.sursa === 'solicitare') return { cod: 'confirmat', label: 'Confirmat', culoare: 'verde' }
  if (i.status_rsvp === 'confirmat') return { cod: 'confirmat', label: 'Confirmat', culoare: 'verde' }
  if (i.status_rsvp === 'refuzat') return { cod: 'refuzat', label: 'Refuzat', culoare: 'rosu' }
  if (i.trimis_la) return { cod: 'trimis', label: 'Trimis, fără răspuns', culoare: 'albastru' }
  return { cod: 'netrimis', label: 'Netrimis', culoare: 'gri' }
}

export default function TabInvitati({ eveniment, inchis, onChanged, onGestioneazaCategorii }) {
  const { active: categoriiActive } = useCategorii()
  const [invitatii, setInvitatii] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectate, setSelectate] = useState([])
  const [potentiali, setPotentiali] = useState([])
  const [dezabonati, setDezabonati] = useState(0)
  const [debifati, setDebifati] = useState(new Set())
  const [adaugand, setAdaugand] = useState(false)
  const [filtru, setFiltru] = useState('toti')
  const [afisate, setAfisate] = useState(AFISARE_INITIALA)
  const [eroare, setEroare] = useState('')

  const loadInvitatii = useCallback(async () => {
    const { data, error } = await fetchAll((a, b) =>
      supabase
        .from('invitatii')
        .select(
          'id, persoana_id, nume_complet_invitat, email_invitat, sursa, status_rsvp, trimis_la, persoane(nume, prenume, email, categorie), cereri_invitati(solicitant_nume)'
        )
        .eq('eveniment_id', eveniment.id)
        .order('created_at', { ascending: false })
        .order('id')
        .range(a, b)
    )
    if (error) setEroare(mesajEroare(error))
    setInvitatii(data || [])
    setLoading(false)
  }, [eveniment.id])

  useEffect(() => {
    loadInvitatii()
  }, [loadInvitatii])

  // Persoanele din categoriile bifate, care nu sunt deja invitate. Cele dezabonate se exclud automat.
  useEffect(() => {
    let anulat = false
    async function incarca() {
      if (selectate.length === 0) {
        setPotentiali([])
        setDezabonati(0)
        return
      }
      const dejaInvitati = new Set(invitatii.map((i) => i.persoana_id).filter(Boolean))
      const { data } = await fetchAll((a, b) =>
        supabase
          .from('persoane')
          .select('id, nume, prenume, email, categorie, abonat_invitatii')
          .in('categorie', selectate)
          .order('nume')
          .order('id')
          .range(a, b)
      )
      if (anulat) return
      const noi = (data || []).filter((p) => !dejaInvitati.has(p.id))
      setPotentiali(noi.filter((p) => p.abonat_invitatii))
      setDezabonati(noi.filter((p) => !p.abonat_invitatii).length)
    }
    incarca()
    return () => {
      anulat = true
    }
  }, [selectate, invitatii])

  function toggleCategorie(nume) {
    setSelectate((prev) => (prev.includes(nume) ? prev.filter((x) => x !== nume) : [...prev, nume]))
    setDebifati(new Set())
  }

  function toggleDebifat(id) {
    setDebifati((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const deAdaugat = potentiali.filter((p) => !debifati.has(p.id))
  const toateBifate = potentiali.length > 0 && deAdaugat.length === potentiali.length

  async function handleAdauga() {
    if (deAdaugat.length === 0) return
    setAdaugand(true)
    setEroare('')
    for (let i = 0; i < deAdaugat.length; i += 500) {
      const lot = deAdaugat.slice(i, i + 500).map((p) => ({
        eveniment_id: eveniment.id,
        persoana_id: p.id,
        categorie: p.categorie,
        sursa: 'trimitere',
      }))
      const { error } = await supabase.from('invitatii').insert(lot)
      if (error) {
        setEroare(mesajEroare(error))
        break
      }
    }
    setAdaugand(false)
    setSelectate([])
    setDebifati(new Set())
    await loadInvitatii()
    onChanged()
  }

  async function handleSterge(i) {
    if (!confirm('Elimini această persoană din lista de invitați la acest eveniment?')) return
    const { error } = await supabase.from('invitatii').delete().eq('id', i.id)
    if (error) {
      setEroare(mesajEroare(error))
      return
    }
    await loadInvitatii()
    onChanged()
  }

  const numere = useMemo(() => {
    const n = { toti: invitatii.length, netrimis: 0, trimis: 0, confirmat: 0, refuzat: 0 }
    for (const i of invitatii) n[stareInvitat(i).cod] += 1
    return n
  }, [invitatii])

  const filtrati = invitatii.filter((i) => filtru === 'toti' || stareInvitat(i).cod === filtru)

  return (
    <div className="space-y-6">
      {!inchis && (
        <div className="rounded-[14px] border border-slate-200 p-4">
          <p className="mb-2.5 text-[13px] font-bold text-slate-700">Adaugă invitați din categorii</p>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {categoriiActive.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5">
                <input type="checkbox" checked={selectate.includes(c.nume)} onChange={() => toggleCategorie(c.nume)} />
                {c.nume}
              </label>
            ))}
            <button type="button" onClick={onGestioneazaCategorii} className="text-[13px] font-semibold text-accent underline">
              Gestionează categorii
            </button>
          </div>

          {potentiali.length > 0 && (
            <div className="overflow-hidden rounded-[10px] border border-slate-200">
              <div className="grid grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)] items-center gap-2.5 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <input
                  type="checkbox"
                  aria-label="Selectează toți"
                  checked={toateBifate}
                  onChange={() => setDebifati(toateBifate ? new Set(potentiali.map((p) => p.id)) : new Set())}
                />
                <span>Nume</span>
                <span>Categorie</span>
                <span>Email</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {potentiali.map((p) => (
                  <label
                    key={p.id}
                    className={`grid cursor-pointer grid-cols-[28px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)] items-center gap-2.5 border-t border-slate-100 px-3 py-2 text-[13px] ${
                      debifati.has(p.id) ? 'opacity-50' : ''
                    }`}
                  >
                    <input type="checkbox" checked={!debifati.has(p.id)} onChange={() => toggleDebifat(p.id)} />
                    <span className="truncate">{p.prenume} {p.nume}</span>
                    <span className="truncate">{p.categorie}</span>
                    <span className="truncate">{p.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectate.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 text-[13px] text-slate-600">
              <span>
                <strong>{deAdaugat.length} din {potentiali.length}</strong> selectați
                {debifati.size > 0 ? ` · ${debifati.size} debifați de tine` : ''}
                {dezabonati > 0 ? ` · ${dezabonati} persoane dezabonate sunt excluse automat` : ''}
              </span>
              <Btn variant="primary" onClick={handleAdauga} disabled={deAdaugat.length === 0 || adaugand}>
                {adaugand ? 'Se adaugă…' : `Adaugă ${deAdaugat.length} invitați`}
              </Btn>
            </div>
          )}
          {selectate.length > 0 && potentiali.length === 0 && (
            <p className="text-[13px] text-slate-500">
              Nicio persoană nouă în aceste categorii (toate sunt deja invitate sau dezabonate).
              {dezabonati > 0 ? ` ${dezabonati} dezabonate sunt excluse automat.` : ''}
            </p>
          )}
        </div>
      )}

      {eroare && <p className="text-sm text-rose-600">{eroare}</p>}

      <div>
        <p className="mb-2.5 text-[13px] font-bold text-slate-700">Invitați existenți ({invitatii.length})</p>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {[
            ['toti', 'Toți'],
            ['netrimis', 'Netrimis'],
            ['trimis', 'Trimis, fără răspuns'],
            ['confirmat', 'Confirmat'],
            ['refuzat', 'Refuzat'],
          ].map(([cod, label]) => (
            <FilterChip
              key={cod}
              activ={filtru === cod}
              onClick={() => {
                setFiltru(cod)
                setAfisate(AFISARE_INITIALA)
              }}
            >
              {label} {numere[cod]}
            </FilterChip>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Se încarcă…</p>
        ) : filtrati.length === 0 ? (
          <p className="text-sm text-slate-400">Niciun invitat în această categorie.</p>
        ) : (
          <>
            {filtrati.slice(0, afisate).map((i) => {
              const stare = stareInvitat(i)
              const nume = i.persoane ? `${i.persoane.prenume} ${i.persoane.nume}` : i.nume_complet_invitat
              const email = i.persoane?.email || i.email_invitat
              const detaliu =
                i.sursa === 'solicitare'
                  ? `Invitat al angajatului ${i.cereri_invitati?.solicitant_nume || '—'}`
                  : i.persoane?.categorie || '—'
              return (
                <div key={i.id} className="mb-1.5 flex items-center justify-between gap-2.5 rounded-[10px] border border-slate-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{nume}</p>
                    <p className="truncate text-xs text-slate-500">{detaliu}{email ? ` · ${email}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Pill culoare={stare.culoare}>{stare.label}</Pill>
                    {!inchis && i.sursa === 'trimitere' && (
                      <button type="button" onClick={() => handleSterge(i)} className="text-xs text-slate-500 underline hover:text-rose-700">
                        Elimină
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {filtrati.length > afisate && (
              <Btn variant="small" onClick={() => setAfisate((a) => a + 100)} className="mt-1">
                Arată încă 100 (din {filtrati.length - afisate} rămași)
              </Btn>
            )}
          </>
        )}
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Statusurile arată acum și dacă emailul a plecat. „Netrimis” înseamnă că invitația există, dar nu a fost trimisă
          încă. Invitații angajaților se gestionează din tabul Aprobări.
        </p>
      </div>
    </div>
  )
}
