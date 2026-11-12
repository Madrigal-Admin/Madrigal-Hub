import { useEffect, useMemo, useState } from 'react'
import Icon from '@shared/Icons'
import { supabase } from '../../supabaseClient'
import { UrmatoareleEvenimente } from './CarduriDreapta'
import { azi } from './date'
import { LUNI, ymd, zileEveniment } from '../../lib/evenimente'

const carcasa = 'min-w-0 rounded-[14px] border border-[#E1E4EA] bg-white p-5'
const DESCRIERI = {
  hr: 'Cere concediu, vezi soldul și cererile',
  invitatii: 'Invitații și confirmări de prezență',
  administrativ: 'Cere materiale din magazie',
  rapoarte: 'Rapoarte de activitate și post-eveniment',
  financiar: 'Referate de necesitate și deconturi',
  secretariat: 'Registrele de intrări, ieșiri și documentele tale',
  admin: 'Angajați, acces, ghid',
}

function MiniCalendar({ evenimente, onOpenCalendar }) {
  const acum = new Date()
  const an = acum.getFullYear()
  const luna = acum.getMonth()
  const ziEv = useMemo(() => {
    const s = new Set()
    for (const e of evenimente) for (const z of zileEveniment(e)) s.add(z)
    return s
  }, [evenimente])
  const primaZi = new Date(an, luna, 1)
  const nrZile = new Date(an, luna + 1, 0).getDate()
  const offset = (primaZi.getDay() + 6) % 7
  const celule = [...Array(offset).fill(null), ...Array.from({ length: nrZile }, (_, i) => i + 1)]
  const astazi = acum.getDate()
  return (
    <section aria-label="Calendar" className={carcasa}>
      <h2 className="text-[19px] font-extrabold">{LUNI[luna]} {an}</h2>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[13px]">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((z, i) => <div key={i} className="py-1 text-[11px] font-bold text-[#5B6578]">{z}</div>)}
        {celule.map((n, i) => {
          if (!n) return <div key={i} />
          const data = ymd(new Date(an, luna, n))
          const areEv = ziEv.has(data)
          const eAzi = n === astazi
          return (
            <div key={i} className={`rounded-lg py-1.5 ${eAzi ? 'bg-[#22406B] font-extrabold text-white' : areEv ? 'bg-[#E4ECF8] font-bold text-[#22406B]' : 'text-[#172036]'}`}>{n}</div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-[#5B6578]">Zilele colorate au evenimente.</p>
      <button type="button" onClick={onOpenCalendar} className="mt-1 py-2 text-sm font-bold text-accent hover:underline">Deschide calendarul →</button>
    </section>
  )
}

// „Situația mea": cererile de concediu proprii (doar pentru cine are acces la Resurse Umane)
function SituatiaMea({ angajat }) {
  const [cereri, setCereri] = useState(null)
  useEffect(() => {
    let activ = true
    supabase
      .from('leave_requests')
      .select('id, status, start_date, end_date')
      .eq('angajat_id', angajat.id)
      .order('start_date', { ascending: true })
      .then(({ data }) => { if (activ) setCereri(data || []) })
    return () => { activ = false }
  }, [angajat.id])

  const fmt = (d) => new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })
  const asteapta = (cereri || []).filter((c) => c.status === 'submitted' || c.status === 'pending')
  const urmatorul = (cereri || []).find((c) => c.status === 'approved' && c.end_date >= azi())

  return (
    <section aria-label="Situația mea" className={carcasa}>
      <h2 className="text-[19px] font-extrabold">Situația mea</h2>
      <p className="text-[13px] text-[#5B6578]">Concediile tale</p>
      {cereri === null ? (
        <p className="mt-3 text-sm text-[#5B6578]">Se încarcă…</p>
      ) : (
        <div className="mt-3 text-sm">
          <div className="flex items-center justify-between border-t border-[#EEF0F4] py-2.5">
            <span>Cereri în așteptare</span>
            <b>{asteapta.length}</b>
          </div>
          <div className="flex items-center justify-between border-t border-[#EEF0F4] py-2.5">
            <span>Următorul concediu aprobat</span>
            <b>{urmatorul ? `${fmt(urmatorul.start_date)} – ${fmt(urmatorul.end_date)}` : 'Niciunul'}</b>
          </div>
        </div>
      )}
      <a href="/HR/" className="mt-3 inline-flex min-h-[44px] items-center rounded-[10px] bg-accent px-4 text-sm font-bold text-white no-underline hover:bg-accent-hover">Cere concediu / vezi soldul</a>
    </section>
  )
}

// Homepage pentru angajații fără acces la Taskuri
export default function FaraTaskuri({ angajat, evenimente, toateEvenimentele, tooluri, onOpenCalendar, onNavigate }) {
  const aresHR = tooluri.some((t) => t.key === 'hr')
  const cartele = tooluri.filter((t) => t.key !== 'calendar')
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <UrmatoareleEvenimente evenimente={evenimente} onOpenCalendar={onOpenCalendar} />
        <MiniCalendar evenimente={toateEvenimentele} onOpenCalendar={onOpenCalendar} />
      </div>
      {aresHR && <SituatiaMea angajat={angajat} />}
      {cartele.length > 0 && (
        <section aria-label="Tool-urile mele" className={carcasa}>
          <h2 className="text-[19px] font-extrabold">Tool-urile mele</h2>
          <p className="text-[13px] text-[#5B6578]">Doar cele la care ai acces</p>
          <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cartele.map((t) => {
              const continut = (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E4ECF8] text-[#22406B]"><Icon name={t.icon} size={20} /></span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-bold text-[#172036]">{t.label}</span>
                    <span className="block text-[13px] text-[#5B6578]">{DESCRIERI[t.key] || ''}</span>
                  </span>
                </>
              )
              const cls = 'flex min-h-[64px] items-start gap-3 rounded-xl border border-[#E1E4EA] bg-white p-3 no-underline hover:bg-[#FAFBFD]'
              return t.view ? (
                <button key={t.key} type="button" onClick={() => onNavigate(t.view)} className={cls}>{continut}</button>
              ) : (
                <a key={t.key} href={t.href} className={cls}>{continut}</a>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
