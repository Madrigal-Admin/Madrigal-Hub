import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import { Pencil, Trash2, Save, X as XIcon, Upload, Plus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { fetchAll } from '../lib/fetchAll'
import { useCategorii } from '../lib/useCategorii'
import { PageHeader } from './ui'

const EMPTY_FORM = {
  nume: '',
  prenume: '',
  email: '',
  institutie: '',
  functie: '',
  categorie: '',
  abonat_invitatii: true,
}

export default function PersoaneTab() {
  const { toate: categoriiToate, active: categoriiActive, reincarca: reincarcaCategorii } = useCategorii()
  const [persoane, setPersoane] = useState([])
  const [istoricMap, setIstoricMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [cautare, setCautare] = useState('')
  const [filtruCategorie, setFiltruCategorie] = useState('')
  const [istoricPersoana, setIstoricPersoana] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data }, { data: invitatiiRows }] = await Promise.all([
      fetchAll((a, b) => supabase.from('persoane').select('*').order('nume').order('id').range(a, b)),
      fetchAll((a, b) => supabase.from('invitatii').select('id, persoana_id, prezent').not('persoana_id', 'is', null).order('id').range(a, b)),
    ])

    const map = {}
    for (const r of invitatiiRows || []) {
      if (!r.persoana_id) continue
      if (!map[r.persoana_id]) map[r.persoana_id] = { invitat: 0, prezent: 0 }
      map[r.persoana_id].invitat += 1
      if (r.prezent) map[r.persoana_id].prezent += 1
    }

    setPersoane(data || [])
    setIstoricMap(map)
    setLoading(false)
  }

  function startEdit(p) {
    setEditingId(p.id)
    setForm({
      nume: p.nume || '',
      prenume: p.prenume || '',
      email: p.email || '',
      institutie: p.institutie || '',
      functie: p.functie || '',
      categorie: p.categorie || '',
      abonat_invitatii: p.abonat_invitatii,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      nume: form.nume.trim(),
      prenume: form.prenume.trim(),
      email: form.email.trim(),
      institutie: form.institutie.trim() || null,
      functie: form.functie.trim() || null,
      categorie: form.categorie.trim() || null,
      abonat_invitatii: form.abonat_invitatii,
    }

    const { error } = editingId
      ? await supabase.from('persoane').update(payload).eq('id', editingId)
      : await supabase.from('persoane').insert(payload)

    setSaving(false)
    if (error) {
      setError(error.message.includes('duplicate') ? 'Există deja o persoană cu acest email.' : error.message)
      return
    }
    cancelEdit()
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Ștergi această persoană? Istoricul ei de invitații/check-in rămâne neatins.')) return
    await supabase.from('persoane').delete().eq('id', id)
    load()
  }

  const filtrate = persoane.filter((p) => {
    const q = cautare.toLowerCase()
    const matchQ =
      !q ||
      p.nume?.toLowerCase().includes(q) ||
      p.prenume?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.institutie?.toLowerCase().includes(q) ||
      p.categorie?.toLowerCase().includes(q)
    const matchCategorie = !filtruCategorie || p.categorie === filtruCategorie
    return matchQ && matchCategorie
  })

  return (
    <div>
      <PageHeader
        titlu="Persoane"
        descriere="Lista fixă de invitați, împărțită pe categorii. Categoriile se editează din Setări."
      >
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Upload size={13} /> Importă CSV
        </button>
      </PageHeader>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-sm p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-sm text-slate-600 mb-1">Nume</label>
          <input
            required
            value={form.nume}
            onChange={(e) => setForm({ ...form, nume: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Prenume</label>
          <input
            required
            value={form.prenume}
            onChange={(e) => setForm({ ...form, prenume: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Categorie</label>
          <select
            value={form.categorie}
            onChange={(e) => setForm({ ...form, categorie: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
          >
            <option value="">— Alege categorie —</option>
            {categoriiActive.map((c) => (
              <option key={c.id} value={c.nume}>
                {c.nume}
              </option>
            ))}
            {form.categorie && !categoriiActive.some((c) => c.nume === form.categorie) && (
              <option value={form.categorie}>{form.categorie} (arhivată)</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Instituție</label>
          <input
            value={form.institutie}
            onChange={(e) => setForm({ ...form, institutie: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600 mb-1">Funcție</label>
          <input
            value={form.functie}
            onChange={(e) => setForm({ ...form, functie: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.abonat_invitatii}
            onChange={(e) => setForm({ ...form, abonat_invitatii: e.target.checked })}
          />
          Abonat la invitații (conform GDPR)
        </label>

        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {editingId ? <Save size={14} /> : <Plus size={14} />}
            {saving ? 'Se salvează...' : editingId ? 'Salvează modificările' : 'Adaugă persoană'}
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

      <div className="mb-3 flex flex-wrap gap-3">
        <input
          value={cautare}
          onChange={(e) => setCautare(e.target.value)}
          placeholder="Caută după nume, email, instituție..."
          className="w-full sm:w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <select
          value={filtruCategorie}
          onChange={(e) => setFiltruCategorie(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">Toate categoriile</option>
          {categoriiToate.map((c) => (
            <option key={c.id} value={c.nume}>
              {c.nume}
              {c.arhivata ? ' (arhivată)' : ''}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Se încarcă...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Nume</th>
                <th className="px-4 py-3 font-medium">Instituție</th>
                <th className="px-4 py-3 font-medium">Funcție</th>
                <th className="px-4 py-3 font-medium">Categorie</th>
                <th className="px-4 py-3 font-medium">Abonat</th>
                <th className="px-4 py-3 font-medium">Evenimente</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrate.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{p.prenume} {p.nume}</p>
                    <p className="text-xs text-slate-400">{p.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.institutie || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.functie || '—'}</td>
                  <td className="px-4 py-3">
                    {p.categorie ? (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {p.categorie}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.abonat_invitatii ? (
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Da</span>
                    ) : (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Nu</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{istoricMap[p.id]?.invitat || 0}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setIstoricPersoana(p)}
                      className="text-slate-500 text-xs hover:underline mr-3"
                    >
                      Vezi istoric
                    </button>
                    <button onClick={() => startEdit(p)} className="text-accent text-sm hover:underline mr-3">
                      <Pencil size={13} className="inline" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-rose-500 text-sm hover:underline">
                      <Trash2 size={13} className="inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtrate.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                    Nicio persoană găsită.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <ImportCsvModal
          categoriiActive={categoriiActive}
          onClose={() => setShowImport(false)}
          onImported={() => {
            load()
            reincarcaCategorii()
          }}
        />
      )}
      {istoricPersoana && (
        <IstoricModal persoana={istoricPersoana} onClose={() => setIstoricPersoana(null)} />
      )}
    </div>
  )
}

function IstoricModal({ persoana, onClose }) {
  const [istoric, setIstoric] = useState(null)

  useEffect(() => {
    supabase
      .from('invitatii')
      .select('status_rsvp, prezent, evenimente(nume, data)')
      .eq('persoana_id', persoana.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setIstoric(data || []))
  }, [persoana.id])

  const totalInvitat = istoric?.length || 0
  const totalPrezent = istoric?.filter((i) => i.prezent).length || 0

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            {persoana.prenume} {persoana.nume}
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <XIcon size={16} />
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-400">{persoana.email}</p>

        {istoric === null ? (
          <p className="text-sm text-slate-400">Se încarcă...</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Invitat la <strong>{totalInvitat}</strong> evenimente, prezent la <strong>{totalPrezent}</strong>.
            </p>
            {istoric.length === 0 ? (
              <p className="text-sm text-slate-400">Nicio invitație încă.</p>
            ) : (
              <div className="space-y-1.5">
                {istoric.map((i, idx) => {
                  const badge = RSVP_LABELS[i.status_rsvp] || RSVP_LABELS.in_asteptare
                  return (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <div>
                        <p className="text-slate-800">{i.evenimente?.nume}</p>
                        <p className="text-xs text-slate-400">
                          {i.evenimente?.data
                            ? new Date(i.evenimente.data).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
                            : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
                        {i.prezent && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Prezent</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const RSVP_LABELS = {
  confirmat: { label: 'Confirmat', className: 'bg-green-50 text-green-700' },
  refuzat: { label: 'Refuzat', className: 'bg-rose-50 text-rose-600' },
  in_asteptare: { label: 'În așteptare', className: 'bg-amber-50 text-amber-700' },
}

const CSV_COLOANE = ['nume', 'prenume', 'email', 'institutie', 'functie', 'categorie']

function ImportCsvModal({ categoriiActive, onClose, onImported }) {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setResult(null)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const lipsa = CSV_COLOANE.filter((c) => c !== 'institutie' && c !== 'functie' && c !== 'categorie').filter(
          (c) => !res.meta.fields?.includes(c)
        )
        if (lipsa.length > 0) {
          setParseError(`Lipsesc coloanele obligatorii: ${lipsa.join(', ')}`)
          setRows([])
          return
        }
        setRows(res.data.filter((r) => r.email?.trim()))
      },
    })
  }

  async function handleImport() {
    // Categoriile din fișier trebuie să existe deja (se gestionează din Setări), ca să nu apară duplicate din greșeli de scriere
    const permise = new Set(categoriiActive.map((c) => c.nume))
    const necunoscute = [...new Set(rows.map((r) => r.categorie?.trim()).filter((c) => c && !permise.has(c)))]
    if (necunoscute.length > 0) {
      setParseError(
        `Categorii necunoscute în fișier: ${necunoscute.join(', ')}. Corectează fișierul sau adaugă categoriile în Setări, apoi importă din nou. Nu s-a importat nimic.`
      )
      return
    }
    setParseError('')
    setImporting(true)
    const payload = rows.map((r) => ({
      nume: r.nume?.trim(),
      prenume: r.prenume?.trim(),
      email: r.email?.trim(),
      institutie: r.institutie?.trim() || null,
      functie: r.functie?.trim() || null,
      categorie: r.categorie?.trim() || null,
      abonat_invitatii: true,
    }))

    let error = null
    for (let i = 0; i < payload.length && !error; i += 500) {
      ;({ error } = await supabase.from('persoane').upsert(payload.slice(i, i + 500), { onConflict: 'email' }))
    }
    setImporting(false)

    if (error) {
      setParseError(error.message)
      return
    }
    setResult(payload.length)
    onImported()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Importă persoane din CSV</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <XIcon size={16} />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Coloane necesare: <code>nume, prenume, email</code> (obligatorii), plus opțional{' '}
          <code>institutie, functie, categorie</code> (categoria trebuie să existe în Setări). Persoanele cu email deja existent se actualizează, nu se
          duplică.
        </p>

        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 mb-3"
        />

        {parseError && <p className="text-sm text-rose-600 mb-3">{parseError}</p>}

        {rows.length > 0 && !result && (
          <p className="text-sm text-slate-600 mb-3">
            <strong>{fileName}</strong> — {rows.length} rânduri detectate, gata de import.
          </p>
        )}

        {result != null && <p className="text-sm text-green-700 mb-3">{result} persoane importate cu succes.</p>}

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={rows.length === 0 || importing || result != null}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {importing ? 'Se importă...' : `Importă ${rows.length > 0 ? rows.length : ''} persoane`}
          </button>
          <button onClick={onClose} className="text-sm text-slate-500 px-4 py-2 rounded-lg hover:bg-slate-100">
            {result != null ? 'Închide' : 'Anulează'}
          </button>
        </div>
      </div>
    </div>
  )
}
