const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', roles: ['full'] },
  { key: 'evenimente', label: 'Evenimente', roles: ['full'] },
  { key: 'persoane', label: 'Persoane', roles: ['full'] },
  { key: 'checkin', label: 'Check-in', roles: ['full', 'checkin'] },
  { key: 'aprobari', label: 'Aprobări', roles: ['full'], badge: true },
  { key: 'setari', label: 'Setări', roles: ['full'] },
  { key: 'solicita', label: 'Solicită invitații', roles: ['checkin'] },
]

export default function Sidebar({ view, onSelect, role, badgeAprobari = 0 }) {
  const sections = SECTIONS.filter((s) => s.roles.includes(role))

  return (
    <aside className="md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0">
      <nav className="flex md:flex-col overflow-x-auto p-3 gap-0.5" aria-label="Navigare Invitații">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => onSelect(s.key)}
            className={`flex items-center justify-between gap-2 text-left text-sm px-3 py-2 rounded-lg transition whitespace-nowrap ${
              view === s.key ? 'bg-[#e9eef6] text-accent font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {s.label}
            {s.badge && badgeAprobari > 0 && (
              <span className="rounded-full bg-accent px-2 py-px text-[11px] font-bold text-white">{badgeAprobari}</span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  )
}
