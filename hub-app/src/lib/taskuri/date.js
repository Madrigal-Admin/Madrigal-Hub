import { supabase } from '../../supabaseClient'

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

// Tabelele pentru taskurile Media (migrarea 22). Dacă migrarea nu e rulată încă, lista rămâne goală și restul Hub-ului merge ca înainte.
async function toateOpt(tabel, ord) {
  try { return await toate(tabel, '*', ord) } catch { return [] }
}

export async function incarcaTaskuri() {
  const [destinatii, membriDest, categorii, sabloane] = await Promise.all([
    toateOpt('tsk_destinatii', 'ordine'),
    toateOpt('tsk_destinatii_membri', 'destinatie_id'),
    toateOpt('tsk_destinatii_categorii', 'ordine'),
    toateOpt('tsk_sabloane_campuri', 'ordine'),
  ])
  const [angajati, grupuri, membri, evenimente, statusuri, taskuri, colaboratori, sectiuni, itemi, acces, necitite] =
    await Promise.all([
      toate('angajati', 'id, nume_complet, activ', 'nume_complet'),
      toate('tsk_grupuri', '*', 'nume'),
      toate('tsk_grup_membri', '*', 'grup_id'),
      toate('evenimente', 'id, nume, data, data_sfarsit, ora_inceput, ora_sfarsit, status, localitate, locatie, checklist_generat, eveniment_pm(angajat_id)', 'data'),
      toate('statusuri_eveniment', '*', 'ordine'),
      toate('tsk_taskuri', '*', 'id'),
      toate('tsk_colaboratori', '*', 'task_id'),
      toate('tsk_checklist_sectiuni', '*', 'ordine'),
      toate('tsk_checklist_itemi', '*', 'ordine'),
      supabase.rpc('tsk_angajati_cu_acces'),
      // Nou pentru tine: RLS întoarce doar rândurile mele. Dacă migrarea 20 nu e rulată încă, lista rămâne goală.
      supabase.from('tsk_necitite').select('task_id, motiv').then((r) => r.data || []),
    ])
  return {
    destinatii,
    membriDest,
    categorii,
    sabloane,
    angajati,
    grupuri,
    membri,
    evenimente: evenimente.map((e) => ({ ...e, pm: (e.eveniment_pm || []).map((p) => p.angajat_id) })),
    statusuri,
    taskuri,
    colaboratori,
    sectiuni,
    itemi,
    // task_id -> 'atribuit' | 'mentiune' | 'actualizat'
    necitite: Object.fromEntries(necitite.map((r) => [r.task_id, r.motiv])),
    // angajat_id -> rol în Taskuri (lipsește dacă nu are acces)
    acces: Object.fromEntries((acces.data || []).map((r) => [r.angajat_id, r.rol])),
  }
}
