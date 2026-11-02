// Logica formularului post-eveniment: tipuri, câmpuri vizibile, validare.

export const IMPLICARI = ['Organizator', 'Partener', 'Invitat']

// Dacă același câmp apare la mai multe tipuri, câștigă modul cel mai strict.
const RANG = { O: 4, B: 3, F: 2, C: 1 }

export const normalizeaza = (s) => (s ?? '').toString().trim().toLowerCase()

export const azi = () => new Date().toISOString().slice(0, 10)

// Câmpurile specifice care apar pentru combinația aleasă (reuniunea câmpurilor
// tipurilor bifate; fiecare câmp o singură dată).
export function campuriVizibile(campuri, matrice, tipuriAlese, implicare) {
  return campuri
    .filter((c) => c.activ)
    .sort((a, b) => a.ordine - b.ordine)
    .map((c) => {
      const moduri = matrice
        .filter((m) => m.camp_cod === c.cod && tipuriAlese.includes(m.tip_cod))
        .map((m) => m.mod)
      if (moduri.length === 0) return null
      let mod = moduri.sort((a, b) => RANG[b] - RANG[a])[0]
      if (mod === 'C') {
        // apare doar dacă „În calitate de" ≠ Organizator; atunci e obligatoriu
        if (!implicare || implicare === 'Organizator') return null
        mod = 'O'
      }
      return { ...c, mod }
    })
    .filter(Boolean)
}

const esteIntregPozitiv = (v) => /^\d+$/.test(String(v).trim()) && Number(v) >= 1

// Întoarce un mesaj de eroare sau '' dacă totul e în regulă.
export function valideaza(f, vizibile) {
  if (!f.tipuri.length) return 'Alege cel puțin un tip de eveniment.'
  if (!f.responsabil_angajat_id) return 'Alege responsabilul de eveniment.'
  if (!f.data_inceput || !f.data_sfarsit) return 'Completează data de început și data de încheiere.'
  if (f.data_sfarsit < f.data_inceput) return 'Data de încheiere nu poate fi înaintea celei de început.'
  if (f.data_sfarsit >= azi()) return 'Raportul se poate depune doar după încheierea evenimentului.'
  if (!f.implicare) return 'Alege calitatea CNCM-MC în cadrul evenimentului.'

  const loc = f.localitati.filter((l) => l.localitate.trim() || String(l.nr).trim())
  if (loc.length === 0) return 'Adaugă cel puțin o localitate.'
  for (const l of loc) {
    if (!l.localitate.trim()) return 'Fiecare linie de localități are nevoie de numele localității.'
    if (!esteIntregPozitiv(l.nr)) return `La „${l.localitate}" numărul de evenimente trebuie să fie un număr întreg, minimum 1.`
  }
  if (!f.locatie.trim()) return 'Completează locația.'
  if (f.echipa.length === 0) return 'Adaugă cel puțin o persoană în echipa de organizare.'
  if (!f.denumire_oficiala.trim()) return 'Completează denumirea oficială a evenimentului.'

  for (const c of vizibile) {
    if (c.tip === 'contacte') {
      const rows = f.contacte.filter((r) => Object.values(r).some((x) => String(x).trim()))
      if (rows.length === 0) return `„${c.eticheta}": adaugă cel puțin un contact.`
      for (const r of rows) {
        if (!r.institutie.trim() || !r.persoana.trim()) return `„${c.eticheta}": completează instituția și persoana de contact.`
      }
      continue
    }
    const val = f.valori[c.cod]
    const gol = val === undefined || val === null || String(val).trim() === ''
    if (c.tip === 'numar') {
      if (c.mod === 'B') {
        if (f.bife[c.cod] && !esteIntregPozitiv(val)) return `„${c.eticheta}": scrie un număr întreg, minimum 1 (sau debifează „a fost cazul").`
      } else if (c.mod === 'O') {
        if (!esteIntregPozitiv(val)) return `„${c.eticheta}": scrie un număr întreg, minimum 1.`
      } else if (!gol && !esteIntregPozitiv(val)) {
        return `„${c.eticheta}": scrie un număr întreg, minimum 1.`
      }
    } else {
      if (c.mod === 'O' && gol) return `„${c.eticheta}" este obligatoriu.`
      if (c.tip === 'link' && !gol && !/^https?:\/\/\S+$/i.test(String(val).trim())) {
        return `„${c.eticheta}": introdu un link complet, care începe cu http:// sau https://.`
      }
    }
  }
  return ''
}

export function curataLocalitati(localitati) {
  return localitati
    .filter((l) => l.localitate.trim())
    .map((l) => ({ localitate: l.localitate.trim(), nr: Number(l.nr) }))
}

export const totalEvenimente = (localitati) =>
  (localitati || []).reduce((s, l) => s + (Number(l.nr) || 0), 0)

// Valorile care se afișează / intră în statistici: doar cele ale câmpurilor vizibile
export function valoriVizibile(raport, vizibile) {
  const out = []
  for (const c of vizibile) {
    if (c.tip === 'contacte') continue
    if (c.mod === 'B' && !raport.bife?.[c.cod]) continue
    const v = raport.valori?.[c.cod]
    if (v === undefined || v === null || String(v).trim() === '') continue
    out.push({ camp: c, valoare: v })
  }
  return out
}
