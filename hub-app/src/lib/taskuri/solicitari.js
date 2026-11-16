// Ajutoare pentru taskurile Media („solicitări"): formatare valori, perechi cheie–etichetă–valoare, titlu automat.

export const dataRo = (s) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : '')
export const COD_EV = '__ev' // opțiunea „locația din eveniment"
export const esteAltul = (eticheta) => (eticheta || '').trim().toLowerCase() === 'altul'

// opțiunile unui câmp (cele active; cele dezactivate rămân doar în taskurile vechi)
export const optiuniActive = (camp) => (camp.optiuni || []).filter((o) => o.activ !== false)

// Locația din evenimentul ales (ca opțiune în plus la lista de locații)
export const locatieEveniment = (ev) => (ev ? (ev.locatie || ev.localitate || '').trim() : '')

export function optiuniCamp(camp, ev) {
  const lista = optiuniActive(camp)
  if (camp.cheie === 'locatie' && locatieEveniment(ev)) return [{ cod: COD_EV, eticheta: locatieEveniment(ev) }, ...lista]
  return lista
}

// Valoarea brută din formular -> text afișat
export function valoareAfisata(camp, v, { ev, nume } = {}) {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return ''
  const optiuni = optiuniCamp(camp, ev)
  const eticheta = (cod) => optiuni.find((o) => o.cod === cod)?.eticheta || (camp.optiuni || []).find((o) => o.cod === cod)?.eticheta || cod
  switch (camp.tip) {
    case 'lista': return eticheta(v)
    case 'multi': return v.map(eticheta).join(', ')
    case 'data': return dataRo(v)
    case 'persoana': return nume ? nume(v) : v
    default: return String(v).trim()
  }
}

// Perechile care se salvează pe task, în ordinea șablonului
export function construiestePerechi(campuri, valori, ctx, ev) {
  return campuri
    .filter((c) => c.activ)
    .map((c) => ({ cheie: c.cheie, eticheta: c.eticheta, tip: c.tip, valoare: valoareAfisata(c, valori[c.cheie], { ev, nume: ctx.nume }) }))
    .filter((p) => p.valoare !== '')
}

// Titlul sugerat: „<Material sau Serviciu> – <Eveniment>"
export function titluAuto(campuri, valori, ctx, ev, categorie) {
  const cheie = campuri.find((c) => c.tip === 'lista' && (c.cheie === 'material' || c.cheie === 'serviciu'))
  const baza = cheie ? valoareAfisata(cheie, valori[cheie.cheie], { ev }) : ''
  const nume = baza || categorie?.nume || ''
  return ev ? (nume ? `${nume} – ${ev.nume}` : ev.nume) : nume
}

// Care câmpuri obligatorii lipsesc / sunt invalide? Întoarce un mesaj în română sau ''.
export function valideazaCampuri(campuri, valori) {
  for (const c of campuri.filter((x) => x.activ)) {
    const v = valori[c.cheie]
    const gol = v === undefined || v === null || String(v).trim() === '' || (Array.isArray(v) && v.length === 0)
    if (c.obligatoriu && gol) return `Completează câmpul „${c.eticheta}”.`
    if (gol) continue
    if (c.tip === 'link' && !/^https?:\/\/\S+$/i.test(String(v).trim())) return `„${c.eticheta}”: linkul trebuie să înceapă cu http:// sau https://.`
    if (c.tip === 'numar' && !(Number.isInteger(Number(v)) && Number(v) >= 1)) return `„${c.eticheta}”: scrie un număr întreg, minim 1.`
  }
  return ''
}
