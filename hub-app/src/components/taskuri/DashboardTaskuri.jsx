import { useMemo } from 'react'
import { esteIntarziat, estePrelucrat } from '../../lib/taskuri/ui'
import { ListaRisc, ListaDeAlocat } from './RiscEvenimente'
import { CULORI_SERIE, CULORI_STATUS, CULOARE_FARA, Casete, Placinta, ProgresPeTag } from './Grafice'

const NUME_STATUS = { de_facut: 'De făcut', in_lucru: 'În lucru', terminat: 'Terminat' }

// Felii „pe responsabil" și „pe status" pentru o listă de taskuri (taskurile anulate nu se numără).
export function felii(taskuri, ctx) {
  const active = taskuri.filter((t) => t.status !== 'anulat')
  const pePers = new Map()
  for (const t of active) pePers.set(t.responsabil_id || '', (pePers.get(t.responsabil_id || '') || 0) + 1)
  const responsabil = [...pePers.entries()]
    .map(([id, valoare]) => ({ nume: id ? ctx.nume(id) : 'Fără responsabil', valoare, fara: !id }))
    .sort((a, b) => (a.fara - b.fara) || b.valoare - a.valoare)
    .map((f, i) => ({ ...f, culoare: f.fara ? CULOARE_FARA : CULORI_SERIE[i % CULORI_SERIE.length] }))
  const status = Object.keys(NUME_STATUS).map((cod) => ({ nume: NUME_STATUS[cod], valoare: active.filter((t) => t.status === cod).length, culoare: CULORI_STATUS[cod] }))
  return { active, responsabil, status }
}

export function progresPeTag(taskuri) {
  const m = new Map()
  for (const t of taskuri) {
    if (t.status === 'anulat') continue
    const k = t.tag || 'Fără tag'
    const x = m.get(k) || { nume: k, gata: 0, total: 0 }
    x.total++
    if (t.status === 'terminat') x.gata++
    m.set(k, x)
  }
  return [...m.values()].sort((a, b) => (a.nume === 'Fără tag') - (b.nume === 'Fără tag') || b.total - a.total || a.nume.localeCompare(b.nume, 'ro'))
}

// Dashboardul „Evenimentele mele": 2 grafice (responsabil, status) + progres pe tag.
export default function DashboardEvenimente({ taskuri, ctx, evenimente = [], onOpen }) {
  const { active, responsabil, status } = useMemo(() => felii(taskuri, ctx), [taskuri, ctx])
  const taguri = useMemo(() => progresPeTag(taskuri), [taskuri])
  return (
    <div className="mb-6 space-y-4">
      <Casete
        elemente={[
          ['Taskuri', active.length],
          ['Terminate', active.filter((t) => t.status === 'terminat').length, 'text-[#1E6B43]'],
          ['În curs', active.filter(estePrelucrat).length],
          ['Întârziate', active.filter(esteIntarziat).length, active.some(esteIntarziat) ? 'text-[#B4332E]' : ''],
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ListaRisc evenimente={evenimente} taskuri={taskuri} />
        <ListaDeAlocat ctx={ctx} evenimente={evenimente} taskuri={taskuri} onOpen={onOpen} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Placinta titlu="Taskuri pe responsabil" felii={responsabil} gol="Niciun task pentru evenimentele alese." />
        <Placinta titlu="Taskuri pe status" felii={status} gol="Niciun task pentru evenimentele alese." />
      </div>
      <ProgresPeTag titlu="Progres pe tag" randuri={taguri} gol="Niciun task pentru evenimentele alese." />
    </div>
  )
}

