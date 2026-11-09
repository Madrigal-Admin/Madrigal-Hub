import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDataScurta, mesajEroare, esteEroareCod, profilul } from '../lib/format'
import { BaraLocuri, Btn, Card, FilterChip, LegendaLocuri, PageHeader, Pill, totalLocuri } from './ui'

const STATUS = {
  in_asteptare: { label: 'În așteptare', culoare: 'galben' },
  aprobata: { label: 'Aprobată', culoare: 'verde' },
  refuzata: { label: 'Refuzată', culoare: 'rosu' },
}

const FILTRE = [
  { cod: 'in_asteptare', label: 'În așteptare' },
  { cod: 'aprobata', label: 'Aprobate' },
  { cod: 'refuzata', label: 'Refuzate' },
  { cod: 'toate', label: 'Toate' },
]

// Lista generală a solicitărilor angajaților, pe eveniment
export default function AprobariTab({ onChanged }) {
  const [evenimente, setEvenimente] = useState([])
  const [evenimentId, setEvenimentId] = useState('')
  const [cereri, setCereri] = useState([])
  const [locuri, setLocuri] = useState(null)
  const [filtru, setFiltru] = useState('in_asteptare')
  const [loading, setLoading] = useState(true)
  const [lucreaza, setLucreaza] = useState(null)
  const [eroare, setEroare] = useState('')

  // Evenimentele cu solicitări: cele marcate pentru RSVP, neanulate
  useEffect(() => {
    async function incarcaEvenimente() {
      const { data } = await supabase
        .from('evenimente')
        .select('id, nume, data, invitatii_profil_eveniment(solicitari_deschise, inchis_la), cereri_invitati(status)')
        .eq('necesita_rsvp', true)
        .order('data', { ascending: false })
      const lista = (data || []).map((e) => {
        const cereri = e.cereri_invitati || []
        return {
          id: e.id,
          nume: e.nume,
          data: e.data,
          inchis: !!profilul(e)?.inchis_la,
          deschis: !!profilul(e)?.solicitari_deschise,
          asteptare: cereri.filter((c) => c.status === 'in_asteptare').length,
          total: cereri.length,
        }
      })
      setEvenimente(lista)
      // implicit: primul eveniment cu cereri în așteptare, apoi primul cu cereri, apoi primul deschis
      const implicit =
        lista.find((e) => e.asteptare > 0) || lista.find((e) => e.total > 0) || lista.find((e) => e.deschis) || lista[0]
      setEvenimentId(implicit?.id || '')
      if (!implicit) setLoading(false)
    }
    incarcaEvenimente()
  }, [])

  const incarca = useCallback(async () => {
    if (!evenimentId) return
    setLoading(true)
    const [lista, loc] = await Promise.all([
      supabase.rpc('solicitari_admin', { p_eveniment_id: evenimentId }),
      supabase.rpc('invitatii_locuri', { p_eveniment_id: evenimentId }),
    ])
    setCereri(lista.data || [])
    setLocuri(loc.data || null)
    setEroare(lista.error || loc.error ? mesajEroare(lista.error || loc.error) : '')
    setLoading(false)
  }, [evenimentId])

  useEffect(() => {
    incarca()
  }, [incarca])

  async function decide(cerere, decizie, depasire = false) {
    setLucreaza(cerere.cerere_id)
    setEroare('')
    const { error } = await supabase.rpc('solicitare_decide', {
      p_cerere_id: cerere.cerere_id,
      p_decizie: decizie,
      p_depasire: depasire,
    })
    setLucreaza(null)
    if (error) {
      if (esteEroareCod(error, 'plafon_depasit')) {
        if (confirm('Aprobarea depășește plafonul evenimentului. Aprobi totuși această cerere?')) {
          decide(cerere, decizie, true)
        }
        return
      }
      setEroare(mesajEroare(error))
      return
    }
    await incarca()
    onChanged?.()
  }

  function anuleaza(cerere) {
    if (!confirm('Anulezi aprobarea? Invitații ei ies din lista de check-in, iar cererea revine „în așteptare”.')) return
    decide(cerere, 'anuleaza')
  }

  const numar = (cod) => cereri.filter((c) => c.status === cod).length
  const vizibile = cereri.filter((c) => filtru === 'toate' || c.status === filtru)
  const eveniment = evenimente.find((e) => e.id === evenimentId)
  const ocupate = locuri ? totalLocuri(locuri) : 0

  return (
    <div>
      <PageHeader
        titlu="Aprobări"
        descriere="Lista generală a solicitărilor angajaților, pe eveniment. Cererile aprobate intră automat în lista de check-in. Vezi plafonul înainte să aprobi."
      />

      {evenimente.length === 0 && !loading ? (
        <p className="text-sm text-slate-500">Niciun eveniment cu RSVP activ.</p>
      ) : (
        <>
          <Card className="mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label htmlFor="ev-aprobari" className="mb-1 block text-xs font-bold text-slate-600">Eveniment</label>
                <select
                  id="ev-aprobari"
                  value={evenimentId}
                  onChange={(e) => setEvenimentId(e.target.value)}
                  className="min-w-[260px] rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {evenimente.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nume}
                      {e.inchis ? ' (închis)' : ''}
                      {e.asteptare > 0 ? ` — ${e.asteptare} în așteptare` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {locuri && (
                <div className="text-right">
                  <strong className="text-xl">
                    {ocupate}
                    {locuri.plafon ? ` / ${locuri.plafon}` : ''}
                  </strong>
                  <p className="text-xs text-slate-500">
                    {locuri.plafon ? `locuri ocupate (${Math.round((ocupate / locuri.plafon) * 100)}%)` : 'locuri ocupate · plafon nesetat'}
                  </p>
                </div>
              )}
            </div>
            {locuri && (
              <div className="mt-3 space-y-2">
                {locuri.plafon && <BaraLocuri locuri={locuri} />}
                <LegendaLocuri locuri={locuri} />
                {locuri.plafon && ocupate >= locuri.plafon * 0.9 && (
                  <p className="rounded-[10px] bg-amber-100 px-3 py-2 text-xs text-amber-900">
                    {ocupate >= locuri.plafon
                      ? 'Plafonul a fost atins. Angajații nu mai pot trimite cereri; poți aproba în continuare, cu confirmare.'
                      : `Ai ocupat ${Math.round((ocupate / locuri.plafon) * 100)}% din plafon. Verifică lista înainte să aprobi alte cereri.`}
                  </p>
                )}
              </div>
            )}
          </Card>

          {eveniment?.inchis && (
            <p className="mb-4 rounded-[10px] bg-slate-100 px-3 py-2 text-sm text-slate-600">
              Evenimentul este închis: cererile nu mai pot fi aprobate sau refuzate.
            </p>
          )}

          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTRE.map((f) => (
              <FilterChip key={f.cod} activ={filtru === f.cod} onClick={() => setFiltru(f.cod)}>
                {f.label} {f.cod === 'toate' ? cereri.length : numar(f.cod)}
              </FilterChip>
            ))}
          </div>

          {eroare && <p className="mb-3 text-sm text-rose-600">{eroare}</p>}

          {loading ? (
            <p className="text-sm text-slate-500">Se încarcă…</p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_80px_130px_190px] items-center gap-3 bg-slate-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <span>Solicitant</span>
                    <span>Invitați</span>
                    <span>Limită</span>
                    <span>Status</span>
                    <span>Acțiuni</span>
                  </div>
                  {vizibile.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">Nicio cerere în această categorie.</p>
                  )}
                  {vizibile.map((c) => (
                    <RandCerere
                      key={c.cerere_id}
                      cerere={c}
                      inchis={eveniment?.inchis}
                      lucreaza={lucreaza === c.cerere_id}
                      onAproba={() => decide(c, 'aproba')}
                      onRefuza={() => decide(c, 'refuza')}
                      onAnuleaza={() => anuleaza(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
            „Limită” arată câți invitați are solicitantul față de limita lui (cea standard sau cea din lista de
            excepții). Dacă aprobarea ar depăși plafonul evenimentului, apare o confirmare.
          </p>
        </>
      )}
    </div>
  )
}

function RandCerere({ cerere: c, inchis, lucreaza, onAproba, onRefuza, onAnuleaza }) {
  const st = STATUS[c.status]
  const invitati = c.invitati || []
  const afisati = invitati.slice(0, 2)
  const peste = invitati.length - afisati.length

  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_80px_130px_190px] items-center gap-3 border-t border-slate-100 px-4 py-3 text-[13px]">
      <div>
        <p className="font-bold text-slate-900">{c.solicitant}</p>
        <p className="text-xs text-slate-500">
          {c.conducere ? 'Conducere' : 'Angajat'} · {formatDataScurta(c.data_cerere)}
        </p>
      </div>
      <div>
        {afisati.map((i) => i.nume).join(', ')}
        <p className="text-xs text-slate-500">
          {peste > 0 ? `+ ${peste} invitați în această cerere` : afisati.map((i) => i.email).filter(Boolean).join(', ')}
        </p>
      </div>
      <span className="font-bold">
        {c.folosite} / {c.limita}
      </span>
      <span><Pill culoare={st.culoare}>{st.label}</Pill></span>
      <div className="flex gap-1.5">
        {!inchis && c.status === 'in_asteptare' && (
          <>
            <Btn variant="smallPrimary" onClick={onAproba} disabled={lucreaza}>Aprobă</Btn>
            <Btn variant="small" onClick={onRefuza} disabled={lucreaza}>Refuză</Btn>
          </>
        )}
        {!inchis && c.status === 'aprobata' && (
          <Btn variant="small" onClick={onAnuleaza} disabled={lucreaza}>Anulează aprobarea</Btn>
        )}
      </div>
    </div>
  )
}
