import { azi } from './ui'

// Perioadele din dropdown-ul dashboardului „Echipa mea". Se aplică după TERMEN.
export const PERIOADE = [
  ['toate', 'Toate'],
  ['azi', 'Azi'],
  ['sapt', 'Săptămâna asta'],
  ['luna', 'Luna asta'],
  ['l3', 'Ultimele 3 luni'],
  ['an', 'Anul acesta'],
  ['ant', 'Anul precedent'],
]

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const dinIso = (s) => {
  const [a, l, z] = s.split('-').map(Number)
  return new Date(a, l - 1, z)
}

// întoarce { start, end } (text AAAA-LL-ZZ, capetele incluse) sau null pentru „Toate"
export function interval(cod) {
  const a = dinIso(azi())
  const an = a.getFullYear()
  if (cod === 'azi') return { start: iso(a), end: iso(a) }
  if (cod === 'sapt') {
    const luni = new Date(a); luni.setDate(a.getDate() - ((a.getDay() + 6) % 7))
    const dum = new Date(luni); dum.setDate(luni.getDate() + 6)
    return { start: iso(luni), end: iso(dum) }
  }
  if (cod === 'luna') return { start: iso(new Date(an, a.getMonth(), 1)), end: iso(new Date(an, a.getMonth() + 1, 0)) }
  if (cod === 'l3') { const s = new Date(a); s.setMonth(a.getMonth() - 3); s.setDate(s.getDate() + 1); return { start: iso(s), end: iso(a) } }
  if (cod === 'an') return { start: `${an}-01-01`, end: `${an}-12-31` }
  if (cod === 'ant') return { start: `${an - 1}-01-01`, end: `${an - 1}-12-31` }
  return null
}

export const inInterval = (t, iv) => !iv || (!!t.termen && t.termen.slice(0, 10) >= iv.start && t.termen.slice(0, 10) <= iv.end)
