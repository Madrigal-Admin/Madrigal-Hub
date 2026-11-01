import { supabase } from '../supabaseClient'

export const IMPLICARI = ['Organizator', 'Partener', 'Invitat']

export const IMPLICARE_CULORI = {
  Organizator: '#f76808',
  Partener: '#ffc53d',
  Invitat: '#30a46c',
}

export const PALETA = ['#7F77DD', '#1D9E75', '#D85A30', '#D4537E', '#378ADD', '#BA7517', '#639922', '#5F5E5A', '#e5484d', '#f76808']

export const ZILE_SAPT = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm', 'Dum']
export const LUNI = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
]

export function formatData(dataStr) {
  if (!dataStr) return '—'
  return new Date(dataStr).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Data locală (nu UTC) — altfel, în România, ziua apărea mutată cu o zi.
export function ymd(date) {
  const a = date.getFullYear()
  const l = String(date.getMonth() + 1).padStart(2, '0')
  const z = String(date.getDate()).padStart(2, '0')
  return `${a}-${l}-${z}`
}

// "19:00" sau "19:00–21:00"; nimic dacă n-ai setat ora.
export function formatOra(e) {
  if (!e.ora_inceput) return ''
  return e.ora_sfarsit && e.ora_sfarsit !== e.ora_inceput ? `${e.ora_inceput}–${e.ora_sfarsit}` : e.ora_inceput
}

// Toate zilele unui eveniment, de la început la sfârșit (max 60 de zile).
export function zileEveniment(e) {
  if (!e.data) return []
  const start = e.data
  const end = e.data_sfarsit && e.data_sfarsit >= e.data ? e.data_sfarsit : e.data
  const zile = []
  const cursor = new Date(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10)))
  for (let i = 0; i < 60; i++) {
    const d = cursor.toISOString().slice(0, 10)
    if (d > end) break
    zile.push(d)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return zile
}

// Variantă mai închisă a unei culori, ca textul să se citească pe fundal deschis.
export function culoareText(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#475569'
  const n = parseInt(m[1], 16)
  const f = (v) => Math.round(v * 0.72).toString(16).padStart(2, '0')
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`
}

export function initiale(nume) {
  const cuvinte = (nume || '').trim().split(/\s+/)
  if (cuvinte.length === 1) return cuvinte[0].slice(0, 3).toUpperCase()
  return cuvinte.slice(0, 2).map((c) => c[0]).join('').toUpperCase()
}

// Cod scurt, fără diacritice, pentru un tip sau status nou.
export function slug(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

// Încarcă tot ce are nevoie calendarul și statisticile, dintr-o singură trecere.
export async function incarcaTot() {
  const [ev, tp, st, ang] = await Promise.all([
    supabase
      .from('evenimente')
      .select('*, eveniment_tipuri(tip_cod), eveniment_pm(angajat_id)')
      .order('data', { ascending: true }),
    supabase.from('tipuri_eveniment').select('*').order('ordine'),
    supabase.from('statusuri_eveniment').select('*').order('ordine'),
    supabase.from('angajati').select('id, nume_complet, activ').order('nume_complet'),
  ])
  const eroare = ev.error || tp.error || st.error || ang.error
  return {
    eroare: eroare ? 'Nu am putut încărca evenimentele.' : '',
    evenimente: (ev.data || []).map((e) => ({
      ...e,
      tipuri: (e.eveniment_tipuri || []).map((t) => t.tip_cod),
      pm: (e.eveniment_pm || []).map((p) => p.angajat_id),
    })),
    tipuri: tp.data || [],
    statusuri: st.data || [],
    angajati: ang.data || [],
  }
}
