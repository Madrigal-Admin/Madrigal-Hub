// netlify/functions/send-brevo.js
//
// Trimite prin Brevo invitațiile unui eveniment, ÎN LOTURI. Apelată repetat de
// butonul "Trimite invitații" din tab-ul Invitații / Conținut & trimitere,
// până când răspunsul spune `ramase: 0` (sau `oprit_limita: true`).
//
// Se trimit doar invitațiile care:
//   - sunt în așteptare și netrimise încă (trimis_la gol),
//   - nu au o eroare anterioară (eroare_trimitere goală),
//   - aparțin unei persoane abonate (abonat_invitatii = true) cu adresă de email.
// Cei dezabonați NU primesc niciodată email, indiferent cum au ajuns pe listă.
//
// Parametri (JSON): eveniment_id (obligatoriu), reseteaza_erori (opțional):
// șterge erorile anterioare ale evenimentului, ca invitațiile eșuate să fie
// reîncercate în acest ciclu.
//
// Variabile de mediu necesare (setate în Netlify, fără prefix VITE_):
//   BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME (opțional),
//   SITE_URL                (ex. https://madrigalhub.netlify.app)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

const LOT = 30 // invitații procesate la un apel (încape în timpul funcției)
const PARALEL = 5 // emailuri trimise simultan către Brevo
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

