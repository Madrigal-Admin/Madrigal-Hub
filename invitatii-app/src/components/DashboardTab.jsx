import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatData, mesajEroare, profilul } from '../lib/format'
import { Card, PageHeader, Pill } from './ui'

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)

export default function DashboardTab() {
  const [randuri, setRanduri] = useState(null)
  const [eroare, setEroare] = useState('')

  useEffect(() => {
    async function load() {
      const [ev, st] = await Promise.all([
        supabase
          .from('evenimente')
          .select('id, nume, data, invitatii_profil_eveniment(plafon, inchis_la)')
          .order('data', { ascending: false }),
        supabase.rpc('invitatii_statistici'),
      ])
      if (ev.error || st.error) {
        setEroare(mesajEroare(ev.error || st.error))
        return
      }
      const pe = new Map((ev.data || []).map((e) => [e.id, e]))
      setRanduri(
        (st.data || [])
          .map((s) => ({ ...s, eveniment: pe.get(s.eveniment_id) }))
          .filter((r) => r.eveniment)
          .sort((a, b) => (b.eveniment.data || '').localeCompare(a.eveniment.data || ''))
      )
    }
    load()
  }, [])

  if (eroare) return <p className="text-sm text-rose-600">{eroare}</p>
  if (!randuri) return <p className="text-sm text-slate-500">Se încarcă…</p>

  const anCurent = String(new Date().getFullYear())
  const inchis = (r) => !!profilul(r.eveniment)?.inchis_la
  const active = randuri.filter((r) => !inchis(r))
  const trimiseAn = randuri
    .filter((r) => (r.eveniment.data || '').startsWith(anCurent))
    .reduce((s, r) => s + r.trimise, 0)
  const cuTrimise = randuri.filter((r) => r.trimise > 0)
  const rataMedie = cuTrimise.length
    ? Math.round(cuTrimise.reduce((s, r) => s + pct(r.confirmati + r.refuzati, r.trimise), 0) / cuTrimise.length)
    : null
  const inchise = randuri.filter((r) => inchis(r) && r.confirmati > 0)
  const prezenta = inchise.length
    ? Math.round((inchise.reduce((s, r) => s + r.prezenti_lista, 0) / inchise.reduce((s, r) => s + r.confirmati, 0)) * 100)
    : null

  return (
    <div>
      <PageHeader
        titlu="Dashboard"
        descriere="Cum a mers fiecare eveniment: câți ai invitat, câți au răspuns, câți au venit. Include evenimentele închise."
      />

      <div className="mb-6 flex flex-wrap gap-3.5">
        <Kpi valoare={active.length} eticheta="Evenimente active" />
        <Kpi valoare={trimiseAn} eticheta="Invitații trimise (an)" />
        <Kpi valoare={rataMedie == null ? '—' : `${rataMedie}%`} eticheta="Rată de răspuns, medie" />
        <Kpi valoare={prezenta == null ? '—' : `${prezenta}%`} eticheta="Prezență din confirmați, evenimente închise" />
      </div>

      {randuri.length === 0 ? (
        <p className="text-sm text-slate-500">Niciun eveniment cu invitații încă.</p>
      ) : (
        randuri.map((r) => <Palnie key={r.eveniment_id} r={r} />)
      )}
    </div>
  )
}

function Kpi({ valoare, eticheta }) {
  return (
    <div className="min-w-[150px] flex-1 rounded-2xl bg-white px-[18px] py-4 shadow-sm">
      <p className="text-[28px] font-extrabold leading-none text-accent">{valoare}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{eticheta}</p>
    </div>
  )
}

function Palnie({ r }) {
  const p = profilul(r.eveniment)
  const inchis = !!p?.inchis_la
  const raspuns = r.confirmati + r.refuzati
  const max = Math.max(r.invitati, 1)

  const trepte = [
    { eticheta: 'Invitați', valoare: r.invitati, text: String(r.invitati) },
    { eticheta: 'Trimise', valoare: r.trimise, text: `${r.trimise} (${pct(r.trimise, r.invitati)}%)` },
    { eticheta: 'Au răspuns', valoare: raspuns, text: `${raspuns} (${pct(raspuns, r.trimise)}%)` },
    { eticheta: 'Confirmați', valoare: r.confirmati, text: String(r.confirmati), verde: true },
    {
      eticheta: 'Prezenți',
      valoare: r.prezenti_lista,
      text: inchis
        ? `${r.prezenti_lista} (${pct(r.prezenti_lista, r.confirmati)}% din confirmați)`
        : r.prezenti_lista > 0
          ? String(r.prezenti_lista)
          : '0 (check-in neînceput)',
      verde: inchis,
    },
  ]

  return (
    <Card className="mb-4 !p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2.5">
        <div>
          <p className="text-base font-bold text-slate-900">{r.eveniment.nume}</p>
          <p className="text-xs text-slate-500">
            {formatData(r.eveniment.data)}
            {p?.plafon ? ` · plafon ${p.plafon}` : ''}
            {inchis ? ` · închis pe ${formatData(p.inchis_la)}` : ''}
          </p>
        </div>
        <Pill culoare={inchis ? 'gri' : 'albastru'}>{inchis ? 'Închis' : 'Activ'}</Pill>
      </div>
      <div className="flex flex-col gap-1.5">
        {trepte.map((t) => (
          <div key={t.eticheta} className="grid grid-cols-[110px_minmax(0,1fr)_170px] items-center gap-3 text-[13px]">
            <span>{t.eticheta}</span>
            <div className="h-3.5 overflow-hidden rounded-md bg-slate-100">
              <div
                className={`h-full rounded-md ${t.verde ? 'bg-green-700' : 'bg-accent'}`}
                style={{ width: `${Math.min(100, (t.valoare / max) * 100)}%` }}
              />
            </div>
            <span className="text-right font-bold">{t.text}</span>
          </div>
        ))}
      </div>
      {r.aprobati_angajati > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          În plus: {r.aprobati_angajati} invitați aprobați ai angajaților (nu intră în cifrele de mai sus, intră direct în check-in); {r.prezenti - r.prezenti_lista} dintre ei au intrat.
        </p>
      )}
    </Card>
  )
}
