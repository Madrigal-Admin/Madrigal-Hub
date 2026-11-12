export function formatData(valoare) {
  if (!valoare) return ''
  // „2026-11-12” (coloană de tip dată) se afișează fără decalaj de fus orar
  const d = /^\d{4}-\d{2}-\d{2}$/.test(valoare) ? new Date(`${valoare}T12:00:00`) : new Date(valoare)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDataOra(valoare) {
  if (!valoare) return ''
  const d = new Date(valoare)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatMarime(octeti) {
  if (octeti == null) return ''
  if (octeti < 1024) return `${octeti} B`
  if (octeti < 1024 * 1024) return `${Math.round(octeti / 1024)} KB`
  return `${(octeti / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export const azi = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Mesajul de eroare pentru utilizator: funcțiile din bază dau deja mesaje în română.
export function mesajEroare(err) {
  if (!err) return ''
  const m = err.message || String(err)
  if (/row-level security|permission denied/i.test(m)) return 'Nu ai dreptul să faci această acțiune.'
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Nu s-a putut contacta serverul. Verifică conexiunea la internet și încearcă din nou.'
  return m
}
