import { useMemo } from 'react'
import { esteIntarziat, estePrelucrat } from '../../lib/taskuri/ui'
import { BareStivuite, CULORI_STATUS, Casete, Placinta } from './Grafice'
import { felii } from './DashboardTaskuri'

const LEGENDA = [
  { nume: 'De făcut', culoare: CULORI_STATUS.de_facut },
  { nume: 'În lucru', culoare: CULORI_STATUS.in_lucru },
]
const segmente = (lista) => [
  { cheie: 'De făcut', valoare: lista.filter((t) => t.status === 'de_facut').length, culoare: CULORI_STATUS.de_facut },
  { cheie: 'În lucru', valoare: lista.filter((t) => t.status === 'in_lucru').length, culoare: CULORI_STATUS.in_lucru },
]

// Dashboardul coordonatorului: cine are ce de făcut, pe ce subiecte (taguri) și în ce stare.
export default function DashboardEchipa({ taskuri, membri, ctx }) {
  const deschise = useMemo(() => taskuri.filter(estePrelucrat), [taskuri])

  const peOameni = useMemo(() => {
    const ids = new Set(membri)
    deschise.forEach((t) => t.responsabil_id && ids.add(t.responsabil_id))
    const randuri = [...ids].map((id) => {
      const lista = deschise.filter((t) => t.responsabil_id === id)
      const intarz = lista.filter(esteIntarziat).length
      return { nume: ctx.nume(id), segmente: segmente(lista), eticheta: intarz ? `${intarz} înt.` : '', total: lista.length }
    })
    const fara = deschise.filter((t) => !t.responsabil_id)
    if (fara.length) randuri.push({ nume: 'Fără responsabil', segmente: segmente(fara), eticheta: '', total: fara.length })
    return randuri.sort((a, b) => b.total - a.total || a.nume.localeCompare(b.nume, 'ro'))
  }, [deschise, membri, ctx])

  const peTaguri = useMemo(() => {
    const m = new Map()
    for (const t of deschise) {
      const k = t.tag || 'Fără tag'
      m.set(k, [...(m.get(k) || []), t])
    }
    return [...m.entries()]
      .map(([nume, lista]) => ({ nume, segmente: segmente(lista), eticheta: '', total: lista.length }))
      .sort((a, b) => (a.nume === 'Fără tag') - (b.nume === 'Fără tag') || b.total - a.total)
  }, [deschise])

  const { status } = useMemo(() => felii(taskuri, ctx), [taskuri, ctx])
  const terminate = taskuri.filter((t) => t.status === 'terminat').length

  return (
    <div className="mb-6 space-y-4">
      <Casete
        elemente={[
          ['Taskuri deschise', deschise.length],
          ['Întârziate', deschise.filter(esteIntarziat).length, deschise.some(esteIntarziat) ? 'text-[#B4332E]' : ''],
          ['Fără responsabil', deschise.filter((t) => !t.responsabil_id).length],
          ['Terminate', terminate, 'text-[#1E6B43]'],
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <BareStivuite titlu="Încărcare pe persoană (taskuri deschise)" randuri={peOameni} legenda={LEGENDA} gol="Nu sunt oameni sau taskuri în selecție." />
        <BareStivuite titlu="Încărcare pe subiect (tag)" randuri={peTaguri} legenda={LEGENDA} gol="Nu sunt taskuri deschise." />
      </div>
      <div className="lg:w-1/2 lg:pr-2"><Placinta titlu="Taskuri pe status" felii={status} gol="Niciun task în selecție." /></div>
    </div>
  )
}
