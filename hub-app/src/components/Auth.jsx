import { useState } from 'react'
import { supabase } from '../supabaseClient'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

// onStart / onAnuleaza / onIntra: App ține ecranul de autentificare afișat cât timp se creează contul, ca să nu apară
// „Cont neconfigurat" între conectare și legarea contului de fișa din lista de angajați.
export default function Auth({ onStart, onAnuleaza, onIntra }) {
  const [tab, setTab] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [succes, setSucces] = useState(null) // { nume } după ce contul a fost creat și legat

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (error) setError('Email sau parolă greșită.')
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    const cleanEmail = email.trim()

    // 1. Verificăm dacă emailul există în angajati (adăugat de admin)
    const { data: stare, error: lookupError } = await supabase.rpc('hub_stare_email', {
      p_email: cleanEmail,
    })

    if (lookupError || stare === 'nu_exista') {
      setLoading(false)
      setError(
        'Acest email nu a fost găsit în lista de angajați. Contactează adminul.'
      )
      return
    }

    if (stare === 'are_cont') {
      setLoading(false)
      setError('Există deja un cont pentru acest email. Folosește "Am cont".')
      return
    }

    // 2. Creăm contul de autentificare (în timpul ăsta App nu are voie să schimbe ecranul)
    onStart?.()
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    })

    if (signUpError) {
      setLoading(false)
      onAnuleaza?.()
      setError(signUpError.message)
      return
    }

    // 3. Legăm contul nou de rândul din angajati
    if (signUpData?.user) {
      await supabase
        .from('angajati')
        .update({ user_id: signUpData.user.id })
        .eq('email', cleanEmail)
    }

    // Fără sesiune (dacă proiectul ar cere confirmarea emailului): revenim la formularul de conectare.
    if (!signUpData?.session) {
      setLoading(false)
      onAnuleaza?.()
      setInfo('Cont creat cu succes! Te poți autentifica acum.')
      setTab('login')
      return
    }

    // 4. Verificăm că legarea a reușit (o singură reîncercare), ca să nu arătăm „succes" degeaba
    let fisa = null
    for (let incercare = 0; incercare < 2 && !fisa; incercare++) {
      if (incercare > 0) await new Promise((r) => setTimeout(r, 1000))
      const { data } = await supabase
        .from('angajati')
        .select('id, nume_complet')
        .eq('user_id', signUpData.user.id)
        .maybeSingle()
      fisa = data
    }
    setLoading(false)
    if (!fisa) {
      await supabase.auth.signOut() // întâi deconectăm (ecranul rămâne cel de autentificare), abia apoi eliberăm App
      onAnuleaza?.()
      setError('Contul a fost creat, dar nu s-a putut lega de fișa ta de angajat. Contactează administratorul.')
      return
    }
    setSucces({ nume: fisa.nume_complet || '' })
  }

  if (succes) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader title="Hub Madrigal" subtitle="Autentificare pentru toate tool-urile Madrigal" />
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Cont creat cu succes!</h2>
            <p className="text-sm text-slate-500 mb-5">
              {succes.nume ? `Bine ai venit, ${succes.nume}. ` : ''}Contul tău e gata de folosit.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => onIntra?.()}
              className="w-full bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2.5 rounded-lg transition"
            >
              Intră în Hub
            </button>
          </div>
        </div>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader
        title="Hub Madrigal"
        subtitle="Autentificare pentru toate tool-urile Madrigal"
      />

      <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => {
                setTab('login')
                setError('')
                setInfo('')
              }}
              className={`flex-1 text-sm py-1.5 rounded-md transition ${
                tab === 'login'
                  ? 'bg-white shadow-sm text-slate-800'
                  : 'text-slate-500'
              }`}
            >
              Am cont
            </button>
            <button
              onClick={() => {
                setTab('signup')
                setError('')
                setInfo('')
              }}
              className={`flex-1 text-sm py-1.5 rounded-md transition ${
                tab === 'signup'
                  ? 'bg-white shadow-sm text-slate-800'
                  : 'text-slate-500'
              }`}
            >
              Sunt angajat, vreau cont
            </button>
          </div>

          <form onSubmit={tab === 'login' ? handleLogin : handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Parolă</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-green-600">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {loading
                ? 'Se procesează...'
                : tab === 'login'
                ? 'Conectare'
                : 'Creează cont'}
            </button>
          </form>
        </div>
      </div>
      </div>

      <SiteFooter />
    </div>
  )
}
