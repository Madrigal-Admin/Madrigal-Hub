// Județe și localități (SIRUTA) pentru alegerea localității în Calendar.
// Fișierul de date (data/siruta.json, ~160 KB comprimat) se încarcă doar când e nevoie.
export const STRAINATATE = 'În afara României'

export const norm = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

let incarcare = null
export function incarcaSiruta() {
  incarcare ||= import('../data/siruta.json').then((m) => {
    const d = m.default
    const intrari = d.loc.map(([nume, j, u, siruta]) => ({
      nume,
      judet: d.judete[j],
      uat: { nume: d.uat[u][0], tip: d.uat[u][2] },
      siruta,
      cheie: norm(nume),
    }))
    return { judete: d.judete, intrari }
  })
  return incarcare
}

// „Luceni, com. Victoria" – când localitatea face parte dintr-un alt UAT, îl arătăm ca să le deosebim.
export const etichetaLocalitate = (e) => (e.uat.nume !== e.nume ? `${e.nume}, ${e.uat.tip} ${e.uat.nume}` : e.nume)

// Căutare fără diacritice: întâi cele care încep cu textul scris, apoi cele care îl conțin.
export function cauta(date, text, judet, limita = 8) {
  const q = norm(text)
  if (!q) return []
  const pot = judet ? date.intrari.filter((e) => e.judet === judet) : date.intrari
  const incep = []
  const contin = []
  for (const e of pot) {
    if (e.cheie.startsWith(q)) incep.push(e)
    else if (contin.length < limita && e.cheie.includes(q)) contin.push(e)
    if (incep.length >= limita) break
  }
  return [...incep, ...contin].slice(0, limita)
}

// Potrivire automată pentru valorile vechi, scrise liber („Bucuresti"): doar dacă există exact o localitate cu acel nume.
export function potriveste(date, localitate, judet) {
  const q = norm(localitate)
  if (!q) return null
  const gasite = date.intrari.filter((e) => e.cheie === q && (!judet || e.judet === judet))
  if (gasite.length === 1) return gasite[0]
  // „Iași" există și ca sat în alt județ: dacă exact una dintre ele e municipiu/oraș, o alegem pe aceea
  const orase = gasite.filter((e) => (e.uat.tip === 'mun.' || e.uat.tip === 'or.') && e.uat.nume === e.nume)
  return orase.length === 1 ? orase[0] : null
}
