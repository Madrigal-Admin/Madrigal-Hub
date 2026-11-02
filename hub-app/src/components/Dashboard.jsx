import { useMemo, useState } from 'react'
import { Plus, Settings } from 'lucide-react'
import { supabase } from '../supabaseClient'
import TaskuriMele from './home/TaskuriMele'
import { EvenimenteleMele, EchipaMea, UrmatoareleEvenimente } from './home/CarduriDreapta'
import { azi, dataAzi, esteDeschis, grupa, prenume } from './home/date'
import { useTaskuri } from './taskuri/TaskuriContext'

// Homepage orientat pe taskuri. Task nou / detaliu task / checklist se deschid ca ferestre deasupra paginii.
export default function Dashboard({ angajat, onNavigate, onOpenCalendar }) {
  const { ctx, acte, eroare: eroareIncarcare, areTaskuri } = useTaskuri()
  const [filtru, setFiltru] = useState('Toate')
  const [suprascrieri, setSuprascrieri] = useState({}) // id -> status afișat imediat, până se confirmă
  const [eroare, setEroare] = useState('')

  const sapteZile = Date.now() - 7 * 24 * 3600 * 1000
  const taskuri = useMemo(() => {
    if (!ctx) return []
    return ctx.taskuri
      .filter((t) => t.responsabil_id === angajat.id || (ctx.colabDupaTask[t.id] || []).includes(angajat.id))
      .filter((t) => esteDeschis(t) || (t.status === 'terminat' && t.terminat_la && new Date(t.terminat_la).getTime() >= sapteZile))
      .map((t) => (suprascrieri[t.id] ? { ...t, status: suprascrieri[t.id] } : t))
  }, [ctx, angajat.id, suprascrieri]) // eslint-disable-line react-hooks/exhaustive-deps

  // Status ales din meniul rândului. Se vede imediat; dacă baza de date refuză, revine.
  async function seteazaStatus(t, nou) {
    setEroare('')
    setSuprascrieri((s) => ({ ...s, [t.id]: nou }))
    const { error } = await supabase.rpc('tsk_schimba_status', { p_task: t.id, p_status: nou })
    if (error) setEroare(error.code === 'P0001' ? error.message : 'Nu am putut schimba statusul.')
    await ctx.reload()
    setSuprascrieri((s) => {
      const n = { ...s }
      delete n[t.id]
      return n
    })
  }

  const evenimente = ctx?.evenimente || []
  const evMap = ctx?.evMap || {}
  const evenimenteleMele = (ctx?.evenimenteMele || []).filter((e) => ['deschis', 'organizare'].includes(ctx.comportament(e.id)))
  const progres = useMemo(() => {
    const p = {}
    for (const t of ctx?.taskuri || []) {
      if (!t.eveniment_id || t.status === 'anulat') continue
      const x = (p[t.eveniment_id] ||= { total: 0, gata: 0 })
      x.total++
      if (t.status === 'terminat') x.gata++
    }
    return p
  }, [ctx])

  const departamente = useMemo(() => {
    if (!ctx) return []
    const numara = {}
    for (const t of ctx.taskuri) if (esteDeschis(t) && t.responsabil_id) numara[t.responsabil_id] = (numara[t.responsabil_id] || 0) + 1
    return ctx.grupuri
      .filter((g) => g.activ && ctx.grupuriCoordonate.has(g.id))
      .map((g) => ({
        id: g.id,
        nume: g.nume,
        membri: ctx.membri
          .filter((m) => m.grup_id === g.id)
          .map((m) => ({ id: m.angajat_id, nume: ctx.nume(m.angajat_id), nr: numara[m.angajat_id] || 0 }))
          .sort((a, b) => b.nr - a.nr),
      }))
  }, [ctx])

  const urmatoare = evenimente.filter((e) => ctx.comportament(e.id) !== 'anulat' && (e.data_sfarsit || e.data) >= azi()).slice(0, 4)

  const poateCrea = !!ctx && (ctx.poateEveniment || ctx.poateOperational)
  const esteAdminTaskuri = !!ctx?.admin

  const deschise = taskuri.filter(esteDeschis)
  const nrIntarziate = deschise.filter((t) => grupa(t) === 'Întârziate').length
  const nrAzi = deschise.filter((t) => grupa(t) === 'Azi').length
  const nr7 = deschise.filter((t) => grupa(t) === 'Următoarele 7 zile').length
  const nrTerminate = taskuri.filter((t) => t.status === 'terminat').length

  const rezumat = areTaskuri
    ? `${nrIntarziate ? `${nrIntarziate} ${nrIntarziate === 1 ? 'task întârziat' : 'taskuri întârziate'}` : 'niciun task întârziat'} · ${nrAzi ? `${nrAzi} ${nrAzi === 1 ? 'scadent azi' : 'scadente azi'}` : 'nimic scadent azi'}`
    : 'Tool-urile tale sunt în rândul de mai sus'

  const casete = [
    ['Întârziate', nrIntarziate, 'au nevoie de atenție', nrIntarziate ? 'text-[#B4332E]' : '', ''],
    ['Scadente azi', nrAzi, 'de făcut sau în lucru', '', ''],
    ['Următoarele 7 zile', nr7, 'încă deschise', '', ''],
    ['Terminate', nrTerminate, 'în ultimele 7 zile', 'text-[#1E6B43]', 'hidden sm:block'],
  ]

  const butonTaskNou = (clase) => (
    <button type="button" onClick={() => acte.taskNou()} className={clase}>
      <Plus size={18} strokeWidth={2.5} aria-hidden="true" /> Task nou
    </button>
  )

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-8 sm:pb-14 sm:pt-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[30px]">Bună, {prenume(angajat.nume_complet)}</h1>
          <p className="mt-1.5 text-sm text-[#5B6578] sm:text-[15px]">{dataAzi()} · {rezumat}</p>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          {esteAdminTaskuri && (
            <button type="button" onClick={() => onNavigate('setari')} className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-[#FDE8D2] px-[18px] text-[15px] font-bold text-[#8A4B12] hover:bg-[#FBDDBF]">
              <Settings size={18} aria-hidden="true" /> Setări
            </button>
          )}
          {poateCrea && butonTaskNou('inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-accent px-[18px] text-[15px] font-bold text-white hover:bg-accent-hover')}
        </div>
      </div>

      {(eroare || eroareIncarcare) && <p className="text-sm text-rose-600">{eroare || eroareIncarcare}</p>}

      {!areTaskuri ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="rounded-[14px] border border-[#E1E4EA] bg-white p-6 text-sm text-[#5B6578]">
            Nu ai încă acces la Taskuri. Dacă ai nevoie, cere unui administrator să-ți dea acces din Hub, la „Acces Tool-uri”. Tool-urile la care ai acces sunt în rândul de sus.
          </div>
          {ctx && <UrmatoareleEvenimente evenimente={urmatoare} onOpenCalendar={onOpenCalendar} />}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            {casete.map(([eticheta, n, cap, culoare, ascunde]) => (
              <div key={eticheta} className={`min-w-[96px] flex-1 rounded-[14px] border border-[#E1E4EA] bg-white px-3.5 py-3 sm:min-w-[200px] sm:px-5 sm:py-[18px] ${ascunde}`}>
                <div className="text-xs font-semibold text-[#5B6578] sm:text-[13px]">{eticheta}</div>
                <div className={`my-1 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[34px] ${culoare}`}>{ctx ? n : '–'}</div>
                <div className="hidden text-[13px] text-[#5B6578] sm:block">{cap}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[999_1_560px]">
              {ctx ? (
                <TaskuriMele
                  taskuri={taskuri}
                  filtru={filtru}
                  setFiltru={setFiltru}
                  ctx={{
                    me: angajat,
                    nume: Object.fromEntries(ctx.angajati.map((a) => [a.id, a.nume_complet])),
                    evenimente: evMap,
                    onStatus: seteazaStatus,
                    onDeschide: (t) => acte.deschideTask(t.id),
                    poateStatus: (t) => ctx.poateSchimbaStatus(t) && !ctx.evenimentAnulat(t.eveniment_id),
                    poateAnula: (t) => ctx.poateGestiona(t),
                  }}
                />
              ) : (
                <p className="text-sm text-[#5B6578]">Se încarcă taskurile…</p>
              )}
            </div>
            <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-6">
              <EvenimenteleMele evenimente={evenimenteleMele} progres={progres} statusuri={ctx?.statusuri || []} onStart={(e) => acte.checklist('start', e)} onToate={() => onNavigate('evenimente')} />
              <EchipaMea departamente={departamente} onToate={() => onNavigate('departament')} />
              {ctx && <UrmatoareleEvenimente evenimente={urmatoare} onOpenCalendar={onOpenCalendar} />}
            </aside>
          </div>
        </>
      )}

      {poateCrea &&
        butonTaskNou('fixed bottom-[84px] right-4 z-20 inline-flex min-h-[52px] items-center gap-2 rounded-[26px] bg-accent px-5 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(23,32,54,0.3)] sm:hidden')}
    </main>
  )
}
