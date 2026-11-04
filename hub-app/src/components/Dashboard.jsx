import { useMemo, useState } from 'react'
import { Eye, Plus, Settings } from 'lucide-react'
import TaskuriMele from './home/TaskuriMele'
import { EvenimenteleMele, EchipaMea, UrmatoareleEvenimente } from './home/CarduriDreapta'
import { azi, dataAzi, esteDeschis, grupa, plusZile, prenume } from './home/date'
import FaraTaskuri from './home/FaraTaskuri'
import { useTaskuri } from './taskuri/TaskuriContext'
import PrivireGenerala from './taskuri/PrivireGenerala'
import { riscEveniment } from '../lib/taskuri/risc'
import { raportLipsa, useRaportate } from '../lib/taskuri/raportLipsa'

// Homepage orientat pe taskuri. Task nou / detaliu task / checklist se deschid ca ferestre deasupra paginii.
export default function Dashboard({ angajat, tooluri = [], onNavigate, onOpenCalendar }) {
  const { ctx, acte, eroare: eroareIncarcare, areTaskuri, areRapoarte } = useTaskuri()
  const raportate = useRaportate(areRapoarte)
  const [filtru, setFiltru] = useState('Toate')
  const [privire, setPrivire] = useState(false)

  const sapteZile = Date.now() - 7 * 24 * 3600 * 1000
  const taskuri = useMemo(() => {
    if (!ctx) return []
    return ctx.taskuri
      .filter((t) => t.responsabil_id === angajat.id || (ctx.colabDupaTask[t.id] || []).includes(angajat.id))
      .filter((t) => esteDeschis(t) || (t.status === 'terminat' && t.terminat_la && new Date(t.terminat_la).getTime() >= sapteZile))
  }, [ctx, angajat.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const evenimente = ctx?.evenimente || []
  const evenimenteleMele = (ctx?.evenimenteMele || [])
    .map((e) => ({ ...e, comportament: ctx.comportament(e.id) }))
    .filter((e) => ['deschis', 'organizare'].includes(e.comportament))
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
  const faraRaport = (ctx?.evenimenteMele || []).filter((e) => raportLipsa(e, ctx, raportate)).sort((a, b) => (b.data || '').localeCompare(a.data || ''))
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

  const urmatoareToate = ctx
    ? evenimente.filter((e) => ctx.comportament(e.id) !== 'anulat' && (e.data_sfarsit || e.data) >= azi()).sort((x, y) => (x.data || '').localeCompare(y.data || ''))
    : []
  const urmatoare = urmatoareToate.slice(0, 4)

  // fără acces la Taskuri nu se arată butonul de creare, chiar dacă ești PM la un eveniment
  const poateCrea = areTaskuri && !!ctx && (ctx.poateEveniment || ctx.poateOperational)
  const esteAdminTaskuri = !!ctx?.admin

  const deschise = taskuri.filter(esteDeschis)
  const nrIntarziate = deschise.filter((t) => grupa(t) === 'Întârziate').length
  const nrAzi = deschise.filter((t) => grupa(t) === 'Azi').length
  const nr7 = deschise.filter((t) => grupa(t) === 'Următoarele 7 zile').length
  const nrTerminate = taskuri.filter((t) => t.status === 'terminat').length

  const rezumat = areTaskuri
    ? `${nrIntarziate ? `${nrIntarziate} ${nrIntarziate === 1 ? 'task întârziat' : 'taskuri întârziate'}` : 'niciun task întârziat'} · ${nrAzi ? `${nrAzi} ${nrAzi === 1 ? 'scadent azi' : 'scadente azi'}` : 'nimic scadent azi'}`
    : urmatoareToate.length
      ? (() => {
          const n = urmatoareToate.filter((e) => e.data <= plusZile(7)).length
          return n === 0 ? 'Niciun eveniment în următoarele 7 zile' : `${n} ${n === 1 ? 'eveniment' : 'evenimente'} în următoarele 7 zile`
        })()
      : 'Niciun eveniment programat în curând'

  // Cardurile sunt și filtre: click = filtrează lista de mai jos, click din nou = înapoi la „Toate"
  const casete = [
    ['Întârziate', nrIntarziate, 'au nevoie de atenție', nrIntarziate ? 'text-[#B4332E]' : '', ''],
    ['Azi', nrAzi, 'de făcut sau în lucru', '', ''],
    ['Următoarele 7 zile', nr7, 'încă deschise', '', ''],
    ['Terminate', nrTerminate, 'în ultimele 7 zile', 'text-[#1E6B43]', 'hidden sm:block'],
  ]
  const comutaFiltru = (f) => setFiltru((cur) => (cur === f ? 'Toate' : f))

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
          {esteAdminTaskuri && (
            <button type="button" onClick={() => setPrivire(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-[#DCEBFA] px-[18px] text-[15px] font-bold text-[#1F4E8C] hover:bg-[#CCE0F5]">
              <Eye size={18} aria-hidden="true" /> Privire Generală
            </button>
          )}
          {poateCrea && butonTaskNou('inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-accent px-[18px] text-[15px] font-bold text-white hover:bg-accent-hover')}
        </div>
      </div>

      {eroareIncarcare && <p className="text-sm text-rose-600">{eroareIncarcare}</p>}

      {!areTaskuri ? (
        ctx ? (
          <FaraTaskuri
            angajat={angajat}
            evenimente={urmatoareToate.slice(0, 5)}
            toateEvenimentele={evenimente.filter((e) => ctx.comportament(e.id) !== 'anulat')}
            tooluri={tooluri}
            onOpenCalendar={onOpenCalendar}
            onNavigate={onNavigate}
          />
        ) : (
          <p className="text-sm text-[#5B6578]">Se încarcă…</p>
        )
      ) : (
        <>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            {casete.map(([filtruCaseta, n, cap, culoare, ascunde]) => {
              const activ = filtru === filtruCaseta
              return (
                <button
                  key={filtruCaseta}
                  type="button"
                  aria-pressed={activ}
                  onClick={() => comutaFiltru(filtruCaseta)}
                  className={`min-w-[96px] flex-1 rounded-[14px] border bg-white px-3.5 py-3 text-left transition-colors hover:border-accent sm:min-w-[200px] sm:px-5 sm:py-[18px] ${activ ? 'border-accent ring-2 ring-accent/30' : 'border-[#E1E4EA]'} ${ascunde}`}
                >
                  <div className="text-xs font-semibold text-[#5B6578] sm:text-[13px]">{filtruCaseta === 'Azi' ? 'Scadente azi' : filtruCaseta}</div>
                  <div className={`my-1 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[34px] ${culoare}`}>{ctx ? n : '–'}</div>
                  <div className="hidden text-[13px] text-[#5B6578] sm:block">{cap}</div>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[999_1_560px]">
              {ctx ? (
                <TaskuriMele taskuri={taskuri} filtru={filtru} setFiltru={setFiltru} ctx={ctx} onOpen={(t) => acte.deschideTask(t.id)} />
              ) : (
                <p className="text-sm text-[#5B6578]">Se încarcă taskurile…</p>
              )}
            </div>
            <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-6">
              <EvenimenteleMele risc={Object.fromEntries(evenimenteleMele.map((e) => [e.id, ctx ? riscEveniment(e, ctx.taskuri).nivel : null]))} raportLipsa={faraRaport} evenimente={evenimenteleMele} progres={progres} statusuri={ctx?.statusuri || []} onStart={(e) => acte.checklist('start', e)} onToate={() => onNavigate('evenimente')} />
              <EchipaMea departamente={departamente} onToate={() => onNavigate('departament')} />
              {ctx && <UrmatoareleEvenimente evenimente={urmatoare} onOpenCalendar={onOpenCalendar} />}
            </aside>
          </div>
        </>
      )}

      {privire && ctx && <PrivireGenerala ctx={ctx} onClose={() => setPrivire(false)} />}

      {poateCrea &&
        butonTaskNou('fixed bottom-[84px] right-4 z-20 inline-flex min-h-[52px] items-center gap-2 rounded-[26px] bg-accent px-5 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(23,32,54,0.3)] sm:hidden')}
    </main>
  )
}
