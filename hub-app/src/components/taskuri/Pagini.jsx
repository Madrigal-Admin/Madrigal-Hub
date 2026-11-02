import { useState } from 'react'
import { useTaskuri } from './TaskuriContext'
import Evenimente from './Evenimente'
import TaskLista from './TaskLista'
import GrupuriAdmin from './GrupuriAdmin'
import ChecklistAdmin from './ChecklistAdmin'
import DashboardEchipa from './DashboardEchipa'
import DashboardEvenimente from './DashboardTaskuri'
import SelectorEvenimente from './SelectorEvenimente'
import { Gol } from './Mici'
import { Plus } from 'lucide-react'

const Cadru = ({ titlu, descriere, actiune, children }) => (
  <main className="w-full flex-1 px-4 pb-10 pt-6 sm:px-8 sm:pt-7">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{titlu}</h1>
        {descriere && <p className="mt-1 text-sm text-[#5B6578]">{descriere}</p>}
      </div>
      {actiune}
    </div>
    {children}
  </main>
)

const Incarca = () => <p className="px-8 py-6 text-sm text-slate-500">Se încarcă…</p>

export function PaginaEvenimente() {
  const { ctx, acte } = useTaskuri()
  const [tab, setTab] = useState('dashboard')
  const [selectate, setSelectate] = useState(() => new Set()) // gol = toate
  if (!ctx) return <Incarca />

  // Doar evenimentele la care sunt PM (secțiune operativă), cele mai apropiate ca dată primele.
  const mele = [...ctx.evenimenteMele].sort((a, b) => (a.data || '').localeCompare(b.data || ''))
  const alese = mele.filter((e) => selectate.has(e.id))
  const filtrat = selectate.size > 0 && alese.length > 0
  const pentruLista = filtrat ? alese : mele
  const pentruDashboard = filtrat ? alese : mele.filter((e) => ['deschis', 'organizare'].includes(ctx.comportament(e.id)))
  const idsDashboard = new Set(pentruDashboard.map((e) => e.id))
  const taskuriDashboard = ctx.taskuri.filter((t) => idsDashboard.has(t.eveniment_id))

  const taburi = [['dashboard', 'Dashboard'], ['lista', `Evenimentele mele · ${pentruLista.length}`]]
  return (
    <Cadru titlu="Evenimentele mele" descriere="Evenimentele la care ești PM: progresul, checklistul și taskurile lor.">
      {mele.length === 0 ? (
        <Gol>Nu ești PM la niciun eveniment.</Gol>
      ) : (
        <>
          <div role="tablist" aria-label="Evenimentele mele" className="mb-5 flex gap-1 border-b border-[#E1E4EA]">
            {taburi.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px min-h-[44px] border-b-[3px] px-5 text-[15px] font-extrabold ${tab === k ? 'border-accent text-accent' : 'border-transparent text-[#5B6578] hover:text-[#172036]'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="mb-5">
            <SelectorEvenimente evenimente={mele} selectate={selectate} onChange={setSelectate} />
          </div>
          {tab === 'dashboard' ? (
            <DashboardEvenimente taskuri={taskuriDashboard} ctx={ctx} />
          ) : (
            <Evenimente ctx={ctx} evenimente={pentruLista} onOpen={(t) => acte.deschideTask(t.id)} onTaskNou={(evId) => acte.taskNou(evId)} onChecklist={(mod, e) => acte.checklist(mod, e)} />
          )}
        </>
      )}
    </Cadru>
  )
}

export function PaginaDepartament() {
  const { ctx, acte } = useTaskuri()
  const [grup, setGrup] = useState('') // '' = toate departamentele mele
  if (!ctx) return <Incarca />
  const grupuri = ctx.grupuri.filter((g) => g.activ && (ctx.admin || ctx.grupuriCoordonate.has(g.id)))
  const grupAles = grupuri.some((g) => g.id === grup) ? grup : ''
  const idsGrupuri = new Set(grupAles ? [grupAles] : grupuri.map((g) => g.id))
  const idsMembri = new Set(ctx.membri.filter((m) => idsGrupuri.has(m.grup_id)).map((m) => m.angajat_id))
  const baza = ctx.admin ? ctx.taskuri.filter((t) => t.tip === 'operational') : ctx.taskuriDepartament
  const taskuri = baza.filter((t) => (t.grup_id && idsGrupuri.has(t.grup_id)) || (t.responsabil_id && idsMembri.has(t.responsabil_id)))
  return (
    <Cadru
      titlu="Echipa mea"
      descriere="Încărcarea echipei și taskurile departamentelor pe care le coordonezi."
      actiune={
        ctx.poateOperational && (
          <button type="button" onClick={() => acte.taskNou()} className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-accent px-[18px] text-[15px] font-bold text-white hover:bg-accent-hover">
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" /> Task nou
          </button>
        )
      }
    >
      {grupuri.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Departament">
          {[['', 'Toate departamentele'], ...grupuri.map((g) => [g.id, g.nume])].map(([id, nume]) => (
            <button key={id || 'toate'} type="button" aria-pressed={grupAles === id} onClick={() => setGrup(id)} className={`min-h-[44px] rounded-full border px-3.5 text-sm font-semibold ${grupAles === id ? 'border-accent bg-accent text-white' : 'border-[#CBD3E0] bg-white text-accent'}`}>
              {nume}
            </button>
          ))}
        </div>
      )}
      <DashboardEchipa taskuri={taskuri} membri={[...idsMembri]} ctx={ctx} />
      <TaskLista taskuri={taskuri} ctx={ctx} onOpen={(t) => acte.deschideTask(t.id)} />
    </Cadru>
  )
}

// Setări Taskuri (doar admin taskuri): toate taskurile, departamente, checklist
export function PaginaSetari() {
  const { ctx, acte } = useTaskuri()
  const [tab, setTab] = useState('toate')
  if (!ctx) return <Incarca />
  if (!ctx.admin) return <Cadru titlu="Setări Taskuri"><p className="text-sm text-slate-500">Nu ai acces la această pagină.</p></Cadru>
  const taburi = [['toate', 'Toate taskurile'], ['grupuri', 'Departamente'], ['checklist', 'Checklist']]
  return (
    <Cadru titlu="Setări Taskuri" descriere="Departamente, checklistul de organizare și vedere de ansamblu asupra taskurilor.">
      <div className="mb-5 flex flex-wrap gap-1 self-start rounded-lg bg-slate-100 p-1 text-sm">
        {taburi.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 font-medium transition ${tab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'toate' && <TaskLista taskuri={ctx.taskuri} ctx={ctx} onOpen={(t) => acte.deschideTask(t.id)} />}
      {tab === 'grupuri' && <GrupuriAdmin ctx={ctx} />}
      {tab === 'checklist' && <ChecklistAdmin ctx={ctx} />}
    </Cadru>
  )
}
