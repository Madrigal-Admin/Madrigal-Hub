import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import FiltruAngajati, { FILTRU_GOL, potrivesteFiltru } from './FiltruAngajati'

// Rolurile posibile per tool. '' înseamnă "fără acces".
const TOOLS = [
  { key: 'hub', label: 'Hub', roles: ['admin'] },
  { key: 'hr', label: 'HR', roles: ['angajat', 'operational', 'full'] },
  { key: 'invitatii', label: 'Invitații', roles: ['full', 'checkin'] },
  { key: 'administrativ', label: 'Administrativ', roles: ['full', 'angajat'] },
  { key: 'calendar', label: 'Calendar', roles: ['admin', 'statistici'] },
  {
    key: 'rapoarte',
    label: 'Rapoarte',
    roles: ['angajat', 'admin_activitate', 'admin_postev', 'vizualizare', 'admin_general'],
  },
  { key: 'financiar', label: 'Financiar', roles: ['angajat', 'admin_financiar'] },
  { key: 'taskuri', label: 'Taskuri', roles: ['angajat', 'admin'] },
]

const ROLE_LABELS = {
  admin: 'Admin',
  statistici: 'Doar statistici evenimente',
  angajat: 'Angajat',
  operational: 'Operațional',
  full: 'Admin complet',
  checkin: 'Verificare la intrare',
  admin_activitate: 'Admin Rapoarte de activitate',
  admin_postev: 'Admin Rapoarte post-eveniment',
  vizualizare: 'Vizualizare dashboard',
  admin_general: 'Admin general Rapoarte',
  admin_financiar: 'Admin Financiar',
}

// Același cod de rol poate avea nume diferit la tool-uri diferite.
const ROLE_LABELS_TOOL = { 'taskuri:admin': 'Admin taskuri', 'hub:admin': 'Admin Hub', 'calendar:admin': 'Admin calendar' }
const labelRol = (tool, r) => ROLE_LABELS_TOOL[`${tool}:${r}`] || ROLE_LABELS[r]

