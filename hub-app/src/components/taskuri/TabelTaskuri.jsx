import { EtichetaNou } from './EtichetaNou'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown, Columns3, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { esteIntarziat, formatData, mesajEroare, sorteaza } from '../../lib/taskuri/ui'
import { COLOANE_OPTIONALE, ORDINE_PRIORITATE, ORDINE_STATUS, poateEditaInLista, poateSterge, stergeTaskuri, useColoane } from '../../lib/taskuri/editare'
import StatusDropdown from './StatusDropdown'
import CelulaEditabila from './CelulaEditabila'
import BaraEditareMasa from './BaraEditareMasa'

const CHEI_SORTARE = {
  status: (t) => ORDINE_STATUS[t.status],
  titlu: (t) => t.titlu.toLowerCase(),
  deadline: (t) => t.termen || '9999-99-99',
  responsabil: (t, ctx) => (t.responsabil_id ? ctx.nume(t.responsabil_id).toLowerCase() : '~'),
  tag: (t) => (t.tag || '~').toLowerCase(),
  grup: (t, ctx) => (ctx.grupMap?.[t.grup_id]?.nume || t.tag || '~').toLowerCase(),
  deschis: (t, ctx) => (t.creat_de ? ctx.nume(t.creat_de).toLowerCase() : '~'),
  prioritate: (t) => ORDINE_PRIORITATE[t.prioritate],
}
const LATIMI = { deadline: '96px', responsabil: '150px', tag: '130px', grup: '140px', deschis: '150px', prioritate: '96px' }
const ETICHETE = { status: 'Status', titlu: 'Titlu', deadline: 'Deadline', responsabil: 'Responsabil', tag: 'Tag', grup: 'Grup', deschis: 'Deschis de', prioritate: 'Prioritate' }

function Eticheta({ t, ctx, arataEveniment, arataTag }) {
  return (
    <>
      {arataEveniment && t.tip === 'eveniment' && ctx.evMap?.[t.eveniment_id] && (
        <span className="max-w-[200px] shrink-0 truncate rounded-md bg-cream px-2 py-0.5 text-xs font-semibold text-[#172036]" title={ctx.evMap[t.eveniment_id].nume}>{ctx.evMap[t.eveniment_id].nume}</span>
      )}
      {arataEveniment && t.tip === 'operational' && (
        <span className="shrink-0 rounded-md border border-[#9AA6B8] px-2 py-0.5 text-xs font-semibold text-[#3A465C]">{ctx.grupMap?.[t.grup_id]?.nume || 'Operațional'}</span>
      )}
      {arataTag && t.tag && <span className="shrink-0 rounded-md bg-[#F1F3F7] px-2 py-0.5 text-xs font-semibold text-[#3A465C]">{t.tag}</span>}
    </>
  )
}

