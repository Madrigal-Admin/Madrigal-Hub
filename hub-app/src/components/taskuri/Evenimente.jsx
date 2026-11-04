import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ListChecks, Plus, PlayCircle, CheckCircle2, RotateCcw } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { estePrelucrat, formatData, mesajEroare, esteIntarziat } from '../../lib/taskuri/ui'
import { culoareText } from '../../lib/evenimente'
import { Gol } from './Mici'
import { linkRaport, raportLipsa, useRaportate } from '../../lib/taskuri/raportLipsa'
import { useTaskuri } from './TaskuriContext'
import TabelTaskuri from './TabelTaskuri'

const SECTIUNI = [
  { cod: 'deschis', titlu: 'Deschise', nota: 'Organizarea nu a început — taskurile apar după ce treci în „În organizare”' },
  { cod: 'organizare', titlu: 'În organizare', nota: '' },
  { cod: 'inchise', titlu: 'Finalizate și anulate', nota: 'ascunse implicit' },
]

// Lista „Evenimentele mele": evenimentele tale grupate pe status, fiecare cu taskurile lui dedesubt.
export default function Evenimente({ ctx, evenimente, onOpen, onTaskNou, onChecklist }) {
  const [inchise, setInchise] = useState(() => new Set()) // evenimente cu taskurile strânse
  const [arataInchise, setArataInchise] = useState(false)
  const [eroare, setEroare] = useState('')
  const raportate = useRaportate(useTaskuri().areRapoarte)

  // În grupurile active: cele mai apropiate ca dată primele. La cele încheiate: cele mai recente primele.
  const grupuri = useMemo(() => {
    const dupa = (cod) => evenimente.filter((e) => {
      const c = ctx.comportament(e.id)
      return cod === 'inchise' ? c === 'finalizat' || c === 'anulat' : c === cod
    })
    const crescator = (a, b) => (a.data || '').localeCompare(b.data || '')
    return {
      deschis: dupa('deschis').sort(crescator),
      organizare: dupa('organizare').sort(crescator),
      inchise: dupa('inchise').sort((a, b) => crescator(b, a)),
    }
  }, [ctx, evenimente])

  async function status(e, cod) {
    setEroare('')
    const { error } = await supabase.rpc('tsk_eveniment_schimba_status', { p_eveniment: e.id, p_status: cod })
    if (error) setEroare(mesajEroare(error, 'Nu am putut schimba statusul evenimentului.'))
    await ctx.reload()
  }

  const codOrganizare = ctx.statusuri.find((s) => s.comportament === 'organizare')?.cod
  const codFinalizat = ctx.statusuri.find((s) => s.comportament === 'finalizat')?.cod
  const comuta = (id) => setInchise((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const renderCard = (e) => {
    const st = ctx.statusMap[e.status]
    const comp = st?.comportament
    const taskuri = ctx.taskuri.filter((t) => t.eveniment_id === e.id)
    const valide = taskuri.filter((t) => t.status !== 'anulat')
    const gata = valide.filter((t) => t.status === 'terminat').length
    const deschiseNr = taskuri.filter(estePrelucrat).length
    const intarziate = taskuri.filter(esteIntarziat).length
    const procent = valide.length ? Math.round((gata / valide.length) * 100) : 0
    const strans = inchise.has(e.id)
    const poate = ctx.pmLaEveniment(e.id)
    const btn = 'inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 hover:bg-slate-50'
    return (
      <div key={e.id} className="mb-3 overflow-hidden rounded-[14px] border border-[#E1E4EA] bg-white">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
          <button type="button" onClick={() => comuta(e.id)} aria-expanded={!strans} className="flex min-w-[220px] flex-1 items-center gap-2 text-left">
            {strans ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            <span>
              <span className="block text-base font-extrabold text-[#172036]">{e.nume}</span>
              <span className="block text-[13px] text-[#5B6578]">{formatData(e.data)}{e.localitate ? ` · ${e.localitate}` : ''}</span>
            </span>
          </button>
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: `${st?.culoare}26`, color: culoareText(st?.culoare) }}>{st?.nume || e.status}</span>
          {raportLipsa(e, ctx, raportate) && (
            <a href={linkRaport(e)} className="inline-flex items-center gap-1 rounded-full bg-[#FFF1D6] px-3 py-1 text-xs font-bold text-[#8A4B12] hover:bg-[#FCE5B8]" title="Deschide formularul de raport pentru acest eveniment">Raport lipsă · Completează →</a>
          )}
          {valide.length > 0 && (
            <div className="w-48">
              <div className="h-2 rounded-full bg-[#E9EDF3]"><div className="h-2 rounded-full bg-[#2E9E6B]" style={{ width: `${procent}%` }} /></div>
              <p className="mt-1 text-xs text-[#5B6578]">{gata}/{valide.length} terminate{intarziate > 0 && <span className="font-bold text-[#B4332E]"> · {intarziate} întârziate</span>}</p>
            </div>
          )}
        </div>

        {poate && comp !== 'anulat' && (
          <div className="flex flex-wrap gap-2 px-4 pb-3 sm:pl-[46px] sm:pr-5">
            {comp === 'deschis' && (
              <button type="button" onClick={() => onChecklist('start', e)} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-bold text-white hover:bg-accent-hover">
                <PlayCircle size={14} /> Trece în „În organizare”
              </button>
            )}
            <button type="button" onClick={() => onTaskNou(e.id)} className={btn}><Plus size={14} /> Task nou</button>
            {comp === 'organizare' && <button type="button" onClick={() => onChecklist('adauga', e)} className={btn}><ListChecks size={14} /> Adaugă din checklist</button>}
            {comp === 'organizare' && codFinalizat && (
              <button type="button" onClick={() => status(e, codFinalizat)} title={deschiseNr > 0 ? `Mai ai ${deschiseNr} taskuri deschise` : 'Marchează evenimentul ca finalizat'} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-[13px] font-bold text-emerald-700 hover:bg-emerald-50">
                <CheckCircle2 size={14} /> Marchează finalizat
              </button>
            )}
            {comp === 'finalizat' && codOrganizare && (
              <button type="button" onClick={() => status(e, codOrganizare)} className={btn}><RotateCcw size={14} /> Redeschide în organizare</button>
            )}
          </div>
        )}
        {comp === 'anulat' && <p className="px-5 pb-3 text-xs text-rose-600">Eveniment anulat — taskurile lui sunt înghețate.</p>}

        {!strans && taskuri.length > 0 && <TabelTaskuri taskuri={taskuri} ctx={ctx} onOpen={onOpen} onEroare={setEroare} bara={false} />}
        {!strans && taskuri.length === 0 && (
          <p className="border-t border-[#EEF0F4] px-5 py-3 text-[13px] text-[#5B6578] sm:pl-[46px]">
            {comp === 'deschis' ? 'Niciun task încă. Vei alege din checklist taskurile necesare când pornești organizarea.' : 'Niciun task la acest eveniment.'}
          </p>
        )}
      </div>
    )
  }

  const titluSectiune = (s, nr) => (
    <div className="mb-2.5 mt-6 flex flex-wrap items-baseline gap-x-3">
      <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-[#172036]">{s.titlu} · {nr}</h2>
      {s.nota && <span className="text-[13px] text-[#5B6578]">{s.nota}</span>}
    </div>
  )

  if (evenimente.length === 0) return <Gol>Nu ai evenimente pentru selecția aleasă.</Gol>

  return (
    <div>
      {eroare && <p className="mb-3 whitespace-pre-wrap text-sm text-rose-600">{eroare}</p>}
      {SECTIUNI.map((s) => {
        const lista = grupuri[s.cod]
        if (lista.length === 0) return null
        if (s.cod === 'inchise') {
          return (
            <div key={s.cod}>
              {titluSectiune(s, lista.length)}
              <button type="button" onClick={() => setArataInchise((a) => !a)} aria-expanded={arataInchise} className="mb-3 text-sm font-bold text-accent hover:underline">
                {arataInchise ? 'Ascunde' : 'Arată'}
              </button>
              {arataInchise && lista.map(renderCard)}
            </div>
          )
        }
        return (
          <div key={s.cod}>
            {titluSectiune(s, lista.length)}
            {lista.map(renderCard)}
          </div>
        )
      })}
    </div>
  )
}