export default function AdminAccesTooluri() {
  const [angajati, setAngajati] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [filtru, setFiltru] = useState(FILTRU_GOL)
  const [accesMap, setAccesMap] = useState({}) // { angajat_id: { tool: rol } }
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null) // "angajatId-tool", cât timp salvează
  const [selectati, setSelectati] = useState(() => new Set())
  const [bulkTool, setBulkTool] = useState('taskuri')
  const [bulkRol, setBulkRol] = useState('angajat')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMesaj, setBulkMesaj] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [angajatiRes, accesRes, deptRes, posRes] = await Promise.all([
      supabase.from('angajati').select('id, nume_complet, email, departament_id, functie_id').order('nume_complet'),
      supabase.from('acces_tooluri').select('angajat_id, tool, rol'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('positions').select('id, name').order('name'),
    ])
    setDepartments(deptRes.data || [])
    setPositions(posRes.data || [])

    const map = {}
    for (const row of accesRes.data || []) {
      if (!map[row.angajat_id]) map[row.angajat_id] = {}
      map[row.angajat_id][row.tool] = row.rol
    }

    setAngajati(angajatiRes.data || [])
    setAccesMap(map)
    setLoading(false)
  }

  async function handleChange(angajatId, tool, newRol) {
    const key = `${angajatId}-${tool}`
    setSavingKey(key)

    if (newRol === '') {
      await supabase
        .from('acces_tooluri')
        .delete()
        .eq('angajat_id', angajatId)
        .eq('tool', tool)
    } else {
      await supabase
        .from('acces_tooluri')
        .upsert(
          { angajat_id: angajatId, tool, rol: newRol },
          { onConflict: 'angajat_id,tool' }
        )
    }

    setAccesMap((prev) => {
      const next = { ...prev, [angajatId]: { ...prev[angajatId] } }
      if (newRol === '') {
        delete next[angajatId][tool]
      } else {
        next[angajatId][tool] = newRol
      }
      return next
    })

    setSavingKey(null)
  }

  // Același acces pentru mai mulți angajați deodată (cei bifați).
  async function aplicaBulk() {
    const ids = [...selectati]
    if (ids.length === 0) return
    const tool = TOOLS.find((t) => t.key === bulkTool)
    const eticheta = bulkRol === '' ? 'FĂRĂ ACCES' : labelRol(bulkTool, bulkRol)
    if (!window.confirm(`Setezi „${eticheta}" la ${tool.label} pentru ${ids.length} persoane? Accesul lor actual la ${tool.label} se înlocuiește.`)) return
    setBulkBusy(true)
    setBulkMesaj('')
    const { error } =
      bulkRol === ''
        ? await supabase.from('acces_tooluri').delete().eq('tool', bulkTool).in('angajat_id', ids)
        : await supabase.from('acces_tooluri').upsert(ids.map((angajat_id) => ({ angajat_id, tool: bulkTool, rol: bulkRol })), { onConflict: 'angajat_id,tool' })
    setBulkBusy(false)
    if (error) return setBulkMesaj('Nu am putut salva accesul. Încearcă din nou.')
    setAccesMap((prev) => {
      const next = { ...prev }
      for (const id of ids) {
        next[id] = { ...next[id] }
        if (bulkRol === '') delete next[id][bulkTool]
        else next[id][bulkTool] = bulkRol
      }
      return next
    })
    setBulkMesaj(`Gata: ${ids.length} persoane actualizate.`)
    setSelectati(new Set())
  }

  if (loading) return <p className="text-sm text-slate-500">Se încarcă...</p>

  const vizibili = angajati.filter((a) => potrivesteFiltru(a, filtru))

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Acces Tool-uri</h2>
      <p className="text-sm text-slate-500 mb-6">
        Alege ce rol are fiecare angajat pentru fiecare tool. „Fără acces" elimină intrarea.
      </p>

      <FiltruAngajati
        value={filtru}
        onChange={setFiltru}
        departments={departments}
        positions={positions}
        total={angajati.length}
        afisati={vizibili.length}
      />
      {selectati.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm">
          <span className="font-medium text-slate-700">{selectati.size} selectați</span>
          <span className="text-slate-500">dă acces la</span>
          <select
            value={bulkTool}
            onChange={(e) => {
              setBulkTool(e.target.value)
              setBulkRol(TOOLS.find((t) => t.key === e.target.value).roles[0])
            }}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"
          >
            {TOOLS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <span className="text-slate-500">cu rolul</span>
          <select value={bulkRol} onChange={(e) => setBulkRol(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5">
            <option value="">Fără acces (elimină)</option>
            {TOOLS.find((t) => t.key === bulkTool).roles.map((r) => (
              <option key={r} value={r}>{labelRol(bulkTool, r)}</option>
            ))}
          </select>
          <button type="button" disabled={bulkBusy} onClick={aplicaBulk} className="rounded-lg bg-accent px-4 py-1.5 font-medium text-white hover:bg-accent-hover disabled:opacity-50">
            {bulkBusy ? 'Se aplică…' : 'Aplică'}
          </button>
          <button type="button" onClick={() => setSelectati(new Set())} className="text-slate-500 hover:underline">Renunță</button>
        </div>
      )}
      {bulkMesaj && <p className="mb-3 text-sm text-slate-600">{bulkMesaj}</p>}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Selectează toți angajații afișați"
                  checked={vizibili.length > 0 && vizibili.every((a) => selectati.has(a.id))}
                  onChange={(e) => setSelectati(e.target.checked ? new Set(vizibili.map((a) => a.id)) : new Set())}
                />
              </th>
              <th className="px-4 py-3 font-medium">Angajat</th>
              {TOOLS.map((t) => (
                <th key={t.key} className="px-4 py-3 font-medium">
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vizibili.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Selectează ${a.nume_complet}`}
                    checked={selectati.has(a.id)}
                    onChange={(e) => setSelectati((p) => { const n = new Set(p); e.target.checked ? n.add(a.id) : n.delete(a.id); return n })}
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-800">{a.nume_complet}</p>
                  <p className="text-xs text-slate-400">{a.email}</p>
                </td>
                {TOOLS.map((t) => {
                  const key = `${a.id}-${t.key}`
                  const current = accesMap[a.id]?.[t.key] || ''
                  return (
                    <td key={t.key} className="px-4 py-3">
                      <select
                        value={current}
                        disabled={savingKey === key}
                        onChange={(e) => handleChange(a.id, t.key, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                      >
                        <option value="">Fără acces</option>
                        {t.roles.map((r) => (
                          <option key={r} value={r}>
                            {labelRol(t.key, r)}
                          </option>
                        ))}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
