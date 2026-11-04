import { ChipRisc } from './RiscEvenimente'
import { riscEveniment } from '../../lib/taskuri/risc'
import { useMemo, useState } from 'react'
import { Modal } from './Mici'
import TabelTaskuri from './TabelTaskuri'
import ButonExport from './ButonExport'
import { GRUPE, esteDeschis, grupa } from '../home/date'
import { esteIntarziat, formatData, inputCls } from '../../lib/taskuri/ui'

const ORDINE = [...GRUPE, 'Terminate recent']
const GRUPARE = { ordine: ORDINE, fn: (t) => (t.status === 'terminat' ? 'Terminate recent' : grupa(t)) }
const COLOANE = ['deadline', 'responsabil', 'grup', 'prioritate']
const TABURI = ['Toate', 'Întârziate', 'Azi', '7 zile', 'Terminate']
const sapteZile = () => Date.now() - 7 * 24 * 3600 * 1000

// „Grup" = departamentul taskului (taskuri operaționale) sau, la taskurile de eveniment, secțiunea din checklist (tagul).
const numeGrup = (t, ctx) => ctx.grupMap?.[t.grup_id]?.nume || t.tag || ''

function potrivitTab(t, tab) {
  if (tab === 'Terminate') return t.status === 'terminat'
  if (!esteDeschis(t)) return false
  if (tab === 'Întârziate') return grupa(t) === 'Întârziate'
  if (tab === 'Azi') return grupa(t) === 'Azi'
  if (tab === '7 zile') return grupa(t) === 'Următoarele 7 zile'
  return true
}

const Stat = ({ eticheta, n, sub, cls = '' }) => (
  <div className="rounded-[14px] border border-[#E1E4EA] bg-white px-5 py-4">
    <div className="text-[13px] font-semibold text-[#5B6578]">{eticheta}</div>
    <div className={`my-0.5 text-[34px] font-extrabold leading-tight tracking-tight ${cls}`}>{n}</div>
    <div className="text-[12.5px] text-[#5B6578]">{sub}</div>
  </div>
)

