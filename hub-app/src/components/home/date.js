// Ajutoare pentru homepage: zile (pe ora locală, nu UTC), grupare taskuri, nume.
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const azi = () => ymd(new Date())
export function plusZile(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return ymd(d)
}

const LUNI_SCURT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']
export function dataScurta(s) {
  if (!s) return ''
  return `${+s.slice(8, 10)} ${LUNI_SCURT[+s.slice(5, 7) - 1]}`
}
export const luna = (s) => LUNI_SCURT[+s.slice(5, 7) - 1]
export const zi = (s) => +s.slice(8, 10)

export function dataAzi() {
  const t = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Numele complet e scris „Nume Prenume ..." (ex.: „Niculae Cătălin Andrei") — prenumele e al doilea cuvânt.
export function prenume(numeComplet) {
  const c = (numeComplet || '').trim().split(/\s+/)
  return c.length > 1 ? c[1] : c[0] || ''
}

export const GRUPE = ['Întârziate', 'Azi', 'Următoarele 7 zile', 'Mai târziu', 'Fără termen']
export function grupa(t) {
  if (!t.termen) return 'Fără termen'
  const a = azi()
  if (t.termen < a) return 'Întârziate'
  if (t.termen === a) return 'Azi'
  if (t.termen <= plusZile(7)) return 'Următoarele 7 zile'
  return 'Mai târziu'
}
export const esteDeschis = (t) => t.status === 'de_facut' || t.status === 'in_lucru'
