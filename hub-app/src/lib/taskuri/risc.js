import { azi } from './ui'

// „Evenimente la risc": semafor calculat din taskurile deschise ale evenimentului.
//  ROȘU   – începe în ≤ 14 zile și are taskuri întârziate, SAU începe în ≤ 7 zile și are taskuri fără responsabil / fără termen
//  GALBEN – are taskuri întârziate, SAU (în ≤ 30 de zile) taskuri fără responsabil / fără termen
//  VERDE  – în rest
export const NIVELE = {
  rosu: { eticheta: 'Risc mare', bg: '#FBE4E2', text: '#B4332E', punct: '#B4332E', ordine: 0 },
  galben: { eticheta: 'Atenție', bg: '#FFF1D6', text: '#8A4B12', punct: '#E0A21B', ordine: 1 },
  verde: { eticheta: 'În grafic', bg: '#E3F4EA', text: '#1E6B43', punct: '#2E9E6B', ordine: 2 },
}

const MS_ZI = 86400000
const zileIntre = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / MS_ZI)

export function riscEveniment(ev, taskuri) {
  const a = azi()
  const zile = ev?.data ? zileIntre(a, ev.data) : 999
  const deschise = taskuri.filter((t) => t.eveniment_id === ev.id && (t.status === 'de_facut' || t.status === 'in_lucru'))
  const intarziate = deschise.filter((t) => t.termen && t.termen < a).length
  const faraResp = deschise.filter((t) => !t.responsabil_id).length
  const faraTermen = deschise.filter((t) => !t.termen).length
  let nivel = 'verde'
  if ((zile <= 14 && intarziate > 0) || (zile <= 7 && (faraResp > 0 || faraTermen > 0))) nivel = 'rosu'
  else if (intarziate > 0 || (zile <= 30 && (faraResp > 0 || faraTermen > 0))) nivel = 'galben'
  const motive = []
  if (intarziate) motive.push(`${intarziate} ${intarziate === 1 ? 'întârziat' : 'întârziate'}`)
  if (faraResp) motive.push(`${faraResp} fără responsabil`)
  if (faraTermen) motive.push(`${faraTermen} fără termen`)
  return { nivel, zile, intarziate, faraResp, faraTermen, motive, text: motive.join(' · ') || 'Totul la zi' }
}

export const textZile = (z) => (z < 0 ? 'în desfășurare' : z === 0 ? 'azi' : z === 1 ? 'mâine' : `în ${z} zile`)

// Taskurile deschise, fără responsabil, ale evenimentelor date.
export function deAlocat(taskuri, evenimente) {
  const ids = new Set(evenimente.map((e) => e.id))
  return taskuri.filter((t) => ids.has(t.eveniment_id) && !t.responsabil_id && (t.status === 'de_facut' || t.status === 'in_lucru'))
}
