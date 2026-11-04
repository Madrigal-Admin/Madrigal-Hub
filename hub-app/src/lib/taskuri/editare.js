import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { mesajEroare } from './ui'

export const ORDINE_STATUS = { de_facut: 0, in_lucru: 1, terminat: 2, anulat: 3 }
export const ORDINE_PRIORITATE = { mare: 0, medie: 1, mica: 2 }

// În liste se editează direct doar taskurile deschise de tine (și doar dacă nu sunt înghețate).
export const poateEditaInLista = (ctx, t) =>
  t.creat_de === ctx.me.id &&
  ctx.poateGestiona(t) &&
  !ctx.inghetat(t) &&
  !(t.tip === 'eveniment' && ctx.evenimentAnulat(t.eveniment_id))

// Ștergerea: aceeași regulă ca în fereastra taskului (cine gestionează taskul, dacă evenimentul nu e anulat).
// Baza de date verifică oricum dreptul.
export const poateSterge = (ctx, t) => ctx.poateGestiona(t) && !(t.tip === 'eveniment' && ctx.evenimentAnulat(t.eveniment_id))

// Șterge definitiv taskuri. Întoarce un mesaj de eroare, sau '' dacă a mers.
export async function stergeTaskuri(ids) {
  const { error } = await supabase.from('tsk_taskuri').delete().in('id', ids)
  return error ? mesajEroare(error, 'Nu am putut șterge.') : ''
}

// Salvează câmpuri pe un task. Întoarce un mesaj de eroare, sau '' dacă a mers.
export async function actualizeaza(id, patch) {
  const { error } = await supabase.from('tsk_taskuri').update(patch).eq('id', id)
  return error ? mesajEroare(error) : ''
}

// Cine poate fi responsabil pentru un task (același regulă ca în formular).
export function optiuniResponsabil(ctx, t) {
  let lista = ctx.angajatiCuAcces
  if (t.tip === 'operational' && t.grup_id && !ctx.admin) {
    const ids = new Set(ctx.membri.filter((m) => m.grup_id === t.grup_id).map((m) => m.angajat_id))
    lista = lista.filter((a) => ids.has(a.id))
  }
  return lista
}

export const COLOANE_OPTIONALE = [
  ['deadline', 'Deadline'],
  ['responsabil', 'Responsabil'],
  ['tag', 'Tag'],
  ['deschis', 'Deschis de'],
  ['prioritate', 'Prioritate'],
]
const IMPLICIT = { deadline: true, responsabil: true, tag: false, deschis: true, prioritate: true }
const CHEIE = 'tsk-coloane'

// Coloanele alese se țin minte în acest browser (aceeași alegere pentru toate listele).
export function useColoane() {
  const [coloane, setColoane] = useState(() => {
    try {
      return { ...IMPLICIT, ...JSON.parse(localStorage.getItem(CHEIE) || '{}') }
    } catch {
      return IMPLICIT
    }
  })
  function schimba(cheie, valoare) {
    setColoane((c) => {
      const nou = { ...c, [cheie]: valoare }
      try { localStorage.setItem(CHEIE, JSON.stringify(nou)) } catch { /* fără stocare locală */ }
      return nou
    })
  }
  return [coloane, schimba]
}
