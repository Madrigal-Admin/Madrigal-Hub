import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AdminZileLibere() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('legal_holidays').select('*').order('start_date')
    setItems(data || [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!startDate) return setError('Completează cel puțin data de început.')
    const end = endDate || startDate
    if (new Date(end) < new Date(startDate)) return setError('Data de sfârșit e înainte de început.')

    const { error } = await supabase
      .from('legal_holidays')
      .insert({ start_date: startDate, end_date: end, label: label.trim() || null })
    if (error) {
      setError('Nu am putut salva.')
      return
    }
    setStartDate('')
    setEndDate('')
    setLabel('')
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Ștergi această zi liberă?')) return
    await supabase.from('legal_holidays').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-800">Zile libere legale</h2>
      <p className="mb-5 text-sm text-slate-500">
        Introdu-le manual, o dată pe an. Cele care cad în cursul săptămânii sunt excluse automat din calculul
        concediilor de odihnă (nu se scad din sold).
      </p>
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <form onSubmit={handleAdd} className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-slate-800">Adaugă zi liberă / interval</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">De la</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Până la <span className="text-slate-400">(opțional, pt. o singură zi)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Denumire <span className="text-slate-400">(opțional)</span>
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="ex: Ziua Națională"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <Plus size={14} /> Adaugă
        </button>
      </form>

      <div>
        {loading ? (
          <p className="text-sm text-slate-500">Se încarcă…</p>
        ) : (
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {items.length === 0 && (
              <p className="text-sm text-slate-400">Nicio zi liberă legală adăugată încă.</p>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {item.start_date === item.end_date
                      ? formatDate(item.start_date)
                      : `${formatDate(item.start_date)} → ${formatDate(item.end_date)}`}
                  </p>
                  {item.label && <p className="text-xs text-slate-400">{item.label}</p>}
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="rounded-full p-2 text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
