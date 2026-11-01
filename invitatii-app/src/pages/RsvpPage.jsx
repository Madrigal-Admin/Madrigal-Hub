import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { PublicLayout } from './PublicLayout'

function formatData(dataStr) {
  if (!dataStr) return '—'
  return new Date(dataStr).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function RsvpPage({ token }) {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('rsvp_get_info', { p_token: token })
    if (error || !data || data.length === 0) {
      setError('Invitația nu a fost găsită. Verifică linkul primit.')
    } else {
      setInfo(data[0])
    }
    setLoading(false)
  }

  async function raspunde(raspuns) {
    setSaving(true)
    await supabase.rpc('rsvp_raspunde', { p_token: token, p_raspuns: raspuns })
    await load()
    setSaving(false)
  }

  if (loading) return <PublicLayout><p className="text-center text-sm text-slate-400">Se încarcă...</p></PublicLayout>
  if (error) return <PublicLayout><p className="text-center text-sm text-rose-600">{error}</p></PublicLayout>

  if (info.anulat) {
    return (
      <PublicLayout>
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <h2 className="font-display text-xl font-semibold text-slate-800">{info.nume_eveniment}</h2>
          <p className="mt-4 text-sm text-slate-600">Acest eveniment a fost anulat. Nu mai este nevoie de un răspuns.</p>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
        {info.afis_url && (
          <img src={info.afis_url} alt={info.nume_eveniment} className="mb-4 w-full rounded-xl object-cover" />
        )}

        <h2 className="font-display text-xl font-semibold text-slate-800">{info.nume_eveniment}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {formatData(info.data)}
          {info.locatie ? ` · ${info.locatie}` : ''}
        </p>

        <p className="mt-4 text-sm text-slate-600">
          Bună, <strong>{info.nume_invitat}</strong>!
          {info.mesaj_intro ? ` ${info.mesaj_intro.replace(/\{\{\s*nume\s*\}\}/g, info.nume_invitat).replace(/\{\{\s*\w+\s*\}\}/g, '')}` : ''}
        </p>

        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => raspunde('confirmat')}
            disabled={saving}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              info.status_rsvp === 'confirmat'
                ? 'bg-green-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Particip
          </button>
          <button
            onClick={() => raspunde('refuzat')}
            disabled={saving}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              info.status_rsvp === 'refuzat'
                ? 'bg-rose-600 text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Nu pot participa
          </button>
        </div>

        {info.status_rsvp !== 'in_asteptare' && (
          <p className="mt-3 text-xs text-slate-400">
            Poți schimba răspunsul oricând, revenind la acest link.
          </p>
        )}
      </div>
    </PublicLayout>
  )
}