function formatData(dataStr) {
  if (!dataStr) return ''
  return new Date(dataStr).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function esc(t) {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Înlocuiește {{nume}}, {{prenume}}, {{nume_familie}}, {{institutie}}, {{functie}}
function inlocuieste(text, valori) {
  return (text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in valori ? valori[k] : m))
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const authHeader = event.headers.authorization || event.headers.Authorization
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return json(401, { error: 'Lipsește tokenul de autentificare.' })

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ANON_KEY = process.env.SUPABASE_ANON_KEY
  const BREVO_API_KEY = process.env.BREVO_API_KEY
  const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL
  const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME
  const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '')

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !BREVO_API_KEY || !BREVO_SENDER_EMAIL || !SITE_URL) {
    return json(500, { error: 'Variabile de mediu lipsă pe server.' })
  }

  let evenimentId
  let reseteazaErori = false
  try {
    const body = JSON.parse(event.body || '{}')
    evenimentId = body.eveniment_id
    reseteazaErori = body.reseteaza_erori === true
  } catch {
    return json(400, { error: 'Corp de cerere invalid.' })
  }
  if (!evenimentId || !UUID.test(evenimentId)) return json(400, { error: 'Lipsește sau e invalid eveniment_id.' })

  const sb = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

  // 1. Verificăm identitatea + rolul (doar Admin complet la Invitații)
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
  })
  if (!userRes.ok) return json(401, { error: 'Sesiune invalidă.' })
  const user = await userRes.json()

  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/angajati?user_id=eq.${user.id}&select=id,acces_tooluri(tool,rol)`,
    { headers: sb }
  )
  const [angajat] = await checkRes.json()
  const isAdmin = angajat?.acces_tooluri?.some((a) => a.tool === 'invitatii' && a.rol === 'full')
  if (!isAdmin) return json(403, { error: 'Doar Admin complet la Invitații poate trimite.' })

  // 2. Evenimentul + conținutul lui
  const evRes = await fetch(
    `${SUPABASE_URL}/rest/v1/evenimente?id=eq.${evenimentId}&select=nume,data,locatie,status,invitatii_profil_eveniment(subiect_email,mesaj_intro,afis_url)`,
    { headers: sb }
  )
  const [eveniment] = await evRes.json()
  if (!eveniment) return json(404, { error: 'Eveniment negăsit.' })

  // Un eveniment anulat nu mai trimite nimic (invitațiile rămân ca istoric)
  const stRes = await fetch(
    `${SUPABASE_URL}/rest/v1/statusuri_eveniment?cod=eq.${encodeURIComponent(eveniment.status)}&select=comportament`,
    { headers: sb }
  )
  const [statusEv] = await stRes.json()
  if (statusEv?.comportament === 'anulat') {
    return json(400, { error: 'Evenimentul este anulat. Nu se mai trimit invitații.' })
  }

  const profil = Array.isArray(eveniment.invitatii_profil_eveniment)
    ? eveniment.invitatii_profil_eveniment[0]
    : eveniment.invitatii_profil_eveniment

  if (!profil?.subiect_email) {
    return json(400, { error: 'Completează subiectul emailului înainte de a trimite.' })
  }

  // Număra rânduri dintr-un filtru PostgREST (fără a le descărca)
  // (filtrele pe `persoane.*` cer ca `persoane` să fie inclusă în select)
  async function numara(filtru, select = 'id') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/invitatii?${filtru}&select=${select}&limit=1`, {
      headers: { ...sb, Prefer: 'count=exact' },
    })
    const total = r.headers.get('content-range')?.split('/')[1]
    return Number(total) || 0
  }

  const baza = `eveniment_id=eq.${evenimentId}&status_rsvp=eq.in_asteptare&trimis_la=is.null`
  // „Eligibil" = netrimis, fără eroare, persoană abonată (inner join exclude nominalizații fără persoană)
  const eligibil = `${baza}&eroare_trimitere=is.null&persoane.abonat_invitatii=eq.true`
  const selectEligibil = 'id,token,persoane!inner(nume,prenume,email,institutie,functie)'
  const selectNumarare = 'id,persoane!inner(id)'

  // 3. La cerere: ștergem erorile vechi, ca invitațiile eșuate să intre din nou în coadă
  if (reseteazaErori) {
    await fetch(`${SUPABASE_URL}/rest/v1/invitatii?${baza}&eroare_trimitere=not.is.null`, {
      method: 'PATCH',
      headers: { ...sb, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ eroare_trimitere: null }),
    })
  }

  // 4. Un lot de invitații eligibile
  const invRes = await fetch(
    `${SUPABASE_URL}/rest/v1/invitatii?${eligibil}&select=${selectEligibil}&order=created_at.asc&limit=${LOT}`,
    { headers: sb }
  )
  if (!invRes.ok) return json(500, { error: 'Nu am putut citi lista de invitați.' })
  const lot = await invRes.json()

  async function marcheaza(id, camp) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/invitatii?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...sb, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(camp),
    })
    return r.ok
  }

  async function trimiteUna(inv) {
    const p = inv.persoane
    if (!p.email?.trim()) return { ok: false, eroare: 'Persoana nu are adresă de email.' }
    const nume = `${p.prenume} ${p.nume}`
    const rsvpLink = `${SITE_URL}/invitatii/?rsvp=${inv.token}`
    const dezabonareLink = `${SITE_URL}/invitatii/?dezabonare=${inv.token}`
    const valori = {
      nume,
      prenume: p.prenume || '',
      nume_familie: p.nume || '',
      institutie: p.institutie || '',
      functie: p.functie || '',
    }
    const mesaj = esc(inlocuieste(profil.mesaj_intro, valori))
    const subiect = inlocuieste(profil.subiect_email, valori)

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        ${profil.afis_url ? `<img src="${esc(profil.afis_url)}" alt="" style="width:100%; border-radius: 12px; margin-bottom: 16px;" />` : ''}
        <h2 style="margin-bottom: 4px;">${esc(eveniment.nume)}</h2>
        <p style="color: #64748b; margin-top: 0;">${esc(formatData(eveniment.data))}${eveniment.locatie ? ` · ${esc(eveniment.locatie)}` : ''}</p>
        <p style="white-space: pre-line;">${mesaj}</p>
        <p style="margin-top: 24px;">
          <a href="${rsvpLink}" style="background:#22406B;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;">
            Răspunde la invitație
          </a>
        </p>
        <p style="margin-top: 32px; font-size: 12px; color: #94a3b8;">
          Primești acest mesaj ca invitat al Corului Madrigal.
          <a href="${dezabonareLink}" style="color: #94a3b8;">Nu mai doresc invitații</a>
        </p>
      </div>
    `

    try {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: BREVO_SENDER_NAME || 'Corul Madrigal', email: BREVO_SENDER_EMAIL },
          to: [{ email: p.email, name: nume }],
          subject: subiect,
          htmlContent,
          headers: { 'List-Unsubscribe': `<${dezabonareLink}>` },
        }),
      })
      if (r.ok) return { ok: true }
      const detaliu = await r.text()
      // Limita zilnică/de ritm a contului Brevo: nu marcăm persoana ca eșuată, oprim lotul
      if (r.status === 429 || /limit|quota/i.test(detaliu)) return { limita: true }
      return { ok: false, eroare: `Brevo ${r.status}: ${detaliu}`.slice(0, 300) }
    } catch (e) {
      return { ok: false, eroare: `Rețea: ${e.message}`.slice(0, 300) }
    }
  }

  let trimise = 0
  let esuate = 0
  let opritLimita = false
  let eroareScriere = false

  for (let i = 0; i < lot.length && !opritLimita && !eroareScriere; i += PARALEL) {
    const grup = lot.slice(i, i + PARALEL)
    const rezultate = await Promise.all(grup.map(trimiteUna))

    for (let k = 0; k < grup.length; k += 1) {
      const rez = rezultate[k]
      if (rez.limita) {
        opritLimita = true
      } else if (rez.ok) {
        trimise += 1
        if (!(await marcheaza(grup[k].id, { trimis_la: new Date().toISOString(), eroare_trimitere: null }))) {
          eroareScriere = true // emailul a plecat, dar nu l-am putut marca: ne oprim ca să nu-l retrimitem
        }
      } else {
        esuate += 1
        await marcheaza(grup[k].id, { eroare_trimitere: rez.eroare })
      }
    }
  }

  if (eroareScriere) {
    return json(500, {
      error: 'Unele emailuri au plecat, dar nu am putut salva starea în baza de date. Oprește trimiterea și verifică lista.',
      trimise,
      esuate,
    })
  }

  const [ramase, dezabonati, faraEmail] = await Promise.all([
    numara(eligibil, selectNumarare),
    numara(`${baza}&persoane.abonat_invitatii=eq.false`, selectNumarare),
    numara(`${baza}&persoana_id=is.null`),
  ])

  return json(200, { ok: true, trimise, esuate, ramase, dezabonati, faraEmail, oprit_limita: opritLimita })
}
