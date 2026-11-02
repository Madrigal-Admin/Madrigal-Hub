import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import RichTextEditor from './ghid/RichTextEditor'

const EMPTY_FORM = {
  subiect: '',
  titlu: '',
  continut_html: '',
  tipAtasament: 'niciun', // 'niciun' | 'link' | 'fisier'
  link: '',
  fisierUrlExistent: '',
  fisierNumeExistent: '',
}

// Componentă de administrare GENERICĂ, în stil acordeon, pentru
// secțiunile cu aceeași structură: Subiect / Titlu / Text formatat +
// opțional link SAU fișier de descărcat (una dintre cele două, nu
// amândouă). Folosită atât pentru "Informații utile" cât și pentru
// "Ghid Resurse Umane" — vezi AdminLayout.jsx.
//
// props:
//   tabel        - numele tabelei din Supabase (ghid_intrebari / ghid_info_resurse_umane)
//   titluSectiune - titlul afișat sus, în Admin Hub
//   descriere    - textul explicativ de sub titlu
export default function AdminGhidAcordeon({ tabel, titluSectiune, descriere }) {
  const [intrari, setIntrari] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [fisierNou, setFisierNou] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // RichTextEditor nu e "controlat" (vezi RichTextEditor.jsx) — ca să-l
  // forțăm să-și reîncarce conținutul la "Renunță" sau la trecerea pe o
  // altă intrare, îi dăm un `key` care se schimbă de fiecare dată.
  const [editorKey, setEditorKey] = useState(0)

  useEffect(() => {
    loadAll()
  }, [tabel])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase.from(tabel).select('*').order('ordine', { ascending: true })
    setIntrari(data || [])
    setLoading(false)
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm({
      subiect: item.subiect || '',
      titlu: item.titlu || '',
      continut_html: item.continut_html || '',
      tipAtasament: item.fisier_url ? 'fisier' : item.link ? 'link' : 'niciun',
      link: item.link || '',
      fisierUrlExistent: item.fisier_url || '',
      fisierNumeExistent: item.fisier_nume || '',
      ordine: item.ordine ?? 0,
    })
    setFisierNou(null)
    setError('')
    setEditorKey((k) => k + 1)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFisierNou(null)
    setError('')
    setEditorKey((k) => k + 1)
  }

  async function handleDelete(item) {
    if (!confirm(`Ștergi "${item.titlu}"?`)) return

    if (item.fisier_url) {
      await supabase.storage.from('ghid-foto').remove([item.fisier_url])
    }

    const { error } = await supabase.from(tabel).delete().eq('id', item.id)
    if (error) {
      setError('Nu am putut șterge: ' + error.message)
      return
    }
    loadAll()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const subiect = form.subiect.trim()
    const titlu = form.titlu.trim()
    if (!subiect || !titlu) {
      setError('Subiectul și titlul sunt obligatorii.')
      return
    }

    if (form.tipAtasament === 'link' && !form.link.trim()) {
      setError('Completează link-ul, sau alege "Fără atașament".')
      return
    }
    if (form.tipAtasament === 'fisier' && !fisierNou && !form.fisierUrlExistent) {
      setError('Alege un fișier de încărcat, sau alege "Fără atașament".')
      return
    }

    setSaving(true)

    const payload = {
      subiect,
      titlu,
      continut_html: form.continut_html,
      ordine: Number(form.ordine) || 0,
      updated_at: new Date().toISOString(),
      link: null,
      fisier_url: null,
      fisier_nume: null,
    }

    // Dacă se renunță la fișierul existent (schimbat tipul de atașament
    // sau s-a încărcat unul nou), ștergem vechiul fișier din storage.
    const trebuieStersFisierVechi =
      form.fisierUrlExistent && (form.tipAtasament !== 'fisier' || fisierNou)

    if (form.tipAtasament === 'link') {
      payload.link = form.link.trim()
    } else if (form.tipAtasament === 'fisier') {
      if (fisierNou) {
        const caleStorage = `${Date.now()}-${fisierNou.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
        const { error: uploadError } = await supabase.storage
          .from('ghid-foto')
          .upload(caleStorage, fisierNou, { upsert: false })

        if (uploadError) {
          setSaving(false)
          setError('Nu am putut încărca fișierul: ' + uploadError.message)
          return
        }
        payload.fisier_url = caleStorage
        payload.fisier_nume = fisierNou.name
      } else {
        payload.fisier_url = form.fisierUrlExistent
        payload.fisier_nume = form.fisierNumeExistent
      }
    }

    const { error: saveError } = editingId
      ? await supabase.from(tabel).update(payload).eq('id', editingId)
      : await supabase.from(tabel).insert(payload)

    if (saveError) {
      setSaving(false)
      setError(saveError.message)
      return
    }

    if (trebuieStersFisierVechi) {
      await supabase.storage.from('ghid-foto').remove([form.fisierUrlExistent])
    }

    setSaving(false)
    cancelEdit()
    loadAll()
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-1">{titluSectiune}</h2>
      <p className="text-sm text-slate-500 mb-6">{descriere}</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 mb-8 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Subiect</label>
            <input
              required
              value={form.subiect}
              onChange={(e) => setForm({ ...form, subiect: e.target.value })}
              placeholder="ex: Concedii"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-xs text-slate-400 mt-1">
              Intrările cu același subiect apar grupate — pune-le cu "ordine" consecutivă.
            </p>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">Ordine afișare</label>
            <input
              type="number"
              value={form.ordine}
              onChange={(e) => setForm({ ...form, ordine: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Titlu</label>
          <input
            required
            value={form.titlu}
            onChange={(e) => setForm({ ...form, titlu: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Text</label>
          <RichTextEditor
            key={editorKey}
            value={form.continut_html}
            onChange={(html) => setForm({ ...form, continut_html: html })}
          />
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-2">Atașament (opțional)</label>
          <div className="flex gap-4 mb-3">
            {[
              { value: 'niciun', label: 'Fără atașament' },
              { value: 'link', label: 'Link' },
              { value: 'fisier', label: 'Fișier de descărcat' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="radio"
                  name="tipAtasament"
                  checked={form.tipAtasament === opt.value}
                  onChange={() => setForm({ ...form, tipAtasament: opt.value })}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {form.tipAtasament === 'link' && (
            <input
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="ex: /HR/ sau https://..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          )}

          {form.tipAtasament === 'fisier' && (
            <div>
              {form.fisierUrlExistent && !fisierNou && (
                <p className="text-xs text-slate-500 mb-1.5">
                  Fișier curent: {form.fisierNumeExistent || form.fisierUrlExistent}
                </p>
              )}
              <input
                type="file"
                onChange={(e) => setFisierNou(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Se salvează...' : editingId ? 'Salvează modificările' : 'Adaugă'}
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
                <th className="px-4 py-3 font-medium">Subiect</th>
                <th className="px-4 py-3 font-medium">Titlu</th>
                <th className="px-4 py-3 font-medium">Ordine</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {intrari.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500">{item.subiect}</td>
                  <td className="px-4 py-3 text-slate-800">{item.titlu}</td>
                  <td className="px-4 py-3 text-slate-500">{item.ordine}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(item)} className="text-accent text-sm hover:underline mr-3">
                      Editează
                    </button>
                    <button onClick={() => handleDelete(item)} className="text-rose-500 text-sm hover:underline">
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
              {intrari.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Nicio intrare adăugată încă.
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
