import { Home } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import PublicRequestForm from './components/PublicRequestForm'
import CertificateRequestForm from './components/CertificateRequestForm'
import AdminDashboard from './components/AdminDashboard'
import EmployeeDashboard from './components/EmployeeDashboard'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = încă se verifică
  const [role, setRole] = useState(null) // 'full_admin' | 'limited_admin' | 'employee' | 'unknown' | null
  const [employee, setEmployee] = useState(null)
  const [view, setView] = useState('employee')
  const [checkingRole, setCheckingRole] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Rolul se (re)calculează DOAR când se schimbă utilizatorul, nu la
  // fiecare reînnoire de token: Supabase emite un obiect `session` nou la
  // revenirea pe tab / după inactivitate, iar dacă depindeam de el,
  // aplicația reafișa ecranul de încărcare și pierdea datele nesalvate.
  const userId = session === undefined ? undefined : session?.user?.id ?? null

  useEffect(() => {
    if (userId === undefined) return // sesiunea încă nu s-a determinat

    if (!userId) {
      // Fără sesiune activă → HR-ul nu are ecran de login propriu, se
      // bazează exclusiv pe sesiunea partajată cu Hub-ul.
      window.location.href = '/'
      return
    }

    resolveRole(session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function resolveRole(session) {
    setCheckingRole(true)
    const uid = session.user.id

    // Legătura angajat ↔ cont se face prin angajati.user_id (populat de Hub
    // la înregistrare) — nu mai există pasul de "leagă contul prin email".
    const { data: angajatRow } = await supabase
      .from('angajati')
      .select('*, department:departments(name), position:positions(name), hr_profil_angajat(*), hr_contracte(*, attribution:attributions(name))')
      .eq('user_id', uid)
      .maybeSingle()

    if (!angajatRow) {
      setRole('unknown')
      setEmployee(null)
      setCheckingRole(false)
      return
    }

    const { data: accesRow } = await supabase
      .from('acces_tooluri')
      .select('rol')
      .eq('angajat_id', angajatRow.id)
      .eq('tool', 'hr')
      .maybeSingle()

    const rol = accesRow?.rol
    const resolvedRole = rol === 'full' ? 'full_admin' : rol === 'operational' ? 'limited_admin' : 'employee'

    setRole(resolvedRole)
    setEmployee(angajatRow)
    setView(resolvedRole === 'full_admin' || resolvedRole === 'limited_admin' ? 'admin' : 'employee')
    setCheckingRole(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const isAdmin = role === 'full_admin' || role === 'limited_admin'
  // Un admin care e și angajat trebuie să poată depune propriile cereri,
  // ca oricare alt angajat.
  const hasEmployeeAccess = role === 'employee' || (isAdmin && !!employee)
  const roleLabel =
    role === 'full_admin' ? 'HR Admin' : role === 'limited_admin' ? 'HR Operational' : role === 'employee' ? 'Angajat' : null
  const displayName = employee?.nume_complet || session?.user?.email || null

  if (!session) {
    return <p className="mx-auto max-w-5xl px-5 py-10 text-sm text-slate-500">Se redirecționează…</p>
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar displayName={displayName} roleLabel={roleLabel} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {isAdmin && <Sidebar view={view} onSelect={setView} />}

        <main className="flex-1 p-6 md:p-8 min-w-0">
          <a href="/" className="hub-back mb-4">
            <Home size={15} />
            Acasă
          </a>
          <div className="w-full">
            {checkingRole && <p className="text-sm text-slate-500">Se verifică contul…</p>}

            {!checkingRole && role === 'unknown' && (
              <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
                Contul tău este autentificat, dar nu este asociat niciunui angajat din Hub. Contactează
                un administrator ca să îți verifice contul.
              </div>
            )}

            {hasEmployeeAccess && view === 'leave' && employee && <PublicRequestForm employee={employee} />}
            {hasEmployeeAccess && view === 'certificate' && employee && <CertificateRequestForm employee={employee} />}

            {isAdmin && view === 'admin' && <AdminDashboard role={role} />}
            {hasEmployeeAccess && view === 'employee' && employee && (
              <EmployeeDashboard employee={employee} onNavigate={setView} />
            )}
          </div>
        </main>
      </div>

      <footer className="site-footer">
        <p>
          Probleme sau întrebări?{' '}
          <a href="mailto:digitalizare@madrigal.ro">digitalizare@madrigal.ro</a>
        </p>
      </footer>
    </div>
  )
}
