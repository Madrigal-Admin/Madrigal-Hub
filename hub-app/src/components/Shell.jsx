import HubHeader from '@shared/HubHeader'
import SiteFooter from './SiteFooter'
import GhidRouter, { deschideGhid } from './ghid/GhidRouter'

// Cadrul comun al paginilor din Hub: antetul (același ca în toate tool-urile) rămâne pe loc,
// iar doar conținutul de dedesubt se schimbă.
export default function Shell({ angajat, tooluri, view, onNavigate, onSignOut, children }) {
  // „Acasă" e pagina de start; celelalte pagini din Hub (calendar, administrare) au câte un buton în listă.
  const activ = view === 'dashboard' || !tooluri.some((t) => t.view === view) ? 'acasa' : tooluri.find((t) => t.view === view).key
  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FB] text-[#172036]">
      <HubHeader nume={angajat.nume_complet} tooluri={tooluri} activ={activ} onNavigate={onNavigate} onGhid={deschideGhid} onSignOut={onSignOut} />
      <div className="flex flex-1 flex-col">{children}</div>
      <div className="hidden sm:block"><SiteFooter /></div>
      <GhidRouter />
    </div>
  )
}
