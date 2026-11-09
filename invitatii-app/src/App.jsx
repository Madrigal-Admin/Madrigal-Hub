import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import DashboardTab from './components/DashboardTab'
import EvenimenteTab from './components/EvenimenteTab'
import PersoaneTab from './components/PersoaneTab'
import CheckinTab from './components/CheckinTab'
import AprobariTab from './components/AprobariTab'
import SetariTab from './components/SetariTab'
import SolicitaTab from './components/SolicitaTab'
import RsvpPage from './pages/RsvpPage'
import DezabonarePage from './pages/DezabonarePage'

// full = Admin general; checkin = Verificare la intrare; angajat = implicit pentru orice angajat din Hub
const ROLE_LABELS = { full: 'Admin general', checkin: 'Verificare la intrare', angajat: 'Angajat' }

export default function App() {
  // ---- Pagini publice, fără login — verificate ÎNAINTE de orice logică
  // de autentificare, pe baza parametrilor din URL. ----
  const params = new URLSearchParams(window.location.search)
  if (params.has('rsvp')) return <RsvpPage token={params.get('rsvp')} />
  if (params.has('dezabonare')) return <DezabonarePage token={params.get('dezabonare')} />

  return <AdminApp />
}

const PAGINA_INITIALA = { full: 'dashboard', checkin: 'checkin', angajat: 'solicita' }

function AdminApp() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null)
  const [angajat, setAngajat] = useState(null)
  const [view, setView] = useState(null)
  const [nrAprobari, setNrAprobari] = useState(0)
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
    if (userId === undefined) return

    if (!userId) {
      window.location.href = '/'
      return
    }

    resolveRole(session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function resolveRole(session) {
    setCheckingRole(true)
    const { data: angajatRow } = await supabase
      .from('angajati')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (!angajatRow) {
      setRole('unknown')
      setCheckingRole(false)
      return
    }

    const { data: accesRow } = await supabase
      .from('acces_tooluri')
      .select('rol')
      .eq('angajat_id', angajatRow.id)
      .eq('tool', 'invitatii')
      .maybeSingle()

    // Orice angajat din Hub are cel puțin rolul „Angajat” (poate solicita invitații)
    const rol = accesRow?.rol === 'full' || accesRow?.rol === 'checkin' ? accesRow.rol : 'angajat'
    setAngajat(angajatRow)
    setRole(rol)
    setView(PAGINA_INITIALA[rol])
    setCheckingRole(false)
  }

  // Numărul cererilor în așteptare, pentru insigna din meniul adminului
  async function reincarcaAprobari() {
    const { count } = await supabase
      .from('cereri_invitati')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_asteptare')
    setNrAprobari(count || 0)
  }

  useEffect(() => {
    if (role === 'full') reincarcaAprobari()
  }, [role, view])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const displayName = angajat?.nume_complet || session?.user?.email || null

  if (!session || checkingRole) {
    return <p className="mx-auto max-w-5xl px-5 py-10 text-sm text-slate-500">Se încarcă…</p>
  }

  if (role === 'unknown') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar displayName={displayName} roleLabel={null} onLogout={handleLogout} />
        <main className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Contul tău nu este asociat unui angajat din Hub, așa că nu poți folosi Invitațiile. Contactează un
            administrator din Hub.
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar displayName={displayName} roleLabel={ROLE_LABELS[role]} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {role !== 'angajat' && <Sidebar view={view} onSelect={setView} role={role} badgeAprobari={nrAprobari} />}

        <main className="flex-1 p-6 md:p-8 min-w-0">
          <div className={role === 'angajat' ? 'mx-auto w-full max-w-3xl' : 'w-full'}>
            {view === 'dashboard' && role === 'full' && <DashboardTab />}
            {view === 'evenimente' && role === 'full' && (
              <EvenimenteTab session={session} onNavigate={setView} />
            )}
            {view === 'persoane' && role === 'full' && <PersoaneTab />}
            {view === 'checkin' && (role === 'full' || role === 'checkin') && <CheckinTab />}
            {view === 'aprobari' && role === 'full' && <AprobariTab onChanged={reincarcaAprobari} />}
            {view === 'setari' && role === 'full' && <SetariTab />}
            {view === 'solicita' && <SolicitaTab />}
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
