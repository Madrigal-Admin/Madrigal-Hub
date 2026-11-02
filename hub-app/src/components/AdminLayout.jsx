import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import AdminAngajati from './AdminAngajati'
import AdminAccesTooluri from './AdminAccesTooluri'
import AdminDepartamenteFunctii from './AdminDepartamenteFunctii'
import AdminZileLibere from './AdminZileLibere'
import AdminGhidEchipa from './AdminGhidEchipa'
import AdminGhidDespre from './AdminGhidDespre'
import AdminGhidAcordeon from './AdminGhidAcordeon'

// Meniul din stânga: o intrare simplă sau un grup care se deschide/închide.
const MENU = [
  { key: 'acces', label: 'Acces Tool-uri', bold: true },
  {
    grup: 'resurse-umane',
    label: 'Resurse Umane',
    items: [
      { key: 'angajati', label: 'Angajați' },
      { key: 'departamente', label: 'Departamente & Funcții' },
      { key: 'zile-libere', label: 'Zile libere legale' },
    ],
  },
  {
    grup: 'ghid',
    label: 'Editează Ghidul Angajatului',
    items: [
      { key: 'ghid-despre', label: 'Despre Madrigal' },
      { key: 'ghid-echipa', label: 'Echipa' },
      { key: 'ghid-info-utile', label: 'Informații utile' },
      { key: 'ghid-info-ru', label: 'Resurse Umane' },
    ],
  },
]

export default function AdminLayout() {
  const [active, setActive] = useState('acces')
  const [deschise, setDeschise] = useState({ 'resurse-umane': false, ghid: false })
  const toggle = (g) => setDeschise((d) => ({ ...d, [g]: !d[g] }))

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <aside className="md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0">
          <nav className="flex md:flex-col overflow-x-auto p-2 gap-1">
            {MENU.map((m) => {
              if (!m.grup) {
                return (
                  <button
                    key={m.key}
                    onClick={() => setActive(m.key)}
                    className={`text-left text-sm px-3 py-2 rounded-lg transition whitespace-nowrap font-semibold ${
                      active === m.key ? 'bg-accent/10 text-accent' : 'text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {m.label}
                  </button>
                )
              }
              const contineActiv = m.items.some((i) => i.key === active)
              const deschis = deschise[m.grup] || contineActiv
              return (
                <div key={m.grup} className="flex flex-col gap-1">
                  <button
                    onClick={() => toggle(m.grup)}
                    className={`flex w-full items-center justify-between gap-2 text-left text-sm px-3 py-2 rounded-lg transition whitespace-nowrap font-medium ${
                      contineActiv ? 'text-accent' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {m.label}
                    {deschis ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {deschis &&
                    m.items.map((i) => (
                      <button
                        key={i.key}
                        onClick={() => setActive(i.key)}
                        className={`md:ml-3 text-left text-sm px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                          active === i.key
                            ? 'bg-accent/10 text-accent font-medium'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {i.label}
                      </button>
                    ))}
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-8 min-w-0">
          {active === 'angajati' && <AdminAngajati />}
          {active === 'acces' && <AdminAccesTooluri />}
          {active === 'departamente' && <AdminDepartamenteFunctii />}
          {active === 'zile-libere' && <AdminZileLibere />}
          {active === 'ghid-despre' && <AdminGhidDespre />}
          {active === 'ghid-echipa' && <AdminGhidEchipa />}
          {active === 'ghid-info-utile' && (
            <AdminGhidAcordeon
              tabel="ghid_intrebari"
              titluSectiune="Ghidul angajatului — Informații utile"
              descriere='Intrări grupate pe subiect, cu titlu, text formatat și, opțional, un link SAU un fișier de descărcat (ex: linkuri către grupuri WhatsApp, documente utile).'
            />
          )}
          {active === 'ghid-info-ru' && (
            <AdminGhidAcordeon
              tabel="ghid_info_resurse_umane"
              titluSectiune="Ghidul angajatului — Ghid Resurse Umane"
              descriere="Aceeași structură ca la Informații utile: subiect, titlu, text formatat și, opțional, un link SAU un fișier de descărcat."
            />
          )}
        </main>
      </div>

    </div>
  )
}
