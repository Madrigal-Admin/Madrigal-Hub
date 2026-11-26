import { useState } from 'react'
import { History, Download, CalendarDays } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { STARI } from '../lib/roluri'
import { etichetaPerioada, formatData, formatDataOra } from '../lib/luni'
import { btnGhost } from '../lib/ui'
import { descarcaRaportWord } from '../lib/generateRaportDocx'

export function StareBadge({ stare }) {
  const s = STARI[stare] || { label: stare, clasa: 'bg-slate-100 text-slate-600' }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.clasa}`}>{s.label}</span>
}

/**
 * Card cu un raport: antet, text, câmpuri suplimentare, istoric, descărcare Word.
 * Butoanele specifice (editează, aprobă etc.) vin din `actiuni`.
 */
export default function RaportCard({ raport, contract, persoana, campuri, aratAutor, aratIntarziere, actiuni, onSchimbaData }) {
  const [istoric, setIstoric] = useState(null)
  const [deschis, setDeschis] = useState(false)
  const [busy, setBusy] = useState(false)
  const [eroare, setEroare] = useState('')

  async function toggleIstoric() {
    if (!deschis && istoric === null) {
      const { data } = await supabase
        .from('rap_istoric')
        .select('*')
        .eq('raport_id', raport.id)
        .order('la', { ascending: true })
      setIstoric(data || [])
    }
    setDeschis((d) => !d)
  }

  async function descarca() {
    setBusy(true)
    setEroare('')
    try {
      await descarcaRaportWord(raport, contract, persoana, campuri)
    } catch (e) {
      setEroare(e.message || 'Nu am putut genera documentul.')
    }
    setBusy(false)
  }

  const extra = (campuri || []).filter((c) => raport.extra?.[c.cod] !== undefined && raport.extra?.[c.cod] !== '')

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-800">
            {aratAutor && persoana ? `${persoana.nume} · ` : ''}
            {etichetaPerioada(raport.luna, raport.an)}
          </p>
          <p className="text-xs text-slate-500">
            {contract?.obiect}
            {contract?.numar_contract ? ` · nr. ${contract.numar_contract}` : ''} · completat {formatData(raport.created_at)}
          </p>
          {raport.data_document && (
            <p className="text-xs text-slate-500">
              Data pe document: <strong className="text-slate-700">{formatData(`${raport.data_document}T00:00:00`)}</strong>
              <span className="text-slate-400"> (schimbată de admin; data completării rămâne în sistem)</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {aratIntarziere && raport.cu_intarziere && (
            <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              Cu întârziere
            </span>
          )}
          <StareBadge stare={raport.stare} />
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{raport.activitati}</p>

      {extra.length > 0 && (
        <dl className="mt-3 space-y-1 text-sm">
          {extra.map((c) => (
            <div key={c.id}>
              <dt className="inline text-slate-500">{c.eticheta}: </dt>
              <dd className="inline text-slate-700">
                {c.tip === 'da_nu'
                  ? raport.extra[c.cod] === 'da' || raport.extra[c.cod] === true ? 'Da' : 'Nu'
                  : c.tip === 'data' ? formatData(raport.extra[c.cod]) : String(raport.extra[c.cod])}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {raport.stare === 'respins' && raport.motiv_stare && (
        <p className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-700">
          <strong>Motiv respingere:</strong> {raport.motiv_stare}
        </p>
      )}

      {eroare && <p className="mt-3 text-sm text-rose-600">{eroare}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {actiuni}
        {onSchimbaData && (
          <button onClick={onSchimbaData} className={btnGhost}>
            <CalendarDays size={14} /> Data pe document
          </button>
        )}
        {raport.stare === 'aprobat' && (
          <button onClick={descarca} disabled={busy} className={btnGhost}>
            <Download size={14} /> {busy ? 'Se generează…' : 'Descarcă Word'}
          </button>
        )}
        <button onClick={toggleIstoric} className={btnGhost}>
          <History size={14} /> Istoric
        </button>
      </div>

      {deschis && (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {(istoric || []).map((h) => (
            <li key={h.id}>
              {formatDataOra(h.la)} · <strong className="text-slate-700">{h.actiune}</strong>
              {h.nume_utilizator ? ` · ${h.nume_utilizator}` : ''}
              {h.motiv ? ` · motiv: ${h.motiv}` : ''}
            </li>
          ))}
          {istoric && istoric.length === 0 && <li>Fără înregistrări.</li>}
        </ul>
      )}
    </div>
  )
}
