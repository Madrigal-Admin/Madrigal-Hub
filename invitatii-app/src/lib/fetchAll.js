// PostgREST întoarce cel mult 1000 de rânduri per cerere. Funcția citește pagină cu pagină,
// până nu mai rămâne nimic. `construieste` primește (de, pana) și întoarce interogarea Supabase
// cu .range(de, pana) aplicat. Exemplu:
//   fetchAll((a, b) => supabase.from('persoane').select('*').order('nume').range(a, b))
const PAGINA = 1000

export async function fetchAll(construieste) {
  const rezultat = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await construieste(de, de + PAGINA - 1)
    if (error) return { data: null, error }
    rezultat.push(...(data || []))
    if (!data || data.length < PAGINA) break
  }
  return { data: rezultat, error: null }
}
