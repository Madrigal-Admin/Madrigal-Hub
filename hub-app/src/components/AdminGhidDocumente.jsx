import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const EMPTY_FORM = {
  titlu: '',
  descriere: '',
  ordine: 0,
}

function formateazaData(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(iso)
    )
  } catch {
    return '—'
  }
}

// Administrarea "Documente Resurse Umane" din Ghidul angajatului —
// adaugă/editează/șterge documente, fără nicio linie de cod: completezi
// un formular și, opțional, încarci un fișier (PDF, Word etc.).
export default function AdminGhidDocumente() {
  const [documente, setDocumente] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [fisierNou, setFisierNou] = useState(null) // obiectul File ales din calculator
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase
      .from('ghid_documente')
      .select('*')
      .order('ordine', { ascending: true })
      .order('titlu', { ascending: true })
    setDocumente(data || [])
    setLoading(false)
  }

  function startEdit(doc) {
    setEditingId(doc.id)
    setForm({
      titlu: doc.titlu || '',
      descriere: doc.descriere || '',
      ordine: doc.ordine ?? 0,
    })
    setFisierNou(null)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFisierNou(null)
    setError('')
  }

  async function handleDelete(doc) {
    const confirmat = confirm(`Ștergi definitiv documentul "${doc.titlu}"? Nu poate fi recuperat.`)
    if (!confirmat) return

    setError('')

    // Ștergem și fișierul din Storage — dacă eșuează (ex: fișierul
    // lipsește deja), nu blocăm ștergerea rândului din listă.
    if (doc.fisier_url) {
      await supabase.storage.from('ghid-documente').remove([doc.fisier_url])
    }

    const { error } = await supabase.from('ghid_documente').delete().eq('id', doc.id)
    if (error) {
      setError('Nu am putut șterge documentul: ' + error.message)
      return
    }
    loadAll()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const titlu = form.titlu.trim()
    if (!titlu) {
      setError('Titlul e obligatoriu.')
      return
    }

    // La adăugare, un fișier e obligatoriu. La editare, poți doar
    // corecta titlul/descrierea fără să schimbi fișierul.
    if (!editingId && !fisierNou) {
      setError('Alege un fișier de încărcat.')
      return
    }

    setSaving(true)

    const payload = {
      titlu,
      descriere: form.descriere.trim() || null,
      ordine: Number(form.ordine) || 0,
      updated_at: new Date().toISOString(),
    }

    if (fisierNou) {
      // Nume unic în Storage, ca să nu suprascriem alt document dacă
      // două fișiere au același nume original.
      const caleStorage = `${Date.now()}-${fisierNou.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`

      const { error: uploadError } = await supabase.storage
        .from('ghid-documente')
        .upload(caleStorage, fisierNou, { upsert: false })

      if (uploadError) {
        setSaving(false)
        setError('Nu am putut încărca fișierul: ' + uploadError.message)
        return
      }

      payload.fisier_url = caleStorage
      payload.fisier_nume_original = fisierNou.name
    }

    const { error: saveError } = editingId
      ? await supabase.from('ghid_documente').update(payload).eq('id', editingId)
      : await supabase.from('ghid_documente').insert(payload)

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    cancelEdit()
    loadAll()
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-1">
        Ghidul angajatului — Documente Resurse Umane
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Documentele apar în Ghidul angajatului, vizibile tuturor colegilor autentificați.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-sm p-5 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-600 mb-1">Titlu</label>
          <input
            required
            value={form.titlu}
            onChange={(e) => setForm({ ...form, titlu: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-600 mb-1">Descriere (opțional)</label>
          <textarea
            rows={2}
            value={form.descriere}
            onChange={(e) => setForm({ ...form, descriere: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Ordine afișare</label>
          <input
            type="number"
            value={form.ordine}
            onChange={(e) => setForm({ ...form, ordine: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-slate-400 mt-1">Numerele mici apar primele.</p>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">
            {editingId ? 'Înlocuiește fișierul (opțional)' : 'Fișier'}
          </label>
          <input
            type="file"
            onChange={(e) => setFisierNou(e.target.files?.[0] || null)}
            className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          {editingId && !fisierNou && (
            <p className="text-xs text-slate-400 mt-1">Lași necompletat dacă păstrezi fișierul actual.</p>
          )}
        </div>

        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Se salvează...' : editingId ? 'Salvează modificările' : 'Adaugă document'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm text-slate-500 px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Anulează
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Se încarcă...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-14rem)] [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-slate-50">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Titlu</th>
                <th className="px-4 py-3 font-medium">Fișier</th>
                <th className="px-4 py-3 font-medium">Actualizat la</th>
                <th className="px-4 py-3 font-medium">Ordine</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {documente.map((doc) => (
                <tr key={doc.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800">{doc.titlu}</td>
                  <td className="px-4 py-3 text-slate-500 truncate max-w-[200px]">
                    {doc.fisier_nume_original || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formateazaData(doc.updated_at)}</td>
                  <td className="px-4 py-3 text-slate-500">{doc.ordine}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => startEdit(doc)}
                      className="text-accent text-sm hover:underline mr-3"
                    >
                      Editează
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      className="text-rose-500 text-sm hover:underline"
                    >
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
              {documente.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Niciun document adăugat încă.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
