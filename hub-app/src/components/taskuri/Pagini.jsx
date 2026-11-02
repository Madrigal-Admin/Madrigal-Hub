import { useState } from 'react'
import { useTaskuri } from './TaskuriContext'
import Evenimente from './Evenimente'
import TaskLista from './TaskLista'
import GrupuriAdmin from './GrupuriAdmin'
import ChecklistAdmin from './ChecklistAdmin'
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
  if (!ctx) return <Incarca />
  return (
    <Cadru titlu={ctx.admin ? 'Evenimente' : 'Evenimentele mele'} descriere="Progresul fiecărui eveniment, checklistul și taskurile lui.">
      <Evenimente ctx={ctx} onOpen={(t) => acte.deschideTask(t.id)} onTaskNou={(evId) => acte.taskNou(evId)} onChecklist={(mod, e) => acte.checklist(mod, e)} />
    </Cadru>
  )
}

export function PaginaDepartament() {
  const { ctx, acte } = useTaskuri()
  if (!ctx) return <Incarca />
  const taskuri = ctx.admin ? ctx.taskuri.filter((t) => t.tip === 'operational') : ctx.taskuriDepartament
  return (
    <Cadru
      titlu="Tichete departament"
      descriere="Taskurile departamentelor pe care le coordonezi."
      actiune={
        ctx.poateOperational && (
          <button type="button" onClick={() => acte.taskNou()} className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-accent px-[18px] text-[15px] font-bold text-white hover:bg-accent-hover">
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" /> Task nou
          </button>
        )
      }
    >
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
