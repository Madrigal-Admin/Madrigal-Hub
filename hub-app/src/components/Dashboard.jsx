import { useCallback, useEffect, useMemo, useState } from 'react'
import { LogOut, Plus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import GhidRouter from './ghid/GhidRouter'
import { BaraJos, RandTooluri, construiesteTooluri } from './home/NavigareTooluri'
import TaskuriMele from './home/TaskuriMele'
import { EvenimenteleMele, TicheteDepartament, UrmatoareleEvenimente } from './home/CarduriDreapta'
import { azi, dataAzi, esteDeschis, grupa, incarcaHome, prenume } from './home/date'

const URMATORUL = { de_facut: 'in_lucru', in_lucru: 'terminat', terminat: 'de_facut' }

// Homepage-ul Hub-ului, orientat pe taskuri. Tool-urile rămân la un click, în rândul „Tool-uri".
export default function Dashboard({ angajat, accesTooluri, isHubAdmin, onOpenAdmin, onOpenCalendar, canSeeStatistici, onOpenStatistici, onSignOut }) {
  const accesSet = useMemo(() => new Set(accesTooluri.map((a) => a.tool)), [accesTooluri])
  const rolTaskuri = accesTooluri.find((a) => a.tool === 'taskuri')?.rol || null
  const areTaskuri = !!rolTaskuri

  const [date, setDate] = useState(null)
  const [taskuri, setTaskuri] = useState([])
  const [filtru, setFiltru] = useState('Toate')
  const [eroare, setEroare] = useState('')

  const incarca = useCallback(async () => {
    const r = await incarcaHome(angajat, areTaskuri)
    setDate(r)
    setTaskuri(r.taskuri)
    setEroare(r.eroare)
  }, [angajat, areTaskuri])
  useEffect(() => { incarca() }, [incarca])

  // Schimbă statusul la click (De făcut → În lucru → Terminat). Se vede imediat; dacă baza de date refuză, revine.
  async function cicleaza(t) {
    const nou = URMATORUL[t.status]
    const vechi = taskuri
    setEroare('')
    setTaskuri((lista) => lista.map((x) => (x.id === t.id ? { ...x, status: nou, terminat_la: nou === 'terminat' ? new Date().toISOString() : null } : x)))
    const { error } = await supabase.rpc('tsk_schimba_status', { p_task: t.id, p_status: nou })
    if (error) {
      setTaskuri(vechi)
      setEroare(error.code === 'P0001' ? error.message : 'Nu am putut schimba statusul.')
    }
  }

  const tooluri = construiesteTooluri({ accesSet, canSeeStatistici, isHubAdmin, onOpenCalendar, onOpenStatistici, onOpenAdmin })

  const evenimente = date?.evenimente || []
  const statusuri = date?.statusuri || []
  const eviMap = Object.fromEntries(evenimente.map((e) => [e.id, e]))
  const evenimenteleMele = evenimente.filter((e) => e.pm.includes(angajat.id) && ['deschis', 'organizare'].includes(e.comportament))
  const urmatoare = evenimente
    .filter((e) => e.comportament !== 'anulat' && (e.data_sfarsit || e.data) >= azi())
    .slice(0, 4)

  // Cine are voie să creeze taskuri: admin taskuri, PM la un eveniment activ sau coordonator de departament.
  const poateCrea =
    areTaskuri && (rolTaskuri === 'admin' || evenimente.some((e) => e.pm.includes(angajat.id) && e.comportament !== 'anulat') || (date?.departamente.length || 0) > 0)

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
    <a href="/taskuri/?nou=1" className={clase}>
      <Plus size={18} strokeWidth={2.5} aria-hidden="true" /> Task nou
    </a>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FB] text-[#172036]">
      <SiteHeader
        title="Hub Madrigal"
        right={
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[220px] truncate rounded-full bg-[#EEF1F6] px-3.5 py-2 text-[13px] font-semibold text-[#3A465C] sm:inline-block">{angajat.nume_complet}</span>
            <button onClick={onSignOut} aria-label="Deconectare" title="Deconectare" className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[#3A465C] hover:bg-slate-100 focus-ring">
              <LogOut size={20} />
            </button>
          </div>
        }
      />
      <RandTooluri tooluri={tooluri} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 pb-28 pt-6 sm:px-8 sm:pb-14 sm:pt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-[30px]">Bună, {prenume(angajat.nume_complet)}</h1>
            <p className="mt-1.5 text-sm text-[#5B6578] sm:text-[15px]">{dataAzi()} · {rezumat}</p>
          </div>
          {poateCrea && butonTaskNou('hidden min-h-[44px] items-center gap-2 rounded-[10px] bg-accent px-[18px] text-[15px] font-bold text-white no-underline hover:bg-accent-hover sm:inline-flex')}
        </div>

        {eroare && <p className="text-sm text-rose-600">{eroare}</p>}

        {!areTaskuri ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="rounded-[14px] border border-[#E1E4EA] bg-white p-6 text-sm text-[#5B6578]">
              Nu ai încă acces la Taskuri. Dacă ai nevoie, cere unui administrator să-ți dea acces din Hub, la „Acces Tool-uri”. Tool-urile la care ai acces sunt în rândul de sus.
            </div>
            <UrmatoareleEvenimente evenimente={urmatoare} onOpenCalendar={onOpenCalendar} />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              {casete.map(([eticheta, n, cap, culoare, ascunde]) => (
                <div key={eticheta} className={`min-w-[96px] flex-1 rounded-[14px] border border-[#E1E4EA] bg-white px-3.5 py-3 sm:min-w-[200px] sm:px-5 sm:py-[18px] ${ascunde}`}>
                  <div className="text-xs font-semibold text-[#5B6578] sm:text-[13px]">{eticheta}</div>
                  <div className={`my-1 text-[26px] font-extrabold leading-tight tracking-tight sm:text-[34px] ${culoare}`}>{date ? n : '–'}</div>
                  <div className="hidden text-[13px] text-[#5B6578] sm:block">{cap}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-start gap-6">
              <div className="min-w-0 flex-[999_1_560px]">
                {date ? (
                  <TaskuriMele taskuri={taskuri} filtru={filtru} setFiltru={setFiltru} ctx={{ me: angajat, nume: date.nume, evenimente: eviMap, onCicleaza: cicleaza }} />
                ) : (
                  <p className="text-sm text-[#5B6578]">Se încarcă taskurile…</p>
                )}
              </div>
              <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-6">
                <EvenimenteleMele evenimente={evenimenteleMele} progres={date?.progres || {}} statusuri={statusuri} />
                <TicheteDepartament departamente={date?.departamente || []} />
                <UrmatoareleEvenimente evenimente={urmatoare} onOpenCalendar={onOpenCalendar} />
              </aside>
            </div>
          </>
        )}
      </main>

      {poateCrea &&
        butonTaskNou('fixed bottom-[84px] right-4 z-20 inline-flex min-h-[52px] items-center gap-2 rounded-[26px] bg-accent px-5 text-[15px] font-bold text-white no-underline shadow-[0_4px_14px_rgba(23,32,54,0.3)] sm:hidden')}

      <div className="hidden sm:block"><SiteFooter /></div>
      <BaraJos tooluri={tooluri} areTaskuri={areTaskuri} onOpenCalendar={onOpenCalendar} />
      <GhidRouter />
    </div>
  )
}
