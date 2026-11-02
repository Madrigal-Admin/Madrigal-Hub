// Lista tool-urilor și categoriile Ghidului — un singur loc, folosit de antetul comun al TUTUROR aplicațiilor.
// (Conținutul Ghidului rămâne în Hub; aici sunt doar cheile și etichetele din meniu. Cheile trebuie să
// coincidă cu hub-app/src/components/ghid/categorii.js.)

export const GHID = [
  { key: 'despre', label: 'Despre Madrigal' },
  { key: 'echipa', label: 'Echipa Madrigal' },
  { key: 'info', label: 'Informații utile' },
  { key: 'documente', label: 'Ghid Resurse Umane' },
]

// accesTooluri: rândurile din tabelul acces_tooluri ale angajatului ([{ tool, rol }]).
// `view` = pagină din interiorul Hub-ului (în Hub se deschide fără reîncărcare).
export function construiesteTooluri(accesTooluri = []) {
  const are = (tool) => accesTooluri.some((a) => a.tool === tool)
  const hubAdmin = accesTooluri.some((a) => a.tool === 'hub' && a.rol === 'admin')
  return [
    { key: 'calendar', label: 'Calendar', icon: 'calendar', href: '/?view=calendar', view: 'calendar' },
    are('hr') && { key: 'hr', label: 'Resurse Umane', icon: 'users', href: '/HR/' },
    are('invitatii') && { key: 'invitatii', label: 'Invitații & RSVP', icon: 'mail', href: '/invitatii/' },
    are('administrativ') && { key: 'administrativ', label: 'Administrativ', icon: 'package', href: '/administrativ/' },
    are('rapoarte') && { key: 'rapoarte', label: 'Rapoarte', icon: 'file', href: '/rapoarte/' },
    are('financiar') && { key: 'financiar', label: 'Financiar', icon: 'receipt', href: '/financiar/' },
    hubAdmin && { key: 'admin', label: 'Administrare Hub', icon: 'settings', href: '/?view=admin', view: 'admin' },
  ].filter(Boolean)
}
