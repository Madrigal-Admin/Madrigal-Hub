import { useEffect, useState } from 'react'
import FiltruAngajati, { FILTRU_GOL, potrivesteFiltru } from './FiltruAngajati'
import { supabase } from '../supabaseClient'

const EMPTY_FORM = {
  nume_complet: '',
  email: '',
  departament_id: '',
  functie_id: '',
  activ: true,
}

export default function AdminAngajati() {
  const [angajati, setAngajati] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [filtru, setFiltru] = useState(FILTRU_GOL)
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
    const [angajatiRes, deptRes, posRes] = await Promise.all([
      supabase
        .from('angajati')
        .select('*, departments(name), positions(name)')
        .order('nume_complet'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('positions').select('*').order('name'),
    ])
    setAngajati(angajatiRes.data || [])
    setDepartments(deptRes.data || [])
    setPositions(posRes.data || [])
    setLoading(false)
  }

  async function handleDelete(a) {
    const confirmat = confirm(
      `Ștergi definitiv "${a.nume_complet}"?\n\n` +
      `Se șterg și: profilul lui HR (contract, solduri), istoricul de vechime, ` +
      `și accesul lui la tool-uri. Cererile de concediu deja depuse rămân, ` +
      `dar fără legătură directă la acest angajat.\n\n` +
      `Dacă angajatul doar a plecat temporar sau vrei să-i păstrezi datele, ` +
      `mai bine editează-l și debifează "Angajat activ" — poți reveni oricând.`
    )
    if (!confirmat) return

    const { error } = await supabase.from('angajati').delete().eq('id', a.id)
    if (error) {
      alert('Nu am putut șterge angajatul: ' + error.message)
      return
    }
    loadAll()
  }

  function startEdit(a) {
    setEditingId(a.id)
    setForm({
      nume_complet: a.nume_complet || '',
      email: a.email || '',
      departament_id: a.departament_id || '',
      functie_id: a.functie_id || '',
      activ: a.activ,
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
      nume_complet: form.nume_complet.trim(),
      email: form.email.trim() || null,
      departament_id: form.departament_id || null,
      functie_id: form.functie_id || null,
      activ: form.activ,
    }

    const { error } = editingId
      ? await supabase.from('angajati').update(payload).eq('id', editingId)
      : await supabase.from('angajati').insert(payload)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    cancelEdit()
    loadAll()
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-6">Angajați</h2>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-sm p-5 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-sm text-slate-600 mb-1">Nume complet</label>
          <input
            required
            value={form.nume_complet}
            onChange={(e) => setForm({ ...form, nume_complet: e.target.value })}
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
          <label className="block text-sm text-slate-600 mb-1">Departament</label>
          <select
            value={form.departament_id}
            onChange={(e) => setForm({ ...form, departament_id: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
          >
            <option value="">— Alege departament —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1">Funcție</label>
          <select
            value={form.functie_id}
            onChange={(e) => setForm({ ...form, functie_id: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-white"
          >
            <option value="">— Alege funcție —</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.activ}
            onChange={(e) => setForm({ ...form, activ: e.target.checked })}
          />
          Angajat activ
        </label>

        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {saving ? 'Se salvează...' : editingId ? 'Salvează modificările' : 'Adaugă angajat'}
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
        <>
        <FiltruAngajati
          value={filtru}
          onChange={setFiltru}
          departments={departments}
          positions={positions}
          total={angajati.length}
          afisati={angajati.filter((a) => potrivesteFiltru(a, filtru)).length}
        />
        <div className="bg-white rounded-xl shadow-sm overflow-auto max-h-[calc(100vh-14rem)] [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-slate-50">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Nume</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Departament</th>
                <th className="px-4 py-3 font-medium">Funcție</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {angajati.filter((a) => potrivesteFiltru(a, filtru)).map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800">{a.nume_complet}</td>
                  <td className="px-4 py-3 text-slate-500">{a.email}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {a.departments?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {a.positions?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {a.activ ? (
                      <span className="text-green-700 bg-green-50 text-xs px-2 py-0.5 rounded-full">
                        Activ
                      </span>
                    ) : (
                      <span className="text-slate-500 bg-slate-100 text-xs px-2 py-0.5 rounded-full">
                        Inactiv
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(a)}
                      className="text-accent text-sm hover:underline mr-3"
                    >
                      Editează
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      className="text-rose-500 text-sm hover:underline"
                    >
                      Șterge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
