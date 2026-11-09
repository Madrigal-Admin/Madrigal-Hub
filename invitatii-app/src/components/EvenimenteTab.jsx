import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { azi, formatData, formatOra, mesajEroare, profilul, randMeta } from '../lib/format'
import { BaraLocuri, Btn, FilterChip, PageHeader, Pill, totalLocuri } from './ui'
import EvenimentModal from './EvenimentModal'

const FILTRE = [
  { cod: 'toate', label: 'Toate' },
  { cod: 'viitoare', label: 'Viitoare' },
  { cod: 'desfasurare', label: 'În desfășurare' },
  { cod: 'inchise', label: 'Închise' },
]

// Starea unui eveniment: închis (manual, de Admin) / viitor / în desfășurare (data a sosit, nu e închis)
function stareEveniment(e, astazi) {
  if (profilul(e)?.inchis_la) return 'inchis'
  if (!e.data || e.data > astazi) return 'viitor'
  return 'desfasurare'
}

const TAG = {
  viitor: { label: 'Viitor', culoare: 'albastru' },
  desfasurare: { label: 'În desfășurare', culoare: 'verde' },
  inchis: { label: 'Închis', culoare: 'gri' },
}

export default function EvenimenteTab({ session, onNavigate }) {
  const [evenimente, setEvenimente] = useState([])
  const [stats, setStats] = useState({})
  const [tipuri, setTipuri] = useState({})
  const [angajati, setAngajati] = useState({})
  const [cautare, setCautare] = useState('')
  const [filtru, setFiltru] = useState('toate')
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState('')
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    const [ev, st, tp, ang] = await Promise.all([
      supabase
        .from('evenimente')
        .select('*, invitatii_profil_eveniment(*), eveniment_tipuri(tip_cod), eveniment_pm(angajat_id)')
        .eq('necesita_rsvp', true)
        .order('data', { ascending: true }),
      supabase.rpc('invitatii_statistici'),
      supabase.from('tipuri_eveniment').select('cod, nume'),
      supabase.from('angajati').select('id, nume_complet'),
    ])
    if (ev.error || st.error) setEroare(mesajEroare(ev.error || st.error))
    else setEroare('')

    const s = {}
    for (const r of st.data || []) s[r.eveniment_id] = r
    setEvenimente(ev.data || [])
    setStats(s)
    setTipuri(Object.fromEntries((tp.data || []).map((t) => [t.cod, t.nume])))
    setAngajati(Object.fromEntries((ang.data || []).map((a) => [a.id, a.nume_complet])))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const astazi = azi()

  const vizibile = useMemo(() => {
    const q = cautare.trim().toLowerCase()
    return evenimente
      .filter((e) => {
        const stare = stareEveniment(e, astazi)
        const potrivireFiltru =
          filtru === 'toate' ||
          (filtru === 'viitoare' && stare === 'viitor') ||
          (filtru === 'desfasurare' && stare === 'desfasurare') ||
          (filtru === 'inchise' && stare === 'inchis')
        const potrivireText = !q || e.nume?.toLowerCase().includes(q) || e.locatie?.toLowerCase().includes(q)
        return potrivireFiltru && potrivireText
      })
      // cele deschise întâi (după dată), cele închise la urmă
      .sort((a, b) => {
        const ia = stareEveniment(a, astazi) === 'inchis' ? 1 : 0
        const ib = stareEveniment(b, astazi) === 'inchis' ? 1 : 0
        if (ia !== ib) return ia - ib
        return ia ? (b.data || '').localeCompare(a.data || '') : (a.data || '9999').localeCompare(b.data || '9999')
      })
  }, [evenimente, cautare, filtru, astazi])

  const evenimentDeschis = evenimente.find((e) => e.id === openId) || null

  if (loading) return <p className="text-sm text-slate-500">Se încarcă…</p>

  return (
    <div>
      <PageHeader
        titlu="Evenimente"
        descriere="Evenimentele vin din calendarul Hub (cele marcate „necesită RSVP”). Ora, PM-ul, tipul și implicarea se completează în Hub."
      />
      {eroare && <p className="mb-3 text-sm text-rose-600">{eroare}</p>}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          value={cautare}
          onChange={(e) => setCautare(e.target.value)}
          placeholder="Caută după nume sau locație"
          aria-label="Caută eveniment"
          className="mr-1 w-full rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent sm:w-72"
        />
        {FILTRE.map((f) => (
          <FilterChip key={f.cod} activ={filtru === f.cod} onClick={() => setFiltru(f.cod)}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      {vizibile.length === 0 ? (
        <p className="text-sm text-slate-400">Niciun eveniment găsit.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {vizibile.map((e) => (
            <CardEveniment
              key={e.id}
              eveniment={e}
              stare={stareEveniment(e, astazi)}
              s={stats[e.id]}
              tipuri={tipuri}
              angajati={angajati}
              onOpen={() => setOpenId(e.id)}
            />
          ))}
        </div>
      )}

      {evenimentDeschis && (
        <EvenimentModal
          eveniment={evenimentDeschis}
          tipuri={tipuri}
          angajati={angajati}
          session={session}
          onClose={() => setOpenId(null)}
          onChanged={load}
          onGestioneazaCategorii={() => onNavigate('setari')}
        />
      )}
    </div>
  )
}

function CardEveniment({ eveniment: e, stare, s, tipuri, angajati, onOpen }) {
  const profil = profilul(e)
  const tag = TAG[stare]
  const ora = formatOra(e)
  const { pm, tipNume } = randMeta(e, tipuri, angajati)
  const st = s || { invitati: 0, trimise: 0, confirmati: 0, refuzati: 0, prezenti: 0, aprobati_angajati: 0, in_asteptare: 0 }
  const locuri = { confirmati: st.confirmati, aprobati: st.aprobati_angajati, in_asteptare: st.in_asteptare, plafon: profil?.plafon }
  const ocupate = totalLocuri(locuri)
  const inchis = stare === 'inchis'

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2.5">
        <p className="text-[17px] font-bold leading-snug text-slate-900">{e.nume}</p>
        <Pill culoare={tag.culoare} className="shrink-0 !text-xs">{tag.label}</Pill>
      </div>

      <p className="text-[13px] leading-relaxed text-slate-600">
        {formatData(e.data)}
        {ora ? ` · ${ora}` : ''}
        {e.locatie && <><br />{e.locatie}</>}
        {pm.length > 0 && <><br />PM: {pm.join(', ')}</>}
      </p>

      {(tipNume.length > 0 || e.implicare) && (
        <div className="flex flex-wrap gap-1.5">
          {tipNume.map((t) => (
            <span key={t} className="rounded-full bg-[#e9eef6] px-2.5 py-0.5 text-xs font-semibold text-accent">{t}</span>
          ))}
          {e.implicare && (
            <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600">{e.implicare}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1 border-y border-slate-100 py-2.5 text-center">
        <Stat n={st.invitati - st.trimise} l="Netrimise" c="text-slate-600" />
        <Stat n={st.trimise} l="Trimise" c="text-accent" />
        <Stat n={st.confirmati} l="Confirm." c="text-green-700" />
        <Stat n={st.refuzati} l="Refuzate" c="text-rose-700" />
        <Stat n={st.prezenti} l="Prezenți" c="text-slate-900" />
      </div>

      <div className="text-xs text-slate-600">
        {inchis ? (
          <>Închis de Admin pe {formatData(profil.inchis_la)} · check-in oprit</>
        ) : profil?.plafon ? (
          <>
            Locuri ocupate: <strong>{ocupate} din {profil.plafon}</strong> ({Math.round((ocupate / profil.plafon) * 100)}%)
            <div className="mt-1.5"><BaraLocuri locuri={locuri} inaltime="h-2" /></div>
          </>
        ) : (
          <>Plafon nesetat</>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {inchis ? (
          <Pill culoare="gri" className="!text-xs">Doar istoric</Pill>
        ) : (
          <>
            <Pill culoare={profil?.solicitari_deschise ? 'verde' : 'gri'} className="!text-xs">
              {profil?.solicitari_deschise ? 'Solicitări angajați deschise' : 'Doar lista fixă'}
            </Pill>
            {!profil?.subiect_email && <Pill culoare="galben" className="!text-xs">Fără conținut de email încă</Pill>}
          </>
        )}
      </div>

      <Btn variant={inchis ? 'secondary' : 'primary'} onClick={onOpen} className="mt-auto !py-2.5">
        {inchis ? 'Vezi detalii' : 'Invitați, trimitere și setări'}
      </Btn>
    </div>
  )
}

function Stat({ n, l, c }) {
  return (
    <div>
      <p className={`text-xl font-extrabold ${c}`}>{n}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{l}</p>
    </div>
  )
}
