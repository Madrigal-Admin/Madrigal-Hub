import { useEffect, useState } from 'react'
import HubHeader from './HubHeader'
import { construiesteTooluri } from './tooluri'

const CHEIE = 'hub-acces-tooluri'

function citesteCache() {
  try { return JSON.parse(sessionStorage.getItem(CHEIE)) || [] } catch { return [] }
}

// Varianta pentru aplicațiile separate (HR, Invitații etc.): își citește singură lista de tool-uri
// la care are acces angajatul. Afișează imediat ultima listă cunoscută și o reîmprospătează în fundal.
export default function HubHeaderAuto({ supabase, activ, displayName, onLogout }) {
  const [acces, setAcces] = useState(citesteCache)

  useEffect(() => {
    let anulat = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: ang } = await supabase.from('angajati').select('id').eq('user_id', session.user.id).maybeSingle()
      if (!ang) return
      const { data } = await supabase.from('acces_tooluri').select('tool, rol').eq('angajat_id', ang.id)
      if (anulat || !data) return
      setAcces(data)
      try { sessionStorage.setItem(CHEIE, JSON.stringify(data)) } catch { /* fără cache, nu e grav */ }
    })()
    return () => { anulat = true }
  }, [supabase])

  function iesire() {
    try { sessionStorage.removeItem(CHEIE) } catch { /* ignorăm */ }
    onLogout()
  }

  return <HubHeader nume={displayName} tooluri={construiesteTooluri(acces)} activ={activ} onSignOut={iesire} />
}
