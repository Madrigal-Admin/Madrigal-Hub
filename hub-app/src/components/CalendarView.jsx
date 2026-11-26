import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, Settings, Plus, Pencil, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import EvenimentForm from './EvenimentForm'
import ListeEvenimente from './ListeEvenimente'
import StatisticiEvenimente from './StatisticiEvenimente'
import FiltruMulti from './FiltruMulti'
import AngajatiPicker from './AngajatiPicker'
import { useTaskuri } from './taskuri/TaskuriContext'
import DecalareTermene, { taskuriDecalabile } from './taskuri/DecalareTermene'
import {
  IMPLICARE_CULORI, ZILE_SAPT, LUNI, formatData, ymd, formatOra, zileEveniment, culoareText, initiale, incarcaTot,
} from '../lib/evenimente'

const CULOARE_NECUNOSCUT = '#94a3b8'

function Chip({ c, children, taiat }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${taiat ? 'line-through' : ''}`}
      style={{ backgroundColor: `${c}26`, color: culoareText(c) }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
      {children}
    </span>
  )
}

export default function CalendarView({ canManageCalendar, canSeeStatistici, meId }) {
  const [date, setDate] = useState({ evenimente: [], tipuri: [], statusuri: [], angajati: [] })
  const [eroare, setEroare] = useState('')
  const [loading, setLoading] = useState(true)
  // filtre cu selecție multiplă; set gol = fără filtru (toate)
  const [tipFilter, setTipFilter] = useState(() => new Set())
  const [statusFilter, setStatusFilter] = useState(() => new Set())
  const [localitateFilter, setLocalitateFilter] = useState(() => new Set())
  const [calitateFilter, setCalitateFilter] = useState(() => new Set())
  const ctxTaskuri = useTaskuri()?.ctx
  const [decalare, setDecalare] = useState(null)
  const [formDeschis, setFormDeschis] = useState(null) // null | 'nou' | eveniment
  const [showListe, setShowListe] = useState(false)
  const [showStatistici, setShowStatistici] = useState(false)
  useEffect(() => {
    if (!showStatistici) return
    const la = (e) => e.key === 'Escape' && setShowStatistici(false)
    window.addEventListener('keydown', la)
    return () => window.removeEventListener('keydown', la)
  }, [showStatistici])
  const [lunaCurenta, setLunaCurenta] = useState(() => {
    const azi = new Date()
    return new Date(azi.getFullYear(), azi.getMonth(), 1)
  })
  const [ziuaSelectata, setZiuaSelectata] = useState(null)
  const [cardFiltru, setCardFiltru] = useState(null) // null | 'fara_pm' | 'organizare' | 'definalizat' (cardurile de sus sunt și filtre)
  const [confirmStatus, setConfirmStatus] = useState(null) // { id, status } — confirmare înainte de Finalizat / Anulat
  const [pmDeschis, setPmDeschis] = useState(null) // id eveniment cu selectorul de PM deschis
  const [eroareCard, setEroareCard] = useState(null) // { id, msg }

  const { evenimente, tipuri, statusuri, angajati } = date

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const r = await incarcaTot()
    setEroare(r.eroare)
    setDate({ evenimente: r.evenimente, tipuri: r.tipuri, statusuri: r.statusuri, angajati: r.angajati })
    setLoading(false)
  }

  const tipDupaCod = useMemo(() => Object.fromEntries(tipuri.map((t) => [t.cod, t])), [tipuri])
  const statusDupaCod = useMemo(() => Object.fromEntries(statusuri.map((s) => [s.cod, s])), [statusuri])
  const numeAngajat = useMemo(() => Object.fromEntries(angajati.map((a) => [a.id, a.nume_complet])), [angajati])

  const localitati = useMemo(
    () => [...new Set(evenimente.map((e) => (e.localitate || '').trim()).filter(Boolean))].sort(),
    [evenimente]
  )

  async function toggleFlag(id, field, value) {
    setDate((prev) => ({ ...prev, evenimente: prev.evenimente.map((e) => (e.id === id ? { ...e, [field]: value } : e)) }))
    await supabase.from('evenimente').update({ [field]: value }).eq('id', id)
  }

  const evenimenteVizibile = useMemo(
    () =>
      evenimente.filter(
        (e) =>
          (tipFilter.size === 0 || e.tipuri.some((c) => tipFilter.has(c))) &&
          (statusFilter.size === 0 || statusFilter.has(e.status)) &&
          (localitateFilter.size === 0 || localitateFilter.has((e.localitate || '').trim())) &&
          (calitateFilter.size === 0 || calitateFilter.has(e.implicare))
      ),
    [evenimente, tipFilter, statusFilter, localitateFilter, calitateFilter]
  )

  const evenimenteByDate = useMemo(() => {
    const map = {}
    for (const e of evenimenteVizibile) {
      for (const z of zileEveniment(e)) {
        if (!map[z]) map[z] = []
        map[z].push(e)
      }
    }
    return map
  }, [evenimenteVizibile])

  const zileGrila = useMemo(() => {
    const primaZi = new Date(lunaCurenta.getFullYear(), lunaCurenta.getMonth(), 1)
    const ultimaZi = new Date(lunaCurenta.getFullYear(), lunaCurenta.getMonth() + 1, 0)
    const offsetStart = (primaZi.getDay() + 6) % 7
    const start = new Date(primaZi)
    start.setDate(start.getDate() - offsetStart)
    const offsetEnd = (7 - ((ultimaZi.getDay() + 6) % 7) - 1) % 7
    const end = new Date(ultimaZi)
    end.setDate(end.getDate() + offsetEnd)
    const zile = []
    const cursor = new Date(start)
    while (cursor <= end) {
      zile.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return zile
  }, [lunaCurenta])

  const azi = ymd(new Date())

  // --- cardurile de sus (cifre + filtre) ---
  const compStatus = (e) => statusDupaCod[e.status]?.comportament
  const prefixLuna = `${lunaCurenta.getFullYear()}-${String(lunaCurenta.getMonth() + 1).padStart(2, '0')}`
  const inLunaAfisata = (e) => zileEveniment(e).some((z) => z.startsWith(prefixLuna))
  const faraPm = (e) => compStatus(e) !== 'anulat' && e.pm.length === 0
  const inOrganizare = (e) => compStatus(e) === 'organizare'
  // „de finalizat" = evenimente trecute, încă deschise sau în organizare (indiferent de lună)
  const deFinalizat = (e) => ['deschis', 'organizare'].includes(compStatus(e)) && (e.data_sfarsit || e.data) < azi
  const evLuna = evenimenteVizibile.filter(inLunaAfisata)
  const caracteristiciCard = {
    fara_pm: { nume: 'Fără PM', potrivit: faraPm },
    organizare: { nume: 'În organizare', potrivit: inOrganizare },
    definalizat: { nume: 'De finalizat (au trecut)', potrivit: deFinalizat },
  }

  const evenimenteAfisate = (() => {
    let lista
    if (ziuaSelectata) lista = evenimenteByDate[ziuaSelectata] || []
    else if (cardFiltru === 'definalizat') lista = evenimenteVizibile
    else lista = evLuna
    return cardFiltru ? lista.filter(caracteristiciCard[cardFiltru].potrivit) : lista
  })()

  // --- status și PM direct din card ---
  const poateSchimbaStatus = (e) => canManageCalendar || (!!meId && e.pm.includes(meId))

  async function schimbaStatus(e, cod) {
    setEroareCard(null)
    setConfirmStatus(null)
    const vechi = e.status
    setDate((prev) => ({ ...prev, evenimente: prev.evenimente.map((x) => (x.id === e.id ? { ...x, status: cod } : x)) }))
    const { error } = await supabase.rpc('eveniment_schimba_status', { p_eveniment: e.id, p_status: cod })
    if (error) {
      setDate((prev) => ({ ...prev, evenimente: prev.evenimente.map((x) => (x.id === e.id ? { ...x, status: vechi } : x)) }))
      setEroareCard({ id: e.id, msg: error.message || 'Nu am putut schimba statusul.' })
      return
    }
    ctxTaskuri?.reload?.() // taskurile evenimentului țin cont de status
  }

  function cereStatus(e, cod) {
    if (cod === e.status) return
    const comp = statusDupaCod[cod]?.comportament
    if (comp === 'finalizat' || comp === 'anulat') {
      setEroareCard(null)
      setConfirmStatus({ id: e.id, status: cod })
    } else {
      schimbaStatus(e, cod)
    }
  }

  async function salveazaPm(e, noua) {
    setEroareCard(null)
    const adaugate = noua.filter((id) => !e.pm.includes(id))
    const scoase = e.pm.filter((id) => !noua.includes(id))
    setDate((prev) => ({ ...prev, evenimente: prev.evenimente.map((x) => (x.id === e.id ? { ...x, pm: noua } : x)) }))
    let err = null
    if (adaugate.length) err = (await supabase.from('eveniment_pm').insert(adaugate.map((a) => ({ eveniment_id: e.id, angajat_id: a })))).error
    if (!err && scoase.length) err = (await supabase.from('eveniment_pm').delete().eq('eveniment_id', e.id).in('angajat_id', scoase)).error
    if (err) {
      setEroareCard({ id: e.id, msg: 'Nu am putut salva PM-ul.' })
      load()
      return
    }
    ctxTaskuri?.reload?.() // PM-ul poate crea taskuri pe eveniment
  }

  function schimbaLuna(delta) {
    setLunaCurenta((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
    setZiuaSelectata(null)
  }

  function dupaSalvare(info) {
    setFormDeschis(null)
    load()
    // Întrebăm doar dacă există taskuri pe care le poți decala.
    if (info && taskuriDecalabile(ctxTaskuri, info.id).length > 0) setDecalare(info)
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        {eroare && <p className="mb-4 text-sm text-rose-600">{eroare}</p>}

        {(canManageCalendar || canSeeStatistici) && (
          <div className="mb-5 flex flex-wrap items-center gap-3 bg-white rounded-xl shadow-sm p-4">
            {canManageCalendar && (
              <>
                <button
                  onClick={() => setFormDeschis('nou')}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  <Plus size={15} /> Eveniment nou
                </button>
                <button
                  onClick={() => setShowListe(true)}
                  className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
                >
                  <Settings size={15} /> Tipuri și statusuri
                </button>
              </>
            )}
            {canSeeStatistici && (
              <button
                onClick={() => setShowStatistici(true)}
                className="ml-auto flex items-center gap-2 rounded-lg bg-[#DDF0E4] px-4 py-2 text-sm font-semibold text-[#1E6B43] transition hover:bg-[#CBE7D6]"
              >
                <BarChart3 size={15} /> Statistici evenimente
              </button>
            )}
          </div>
        )}

        {!loading && (
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              [null, `Evenimente · ${LUNI[lunaCurenta.getMonth()].toLowerCase()}`, evLuna.filter((e) => compStatus(e) !== 'anulat').length, ''],
              ['fara_pm', 'Fără PM', evLuna.filter(faraPm).length, evLuna.some(faraPm) ? 'text-[#B4332E]' : ''],
              ['organizare', 'În organizare', evLuna.filter(inOrganizare).length, ''],
              ['definalizat', 'De finalizat', evenimenteVizibile.filter(deFinalizat).length, evenimenteVizibile.some(deFinalizat) ? 'text-[#B4332E]' : ''],
            ].map(([cod, eticheta, n, culoare]) => (
              <button
                key={eticheta}
                type="button"
                aria-pressed={cardFiltru === cod}
                onClick={() => { setCardFiltru(cod && cardFiltru === cod ? null : cod); setZiuaSelectata(null) }}
                title={cod ? 'Filtrează evenimentele din dreapta' : 'Arată toate evenimentele lunii'}
                className={`flex items-baseline justify-between gap-3 rounded-[14px] border bg-white px-4 py-2.5 text-left transition hover:border-[#9AA6B8] ${cardFiltru === cod ? 'border-accent ring-2 ring-accent/25' : 'border-[#E1E4EA]'}`}
              >
                <span className="text-xs font-semibold text-[#5B6578]">{eticheta}</span>
                <span className={`text-[26px] font-extrabold leading-none tracking-tight ${culoare}`}>{n}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-2 bg-white rounded-xl shadow-sm p-3">
          <span className="mr-1 text-xs font-medium text-slate-500">Filtrează:</span>
          <FiltruMulti
            eticheta="Tipuri" toate="Toate tipurile" selectat={tipFilter} onChange={setTipFilter}
            optiuni={tipuri.filter((t) => t.activ || evenimente.some((e) => e.tipuri.includes(t.cod))).map((t) => ({ valoare: t.cod, eticheta: t.nume, culoare: t.culoare }))}
          />
          <FiltruMulti
            eticheta="Statusuri" toate="Toate statusurile" selectat={statusFilter} onChange={setStatusFilter}
            optiuni={statusuri.map((s) => ({ valoare: s.cod, eticheta: s.nume, culoare: s.culoare }))}
          />
          <FiltruMulti
            eticheta="Localități" toate="Toate localitățile" selectat={localitateFilter} onChange={setLocalitateFilter}
            optiuni={localitati.map((l) => ({ valoare: l, eticheta: l }))}
          />
          <FiltruMulti
            eticheta="Calitate" toate="Toate calitățile" selectat={calitateFilter} onChange={setCalitateFilter}
            optiuni={Object.entries(IMPLICARE_CULORI).map(([k, c]) => ({ valoare: k, eticheta: k, culoare: c }))}
          />
          {(tipFilter.size > 0 || statusFilter.size > 0 || localitateFilter.size > 0 || calitateFilter.size > 0) && (
            <button
              type="button"
              onClick={() => { setTipFilter(new Set()); setStatusFilter(new Set()); setLocalitateFilter(new Set()); setCalitateFilter(new Set()) }}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#22406B] hover:bg-slate-100"
            >
              Șterge toate filtrele
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Se încarcă...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="mb-4 flex items-center justify-between">
                <button onClick={() => schimbaLuna(-1)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
                  <ChevronLeft size={18} />
                </button>
                <p className="font-display text-base font-semibold text-slate-800">
                  {LUNI[lunaCurenta.getMonth()]} {lunaCurenta.getFullYear()}
                </p>
                <button onClick={() => schimbaLuna(1)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[11px] font-medium uppercase text-slate-400">
                {ZILE_SAPT.map((z) => (
                  <div key={z}>{z}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {zileGrila.map((zi) => {
                  const dataStr = ymd(zi)
                  const inLuna = zi.getMonth() === lunaCurenta.getMonth()
                  const evZi = evenimenteByDate[dataStr] || []
                  const esteAzi = dataStr === azi
                  const esteSelectata = dataStr === ziuaSelectata

                  const evMultiZi = evZi.find((e) => e.data_sfarsit && e.data_sfarsit > e.data)
                  const culoareInterval = evMultiZi ? tipDupaCod[evMultiZi.tipuri[0]]?.culoare || CULOARE_NECUNOSCUT : null

                  const tipurileZilei = [...new Set(evZi.flatMap((e) => (e.tipuri.length ? e.tipuri : ['__fara_tip__'])))]

                  return (
                    <button
                      key={dataStr}
                      onClick={() => setZiuaSelectata(esteSelectata ? null : dataStr)}
                      style={evMultiZi && !esteSelectata ? { backgroundColor: `${culoareInterval}1f` } : undefined}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-start pt-1.5 text-sm transition ${
                        !inLuna ? 'text-slate-300' : 'text-slate-700'
                      } ${esteSelectata ? 'bg-accent text-white' : esteAzi ? 'bg-accent/10 text-accent font-semibold' : 'hover:bg-slate-50'}`}
                    >
                      {zi.getDate()}
                      {tipurileZilei.length > 0 && (
                        <div className="mt-1 flex flex-col items-center gap-0.5 w-full px-1">
                          {tipurileZilei.slice(0, 2).map((cod) => {
                            if (cod === '__fara_tip__') {
                              return <span key={cod} className={`h-1.5 w-1.5 rounded-full ${esteSelectata ? 'bg-white' : 'bg-slate-400'}`} />
                            }
                            const t = tipDupaCod[cod]
                            const c = t?.culoare || CULOARE_NECUNOSCUT
                            return (
                              <span
                                key={cod}
                                className="w-full truncate rounded text-[9px] font-semibold leading-tight px-0.5"
                                style={{
                                  backgroundColor: esteSelectata ? 'rgba(255,255,255,0.25)' : `${c}22`,
                                  color: esteSelectata ? '#fff' : culoareText(c),
                                }}
                              >
                                {initiale(t?.nume || cod)}
                              </span>
                            )
                          })}
                          {tipurileZilei.length > 2 && (
                            <span className={`text-[9px] ${esteSelectata ? 'text-white/80' : 'text-slate-400'}`}>
                              +{tipurileZilei.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-slate-800">
                  {ziuaSelectata ? formatData(ziuaSelectata) : cardFiltru ? `${caracteristiciCard[cardFiltru].nume}${cardFiltru === 'definalizat' ? '' : ` · ${LUNI[lunaCurenta.getMonth()].toLowerCase()}`}` : `Evenimentele lunii ${LUNI[lunaCurenta.getMonth()].toLowerCase()}`}
                </p>
                {ziuaSelectata && (
                  <button onClick={() => setZiuaSelectata(null)} className="text-xs text-accent hover:underline">
                    Vezi toată luna
                  </button>
                )}
              </div>

              {evenimenteAfisate.length === 0 ? (
                <p className="text-sm text-slate-400">{cardFiltru ? 'Niciun eveniment pentru acest filtru.' : 'Niciun eveniment.'}</p>
              ) : (
                <div className="space-y-2">
                  {evenimenteAfisate.map((e) => {
                    const status = statusDupaCod[e.status]
                    const anulat = status?.comportament === 'anulat'
                    const implC = e.implicare ? IMPLICARE_CULORI[e.implicare] || CULOARE_NECUNOSCUT : null
                    const ora = formatOra(e)
                    const pmNume = e.pm.map((id) => numeAngajat[id]).filter(Boolean)
                    return (
                      <div key={e.id} className={`rounded-xl border border-slate-100 p-3 ${anulat ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm font-medium text-slate-800 truncate ${anulat ? 'line-through' : ''}`}>{e.nume}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatData(e.data)}
                              {e.data_sfarsit && e.data_sfarsit !== e.data ? ` – ${formatData(e.data_sfarsit)}` : ''}
                              {ora ? ` · ${ora}` : ''}
                              {e.locatie ? ` · ${e.locatie}` : ''}
                              {e.localitate ? ` · ${e.localitate}${e.judet && e.judet !== e.localitate && e.judet !== 'În afara României' ? `, ${e.judet}` : ''}` : ''}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
                              {pmNume.length > 0 ? (
                                <span className="text-slate-400">PM: <span className="text-slate-600">{pmNume.join(', ')}</span></span>
                              ) : (
                                !anulat && <span className="rounded-full border border-dashed border-amber-500 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">Fără PM</span>
                              )}
                              {canManageCalendar && !anulat && (
                                <button type="button" onClick={() => setPmDeschis(pmDeschis === e.id ? null : e.id)} className="rounded-full px-2 py-0.5 font-semibold text-accent hover:bg-accent/10">
                                  {pmNume.length > 0 ? 'Schimbă PM' : '+ Alocă PM'}
                                </button>
                              )}
                              {e.organizator && <span className="text-slate-400">{pmNume.length > 0 || !anulat ? '· ' : ''}Organizator: {e.organizator}</span>}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {status && poateSchimbaStatus(e) ? (
                              <select
                                value={e.status}
                                onChange={(ev) => cereStatus(e, ev.target.value)}
                                aria-label={`Status: ${e.nume}`}
                                title="Schimbă statusul"
                                className="cursor-pointer rounded-full border-0 py-0.5 pl-2 pr-1 text-[11px] font-semibold"
                                style={{ backgroundColor: `${status.culoare}26`, color: culoareText(status.culoare) }}
                              >
                                {statusuri.map((s) => <option key={s.cod} value={s.cod}>{s.nume}</option>)}
                              </select>
                            ) : (
                              status && <Chip c={status.culoare}>{status.nume}</Chip>
                            )}
                            {implC && <Chip c={implC}>{e.implicare}</Chip>}
                          </div>
                        </div>

                        {confirmStatus?.id === e.id && (
                          <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                            <p>
                              {statusDupaCod[confirmStatus.status]?.comportament === 'anulat'
                                ? `Marchezi „${e.nume}" ca ${statusDupaCod[confirmStatus.status]?.nume}? Invitațiile și taskurile evenimentului vor fi înghețate.`
                                : `Marchezi „${e.nume}" ca ${statusDupaCod[confirmStatus.status]?.nume}? Evenimentul poate primi apoi raport post-eveniment.`}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button type="button" onClick={() => schimbaStatus(e, confirmStatus.status)} className="rounded-lg bg-accent px-3 py-1 font-semibold text-white hover:bg-accent-hover">Confirmă</button>
                              <button type="button" onClick={() => setConfirmStatus(null)} className="rounded-lg px-3 py-1 font-semibold text-accent hover:bg-white">Renunță</button>
                            </div>
                          </div>
                        )}
                        {eroareCard?.id === e.id && <p className="mt-2 text-xs text-rose-600">{eroareCard.msg}</p>}
                        {pmDeschis === e.id && canManageCalendar && (
                          <div className="mt-2 rounded-lg bg-slate-50 p-2.5">
                            <p className="mb-1.5 text-xs font-medium text-slate-600">PM / coordonator eveniment</p>
                            <AngajatiPicker angajati={angajati} valoare={e.pm} onChange={(v) => salveazaPm(e, v)} placeholder="Caută un coleg…" />
                            <button type="button" onClick={() => setPmDeschis(null)} className="mt-2 text-xs font-semibold text-accent hover:underline">Gata</button>
                          </div>
                        )}

                        {e.tipuri.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {e.tipuri.map((cod) => {
                              const t = tipDupaCod[cod]
                              const c = t?.culoare || CULOARE_NECUNOSCUT
                              return (
                                <span key={cod} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${c}22`, color: culoareText(c) }}>
                                  {t?.nume || cod}
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {canManageCalendar && (
                          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                            <label className="flex items-center gap-1.5">
                              <input type="checkbox" checked={e.necesita_rsvp} disabled={anulat} onChange={(ev) => toggleFlag(e.id, 'necesita_rsvp', ev.target.checked)} />
                              RSVP
                            </label>
                            <label className="flex items-center gap-1.5">
                              <input type="checkbox" checked={e.necesita_costume} disabled={anulat} onChange={(ev) => toggleFlag(e.id, 'necesita_costume', ev.target.checked)} />
                              Costume
                            </label>
                            <button onClick={() => setFormDeschis(e)} className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-accent hover:bg-accent/10">
                              <Pencil size={12} /> Editează
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {formDeschis && (
        <EvenimentForm
          eveniment={formDeschis === 'nou' ? null : formDeschis}
          tipuri={tipuri}
          statusuri={statusuri}
          angajati={angajati}
          onClose={() => setFormDeschis(null)}
          onSaved={dupaSalvare}
        />
      )}

      {decalare && ctxTaskuri && <DecalareTermene ctx={ctxTaskuri} info={decalare} onClose={() => setDecalare(null)} />}

      {showStatistici && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 sm:p-6" onClick={() => setShowStatistici(false)}>
          <div role="dialog" aria-modal="true" aria-label="Statistici evenimente" className="max-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-y-auto rounded-2xl bg-[#F6F8FB] shadow-xl sm:max-h-[calc(100vh-3rem)]" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-slate-200 bg-white px-5 py-3">
              <h2 className="text-lg font-semibold text-slate-800">Statistici evenimente</h2>
              <button type="button" onClick={() => setShowStatistici(false)} aria-label="Închide" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <StatisticiEvenimente />
          </div>
        </div>
      )}

      {showListe && (
        <ListeEvenimente tipuri={tipuri} statusuri={statusuri} evenimente={evenimente} onClose={() => setShowListe(false)} onChanged={load} />
      )}

    </div>
  )
}
