import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Categoriile de invitați (editabile din Setări). `active` = cele care se mai oferă;
// `toate` include și categoriile arhivate (ex. „Prieteni/Familie”), pentru filtre și istoric.
export function useCategorii() {
  const [toate, setToate] = useState([])
  const [loading, setLoading] = useState(true)

  const reincarca = useCallback(async () => {
    const { data } = await supabase.from('invitatii_categorii').select('id, nume, arhivata').order('nume')
    setToate(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reincarca()
  }, [reincarca])

  return { toate, active: toate.filter((c) => !c.arhivata), loading, reincarca }
}
