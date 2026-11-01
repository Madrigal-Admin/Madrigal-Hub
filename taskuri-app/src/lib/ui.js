export const STATUSURI = [
  { cod: 'de_facut', nume: 'De făcut', cls: 'bg-slate-100 text-slate-700' },
  { cod: 'in_lucru', nume: 'În lucru', cls: 'bg-blue-100 text-blue-700' },
  { cod: 'terminat', nume: 'Terminat', cls: 'bg-emerald-100 text-emerald-700' },
  { cod: 'anulat', nume: 'Anulat', cls: 'bg-rose-100 text-rose-700' },
]
export const STATUS_DUPA_COD = Object.fromEntries(STATUSURI.map((s) => [s.cod, s]))

export const PRIORITATI = [
  { cod: 'mare', nume: 'Mare', cls: 'text-rose-600' },
  { cod: 'medie', nume: 'Medie', cls: 'text-amber-600' },
  { cod: 'mica', nume: 'Mică', cls: 'text-slate-400' },
]
export const PRIORITATE_DUPA_COD = Object.fromEntries(PRIORITATI.map((p) => [p.cod, p]))
const RANG_PRIORITATE = { mare: 0, medie: 1, mica: 2 }

export const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none'
export const labelCls = 'mb-1 block text-xs font-medium text-slate-600'

export function azi() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatData(s) {
  if (!s) return '—'
  const [a, l, z] = s.slice(0, 10).split('-').map(Number)
  return new Date(a, l - 1, z).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDataOra(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const estePrelucrat = (t) => t.status === 'de_facut' || t.status === 'in_lucru'
export const esteIntarziat = (t) => estePrelucrat(t) && t.termen && t.termen < azi()

// Termenele apropiate primele, cele fără termen la urmă; la termen egal, prioritatea mai mare.
export function sorteaza(taskuri) {
  return [...taskuri].sort((a, b) => {
    const ta = a.termen || '9999-99-99'
    const tb = b.termen || '9999-99-99'
    if (ta !== tb) return ta < tb ? -1 : 1
    return RANG_PRIORITATE[a.prioritate] - RANG_PRIORITATE[b.prioritate]
  })
}

export function mesajEroare(err, implicit = 'Nu am putut salva. Încearcă din nou.') {
  const m = err?.message || ''
  if (m.includes('row-level security') || m.includes('permission denied')) return 'Nu ai dreptul pentru această acțiune.'
  if (m.includes('link_document')) return 'Linkul trebuie să înceapă cu http:// sau https://.'
  if (err?.code === 'P0001') return m // mesajele scrise de noi în baza de date, deja în română
  return implicit
}
