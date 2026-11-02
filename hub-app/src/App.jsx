import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import AdminLayout from './components/AdminLayout'
import CalendarView from './components/CalendarView'
import Shell from './components/Shell'
import { construiesteTooluri } from '@shared/tooluri'
import { TaskuriProvider } from './components/taskuri/TaskuriContext'
import { PaginaDepartament, PaginaEvenimente, PaginaSetari } from './components/taskuri/Pagini'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = încă neverificat
  const [angajat, setAngajat] = useState(null)
  const [accesTooluri, setAccesTooluri] = useState([])
  const [view, setViewState] = useState(() => new URLSearchParams(window.location.search).get('view') || 'dashboard')
  const [loadingProfil, setLoadingProfil] = useState(true)

  // Navigare "reală" — fiecare schimbare de view se scrie în istoricul
  // browserului, ca butonul "Înapoi" să funcționeze intuitiv, nu să te
  // scoată din aplicație.
  function navigateTo(nextView) {
    setViewState(nextView)
    const url = nextView === 'dashboard' ? '/' : `/?view=${nextView}`
    window.history.pushState({ view: nextView }, '', url)
  }

  useEffect(() => {
    function onPopState() {
      const v = new URLSearchParams(window.location.search).get('view') || 'dashboard'
      setViewState(v)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Reîncărcăm profilul DOAR când se schimbă utilizatorul, nu la fiecare
  // reînnoire de token. Supabase emite evenimente de auth (SIGNED_IN /
  // TOKEN_REFRESHED) cu un obiect `session` nou de fiecare dată când
  // revii pe tab sau după câteva minute de inactivitate — dacă depindeam
  // de obiectul `session`, aplicația afișa ecranul "Se încarcă..." și
  // șterge tot ce era completat în formularele din Admin.
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) {
      setAngajat(null)
      setAccesTooluri([])
      setLoadingProfil(false)
      return
    }

    async function loadProfil() {
      setLoadingProfil(true)
      const { data: angajatData } = await supabase
        .from('angajati')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      setAngajat(angajatData)

      if (angajatData) {
        const { data: accesData } = await supabase
          .from('acces_tooluri')
          .select('tool, rol')
          .eq('angajat_id', angajatData.id)
        setAccesTooluri(accesData || [])
      }

      setLoadingProfil(false)
    }

    loadProfil()
  }, [userId])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigateTo('dashboard')
  }

  // Încă verificăm dacă există o sesiune salvată
  if (session === undefined || loadingProfil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">Se încarcă...</p>
      </div>
    )
  }

  if (!session) {
    return <Auth />
  }

  if (!angajat) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-sm">
          <p className="text-slate-800 font-medium mb-2">Cont neconfigurat</p>
          <p className="text-sm text-slate-500 mb-4">
            Contul tău e autentificat, dar nu e legat de niciun rând din lista de angajați.
            Contactează adminul.
          </p>
          <button
            onClick={handleSignOut}
            className="text-sm text-accent hover:underline"
          >
            Deconectare
          </button>
        </div>
      </div>
    )
  }

  const isHubAdmin = accesTooluri.some((a) => a.tool === 'hub' && a.rol === 'admin')
  const canManageCalendar = isHubAdmin || accesTooluri.some((a) => a.tool === 'calendar' && a.rol === 'admin')
  const canSeeStatistici = canManageCalendar || accesTooluri.some((a) => a.tool === 'calendar' && a.rol === 'statistici')
  const rolTaskuri = accesTooluri.find((a) => a.tool === 'taskuri')?.rol || null

  // Doar paginile la care ai voie; orice altceva te duce acasă.
  const permise = {
    dashboard: true,
    calendar: true,
    admin: isHubAdmin,
    evenimente: !!rolTaskuri,
    departament: !!rolTaskuri,
    setari: rolTaskuri === 'admin',
  }
  const viewEfectiv = permise[view] ? view : 'dashboard'

  const tooluri = construiesteTooluri(accesTooluri)

  return (
    <TaskuriProvider angajat={angajat} accesTooluri={accesTooluri}>
      <Shell angajat={angajat} tooluri={tooluri} view={viewEfectiv} onNavigate={navigateTo} onSignOut={handleSignOut}>
        {viewEfectiv === 'dashboard' && <Dashboard angajat={angajat} onNavigate={navigateTo} onOpenCalendar={() => navigateTo('calendar')} />}
        {viewEfectiv === 'calendar' && <CalendarView canManageCalendar={canManageCalendar} canSeeStatistici={canSeeStatistici} />}
        {viewEfectiv === 'admin' && <AdminLayout />}
        {viewEfectiv === 'evenimente' && <PaginaEvenimente />}
        {viewEfectiv === 'departament' && <PaginaDepartament />}
        {viewEfectiv === 'setari' && <PaginaSetari />}
      </Shell>
    </TaskuriProvider>
  )
}
