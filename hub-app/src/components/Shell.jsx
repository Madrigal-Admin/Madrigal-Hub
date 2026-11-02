import { LogOut } from 'lucide-react'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import GhidRouter from './ghid/GhidRouter'
import { BaraJos, RandTooluri } from './home/NavigareTooluri'

// Cadrul comun al tuturor paginilor din Hub: antetul și rândul de tool-uri rămân pe loc,
// iar doar conținutul de dedesubt se schimbă.
export default function Shell({ angajat, tooluri, view, onNavigate, onSignOut, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FB] text-[#172036]">
      <SiteHeader
        title="Hub Madrigal"
        right={
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[220px] truncate rounded-full bg-[#EEF1F6] px-3.5 py-2 text-[13px] font-semibold text-[#3A465C] sm:inline-block">{angajat.nume_complet}</span>
            <button onClick={onSignOut} aria-label="Deconectare" title="Deconectare" className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[#3A465C] hover:bg-slate-100 focus-ring">
              <LogOut size={20} />
            </button>
          </div>
        }
      />
      <RandTooluri tooluri={tooluri} view={view} onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col pb-20 sm:pb-0">{children}</div>
      <div className="hidden sm:block"><SiteFooter /></div>
      <BaraJos tooluri={tooluri} view={view} onNavigate={onNavigate} />
      <GhidRouter />
    </div>
  )
}
