import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { azi, formatData, mesajEroare, profilul } from '../lib/format'
import { Pill, PageHeader } from './ui'

const RSVP_BADGE = {
  confirmat: { label: 'Confirmat', culoare: 'verde' },
  refuzat: { label: 'Refuzat', culoare: 'rosu' },
  in_asteptare: { label: 'În așteptare', culoare: 'galben' },
}

// Check-in: doar evenimentele în desfășurare (data a sosit) care nu au fost închise de Admin
export default function CheckinTab() {
  const [evenimente, setEvenimente] = useState([])
  const [evenimentId, setEvenimentId] = useState('')
  const [invitatii, setInvitatii] = useState([])
  const [cautare, setCautare] = useState('')
  const [sortare, setSortare] = useState('nume')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [eroare, setEroare] = useState('')

  useEffect(() => {
    async function loadEvenimente() {
      const { data } = await supabase
        .from('evenimente')
        .select('id, nume, data, invitatii_profil_eveniment(inchis_la)')
        .eq('necesita_rsvp', true)
        .lte('data', azi())
        .order('data', { ascending: false })

      const lista = (data || []).filter((e) => !profilul(e)?.inchis_la)
      setEvenimente(lista)
      setEvenimentId(lista[0]?.id || '')
      if (lista.length === 0) setLoading(false)
    }
    loadEvenimente()
  }, [])

  const loadInvitatii = useCallback(async (id) => {
    setLoading(true)
    const { data, error } = await supabase.rpc('checkin_invitati', { p_eveniment_id: id })
    if (error) setEroare(mesajEroare(error))
    setInvitatii(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (evenimentId) loadInvitatii(evenimentId)
  }, [evenimentId, loadInvitatii])

  async function toggleCheckin(inv) {
    setBusyId(inv.id)
    setEroare('')
    const nouaValoare = !inv.prezent
    const { error } = await supabase
      .from('invitatii')
      .update({ prezent: nouaValoare, data_checkin: nouaValoare ? new Date().toISOString() : null })
      .eq('id', inv.id)
    setBusyId(null)
    if (error) {
      setEroare(mesajEroare(error))
      return
    }
    setInvitatii((prev) => prev.map((i) => (i.id === inv.id ? { ...i, prezent: nouaValoare } : i)))
  }

  const filtrate = useMemo(() => {
    const q = cautare.trim().toLowerCase()
    const lista = invitatii.filter((i) => !q || (i.nume || '').toLowerCase().includes(q))
    return [...lista].sort((a, b) =>
      sortare === 'categorie'
        ? (a.categorie || '').localeCompare(b.categorie || '', 'ro') || (a.nume || '').localeCompare(b.nume || '', 'ro')
        : (a.nume || '').localeCompare(b.nume || '', 'ro')
    )
  }, [invitatii, cautare, sortare])

  const prezenti = invitatii.filter((i) => i.prezent).length
  const lista = invitatii.filter((i) => i.sursa === 'trimitere')
  const confirmati = lista.filter((i) => i.status_rsvp === 'confirmat').length
  const inAsteptare = lista.filter((i) => i.status_rsvp === 'in_asteptare').length
  const refuzati = lista.filter((i) => i.status_rsvp === 'refuzat').length
  const angajati = invitatii.filter((i) => i.sursa === 'solicitare').length

  return (
    <div>
      <PageHeader
        titlu="Check-in"
        descriere="Evenimentele în desfășurare: data a sosit și nu au fost închise de un administrator. Bifezi persoanele pe măsură ce intră."
      />

      {evenimente.length === 0 ? (
        !loading && (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
            Niciun eveniment în desfășurare. Check-in-ul e disponibil din ziua evenimentului, până când un
            administrator îl închide.
          </p>
        )
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="ev-checkin" className="mb-1 block text-xs font-bold text-slate-600">Eveniment</label>
              <select
                id="ev-checkin"
                value={evenimentId}
                onChange={(e) => setEvenimentId(e.target.value)}
                className="min-w-[260px] rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {evenimente.map((e) => (
                  <option key={e.id} value={e.id}>{e.nume} — {formatData(e.data)}</option>
                ))}
              </select>
            </div>
            <input
              value={cautare}
              onChange={(e) => setCautare(e.target.value)}
              placeholder="Caută persoană…"
              aria-label="Caută persoană"
              className="rounded-[10px] border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div>
              <label htmlFor="sort-checkin" className="mb-1 block text-xs font-bold text-slate-600">Sortează după</label>
              <select
                id="sort-checkin"
                value={sortare}
                onChange={(e) => setSortare(e.target.value)}
                className="rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="nume">Nume</option>
                <option value="categorie">Categorie</option>
              </select>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-accent p-5 text-white">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">Prezenți la intrare</p>
              <p className="text-3xl font-extrabold">
                {prezenti} <span className="text-lg font-normal text-white/70">/ {invitatii.length} invitați</span>
              </p>
            </div>
            <div className="text-sm text-white/90">
              <p>{confirmati} confirmați</p>
              <p>{inAsteptare} în așteptare</p>
              <p>{refuzati} refuzați</p>
              <p>{angajati} invitați ai angajaților</p>
            </div>
          </div>

          {eroare && <p className="mb-3 text-sm text-rose-600">{eroare}</p>}

          {loading ? (
            <p className="text-sm text-slate-500">Se încarcă…</p>
          ) : (
            <div className="space-y-1.5">
              {filtrate.map((inv) => {
                const badge = RSVP_BADGE[inv.status_rsvp] || RSVP_BADGE.in_asteptare
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-200 bg-white p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{inv.nume || 'Fără nume'}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {inv.sursa === 'solicitare' ? (
                          <Pill culoare="albastru">Invitat al angajatului {inv.solicitant || '—'}</Pill>
                        ) : (
                          <>
                            {inv.categorie && <Pill>{inv.categorie}</Pill>}
                            <Pill culoare={badge.culoare}>{badge.label}</Pill>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-slate-500">{inv.prezent ? 'Prezent' : 'Neprezentat'}</span>
                      <button
                        onClick={() => toggleCheckin(inv)}
                        disabled={busyId === inv.id}
                        aria-label={inv.prezent ? 'Anulează prezența' : 'Marchează prezent'}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition disabled:opacity-50 ${
                          inv.prezent ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 text-transparent hover:border-accent'
                        }`}
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
              {filtrate.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Niciun invitat găsit.</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
