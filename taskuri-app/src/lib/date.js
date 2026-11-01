import { supabase } from '../supabaseClient'

// Citește toate rândurile unui tabel, în pagini (limita implicită Supabase e 1000).
async function toate(tabel, select = '*', ord = 'id') {
  const out = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from(tabel).select(select).order(ord).range(de, de + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export async function incarcaTot() {
  const [angajati, grupuri, membri, evenimente, statusuri, taskuri, colaboratori, sectiuni, itemi, acces] =
    await Promise.all([
      toate('angajati', 'id, nume_complet, activ', 'nume_complet'),
      toate('tsk_grupuri', '*', 'nume'),
      toate('tsk_grup_membri', '*', 'grup_id'),
      toate('evenimente', 'id, nume, data, data_sfarsit, status, localitate, checklist_generat, eveniment_pm(angajat_id)', 'data'),
      toate('statusuri_eveniment', '*', 'ordine'),
      toate('tsk_taskuri', '*', 'id'),
      toate('tsk_colaboratori', '*', 'task_id'),
      toate('tsk_checklist_sectiuni', '*', 'ordine'),
      toate('tsk_checklist_itemi', '*', 'ordine'),
      supabase.rpc('tsk_angajati_cu_acces'),
    ])
  return {
    angajati,
    grupuri,
    membri,
    evenimente: evenimente.map((e) => ({ ...e, pm: (e.eveniment_pm || []).map((p) => p.angajat_id) })),
    statusuri,
    taskuri,
    colaboratori,
    sectiuni,
    itemi,
    // angajat_id -> rol în Taskuri (lipsește dacă nu are acces)
    acces: Object.fromEntries((acces.data || []).map((r) => [r.angajat_id, r.rol])),
  }
}
