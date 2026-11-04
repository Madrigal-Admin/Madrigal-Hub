import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { plusZile } from '../../components/home/date'

// Evenimentele care au deja raport post-eveniment (mulțime de id-uri), sau null cât timp nu se știe
// (nu ai acces la Rapoarte, ori încă se încarcă). Fără știrea asta nu afișăm „Raport lipsă".
export function useRaportate(areRapoarte) {
  const [raportate, setRaportate] = useState(null)
  useEffect(() => {
    if (!areRapoarte) return
    supabase.rpc('rap_evenimente_raportate').then(({ data, error }) => setRaportate(error ? null : new Set(data || [])))
  }, [areRapoarte])
  return raportate
}

// Evenimente încheiate din ultimele 120 de zile, la care ești PM, fără raport depus.
export const raportLipsa = (e, ctx, raportate) =>
  !!raportate &&
  ctx.comportament(e.id) === 'finalizat' &&
  ctx.pmLaEveniment(e.id) &&
  !raportate.has(e.id) &&
  (e.data_sfarsit || e.data || '') >= plusZile(-120)

export const linkRaport = (e) => `/rapoarte/?postev=${e.id}`
