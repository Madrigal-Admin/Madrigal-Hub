import { useState } from 'react'
import { BarChart3, BookOpen, CalendarDays, ChevronDown, FileText, Home, LayoutGrid, Mail, Package, Receipt, Settings, Users, X as XIcon } from 'lucide-react'
import { CATEGORII_GHID } from '../ghid/categorii'
import { deschideGhid } from '../ghid/GhidRouter'

// Lista tool-urilor din rândul „Tool-uri". Apar doar cele la care ai acces.
export function construiesteTooluri({ accesSet, canSeeStatistici, isHubAdmin, onOpenCalendar, onOpenStatistici, onOpenAdmin }) {
  return [
    { key: 'calendar', label: 'Calendar', icon: CalendarDays, onClick: onOpenCalendar, view: 'calendar' },
    accesSet.has('hr') && { key: 'hr', label: 'Resurse Umane', icon: Users, href: '/HR/' },
    accesSet.has('invitatii') && { key: 'invitatii', label: 'Invitații & RSVP', icon: Mail, href: '/invitatii/' },
    accesSet.has('administrativ') && { key: 'administrativ', label: 'Administrativ', icon: Package, href: '/administrativ/' },
    accesSet.has('rapoarte') && { key: 'rapoarte', label: 'Rapoarte', icon: FileText, href: '/rapoarte/' },
    accesSet.has('financiar') && { key: 'financiar', label: 'Financiar', icon: Receipt, href: '/financiar/' },
    canSeeStatistici && { key: 'statistici', label: 'Statistici evenimente', icon: BarChart3, onClick: onOpenStatistici, view: 'statistici' },
    isHubAdmin && { key: 'admin', label: 'Administrare Hub', icon: Settings, onClick: onOpenAdmin, view: 'admin' },
  ].filter(Boolean)
}

const pilula = (activ) =>
  `inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-sm font-semibold no-underline focus-ring ${
    activ ? 'border-accent bg-accent text-white' : 'border-[#E1E4EA] bg-white text-accent hover:bg-[#F6F8FB]'
  }`

function Element({ t, className, onDone, activ }) {
  const Icon = t.icon
  const continut = (
    <>
      <Icon size={18} aria-hidden="true" />
      {t.label}
    </>
  )
  return t.href ? (
    <a href={t.href} className={className}>{continut}</a>
  ) : (
    <button type="button" className={className} aria-current={activ ? 'page' : undefined} onClick={() => { onDone?.(); t.onClick() }}>{continut}</button>
  )
}

// Meniul „Ghidul angajatului": cele 4 categorii existente, nemodificate.
function MeniuGhid({ className = '' }) {
  const [deschis, setDeschis] = useState(false)
  return (
    <div className={`relative ${className}`}>
      <button type="button" onClick={() => setDeschis((d) => !d)} aria-expanded={deschis} className="inline-flex min-h-[44px] items-center gap-2 px-2 text-sm font-semibold text-accent hover:underline focus-ring">
        <BookOpen size={18} aria-hidden="true" /> Ghidul angajatului <ChevronDown size={14} aria-hidden="true" />
      </button>
      {deschis && (
        <div className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border border-[#E1E4EA] bg-white shadow-lg">
          {CATEGORII_GHID.map((c) => {
            const Icon = c.icon
            return (
              <button key={c.key} type="button" onClick={() => { setDeschis(false); deschideGhid(c.key) }} className="flex min-h-[44px] w-full items-center gap-2.5 px-4 text-left text-sm font-medium text-[#172036] hover:bg-[#F6F8FB]">
                <Icon size={16} className="text-[#5B6578]" /> {c.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Desktop: rândul compact de sub antet. „Acasă" e mereu primul.
export function RandTooluri({ tooluri, view, onNavigate }) {
  return (
    <nav aria-label="Tool-uri" className="hidden border-b border-[#E1E4EA] bg-white px-8 py-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
      <button type="button" onClick={() => onNavigate('dashboard')} aria-current={view === 'dashboard' ? 'page' : undefined} className={pilula(view === 'dashboard')}>
        <Home size={18} aria-hidden="true" /> Acasă
      </button>
      <span className="mx-1.5 h-6 w-px bg-[#E1E4EA]" aria-hidden="true" />
      <span className="mr-1.5 text-xs font-bold uppercase tracking-wider text-[#5B6578]">Tool-uri</span>
      {tooluri.map((t) => (
        <Element key={t.key} t={t} activ={t.view === view} className={pilula(t.view === view)} />
      ))}
      <div className="flex-1" />
      <MeniuGhid />
    </nav>
  )
}

// Telefon: bara de jos + foaia „Tool-uri"
export function BaraJos({ tooluri, view, onNavigate }) {
  const [foaie, setFoaie] = useState(false)
  const item = 'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-[#5B6578] no-underline'
  return (
    <>
      <nav aria-label="Navigare" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[#E1E4EA] bg-white px-2 pb-2.5 pt-1.5 sm:hidden">
        <button type="button" onClick={() => onNavigate('dashboard')} className={`${item} ${view === 'dashboard' ? '!font-bold !text-accent' : ''}`}><Home size={22} aria-hidden="true" />Acasă</button>
        <button type="button" onClick={() => onNavigate('calendar')} className={`${item} ${view === 'calendar' ? '!font-bold !text-accent' : ''}`}><CalendarDays size={22} aria-hidden="true" />Calendar</button>
        <button type="button" onClick={() => setFoaie(true)} className={item}><LayoutGrid size={22} aria-hidden="true" />Tool-uri</button>
      </nav>
      {foaie && (
        <div className="fixed inset-0 z-40 flex items-end bg-[#172036]/45 sm:hidden" onClick={() => setFoaie(false)}>
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Tool-uri</h2>
              <button type="button" onClick={() => setFoaie(false)} aria-label="Închide" className="flex h-11 w-11 items-center justify-center rounded-lg text-[#3A465C]"><XIcon size={22} /></button>
            </div>
            <div className="flex flex-col gap-2">
              {tooluri.map((t) => (
                <Element key={t.key} t={t} onDone={() => setFoaie(false)} className="flex min-h-[48px] items-center gap-3 rounded-xl border border-[#E1E4EA] px-4 text-[15px] font-semibold text-accent no-underline" />
              ))}
            </div>
            <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-[#5B6578]">Ghidul angajatului</h3>
            <div className="flex flex-col gap-2">
              {CATEGORII_GHID.map((c) => {
                const Icon = c.icon
                return (
                  <button key={c.key} type="button" onClick={() => { setFoaie(false); deschideGhid(c.key) }} className="flex min-h-[48px] items-center gap-3 rounded-xl border border-[#E1E4EA] px-4 text-left text-[15px] font-medium">
                    <Icon size={18} className="text-[#5B6578]" /> {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