function Eticheta({ label, children }) {
  return <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-bold text-[#5B6578]">{label}{children}</label>
}

// „Privire Generală": imagine de ansamblu doar pentru vizualizare (nimic nu se poate modifica de aici).
export default function PrivireGenerala({ ctx, onClose }) {
  const [tab, setTab] = useState('Toate')
  const [fGrup, setFGrup] = useState('')
  const [fEv, setFEv] = useState('')
  const [fResp, setFResp] = useState('')
  const [text, setText] = useState('')
  const [arataToate, setArataToate] = useState(false)

  const taskuri = useMemo(() => {
    const limita = sapteZile()
    return ctx.taskuri.filter((t) => esteDeschis(t) || (t.status === 'terminat' && t.terminat_la && new Date(t.terminat_la).getTime() >= limita))
  }, [ctx])
  const deschise = taskuri.filter(esteDeschis)
  const nr = (f) => deschise.filter((t) => grupa(t) === f).length
  const terminate = taskuri.filter((t) => t.status === 'terminat').length

  const evenimente = useMemo(() => {
    return ctx.evenimente
      .filter((e) => ctx.comportament(e.id) !== 'anulat')
      .filter((e) => arataToate || ['deschis', 'organizare'].includes(ctx.comportament(e.id)))
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
      .map((e) => {
        const t = ctx.taskuri.filter((x) => x.eveniment_id === e.id && x.status !== 'anulat')
        return {
          ...e,
          total: t.length,
          gata: t.filter((x) => x.status === 'terminat').length,
          intarziate: t.filter(esteIntarziat).length,
          faraResp: t.filter((x) => esteDeschis(x) && !x.responsabil_id).length,
        }
      })
  }, [ctx, arataToate])

  const optiuni = useMemo(() => {
    const unic = (v) => [...new Set(v.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ro'))
    return {
      grupuri: unic(taskuri.map((t) => numeGrup(t, ctx))),
      evenimente: unic(taskuri.map((t) => ctx.evMap[t.eveniment_id]?.nume || (t.tip === 'operational' ? 'Operațional' : ''))),
      responsabili: unic(taskuri.map((t) => (t.responsabil_id ? ctx.nume(t.responsabil_id) : ''))),
    }
  }, [taskuri, ctx])

  const dupaFiltre = (t) =>
    (!fGrup || numeGrup(t, ctx) === fGrup) &&
    (!fEv || (ctx.evMap[t.eveniment_id]?.nume || (t.tip === 'operational' ? 'Operațional' : '')) === fEv) &&
    (!fResp || (t.responsabil_id && ctx.nume(t.responsabil_id) === fResp)) &&
    (!text.trim() || t.titlu.toLowerCase().includes(text.trim().toLowerCase()))
  const filtrate = taskuri.filter(dupaFiltre)
  const vizibile = filtrate.filter((t) => potrivitTab(t, tab))

  const incarcare = useMemo(() => {
    const m = new Map()
    for (const t of deschise) {
      const g = numeGrup(t, ctx) || 'Fără grup'
      const x = m.get(g) || { g, n: 0, intarziate: 0 }
      x.n++
      if (grupa(t) === 'Întârziate') x.intarziate++
      m.set(g, x)
    }
    return [...m.values()].sort((a, b) => b.n - a.n)
  }, [deschise, ctx])
  const maxim = Math.max(1, ...incarcare.map((x) => x.n))

  const dataEv = (e) => (e.data ? `${formatData(e.data)}${e.data_sfarsit && e.data_sfarsit !== e.data ? ` – ${formatData(e.data_sfarsit)}` : ''}` : '')

  return (
    <Modal titlu="Privire Generală" onClose={onClose} lat="max-w-[1500px]">
      <div className="-mt-1 space-y-5 rounded-xl bg-[#F6F8FB] p-4">
        <p className="text-sm text-[#5B6578]">Toate evenimentele și taskurile din Hub, doar pentru vizualizare. Nimic nu se modifică din această fereastră.</p>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat eticheta="Întârziate" n={nr('Întârziate')} sub="în toată organizația" cls={nr('Întârziate') ? 'text-[#B4332E]' : ''} />
          <Stat eticheta="Scadente azi" n={nr('Azi')} sub="de făcut sau în lucru" />
          <Stat eticheta="Următoarele 7 zile" n={nr('Următoarele 7 zile')} sub="încă deschise" />
          <Stat eticheta="Terminate" n={terminate} sub="în ultimele 7 zile" cls="text-[#1E6B43]" />
        </div>

        <section aria-label="Evenimente" className="rounded-[14px] border border-[#E1E4EA] bg-white px-5 py-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[19px] font-extrabold text-[#172036]">{arataToate ? 'Evenimente' : 'Evenimente în organizare și deschise'}</h2>
            <select className={`${inputCls} !w-auto`} value={arataToate ? 'toate' : 'active'} onChange={(e) => setArataToate(e.target.value === 'toate')} aria-label="Evenimente afișate">
              <option value="active">Doar active</option>
              <option value="toate">Toate (fără cele anulate)</option>
            </select>
          </div>
          {evenimente.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#5B6578]">Niciun eveniment.</p>
          ) : (
            <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
              {evenimente.map((e) => (
                <div key={e.id} className="rounded-xl border border-[#E1E4EA] p-3.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="text-[15px] font-bold leading-snug text-[#172036]">{e.nume}</div>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full bg-[#EEF1F6] px-2.5 py-1 text-xs font-bold text-[#3A465C]">{ctx.statusMap[e.status]?.nume || e.status}</span>
                      {['deschis', 'organizare'].includes(ctx.comportament(e.id)) && <ChipRisc nivel={riscEveniment(e, ctx.taskuri).nivel} mic />}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] text-[#5B6578]">
                    {dataEv(e)}{e.localitate ? ` · ${e.localitate}` : ''}{e.pm.length ? ` · PM: ${e.pm.map((id) => ctx.nume(id)).join(', ')}` : ''}
                  </div>
                  {e.total > 0 ? (
                    <>
                      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#E9EDF3]"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.round((e.gata / e.total) * 100)}%` }} /></div>
                      <div className="mt-1.5 text-[13px] text-[#5B6578]">{e.gata} din {e.total} taskuri finalizate</div>
                    </>
                  ) : (
                    <div className="mt-2.5 text-[13px] text-[#5B6578]">Niciun task încă</div>
                  )}
                  {(e.intarziate > 0 || e.faraResp > 0) && (
                    <div className="mt-1.5 text-[13px] text-[#172036]">
                      {e.intarziate > 0 && <span className="font-semibold text-[#B4332E]">{e.intarziate} {e.intarziate === 1 ? 'întârziat' : 'întârziate'}</span>}
                      {e.intarziate > 0 && e.faraResp > 0 && ' · '}
                      {e.faraResp > 0 && <span>{e.faraResp} fără responsabil</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-start gap-5">
          <section aria-label="Toate taskurile" className="min-w-0 flex-[999_1_640px] overflow-hidden rounded-[14px] border border-[#E1E4EA] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="text-[19px] font-extrabold text-[#172036]">Toate taskurile</h2>
              <div className="flex flex-wrap items-center gap-2">
                {TABURI.map((t) => (
                  <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={`min-h-[40px] rounded-full border px-3.5 text-sm font-semibold ${tab === t ? 'border-accent bg-accent text-white' : 'border-[#CBD3E0] bg-white text-accent'}`}>
                    {t} · {filtrate.filter((x) => potrivitTab(x, t)).length}
                  </button>
                ))}
                <ButonExport taskuri={vizibile} ctx={ctx} numeFisier="privire-generala-taskuri" clasa="!rounded-full" filtre={[
                  ['Filtru', tab], ['Grup', fGrup || 'Toate'], ['Eveniment', fEv || 'Toate'], ['Responsabil', fResp || 'Toți'], ['Căutare text', text.trim() || '—'],
                ]} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 border-t border-[#E1E4EA] bg-[#F6F8FB] px-5 py-3">
              <Eticheta label="Căutare"><input className={inputCls} placeholder="Titlu…" value={text} onChange={(e) => setText(e.target.value)} /></Eticheta>
              <Eticheta label="Grup"><select className={inputCls} value={fGrup} onChange={(e) => setFGrup(e.target.value)}><option value="">Toate</option>{optiuni.grupuri.map((g) => <option key={g}>{g}</option>)}</select></Eticheta>
              <Eticheta label="Eveniment"><select className={inputCls} value={fEv} onChange={(e) => setFEv(e.target.value)}><option value="">Toate</option>{optiuni.evenimente.map((g) => <option key={g}>{g}</option>)}</select></Eticheta>
              <Eticheta label="Responsabil"><select className={inputCls} value={fResp} onChange={(e) => setFResp(e.target.value)}><option value="">Toți</option>{optiuni.responsabili.map((g) => <option key={g}>{g}</option>)}</select></Eticheta>
            </div>
            {vizibile.length === 0 ? (
              <p className="border-t border-[#E1E4EA] px-5 py-7 text-center text-sm text-[#5B6578]">Niciun task pentru filtrele alese.</p>
            ) : (
              <TabelTaskuri taskuri={vizibile} ctx={ctx} doarCitire arataEveniment grupare={GRUPARE} coloaneFixe={COLOANE} />
            )}
          </section>

          <aside className="min-w-0 flex-[1_1_320px]">
            <section aria-label="Încărcare pe grup" className="rounded-[14px] border border-[#E1E4EA] bg-white px-5 py-[18px]">
              <h2 className="text-[19px] font-extrabold text-[#172036]">Încărcare pe grup</h2>
              <p className="text-[12.5px] text-[#5B6578]">Taskuri deschise, cu cele întârziate în roșu</p>
              {incarcare.length === 0 && <p className="mt-3 text-sm text-[#5B6578]">Niciun task deschis.</p>}
              {incarcare.map((x) => (
                <div key={x.g} className="mt-3.5">
                  <div className="flex justify-between gap-2 text-sm font-semibold text-[#172036]">
                    <span className="min-w-0 truncate">{x.g}</span>
                    <span className="shrink-0 text-[13px] font-medium text-[#5B6578]">{x.n} deschise{x.intarziate > 0 && <> · <b className="text-[#B4332E]">{x.intarziate} întârziate</b></>}</span>
                  </div>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[#E9EDF3]">
                    <i className="block h-full bg-accent" style={{ width: `${Math.round(((x.n - x.intarziate) / maxim) * 100)}%` }} />
                    <i className="block h-full bg-[#B4332E]" style={{ width: `${Math.round((x.intarziate / maxim) * 100)}%` }} />
                  </div>
                </div>
              ))}
              <p className="mt-3 text-xs leading-relaxed text-[#5B6578]">Grupul unui task este departamentul lui; la taskurile de eveniment, secțiunea din checklist (tagul).</p>
            </section>
          </aside>
        </div>
      </div>
    </Modal>
  )
}
