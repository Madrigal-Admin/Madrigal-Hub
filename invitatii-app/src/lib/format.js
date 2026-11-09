export function formatData(dataStr) {
  if (!dataStr) return '—'
  return new Date(dataStr).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDataScurta(dataStr) {
  if (!dataStr) return '—'
  return new Date(dataStr).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

// "19:00–21:00" / "19:00" / ""
export function formatOra(ev) {
  const start = (ev.ora_inceput || '').slice(0, 5)
  const sfarsit = (ev.ora_sfarsit || '').slice(0, 5)
  if (start && sfarsit) return `${start}–${sfarsit}`
  return start || ''
}

export function azi() {
  const d = new Date()
  const luna = String(d.getMonth() + 1).padStart(2, '0')
  const zi = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${luna}-${zi}`
}

export function profilul(ev) {
  const p = ev.invitatii_profil_eveniment
  return (Array.isArray(p) ? p[0] : p) || null
}

// Mesaje în română pentru erorile ridicate de funcțiile din baza de date
const ERORI = {
  neautentificat: 'Trebuie să fii autentificat.',
  acces_interzis: 'Nu ai dreptul la această acțiune.',
  eveniment_indisponibil: 'Evenimentul nu mai primește solicitări.',
  fara_invitati: 'Adaugă cel puțin un invitat.',
  date_invalide: 'Verifică numele și adresele de email ale invitaților.',
  limita_depasita: 'Ai depăși limita ta de invitații pentru acest eveniment.',
  plafon_atins: 'Evenimentul a atins numărul maxim de persoane. Nu se mai pot trimite solicitări.',
  plafon_depasit: 'plafon_depasit',
  eveniment_inchis: 'Evenimentul este închis sau anulat.',
  stare_invalida: 'Cererea a fost deja procesată. Reîncarcă lista.',
  deja_prezent: 'Unul dintre invitați a fost deja marcat prezent la intrare, deci aprobarea nu se mai poate anula.',
  cerere_negasita: 'Cererea nu mai există. Reîncarcă lista.',
}

export function mesajEroare(error) {
  const text = error?.message || ''
  for (const cod of Object.keys(ERORI)) {
    if (text.includes(cod)) return ERORI[cod]
  }
  return text || 'A apărut o eroare. Încearcă din nou.'
}

export function esteEroareCod(error, cod) {
  return (error?.message || '').includes(cod)
}

// PM-urile și tipurile unui eveniment, ca nume (pe baza dicționarelor încărcate o dată)
export function randMeta(e, tipuri, angajati) {
  const pm = (e.eveniment_pm || []).map((x) => angajati[x.angajat_id]).filter(Boolean)
  const tipNume = (e.eveniment_tipuri || []).map((x) => tipuri[x.tip_cod] || x.tip_cod)
  return { pm, tipNume }
}
