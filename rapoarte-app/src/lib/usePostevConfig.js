import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Încarcă o singură dată configurarea modulului post-eveniment.
export function usePostevConfig() {
  const [cfg, setCfg] = useState({ loading: true, tipuri: [], campuri: [], matrice: [], angajati: [] })

  useEffect(() => {
    let activ = true
    Promise.all([
      supabase.from('tipuri_eveniment').select('*').order('ordine'),
      supabase.from('rap_tipuri').select('cod, prioritate'),
      supabase.from('rap_postev_campuri').select('*').order('ordine'),
      supabase.from('rap_postev_campuri_tipuri').select('*'),
      supabase.from('angajati').select('id, nume_complet, activ').order('nume_complet'),
    ]).then(([t, rt, c, m, a]) => {
      if (!activ) return
      setCfg({
        loading: false,
        // numele, culoarea și starea tipurilor vin din Calendar; Rapoarte adaugă doar prioritatea
        tipuri: (t.data || []).map((x) => ({
          ...x,
          prioritate: (rt.data || []).find((r) => r.cod === x.cod)?.prioritate ?? 4,
        })),
        campuri: c.data || [],
        matrice: m.data || [],
        angajati: a.data || [],
      })
    })
    return () => {
      activ = false
    }
  }, [])

  return cfg
}
