import { useEffect, useMemo, useState } from 'react'
import { LogOut, ChevronLeft, ChevronRight, ArrowLeft, Settings, Plus, Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import EvenimentForm from './EvenimentForm'
import ListeEvenimente from './ListeEvenimente'
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

export default function CalendarView({ angajat, canManageCalendar, onBack, onSignOut }) {
  const [date, setDate] = useState({ evenimente: [], tipuri: [], statusuri: [], angajati: [] })
  const [eroare, setEroare] = useState('')
  const [loading, setLoading] = useState(true)
  const [tipFilter, setTipFilter] = useState(null) // null = toate; altfel Set<cod>
  const [statusFilter, setStatusFilter] = useState('')
  const [localitateFilter, setLocalitateFilter] = useState('')
  const [formDeschis, setFormDeschis] = useState(null) // null | 'nou' | eveniment
  const [showListe, setShowListe] = useState(false)
  const [lunaCurenta, setLunaCurenta] = useState(() => {
    const azi = new Date()
    return new Date(azi.getFullYear(), azi.getMonth(), 1)
  })
  const [ziuaSelectata, setZiuaSelectata] = useState(null)

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

  const tipuriActive = tipFilter === null ? new Set(tipuri.map((t) => t.cod)) : tipFilter

  function toggleTipFilter(cod) {
    setTipFilter((prev) => {
      const curent = prev === null ? new Set(tipuri.map((t) => t.cod)) : new Set(prev)
      if (curent.has(cod)) curent.delete(cod)
      else curent.add(cod)
      return curent
    })
  }

  async function toggleFlag(id, field, value) {
    setDate((prev) => ({ ...prev, evenimente: prev.evenimente.map((e) => (e.id === id ? { ...e, [field]: value } : e)) }))
    await supabase.from('evenimente').update({ [field]: value }).eq('id', id)
  }

  // Evenimentele fără niciun tip rămân mereu vizibile — filtrul de tip se aplică doar celor cu tip.
  const evenimenteVizibile = useMemo(
    () =>
      evenimente.filter(
        (e) =>
          (!e.tipuri.length || e.tipuri.some((c) => tipuriActive.has(c))) &&
          (!statusFilter || e.status === statusFilter) &&
          (!localitateFilter || (e.localitate || '').trim() === localitateFilter)
      ),
    [evenimente, tipuriActive, statusFilter, localitateFilter]
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

  const evenimenteAfisate = useMemo(() => {
    if (ziuaSelectata) return evenimenteByDate[ziuaSelectata] || []
    const prefix = `${lunaCurenta.getFullYear()}-${String(lunaCurenta.getMonth() + 1).padStart(2, '0')}`
    return evenimenteVizibile.filter((e) => zileEveniment(e).some((z) => z.startsWith(prefix)))
  }, [ziuaSelectata, evenimenteByDate, evenimenteVizibile, lunaCurenta])

  function schimbaLuna(delta) {
    setLunaCurenta((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
    setZiuaSelectata(null)
  }

  function dupaSalvare() {
    setFormDeschis(null)
    load()
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SiteHeader
        title="Calendar Evenimente"
        right={
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[220px] truncate rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 sm:inline-block">
              {angajat.nume_complet}
            </span>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-100 focus-ring transition"
              title="Deconectare"
            >
              <LogOut size={15} />
            </button>
          </div>
        }
      />

      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        <button type="button" onClick={onBack} className="hub-back mb-4">
          <ArrowLeft size={15} />
          Înapoi la Hub
        </button>

        {eroare && <p className="mb-4 text-sm text-rose-600">{eroare}</p>}

        {canManageCalendar && (
          <div className="mb-5 flex flex-wrap items-center gap-3 bg-white rounded-xl shadow-sm p-4">
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
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-2 bg-white rounded-xl shadow-sm p-3">
          <span className="text-xs font-medium text-slate-500 mr-1">Tipuri:</span>
          {tipuri
            .filter((t) => t.activ || evenimente.some((e) => e.tipuri.includes(t.cod)))
            .map((t) => {
              const activ = tipuriActive.has(t.cod)
              return (
                <button
                  key={t.cod}
                  onClick={() => toggleTipFilter(t.cod)}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition"
                  style={{ backgroundColor: activ ? `${t.culoare}22` : '#f1f5f9', color: activ ? culoareText(t.culoare) : '#94a3b8' }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activ ? t.culoare : '#cbd5e1' }} />
                  {t.nume}
                </button>
              )
            })}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
              aria-label="Filtru status"
            >
              <option value="">Toate statusurile</option>
              {statusuri.map((s) => (
                <option key={s.cod} value={s.cod}>{s.nume}</option>
              ))}
            </select>
            <select
              value={localitateFilter}
              onChange={(e) => setLocalitateFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
              aria-label="Filtru localitate"
            >
              <option value="">Toate localitățile</option>
              {localitati.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
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
                  {ziuaSelectata ? formatData(ziuaSelectata) : `Evenimentele lunii ${LUNI[lunaCurenta.getMonth()].toLowerCase()}`}
                </p>
                {ziuaSelectata && (
                  <button onClick={() => setZiuaSelectata(null)} className="text-xs text-accent hover:underline">
                    Vezi toată luna
                  </button>
                )}
              </div>

              {evenimenteAfisate.length === 0 ? (
                <p className="text-sm text-slate-400">Niciun eveniment.</p>
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
                              {e.localitate ? ` · ${e.localitate}` : ''}
                            </p>
                            {(pmNume.length > 0 || e.organizator) && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {pmNume.length > 0 && `PM: ${pmNume.join(', ')}`}
                                {pmNume.length > 0 && e.organizator ? ' · ' : ''}
                                {e.organizator && `Organizator: ${e.organizator}`}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {status && <Chip c={status.culoare}>{status.nume}</Chip>}
                            {implC && <Chip c={implC}>{e.implicare}</Chip>}
                          </div>
                        </div>

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

      {showListe && (
        <ListeEvenimente tipuri={tipuri} statusuri={statusuri} evenimente={evenimente} onClose={() => setShowListe(false)} onChanged={load} />
      )}

      <SiteFooter />
    </div>
  )
}
