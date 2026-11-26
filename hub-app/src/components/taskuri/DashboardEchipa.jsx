import { useEffect, useMemo, useState } from 'react'
import { esteIntarziat, estePrelucrat } from '../../lib/taskuri/ui'
import { PERIOADE, interval, inInterval, dinIso } from '../../lib/taskuri/perioada'
import { BareStivuite, CULORI_STATUS, Placinta, TaskuriPeLuni } from './Grafice'
import { felii } from './DashboardTaskuri'
import TaskLista from './TaskLista'

const LEGENDA = [
  { nume: 'De făcut', culoare: CULORI_STATUS.de_facut },
  { nume: 'În lucru', culoare: CULORI_STATUS.in_lucru },
  { nume: 'Întârziat', culoare: CULORI_STATUS.intarziat },
]
// Un task întârziat apare o singură dată, în segmentul roșu (nu și la „De făcut" / „În lucru")
const segmente = (lista) => [
  { cheie: 'De făcut', cod: 'de_facut_curent', valoare: lista.filter((t) => t.status === 'de_facut' && !esteIntarziat(t)).length, culoare: CULORI_STATUS.de_facut },
  { cheie: 'În lucru', cod: 'in_lucru_curent', valoare: lista.filter((t) => t.status === 'in_lucru' && !esteIntarziat(t)).length, culoare: CULORI_STATUS.in_lucru },
  { cheie: 'Întârziat', cod: 'intarziate', valoare: lista.filter(esteIntarziat).length, culoare: CULORI_STATUS.intarziat },
]

// true când ecranul e destul de lat pentru cele 4 grafice pe un singur rând
function useEcranLat(px = 1280) {
  const [lat, setLat] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(`(min-width:${px}px)`).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(`(min-width:${px}px)`)
    const f = () => setLat(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [px])
  return lat
}

const fmt = (s) => dinIso(s).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })

// Cardurile de sus sunt și filtre pentru lista de dedesubt (click = filtrează, click din nou = scoate filtrul)
function Carduri({ elemente, activ, onClick }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {elemente.map(([cod, eticheta, n, culoare]) => (
        <button key={cod} type="button" aria-pressed={activ === cod} onClick={() => onClick(cod)} title="Filtrează lista de mai jos"
          className={`flex items-baseline justify-between gap-3 rounded-[14px] border bg-white px-4 py-2.5 text-left transition hover:border-[#9AA6B8] ${activ === cod ? 'border-accent ring-2 ring-accent/25' : 'border-[#E1E4EA]'}`}>
          <span className="text-xs font-semibold text-[#5B6578]">{eticheta}</span>
          <span className={`text-[26px] font-extrabold leading-none tracking-tight ${culoare || ''}`}>{n}</span>
        </button>
      ))}
    </div>
  )
}