function SelectorColoane({ coloane, schimba }) {
  const [deschis, setDeschis] = useState(false)
  const radacina = useRef(null)
  const [poz, setPoz] = useState(null)
  useEffect(() => {
    if (!deschis) return
    const r = radacina.current.getBoundingClientRect()
    setPoz(window.innerHeight - r.bottom < 280 ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right } : { top: r.bottom + 4, right: window.innerWidth - r.right })
    const inchide = () => setDeschis(false)
    window.addEventListener('scroll', inchide, true)
    window.addEventListener('resize', inchide)
    const afara = (e) => { if (radacina.current && !radacina.current.contains(e.target)) setDeschis(false) }
    const tasta = (e) => e.key === 'Escape' && setDeschis(false)
    document.addEventListener('mousedown', afara)
    document.addEventListener('keydown', tasta)
    return () => { document.removeEventListener('mousedown', afara); document.removeEventListener('keydown', tasta); window.removeEventListener('scroll', inchide, true); window.removeEventListener('resize', inchide) }
  }, [deschis])
  return (
    <div className="relative" ref={radacina}>
      <button type="button" aria-expanded={deschis} onClick={() => setDeschis((d) => !d)} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-[#3A465C] hover:bg-[#EEF1F6]">
        <Columns3 size={14} aria-hidden="true" /> Coloane
      </button>
      {deschis && (
        <div style={poz ? { position: 'fixed', ...poz } : { visibility: 'hidden' }} className="z-50 w-52 rounded-xl border border-[#E1E4EA] bg-white p-2 shadow-lg">
          {COLOANE_OPTIONALE.map(([k, e]) => (
            <label key={k} className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-[#172036] hover:bg-[#F6F8FB]">
              <input type="checkbox" className="h-4 w-4 accent-[#22406B]" checked={coloane[k]} onChange={(e2) => schimba(k, e2.target.checked)} /> {e}
            </label>
          ))}
          <p className="px-2 pt-1 text-[11px] text-[#7A869A]">Titlul și statusul sunt mereu afișate. Alegerea rămâne pe acest calculator.</p>
        </div>
      )}
    </div>
  )
}

// coloaneFixe: lista exactă de coloane afișate (fără selectorul „Coloane").
// doarCitire: fără status, editare, selecție, ștergere si fără deschiderea taskului (pentru Privire Generală).
// Tabel de taskuri folosit peste tot: sortare pe coloane, coloane la alegere, selecție multiplă cu
// editare în masă și editare directă (doar la taskurile deschise de tine).
// `grupare` (opțional): { ordine: [eticheta...], fn: (task) => eticheta } pentru secțiuni.
export default function TabelTaskuri({ taskuri, ctx, onOpen, onEroare, arataEveniment = false, bara = true, grupare = null, doarCitire = false, coloaneFixe = null }) {
  const [suprascrieri, setSuprascrieri] = useState({})
  const [sortare, setSortare] = useState(null) // { cheie, dir }
  const [selectate, setSelectate] = useState(() => new Set())
  const [coloane, schimbaColoana] = useColoane()

  const lista = useMemo(() => {
    const cuStatus = taskuri.map((t) => (suprascrieri[t.id] ? { ...t, status: suprascrieri[t.id] } : t))
    if (sortare) {
      const f = CHEI_SORTARE[sortare.cheie]
      return [...cuStatus].sort((a, b) => {
        const x = f(a, ctx)
        const y = f(b, ctx)
        const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ro')
        return c * sortare.dir
      })
    }
    const deschise = sorteaza(cuStatus.filter((t) => t.status === 'de_facut' || t.status === 'in_lucru'))
    const restul = sorteaza(cuStatus.filter((t) => t.status === 'terminat' || t.status === 'anulat'))
    return [...deschise, ...restul]
  }, [taskuri, suprascrieri, sortare, ctx])

  const sectiuni = useMemo(() => {
    if (!grupare) return [{ eticheta: null, taskuri: lista }]
    return grupare.ordine.map((e) => ({ eticheta: e, taskuri: lista.filter((t) => grupare.fn(t) === e) })).filter((s) => s.taskuri.length)
  }, [lista, grupare])

  const idVizibile = useMemo(() => new Set(taskuri.map((t) => t.id)), [taskuri])
  const alese = lista.filter((t) => selectate.has(t.id) && idVizibile.has(t.id))
  const toateAlese = lista.length > 0 && alese.length === lista.length

  async function seteaza(t, nou) {
    onEroare?.('')
    setSuprascrieri((s) => ({ ...s, [t.id]: nou }))
    const { error } = await supabase.rpc('tsk_schimba_status', { p_task: t.id, p_status: nou })
    if (error) onEroare?.(mesajEroare(error, 'Nu am putut schimba statusul.'))
    await ctx.reload()
    setSuprascrieri((s) => { const n = { ...s }; delete n[t.id]; return n })
  }

  async function sterge(t) {
    if (!window.confirm(`Ștergi definitiv taskul „${t.titlu}"? Nu se poate reveni. Dacă vrei doar să-l oprești, schimbă statusul în „Anulat".`)) return
    onEroare?.('')
    const err = await stergeTaskuri([t.id])
    if (err) return onEroare?.(err)
    setSelectate((s) => { const n = new Set(s); n.delete(t.id); return n })
    await ctx.reload()
  }

  function comuta(id) {
    setSelectate((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function sorteazaDupa(cheie) {
    setSortare((s) => (!s || s.cheie !== cheie ? { cheie, dir: 1 } : s.dir === 1 ? { cheie, dir: -1 } : null))
  }

  if (taskuri.length === 0) return null

  const vizibile = coloaneFixe || ['deadline', 'responsabil', 'tag', 'deschis', 'prioritate'].filter((k) => coloane[k])
  const areStergere = !doarCitire && lista.some((t) => poateSterge(ctx, t))
  const sablon = [...(doarCitire ? [] : ['28px']), '112px', 'minmax(0,1fr)', ...vizibile.map((k) => LATIMI[k]), ...(areStergere ? ['32px'] : [])].join(' ')
  const stilGrid = { gridTemplateColumns: sablon }
  const clasaRand = 'grid items-center gap-x-3'
  const stare = (cheie) => (sortare?.cheie === cheie ? (sortare.dir === 1 ? 'ascending' : 'descending') : 'none')
  const Sageata = ({ cheie }) => (sortare?.cheie === cheie ? (sortare.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronsUpDown size={12} className="opacity-40" />)
  const antet = (cheie) => (
    <span key={cheie} role="columnheader" aria-sort={stare(cheie)}>
      <button type="button" onClick={() => sorteazaDupa(cheie)} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[#172036]">{ETICHETE[cheie]} <Sageata cheie={cheie} /></button>
    </span>
  )

  const rand = (t) => {
    const inchis = t.status === 'terminat' || t.status === 'anulat'
    const editabil = !doarCitire && poateEditaInLista(ctx, t)
    const butonSterge = !doarCitire && poateSterge(ctx, t) && (
      <button type="button" onClick={() => sterge(t)} className="flex h-8 w-8 items-center justify-center rounded-md text-[#7A869A] hover:bg-rose-50 hover:text-rose-600" title="Șterge taskul" aria-label={`Șterge taskul „${t.titlu}"`}>
        <Trash2 size={15} aria-hidden="true" />
      </button>
    )
    const aleasa = selectate.has(t.id)
    const dd = (
      <StatusDropdown compact status={t.status} poate={!doarCitire && ctx.poateSchimbaStatus(t) && !ctx.inghetat(t) && !ctx.evenimentAnulat(t.eveniment_id)} poateAnula={!doarCitire && ctx.poateGestiona(t)} onChange={(s) => seteaza(t, s)} />
    )
    const celula = (tip) => <CelulaEditabila tip={tip} task={t} ctx={ctx} poate={editabil} onEroare={onEroare} />
    return (
      <div key={t.id}>
        {/* telefon: card compact */}
        <div className="border-t border-[#EEF0F4] px-4 py-2 sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <button type="button" disabled={doarCitire} onClick={() => onOpen(t)} className={`text-left text-[15px] font-semibold leading-snug ${doarCitire ? 'cursor-default' : 'hover:underline'} ${inchis ? 'text-[#7A869A] line-through' : 'text-[#172036]'}`}><EtichetaNou ctx={ctx} t={t} />{t.titlu}</button>
            <span className={`shrink-0 text-[13px] font-bold ${esteIntarziat(t) ? 'text-[#B4332E]' : 'text-[#172036]'}`}>{t.termen ? formatData(t.termen) : '—'}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-wrap gap-1"><Eticheta t={t} ctx={ctx} arataEveniment={arataEveniment} arataTag={!coloaneFixe} /></span>
            <span className="flex shrink-0 items-center gap-1">{dd}{butonSterge}</span>
          </div>
        </div>
        {/* desktop: rând de tabel */}
        <div style={stilGrid} className={`${clasaRand} hidden border-t border-[#EEF0F4] px-5 py-2 sm:grid ${aleasa ? 'bg-[#EEF3FB]' : 'hover:bg-[#FAFBFD]'}`}>
          {!doarCitire && <div><input type="checkbox" className="h-4 w-4 accent-[#22406B]" checked={aleasa} onChange={() => comuta(t.id)} aria-label={`Selectează „${t.titlu}"`} /></div>}
          <div>{dd}</div>
          <div className="min-w-0">
            <button type="button" disabled={doarCitire} onClick={() => onOpen(t)} title={t.titlu} className={`block max-w-full truncate text-left text-sm font-semibold ${doarCitire ? 'cursor-default' : 'hover:underline'} ${inchis ? 'text-[#7A869A] line-through' : 'text-[#172036]'}`}><EtichetaNou ctx={ctx} t={t} />{t.titlu}</button>
            <span className="mt-0.5 flex min-w-0 flex-wrap gap-1 empty:hidden"><Eticheta t={t} ctx={ctx} arataEveniment={arataEveniment} arataTag={!coloane.tag && !coloaneFixe} /></span>
          </div>
          {vizibile.map((k) => (
            <div key={k} className="min-w-0 truncate text-[13px] text-[#172036]">
              {k === 'deadline' && <span className="font-bold">{celula('data')}</span>}
              {k === 'responsabil' && celula('responsabil')}
              {k === 'tag' && celula('tag')}
              {k === 'grup' && <span title={ctx.grupMap?.[t.grup_id]?.nume || t.tag || ''}>{ctx.grupMap?.[t.grup_id]?.nume || t.tag || '—'}</span>}
              {k === 'prioritate' && <span className="text-[#5B6578]">{celula('prioritate')}</span>}
              {k === 'deschis' && <span title={t.creat_de ? ctx.nume(t.creat_de) : ''}>{t.creat_de ? ctx.nume(t.creat_de) : '—'}</span>}
            </div>
          ))}
          {areStergere && <div className="flex justify-end">{butonSterge}</div>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {!doarCitire && alese.length > 0 && <BaraEditareMasa taskuri={alese} ctx={ctx} onGata={() => setSelectate(new Set())} />}
      {bara && !coloaneFixe && (doarCitire || alese.length === 0) && (
        <div className="hidden justify-end border-t border-[#E1E4EA] px-5 py-0.5 sm:flex">
          <SelectorColoane coloane={coloane} schimba={schimbaColoana} />
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="sm:min-w-[860px]">
          <div role="row" style={stilGrid} className={`${clasaRand} hidden border-t border-[#E1E4EA] bg-[#F6F8FB] px-5 py-1.5 text-[11px] font-bold text-[#5B6578] sm:grid`}>
            {!doarCitire && <div><input type="checkbox" className="h-4 w-4 accent-[#22406B]" checked={toateAlese} onChange={() => setSelectate(toateAlese ? new Set() : new Set(lista.map((t) => t.id)))} aria-label="Selectează toate taskurile" /></div>}
            {antet('status')}{antet('titlu')}{vizibile.map(antet)}{areStergere && <span />}
          </div>
          {sectiuni.map((s) => (
            <div key={s.eticheta || 'toate'}>
              {s.eticheta && (
                <div className="border-t border-[#E1E4EA] bg-[#EEF1F6] px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-[#5B6578] sm:px-5">{s.eticheta} · {s.taskuri.length}</div>
              )}
              {s.taskuri.map(rand)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
