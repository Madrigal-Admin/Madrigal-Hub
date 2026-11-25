import { useMemo, useState } from 'react'
import { esteIntarziat, estePrelucrat } from '../../lib/taskuri/ui'
import { BareStivuite, CULORI_STATUS, Casete, Placinta, TaskuriPeLuni } from './Grafice'
import { felii } from './DashboardTaskuri'

const LEGENDA = [
  { nume: 'De făcut', culoare: CULORI_STATUS.de_facut },
  { nume: 'În lucru', culoare: CULORI_STATUS.in_lucru },
  { nume: 'Întârziat', culoare: CULORI_STATUS.intarziat },
]
// Un task întârziat apare o singură dată, în segmentul roșu (nu și la „De făcut" / „În lucru")
const segmente = (lista) => [
  { cheie: 'De făcut', valoare: lista.filter((t) => t.status === 'de_facut' && !esteIntarziat(t)).length, culoare: CULORI_STATUS.de_facut },
  { cheie: 'În lucru', valoare: lista.filter((t) => t.status === 'in_lucru' && !esteIntarziat(t)).length, culoare: CULORI_STATUS.in_lucru },
  { cheie: 'Întârziat', valoare: lista.filter(esteIntarziat).length, culoare: CULORI_STATUS.intarziat },
]

// Dashboardul coordonatorului: cine are ce de făcut, pe ce subiecte (taguri) și în ce stare.
export default function DashboardEchipa({ taskuri, membri, afara = {}, ctx }) {
  const [arataRestul, setArataRestul] = useState(true)
  const existaAfara = Object.values(afara).some((n) => n > 0)
  const deschise = useMemo(() => taskuri.filter(estePrelucrat), [taskuri])

  const peOameni = useMemo(() => {
    const ids = new Set(membri)
    deschise.forEach((t) => t.responsabil_id && ids.add(t.responsabil_id))
    const randuri = [...ids].map((id) => {
      const lista = deschise.filter((t) => t.responsabil_id === id)
      return { nume: ctx.nume(id), segmente: segmente(lista), eticheta: '', total: lista.length, afara: arataRestul ? afara[id] || 0 : 0 }
    })
    const fara = deschise.filter((t) => !t.responsabil_id)
    if (fara.length) randuri.push({ nume: 'Fără responsabil', segmente: segmente(fara), eticheta: '', total: fara.length })
    return randuri.sort((a, b) => b.total - a.total || a.nume.localeCompare(b.nume, 'ro'))
  }, [deschise, membri, ctx, afara, arataRestul])

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

  const persoane = useMemo(() => {
    const ids = new Set(membri)
    taskuri.forEach((t) => t.responsabil_id && ids.add(t.responsabil_id))
    return [...ids].map((id) => ({ id, nume: ctx.nume(id) })).sort((a, b) => a.nume.localeCompare(b.nume, 'ro'))
  }, [taskuri, membri, ctx])

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
      {existaAfara && (
        <button type="button" role="switch" aria-checked={arataRestul} onClick={() => setArataRestul((v) => !v)} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-[#5B6578]">
          <span className={`relative inline-block h-[18px] w-[30px] rounded-full transition-colors ${arataRestul ? 'bg-accent' : 'bg-[#CBD3E0]'}`}>
            <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all ${arataRestul ? 'left-[14px]' : 'left-[2px]'}`} />
          </span>
          Arată și restul taskurilor membrilor (bara hașurată = în afara departamentului)
        </button>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <BareStivuite titlu="Încărcare pe persoană (taskuri deschise)" randuri={peOameni} legenda={LEGENDA} gol="Nu sunt oameni sau taskuri în selecție." />
        <BareStivuite titlu="Încărcare pe subiect (tag)" randuri={peTaguri} legenda={LEGENDA} gol="Nu sunt taskuri deschise." />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Placinta titlu="Taskuri pe status" felii={status} gol="Niciun task în selecție." />
        <TaskuriPeLuni taskuri={taskuri} persoane={persoane} />
      </div>
    </div>
  )
}
