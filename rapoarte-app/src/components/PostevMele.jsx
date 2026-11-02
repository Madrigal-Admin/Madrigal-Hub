import { useEffect, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { btnPrimary, btnGhost } from '../lib/ui'
import { usePostevConfig } from '../lib/usePostevConfig'
import PostevForm from './PostevForm'
import PostevCard from './PostevCard'
import EvenimentPicker from './EvenimentPicker'

export default function PostevMele({ angajat, role }) {
  const cfg = usePostevConfig()
  const [rapoarte, setRapoarte] = useState([])
  const [loading, setLoading] = useState(true)
  const [pas, setPas] = useState('lista') // lista | alege | formular
  const [eveniment, setEveniment] = useState(null)
  const [editat, setEditat] = useState(null)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  useEffect(() => {
    if (userId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function load() {
    setLoading(true)
    // adminii văd toate rapoartele în ecranul lor; aici arătăm doar ale mele
    const { data } = await supabase
      .from('rap_postev')
      .select('*')
      .eq('autor_user_id', userId)
      .order('data_sfarsit', { ascending: false })
    setRapoarte(data || [])
    setLoading(false)
  }

  if (cfg.loading || loading) return <p className="text-sm text-slate-500">Se încarcă…</p>

  const inapoi = () => {
    setPas('lista')
    setEveniment(null)
    setEditat(null)
  }
  const salvat = () => {
    inapoi()
    load()
  }

  if (pas === 'alege') {
    return (
      <EvenimentPicker
        angajatId={angajat?.id}
        vedeTot={role === 'admin_postev' || role === 'admin_general'}
        onCancel={inapoi}
        onAlege={(e) => { setEveniment(e); setPas('formular') }}
        onManual={() => { setEveniment(null); setPas('formular') }}
      />
    )
  }
  if (pas === 'formular') {
    return (
      <PostevForm
        key={editat?.id || eveniment?.id || 'manual'}
        eveniment={eveniment}
        raport={editat}
        cfg={cfg}
        angajatCurent={angajat}
        onSaved={salvat}
        onCancel={inapoi}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-slate-800">Rapoartele mele post-eveniment</h2>
        <button onClick={() => setPas('alege')} className={btnPrimary}><Plus size={14} /> Raport nou</button>
      </div>

      {rapoarte.length === 0 && <p className="text-sm text-slate-500">Nu ai depus încă niciun raport post-eveniment.</p>}

      {rapoarte.map((r) => (
        <PostevCard
          key={r.id}
          raport={r}
          cfg={cfg}
          actiuni={
            (r.stare === 'trimis' || r.stare === 'respins') && (
              <button onClick={() => { setEditat(r); setPas('formular') }} className={btnGhost}>
                <Pencil size={14} /> {r.stare === 'respins' ? 'Corectează și retrimite' : 'Editează'}
              </button>
            )
          }
        />
      ))}
    </div>
  )
}