// „Echipa mea": perioadă + carduri + grafice + lista de taskuri, toate legate între ele.
export default function DashboardEchipa({ taskuri: toate, membri, afara = {}, ctx, onOpen }) {
  const [arataRestul, setArataRestul] = useState(true)
  const [perioada, setPerioada] = useState('toate')
  const [status, setStatus] = useState('toate') // filtrul listei (setat și din carduri / grafice)
  const [resp, setResp] = useState('')
  const lat = useEcranLat()
  const existaAfara = Object.values(afara).some((n) => n > 0)

  const iv = useMemo(() => interval(perioada), [perioada])
  const taskuri = useMemo(() => toate.filter((t) => inInterval(t, iv)), [toate, iv])
  const fara = iv ? toate.filter((t) => !t.termen).length : 0
  const deschise = useMemo(() => taskuri.filter(estePrelucrat), [taskuri])

  const peOameni = useMemo(() => {
    const ids = new Set(membri)
    deschise.forEach((t) => t.responsabil_id && ids.add(t.responsabil_id))
    const randuri = [...ids].map((id) => {
      const lista = deschise.filter((t) => t.responsabil_id === id)
      return { id, nume: ctx.nume(id), segmente: segmente(lista), eticheta: '', total: lista.length, afara: arataRestul ? afara[id] || 0 : 0 }
    })
    const nimeni = deschise.filter((t) => !t.responsabil_id)
    if (nimeni.length) randuri.push({ id: '__nimeni', nume: 'Fără responsabil', segmente: segmente(nimeni), eticheta: '', total: nimeni.length })
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
    toate.forEach((t) => t.responsabil_id && ids.add(t.responsabil_id))
    return [...ids].map((id) => ({ id, nume: ctx.nume(id) })).sort((a, b) => a.nume.localeCompare(b.nume, 'ro'))
  }, [toate, membri, ctx])

  const { status: feliiStatus } = useMemo(() => felii(taskuri, ctx), [taskuri, ctx])
  const terminate = taskuri.filter((t) => t.status === 'terminat').length
  const nrIntarziate = deschise.filter(esteIntarziat).length
  const nrFaraResp = deschise.filter((t) => !t.responsabil_id).length

  // ce card e „aprins" acum, după filtrele listei
  const cardActiv = resp === '__nimeni' && status === 'deschise' ? 'fara' : resp ? null : { deschise: 'deschise', intarziate: 'intarziate', terminat: 'terminat' }[status] || null
  const clickCard = (cod) => {
    if (cardActiv === cod) { setStatus('toate'); setResp(''); return }
    if (cod === 'fara') { setStatus('deschise'); setResp('__nimeni'); return }
    setStatus(cod); setResp('')
  }
  const alege = (st, r = '') => { // click pe un status / segment: același element de două ori = scoate filtrul
    if (status === st && resp === r) { setStatus('toate'); setResp('') } else { setStatus(st); setResp(r) }
  }

  const selectPerioada = (
    <select value={perioada} onChange={(e) => setPerioada(e.target.value)} aria-label="Perioadă" title="Perioadă (după termen)" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
      {PERIOADE.map(([cod, nume]) => <option key={cod} value={cod}>{cod === 'toate' ? 'Perioadă: Toate' : nume}</option>)}
    </select>
  )

  return (
    <div className="mb-6 space-y-3">
      <Carduri
        activ={cardActiv}
        onClick={clickCard}
        elemente={[
          ['deschise', 'Taskuri deschise', deschise.length],
          ['intarziate', 'Întârziate', nrIntarziate, nrIntarziate ? 'text-[#B4332E]' : ''],
          ['fara', 'Fără responsabil', nrFaraResp],
          ['terminat', 'Terminate', terminate, 'text-[#1E6B43]'],
        ]}
      />
      {(iv || existaAfara) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-[#5B6578]">
          <span>
            {iv ? <>Perioadă: <b className="text-[#172036]">{fmt(iv.start)} – {fmt(iv.end)}</b> · {taskuri.length} din {toate.length} taskuri{fara > 0 ? ` (cele ${fara} fără termen nu sunt incluse)` : ''}</> : null}
          </span>
          {existaAfara && (
            <button type="button" role="switch" aria-checked={arataRestul} onClick={() => setArataRestul((v) => !v)} className="inline-flex min-h-[36px] items-center gap-2 font-semibold">
              <span className={`relative inline-block h-[18px] w-[30px] rounded-full transition-colors ${arataRestul ? 'bg-accent' : 'bg-[#CBD3E0]'}`}>
                <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all ${arataRestul ? 'left-[14px]' : 'left-[2px]'}`} />
              </span>
              Arată și restul taskurilor membrilor (hașurat = în afara departamentului)
            </button>
          )}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BareStivuite
          titlu="Încărcare pe persoană"
          randuri={peOameni}
          legenda={LEGENDA}
          gol="Nu sunt oameni sau taskuri în selecție."
          ingust={lat}
          activNume={resp}
          onNume={(r) => { if (resp === r.id) { setResp(''); } else { setResp(r.id); setStatus('deschise') } }}
          onSegment={(r, x) => alege(x.cod, r.id)}
        />
        <BareStivuite titlu="Încărcare pe subiect (tag)" randuri={peTaguri} legenda={LEGENDA} gol="Nu sunt taskuri deschise." ingust={lat} />
        <Placinta titlu="Taskuri pe status" felii={feliiStatus} gol="Niciun task în selecție." ingust={lat} activ={resp ? null : status} onFelie={(f) => alege(f.cod)} />
        <TaskuriPeLuni taskuri={taskuri} persoane={persoane} iv={iv} ingust={lat} />
      </div>
      <TaskLista
        taskuri={taskuri}
        ctx={ctx}
        onOpen={onOpen}
        status={status}
        onStatus={setStatus}
        resp={resp}
        onResp={setResp}
        extraFiltre={selectPerioada}
      />
    </div>
  )
}
