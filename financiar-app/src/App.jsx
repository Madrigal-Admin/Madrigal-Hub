import { Home } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './components/Navbar'
import Sidebar, { sectiuniPermise } from './components/Sidebar'
import ReferateLista from './components/ReferateLista'
import DeconturiLista from './components/DeconturiLista'
import ListePrestabilite from './components/ListePrestabilite'
import Setari from './components/Setari'
import Sabloane from './components/Sabloane'
import { ROLE_LABELS } from './lib/roluri'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null) // null = se verifică, 'none' = fără acces
  const [angajat, setAngajat] = useState(null)
  const [nav, setNav] = useState({ view: '', params: null })
  const [checkingRole, setCheckingRole] = useState(false)
  const [comune, setComune] = useState({ um: [], surse: [], setari: null, liste: [] })

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

  const incarcaComune = useCallback(async () => {
    const [um, surse, setari, liste] = await Promise.all([
      supabase.from('fin_um').select('*').order('ordine').order('denumire'),
      supabase.from('fin_surse').select('*').order('ordine').order('denumire'),
      supabase.from('fin_setari').select('*').eq('id', 1).maybeSingle(),
      supabase.from('fin_liste').select('*').order('denumire').order('valabil_de_la', { ascending: false }),
    ])
    setComune({ um: um.data || [], surse: surse.data || [], setari: setari.data || null, liste: liste.data || [] })
  }, [])

  async function resolveRole(s) {
    setCheckingRole(true)
    const { data: angajatRow } = await supabase.from('angajati').select('*').eq('user_id', s.user.id).maybeSingle()
    setAngajat(angajatRow || null)
    const { data: rol } = await supabase.rpc('fin_rol')
    const r = rol || 'none'
    setRole(r)
    if (r !== 'none') {
      await incarcaComune()
      setNav({ view: sectiuniPermise(r)[0]?.key || '', params: null })
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
        <Navbar displayName={displayName} roleLabel={null} onLogout={handleLogout} />
        <main className="flex flex-1 flex-col items-center justify-center px-4">
          <a href="/" className="hub-back mb-4">
            <Home size={15} />
            Acasă
          </a>
          <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Contul tău nu are acces la tool-ul Financiar. Contactează un administrator din Hub, în secțiunea „Acces Tool-uri".
          </div>
        </main>
      </div>
    )
  }

  const { view, params } = nav
  const comun = { role, angajat, comune, go }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar displayName={displayName} roleLabel={ROLE_LABELS[role]} onLogout={handleLogout} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Sidebar view={view} onSelect={(v) => go(v)} role={role} />
        <main className="min-w-0 flex-1 p-6 md:p-8">
          <a href="/" className="hub-back mb-4">
            <Home size={15} />
            Acasă
          </a>
          <div className="w-full">
            {view === 'referate' && <ReferateLista key={JSON.stringify(params)} {...comun} params={params} />}
            {view === 'deconturi' && <DeconturiLista key={JSON.stringify(params)} {...comun} params={params} />}
            {view === 'liste' && <ListePrestabilite comune={comune} reload={incarcaComune} />}
            {view === 'setari' && <Setari comune={comune} reload={incarcaComune} />}
            {view === 'sabloane' && <Sabloane />}
          </div>
        </main>
      </div>
      <footer className="site-footer">
        <p>Probleme sau întrebări? <a href="mailto:digitalizare@madrigal.ro">digitalizare@madrigal.ro</a></p>
      </footer>
    </div>
  )
}
