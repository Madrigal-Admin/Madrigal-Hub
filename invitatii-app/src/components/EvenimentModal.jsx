import { useState } from 'react'
import { X as XIcon } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { formatData, formatOra, mesajEroare, profilul, randMeta } from '../lib/format'
import { Btn } from './ui'
import TabInvitati from './TabInvitati'
import TabContinut from './TabContinut'
import TabSolicitari from './TabSolicitari'

const TABURI = [
  { cod: 'invitati', label: 'Invitați' },
  { cod: 'continut', label: 'Conținut & trimitere' },
  { cod: 'solicitari', label: 'Solicitări & plafon' },
]

export default function EvenimentModal({ eveniment, tipuri, angajati, session, onClose, onChanged, onGestioneazaCategorii }) {
  const [tab, setTab] = useState('invitati')
  const [eroare, setEroare] = useState('')
  const profil = profilul(eveniment)
  const inchis = !!profil?.inchis_la
  const ora = formatOra(eveniment)
  const { pm, tipNume } = randMeta(eveniment, tipuri, angajati)

  async function schimbaInchiderea() {
    const mesaj = inchis
      ? 'Redeschizi evenimentul? Check-in-ul, răspunsurile RSVP și solicitările noi vor funcționa din nou.'
      : 'Închizi evenimentul? După închidere nu mai merg check-in-ul, răspunsurile RSVP și solicitările noi. Istoricul rămâne vizibil în Dashboard și poți redeschide oricând.'
    if (!confirm(mesaj)) return
    setEroare('')
    const { error } = await supabase
      .from('invitatii_profil_eveniment')
      .upsert({ eveniment_id: eveniment.id, inchis_la: inchis ? null : new Date().toISOString() })
    if (error) {
      setEroare(mesajEroare(error))
      return
    }
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-[20px] bg-white shadow-xl" role="dialog" aria-label={eveniment.nume}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-7 pb-4 pt-6">
          <div className="min-w-0">
            <h3 className="text-xl font-extrabold text-slate-900">{eveniment.nume}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              {formatData(eveniment.data)}
              {ora ? ` · ${ora}` : ''}
              {eveniment.locatie ? ` · ${eveniment.locatie}` : ''}
              {(pm.length > 0 || tipNume.length > 0 || eveniment.implicare) && <br />}
              {[pm.length ? `PM: ${pm.join(', ')}` : '', tipNume.join(', '), eveniment.implicare].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Btn onClick={schimbaInchiderea}>{inchis ? 'Redeschide evenimentul' : 'Închide evenimentul'}</Btn>
            <button onClick={onClose} aria-label="Închide fereastra" className="rounded-full border border-slate-300 px-3 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
              <XIcon size={14} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-5">
          {TABURI.map((t) => (
            <button
              key={t.cod}
              onClick={() => setTab(t.cod)}
              className={`-mb-px whitespace-nowrap border-b-[3px] px-3 py-3.5 text-sm font-semibold transition ${
                tab === t.cod ? 'border-accent text-accent' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-7 pb-7 pt-6">
          {eroare && <p className="mb-3 text-sm text-rose-600">{eroare}</p>}
          {inchis && (
            <p className="mb-4 rounded-[10px] bg-slate-100 px-3 py-2 text-sm text-slate-600">
              Evenimentul este închis (din {formatData(profil.inchis_la)}). Vezi doar istoricul; ca să modifici ceva,
              redeschide-l.
            </p>
          )}
          {tab === 'invitati' && (
            <TabInvitati eveniment={eveniment} inchis={inchis} onChanged={onChanged} onGestioneazaCategorii={onGestioneazaCategorii} />
          )}
          {tab === 'continut' && <TabContinut eveniment={eveniment} inchis={inchis} session={session} onChanged={onChanged} />}
          {tab === 'solicitari' && <TabSolicitari eveniment={eveniment} inchis={inchis} onChanged={onChanged} onSchimbaInchiderea={schimbaInchiderea} />}
        </div>
      </div>
    </div>
  )
}
