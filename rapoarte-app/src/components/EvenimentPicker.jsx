import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatData } from '../lib/luni'
import { azi } from '../lib/postev'
import { inputCls, btnGhost, cardCls } from '../lib/ui'

// Alege evenimentul pentru care se face raportul: din calendar (încheiate, fără raport)
// sau un eveniment care nu e în calendar.
export default function EvenimentPicker({ onAlege, onManual, onCancel }) {
  const [loading, setLoading] = useState(true)
  const [lista, setLista] = useState([])
  const [cauta, setCauta] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: ev }, { data: raportate }, { data: tipuri }] = await Promise.all([
        supabase.from('evenimente').select('*, eveniment_tipuri(tip_cod), eveniment_pm(angajat_id)').not('data', 'is', null).order('data', { ascending: false }).limit(400),
        supabase.rpc('rap_evenimente_raportate'),
        supabase.from('tipuri_eveniment').select('cod, nume'),
      ])
      const deja = new Set(raportate || [])
      const nume = Object.fromEntries((tipuri || []).map((t) => [t.cod, t.nume]))
      setLista(
        (ev || [])
          .filter((e) => e.status !== 'anulat' && (e.data_sfarsit || e.data) < azi() && !deja.has(e.id))
          .map((e) => {
            const coduri = (e.eveniment_tipuri || []).map((x) => x.tip_cod)
            return { ...e, tipuri_coduri: coduri, tipuri_nume: coduri.map((c) => nume[c] || c), pm_ids: (e.eveniment_pm || []).map((x) => x.angajat_id) }
          })
      )
      setLoading(false)
    }
    load()
  }, [])

  const vizibile = lista.filter((e) => !cauta || (e.nume || '').toLowerCase().includes(cauta.toLowerCase()))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-slate-800">Alege evenimentul</h2>
        <button onClick={onCancel} className={btnGhost}>Înapoi</button>
      </div>
      <p className="text-sm text-slate-500">
        Apar evenimentele din calendar care s-au încheiat și nu au încă raport.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input className={`${inputCls} max-w-sm`} placeholder="Caută după nume…" value={cauta} onChange={(e) => setCauta(e.target.value)} />
        <button onClick={onManual} className={btnGhost}>Evenimentul nu e în calendar</button>
      </div>

      {loading && <p className="text-sm text-slate-500">Se încarcă…</p>}
      {!loading && vizibile.length === 0 && <p className="text-sm text-slate-500">Niciun eveniment disponibil.</p>}

      <div className="space-y-2">
        {vizibile.map((e) => (
          <button key={e.id} onClick={() => onAlege(e)} className={`${cardCls} w-full text-left transition hover:shadow-md`}>
            <p className="font-medium text-slate-800">{e.nume}</p>
            <p className="text-xs text-slate-500">
              {formatData(e.data)}
              {e.data_sfarsit && e.data_sfarsit !== e.data ? ` – ${formatData(e.data_sfarsit)}` : ''}
              {e.locatie ? ` · ${e.locatie}` : ''}
              {e.tipuri_nume.length ? ` · ${e.tipuri_nume.join(', ')}` : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
