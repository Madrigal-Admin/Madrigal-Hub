import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { azi, mesajEroare, profilul } from '../lib/format'
import { BaraLocuri, Btn, LegendaLocuri, Pill, totalLocuri } from './ui'

const BUCKET = 'invitatii-fisiere'
const MAX_FISIER = 10 * 1024 * 1024
const TIPURI = ['application/pdf', 'image/jpeg', 'image/png']
const INPUT = 'w-full rounded-[10px] border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

// Calea obiectului din URL-ul public (pentru ștergere)
function caleDinUrl(url) {
  const marcaj = `/${BUCKET}/`
  const i = url.indexOf(marcaj)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marcaj.length).split('?')[0])
}

function Cutie({ children }) {
  return <div className="rounded-[14px] border border-slate-200 p-[18px]">{children}</div>
}

export default function TabSolicitari({ eveniment, inchis, onChanged, onSchimbaInchiderea }) {
  const profil = profilul(eveniment)
  const [deschise, setDeschise] = useState(!!profil?.solicitari_deschise)
  const [plafon, setPlafon] = useState(profil?.plafon ? String(profil.plafon) : '')
  const [link, setLink] = useState(profil?.invitatie_link || '')
  const [locuri, setLocuri] = useState(null)
  const [mesaj, setMesaj] = useState('')
  const [eroare, setEroare] = useState('')
  const [incarca, setIncarca] = useState(false)

  const incarcaLocuri = useCallback(async () => {
    const { data } = await supabase.rpc('invitatii_locuri', { p_eveniment_id: eveniment.id })
    setLocuri(data || null)
  }, [eveniment.id])

  useEffect(() => {
    incarcaLocuri()
  }, [incarcaLocuri])

  async function salveaza(campuri, mesajOk) {
    setEroare('')
    setMesaj('')
    const { error } = await supabase
      .from('invitatii_profil_eveniment')
      .upsert({ eveniment_id: eveniment.id, ...campuri })
    if (error) {
      setEroare(mesajEroare(error))
      return false
    }
    if (mesajOk) setMesaj(mesajOk)
    await incarcaLocuri()
    onChanged()
    return true
  }

  async function comuta() {
    const nou = !deschise
    if (await salveaza({ solicitari_deschise: nou })) setDeschise(nou)
  }

  async function salveazaPlafon() {
    const t = plafon.trim()
    if (t !== '' && (!Number.isInteger(Number(t)) || Number(t) < 1)) {
      setEroare('Plafonul trebuie să fie un număr întreg pozitiv (sau gol, pentru fără plafon).')
      return
    }
    await salveaza({ plafon: t === '' ? null : Number(t) }, 'Plafonul a fost salvat.')
  }

  async function salveazaLink() {
    const t = link.trim()
    if (t && !/^https?:\/\//i.test(t)) {
      setEroare('Linkul trebuie să înceapă cu http:// sau https://')
      return
    }
    await salveaza({ invitatie_link: t || null }, 'Linkul a fost salvat.')
  }

  async function incarcaFisier(e) {
    const fisier = e.target.files?.[0]
    e.target.value = ''
    if (!fisier) return
    if (!TIPURI.includes(fisier.type)) return setEroare('Fișierul trebuie să fie PDF, JPEG sau PNG.')
    if (fisier.size > MAX_FISIER) return setEroare('Fișierul depășește 10 MB.')

    setIncarca(true)
    setEroare('')
    const ext = fisier.type === 'application/pdf' ? 'pdf' : fisier.type === 'image/png' ? 'png' : 'jpg'
    const cale = `${eveniment.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(cale, fisier)
    if (error) {
      setIncarca(false)
      return setEroare('Nu am putut încărca fișierul. Verifică tipul (PDF, JPEG, PNG) și dimensiunea (maximum 10 MB).')
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(cale)
    const veche = profil?.invitatie_fisier_url ? caleDinUrl(profil.invitatie_fisier_url) : null
    const ok = await salveaza({ invitatie_fisier_url: data.publicUrl, invitatie_fisier_nume: fisier.name })
    if (ok && veche) await supabase.storage.from(BUCKET).remove([veche])
    if (!ok) await supabase.storage.from(BUCKET).remove([cale])
    setIncarca(false)
  }

  async function stergeFisier() {
    if (!confirm('Ștergi fișierul invitației? Angajații cu cereri aprobate nu îl vor mai vedea.')) return
    const cale = caleDinUrl(profil.invitatie_fisier_url)
    if (await salveaza({ invitatie_fisier_url: null, invitatie_fisier_nume: null }) && cale) {
      await supabase.storage.from(BUCKET).remove([cale])
    }
  }

  const ocupate = locuri ? totalLocuri(locuri) : 0
  const procent = locuri?.plafon ? Math.round((ocupate / locuri.plafon) * 100) : 0
    const checkinActiv = !inchis && (!eveniment.data || eveniment.data <= azi())

  return (
    <div className="space-y-4">
      {eroare && <p className="text-sm text-rose-600">{eroare}</p>}
      {mesaj && <p className="text-sm text-green-700">{mesaj}</p>}

      <Cutie>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={deschise}
            aria-label="Deschis pentru solicitările angajaților"
            disabled={inchis}
            onClick={comuta}
            className={`relative h-[26px] w-11 shrink-0 rounded-full transition disabled:opacity-50 ${deschise ? 'bg-accent' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${deschise ? 'left-[21px]' : 'left-[3px]'}`} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-slate-900">Deschis pentru solicitările angajaților</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Evenimentul apare în lista angajaților și a persoanelor cu rol „Verificare la intrare”. Când e oprit, apare doar lista fixă.
            </p>
          </div>
        </div>
      </Cutie>

      <Cutie>
        <p className="text-[15px] font-bold text-slate-900">Plafon de persoane</p>
        <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">
          Locuri ocupate = invitați confirmați din lista fixă + invitații aprobați ai angajaților + cererile în așteptare.
          Avertizare la 90%; la 100% nu se mai pot trimite solicitări noi (tu poți aproba în continuare, cu confirmare).
        </p>
        <label htmlFor="plafon" className="mb-1.5 block text-xs font-bold text-slate-600">Plafon maxim</label>
        <div className="flex flex-wrap items-center gap-2">
          <input id="plafon" type="number" min="1" value={plafon} disabled={inchis} onChange={(e) => setPlafon(e.target.value)} className={`${INPUT} !w-32`} placeholder="fără plafon" />
          <Btn variant="smallPrimary" onClick={salveazaPlafon} disabled={inchis}>Salvează</Btn>
        </div>
        {locuri && (
          <div className="mt-3 space-y-2">
            {locuri.plafon && <BaraLocuri locuri={locuri} />}
            <LegendaLocuri locuri={locuri} />
            <p className="text-xs text-slate-500">
              {locuri.plafon ? (
                <><strong>{ocupate} din {locuri.plafon} locuri</strong> ({procent}%). {ocupate < locuri.plafon ? `Mai sunt ${locuri.plafon - ocupate}.` : 'Plafonul a fost atins.'}</>
              ) : (
                <><strong>{ocupate} locuri ocupate</strong> · plafon nesetat.</>
              )}
            </p>
            {locuri.plafon && ocupate >= locuri.plafon * 0.9 && (
              <p className="rounded-[10px] bg-amber-100 px-3 py-2 text-xs leading-relaxed text-amber-900">
                {ocupate >= locuri.plafon
                  ? 'Plafonul a fost atins: angajații nu mai pot trimite solicitări noi.'
                  : `Ai ocupat ${procent}% din plafon. Verifică lista înainte să aprobi alte cereri.`}
              </p>
            )}
          </div>
        )}
      </Cutie>

      <Cutie>
        <p className="text-[15px] font-bold text-slate-900">Invitația pentru angajați</p>
        <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">
          Adaugi tu invitația (fișier, link sau ambele). Angajatul le vede doar după ce cererea lui e aprobată. Linkul e
          public: oricine îl are îl poate deschide, ca invitația să poată fi trimisă mai departe ușor.
        </p>
        {profil?.invitatie_fisier_url ? (
          <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-slate-200 px-3 py-2.5 text-[13px]">
            <Pill culoare="verde" className="!text-xs">Încărcat</Pill>
            <a href={profil.invitatie_fisier_url} target="_blank" rel="noreferrer" className="min-w-[200px] flex-1 truncate text-accent underline">
              {profil.invitatie_fisier_nume || 'Fișier'}
            </a>
            {!inchis && (
              <>
                <label className={`cursor-pointer rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${incarca ? 'pointer-events-none opacity-50' : ''}`}>
                  {incarca ? 'Se încarcă…' : 'Înlocuiește'}
                  <input type="file" accept=".pdf,image/jpeg,image/png" className="sr-only" onChange={incarcaFisier} disabled={incarca} />
                </label>
                <Btn variant="small" onClick={stergeFisier}>Șterge</Btn>
              </>
            )}
          </div>
        ) : (
          !inchis && (
            <label className={`inline-block cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 ${incarca ? 'pointer-events-none opacity-50' : ''}`}>
              {incarca ? 'Se încarcă…' : 'Încarcă fișierul invitației'}
              <input type="file" accept=".pdf,image/jpeg,image/png" className="sr-only" onChange={incarcaFisier} disabled={incarca} />
            </label>
          )
        )}
        <label htmlFor="lnk" className="mb-1.5 mt-3 block text-xs font-bold text-slate-600">Link de distribuire (opțional)</label>
        <div className="flex flex-wrap items-center gap-2">
          <input id="lnk" value={link} disabled={inchis} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={`${INPUT} min-w-[220px] flex-1`} />
          <Btn variant="smallPrimary" onClick={salveazaLink} disabled={inchis}>Salvează linkul</Btn>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">Fișiere acceptate: PDF, JPEG, PNG, maximum 10 MB.</p>
      </Cutie>

      <Cutie>
        <p className="text-[15px] font-bold text-slate-900">Închiderea evenimentului</p>
        <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">
          Doar Adminul general închide un eveniment, când hotărăște el (nu automat, după dată). După închidere nu merg:
          check-in-ul, răspunsurile RSVP și solicitările noi. Istoricul și cifrele rămân vizibile în Dashboard. Poți
          redeschide oricând.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Pill culoare={inchis ? 'gri' : checkinActiv ? 'verde' : 'albastru'} className="!text-xs">
            {inchis ? 'Închis' : checkinActiv ? 'Check-in activ' : 'Check-in începe în ziua evenimentului'}
          </Pill>
          <Btn variant={inchis ? 'secondary' : 'danger'} onClick={onSchimbaInchiderea}>
            {inchis ? 'Redeschide evenimentul' : 'Închide evenimentul'}
          </Btn>
        </div>
      </Cutie>
    </div>
  )
}
