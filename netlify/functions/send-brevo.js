// netlify/functions/send-brevo.js
//
// Trimite invitațiile "în așteptare" (nu deja trimise) ale unui eveniment,
// prin Brevo. Apelată de butonul "Trimite invitații" din tab-ul
// Invitații/Conținut & trimitere.
//
// Variabile de mediu necesare (setate în Netlify, fără prefix VITE_):
//   BREVO_API_KEY
//   BREVO_SENDER_EMAIL
//   BREVO_SENDER_NAME
//   SITE_URL                (ex. https://madrigalhub.netlify.app)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (deja există)

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

function formatData(dataStr) {
  if (!dataStr) return ''
  return new Date(dataStr).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}

function esc(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
  const SITE_URL = process.env.SITE_URL

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !BREVO_API_KEY || !BREVO_SENDER_EMAIL || !SITE_URL) {
    return json(500, { error: 'Variabile de mediu lipsă pe server.' })
  }

  let evenimentId
  try {
    evenimentId = JSON.parse(event.body || '{}').eveniment_id
  } catch {
    return json(400, { error: 'Corp de cerere invalid.' })
  }
  if (!evenimentId) return json(400, { error: 'Lipsește eveniment_id.' })

  // 1. Verificăm identitatea + rolul (doar Admin complet la Invitații)
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
  })
  if (!userRes.ok) return json(401, { error: 'Sesiune invalidă.' })
  const user = await userRes.json()

  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/angajati?user_id=eq.${user.id}&select=id,acces_tooluri(tool,rol)`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const [angajat] = await checkRes.json()
  const isAdmin = angajat?.acces_tooluri?.some((a) => a.tool === 'invitatii' && a.rol === 'full')
  if (!isAdmin) return json(403, { error: 'Doar Admin complet la Invitații poate trimite.' })

  // 2. Evenimentul + conținutul lui
  const evRes = await fetch(
    `${SUPABASE_URL}/rest/v1/evenimente?id=eq.${evenimentId}&select=nume,data,locatie,invitatii_profil_eveniment(subiect_email,mesaj_intro,afis_url)`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const [eveniment] = await evRes.json()
  if (!eveniment) return json(404, { error: 'Eveniment negăsit.' })

  const profil = Array.isArray(eveniment.invitatii_profil_eveniment)
    ? eveniment.invitatii_profil_eveniment[0]
    : eveniment.invitatii_profil_eveniment

  if (!profil?.subiect_email) {
    return json(400, { error: 'Completează subiectul emailului înainte de a trimite.' })
  }

  // 3. Invitațiile "în așteptare", netrimise încă, cu email valid
  const invRes = await fetch(
    `${SUPABASE_URL}/rest/v1/invitatii?eveniment_id=eq.${evenimentId}&status_rsvp=eq.in_asteptare&trimis_la=is.null&select=id,token,nume_complet_invitat,persoane(nume,prenume,email,institutie,functie)`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const invitatii = await invRes.json()

  const cuEmail = invitatii.filter((i) => i.persoane?.email)
  const faraEmail = invitatii.length - cuEmail.length

  let trimise = 0
  let esuate = 0

  for (const inv of cuEmail) {
    const nume = `${inv.persoane.prenume} ${inv.persoane.nume}`
    const rsvpLink = `${SITE_URL}/invitatii/?rsvp=${inv.token}`
    const valori = {
      nume,
      prenume: inv.persoane.prenume || '',
      nume_familie: inv.persoane.nume || '',
      institutie: inv.persoane.institutie || '',
      functie: inv.persoane.functie || '',
    }
    const mesaj = esc(inlocuieste(profil.mesaj_intro, valori))
    const subiect = inlocuieste(profil.subiect_email, valori)

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        ${profil.afis_url ? `<img src="${profil.afis_url}" alt="" style="width:100%; border-radius: 12px; margin-bottom: 16px;" />` : ''}
        <h2 style="margin-bottom: 4px;">${eveniment.nume}</h2>
        <p style="color: #64748b; margin-top: 0;">${formatData(eveniment.data)}${eveniment.locatie ? ` · ${eveniment.locatie}` : ''}</p>
        <p style="white-space: pre-line;">${mesaj}</p>
        <p style="margin-top: 24px;">
          <a href="${rsvpLink}" style="background:#22406B;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;">
            Răspunde la invitație
          </a>
        </p>
      </div>
    `

    const sendRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME || 'Corul Madrigal', email: BREVO_SENDER_EMAIL },
        to: [{ email: inv.persoane.email, name: nume }],
        subject: subiect,
        htmlContent,
      }),
    })

    if (sendRes.ok) {
      trimise += 1
      await fetch(`${SUPABASE_URL}/rest/v1/invitatii?id=eq.${inv.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ trimis_la: new Date().toISOString() }),
      })
    } else {
      esuate += 1
    }
  }

  return json(200, { ok: true, trimise, esuate, faraEmail })
}
