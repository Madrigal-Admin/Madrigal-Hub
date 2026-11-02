import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const EMPTY_FORM = { nume: '', rol: '', ordine: 0, parinte_id: '' }

// Toți descendenții unei persoane (copii, nepoți, ...) — ca să nu poți
// alege, din greșeală, pe cineva din propria "subordine" drept superior
// (ar crea un cerc fără sfârșit în organigramă).
function descendentiDe(persoane, id) {
  const copiiDirecti = persoane.filter((p) => p.parinte_id === id)
  return copiiDirecti.reduce(
    (acc, c) => [...acc, c.id, ...descendentiDe(persoane, c.id)],
    []
  )
}

// Administrarea organigramei "Echipa" din Ghidul angajatului — o listă
// scurtă, manuală (nume + rol + superior), NU legată de tabelul angajați.
// Alegerea unui "Superior" pentru fiecare persoană e ce desenează liniile
// din organigramă.
export default function AdminGhidEchipa() {
  const [persoane, setPersoane] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
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
      .from('ghid_echipa_persoane')
      .select('*')
      .order('ordine', { ascending: true })
    setPersoane(data || [])
    setLoading(false)
  }

  function startEdit(p) {
    setEditingId(p.id)
    setForm({
      nume: p.nume || '',
      rol: p.rol || '',
      ordine: p.ordine ?? 0,
      parinte_id: p.parinte_id || '',
    })
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError('')
  }

  async function handleDelete(p) {
    const areCopii = persoane.some((x) => x.parinte_id === p.id)
    const mesaj = areCopii
      ? `Ștergi "${p.nume}"? Persoanele aflate sub ea în organigramă rămân, dar fără superior (urcă pe primul nivel) — le poți reatribui după aceea.`
      : `Ștergi "${p.nume}" din organigramă?`
    if (!confirm(mesaj)) return

    const { error } = await supabase.from('ghid_echipa_persoane').delete().eq('id', p.id)
    if (error) {
      setError('Nu am putut șterge: ' + error.message)
      return
    }
    loadAll()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const nume = form.nume.trim()
    const rol = form.rol.trim()
    if (!nume || !rol) {
      setError('Numele și rolul sunt obligatorii.')
      return
    }

    setSaving(true)

    const payload = {
      nume,
      rol,
      ordine: Number(form.ordine) || 0,
      parinte_id: form.parinte_id || null,
      updated_at: new Date().toISOString(),
    }

    const { error: saveError } = editingId
      ? await supabase.from('ghid_echipa_persoane').update(payload).eq('id', editingId)
      : await supabase.from('ghid_echipa_persoane').insert(payload)

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    cancelEdit()
    loadAll()
  }

  // La editare, nu poți alege drept superior nici persoana însăși, nici
  // pe cineva aflat sub ea — ar crea un cerc.
  const interziseLaSuperior = editingId
    ? new Set([editingId, ...descendentiDe(persoane, editingId)])
    : new Set()
  const optiuniSuperior = persoane.filter((p) => !interziseLaSuperior.has(p.id))

  const numeDupaId = new Map(persoane.map((p) => [p.id, p.nume]))

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-1">
        Ghidul angajatului — Echipa (organigramă)
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        Listă scurtă, manuală — nu e legată de lista de angajați. Alegi, pentru fiecare persoană,
        cine îi e superior; asta desenează liniile din organigramă.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-sm p-5 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4"
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
          <label className="block text-sm text-slate-600 mb-1">Rol</label>
          <input
            required
            value={form.rol}
            onChange={(e) => setForm({ ...form, rol: e.target.value })}
            placeholder="ex: Manager General, Secretariat..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Superior (opțional)</label>
          <select
            value={form.parinte_id}
            onChange={(e) => setForm({ ...form, parinte_id: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
          >
            <option value="">— Fără (pe primul nivel) —</option>
            {optiuniSuperior.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nume} ({p.rol})
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Lasă necompletat dacă e pe primul nivel al organigramei (ex: Manager General).
          </p>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Ordine între frați</label>
          <input
            type="number"
            value={form.ordine}
            onChange={(e) => setForm({ ...form, ordine: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <p className="text-xs text-slate-400 mt-1">
            Numerele mici apar primele, printre persoanele cu același superior.
          </p>
        </div>

        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
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

      {loading ? (
        <p className="text-sm text-slate-500">Se încarcă...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-14rem)] [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-slate-50">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Nume</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Superior</th>
                <th className="px-4 py-3 font-medium">Ordine</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {persoane.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800">{p.nume}</td>
                  <td className="px-4 py-3 text-slate-500">{p.rol}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.parinte_id ? numeDupaId.get(p.parinte_id) || '—' : '— (nivel 1)'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.ordine}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(p)} className="text-accent text-sm hover:underline mr-3">
                      Editează
                    </button>
                    <button onClick={() => handleDelete(p)} className="text-rose-500 text-sm hover:underline">
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
              {persoane.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nicio persoană adăugată încă.
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
