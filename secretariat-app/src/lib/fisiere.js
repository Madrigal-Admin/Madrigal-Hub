import { supabase } from '../supabaseClient'

export const BUCKET = 'secretariat-documente'
export const MAX_PDF = 25 * 1024 * 1024
export const MAX_IMAGINE = 10 * 1024 * 1024
const MAX_LATURA = 2500 // pixeli, latura lungă a unei imagini (aprox. A4 la 300 dpi)

const EXTENSII = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

// Pozele (JPEG/PNG) se micșorează în browser. PDF-urile NU se modifică niciodată
// (un PDF semnat electronic și-ar pierde semnătura dacă ar fi recomprimat).
async function comprimaImagine(file) {
  try {
    const bmp = await createImageBitmap(file)
    const scala = Math.min(1, MAX_LATURA / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scala))
    const h = Math.max(1, Math.round(bmp.height * scala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
    if (blob && blob.size < file.size) {
      return { blob, tip: 'image/jpeg', nume: file.name.replace(/\.[^.]+$/, '') + '.jpg' }
    }
  } catch {
    /* dacă imaginea nu poate fi procesată, o păstrăm așa cum este */
  }
  return { blob: file, tip: file.type, nume: file.name }
}

// Verifică și pregătește fișierul. Aruncă o eroare cu mesaj în română dacă nu e acceptat.
export async function pregatesteFisier(file) {
  if (!EXTENSII[file.type]) throw new Error('Sunt permise doar fișiere PDF, JPEG și PNG.')
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF) throw new Error('PDF-ul depășește 25 MB. Rescanează-l la o rezoluție mai mică (200 dpi, alb-negru sau tonuri de gri).')
    return { blob: file, tip: file.type, nume: file.name }
  }
  const r = await comprimaImagine(file)
  if (r.blob.size > MAX_IMAGINE) throw new Error('Imaginea depășește 10 MB chiar și după micșorare.')
  return r
}

// Încarcă fișierul în spațiul privat, apoi îl înregistrează ca versiune nouă a documentului.
export async function incarcaVersiune(docId, file) {
  const f = await pregatesteFisier(file)
  const path = `${docId}/${crypto.randomUUID()}.${EXTENSII[f.tip]}`
  const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, f.blob, { contentType: f.tip, upsert: false })
  if (eUp) throw eUp
  const { data, error } = await supabase.rpc('sec_adauga_versiune', { p_doc: docId, p_path: path, p_nume: f.nume })
  if (error) throw error
  return data
}

// Deschide un fișier într-o filă nouă printr-un link semnat, valabil 60 de secunde.
export async function deschideFisier(path) {
  const fereastra = window.open('', '_blank') // se deschide imediat, ca browserul să nu o blocheze
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
  if (error || !data?.signedUrl) {
    fereastra?.close()
    throw error || new Error('Nu s-a putut deschide fișierul.')
  }
  if (fereastra) fereastra.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}
