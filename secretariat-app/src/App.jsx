import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './components/Navbar'
import Sidebar, { sectiuniPermise } from './components/Sidebar'
import Registru from './components/Registru'
import Contacte from './components/Contacte'
import Setari from './components/Setari'
import ComingSoon from './components/ComingSoon'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null) // null = se verifică, 'none' = fără acces
  const [angajat, setAngajat] = useState(null)
  const [nav, setNav] = useState({ view: '', params: null })
  const [checkingRole, setCheckingRole] = useState(false)
  const [comune, setComune] = useState({ angajati: [], grupuri: [], tipuri: [], canale: [] })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

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

  // Listele folosite în formulare și filtre (angajați, departamente, tipuri, canale)
  const incarcaComune = useCallback(async () => {
    const [ang, grp, tip, can] = await Promise.all([
      supabase.from('angajati').select('id, nume_complet, activ').order('nume_complet'),
      supabase.rpc('sec_grupuri_lista'),
      supabase.from('sec_tipuri_document').select('*').order('ordine').order('denumire'),
      supabase.from('sec_canale').select('*').order('ordine').order('denumire'),
    ])
    setComune({
      angajati: ang.data || [],
      grupuri: grp.data || [],
      tipuri: tip.data || [],
      canale: can.data || [],
    })
  }, [])

  async function resolveRole(s) {
    setCheckingRole(true)
    const { data: angajatRow } = await supabase.from('angajati').select('*').eq('user_id', s.user.id).maybeSingle()
    setAngajat(angajatRow || null)
    const { data: rol } = await supabase.rpc('sec_rol')
    const r = rol || 'none'
    setRole(r)
    if (r !== 'none') {
      await incarcaComune()
      // Deschidere directă a unui document (pregătit pentru codul QR din Etapa 3): ?registru=intrari&id=...
      const q = new URLSearchParams(window.location.search)
      const reg = q.get('registru')
      const id = q.get('id')
      if ((reg === 'intrari' || reg === 'iesiri') && id) {
        setNav({ view: reg, params: { id } })
      } else {
        setNav({ view: sectiuniPermise(r)[0]?.key || '', params: null })
      }
    }
    setCheckingRole(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const go = (view, params = null) => setNav({ view, params })
  const displayName = angajat?.nume_complet || session?.user?.email || null

  if (!session || checkingRole || role === null) {
    return <p className="mx-auto max-w-5xl px-5 py-10 text-sm text-slate-500">Se încarcă…</p>
  }

  if (role === 'none') {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Navbar displayName={displayName} onLogout={handleLogout} />
        <main className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Contul tău nu are acces la tool-ul Secretariat. Contactează un administrator din Hub.
          </div>
        </main>
      </div>
    )
  }

  const { view, params } = nav
  const comun = { role, angajat, comune, go }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar displayName={displayName} onLogout={handleLogout} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Sidebar view={view} onSelect={(v) => go(v)} role={role} />
        <main className="min-w-0 flex-1 p-6 md:p-8">
          <div className="w-full">
            {(view === 'intrari' || view === 'iesiri') && (
              <Registru key={`${view}-${params?.id || ''}`} registru={view} params={params} {...comun} />
            )}
            {view === 'circuit' && <ComingSoon titlu="Circuit de semnare" />}
            {view === 'contacte' && <Contacte role={role} angajat={angajat} />}
            {view === 'setari' && <Setari role={role} comune={comune} reload={incarcaComune} />}
          </div>
        </main>
      </div>
      <footer className="site-footer">
        <p>Probleme sau întrebări? <a href="mailto:digitalizare@madrigal.ro">digitalizare@madrigal.ro</a></p>
      </footer>
    </div>
  )
}
