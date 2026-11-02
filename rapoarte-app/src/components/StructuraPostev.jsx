import { useEffect, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { inputCls, labelCls, btnPrimary, btnGhost, cardCls } from '../lib/ui'

const MODURI = [
  { v: '', l: '— nu apare' },
  { v: 'O', l: 'Obligatoriu' },
  { v: 'F', l: 'Facultativ' },
  { v: 'B', l: 'După bifa „a fost cazul"' },
  { v: 'C', l: 'Dacă nu e Organizator' },
]
const TIPURI_CAMP = [
  { v: 'numar', l: 'Număr (întreg, minimum 1)' },
  { v: 'text', l: 'Text scurt' },
  { v: 'text_lung', l: 'Text lung' },
  { v: 'link', l: 'Link' },
]

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

export default function StructuraPostev() {
  const [tipuri, setTipuri] = useState([])
  const [campuri, setCampuri] = useState([])
  const [matrice, setMatrice] = useState([])
  const [loading, setLoading] = useState(true)
  const [campEditat, setCampEditat] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [t, c, m] = await Promise.all([
      supabase.from('rap_tipuri').select('*').order('ordine'),
      supabase.from('rap_postev_campuri').select('*').order('ordine'),
      supabase.from('rap_postev_campuri_tipuri').select('*'),
    ])
    setTipuri(t.data || [])
    setCampuri(c.data || [])
    setMatrice(m.data || [])
    setLoading(false)
  }

  async function salveazaTip(t, patch) {
    setError('')
    const { error: err } = await supabase.from('rap_tipuri').update(patch).eq('cod', t.cod)
    if (err) setError('Nu am putut salva tipul.')
    load()
  }

  async function seteazaMod(campCod, tipCod, mod) {
    setError('')
    const res = mod
      ? await supabase.from('rap_postev_campuri_tipuri').upsert({ camp_cod: campCod, tip_cod: tipCod, mod })
      : await supabase.from('rap_postev_campuri_tipuri').delete().eq('camp_cod', campCod).eq('tip_cod', tipCod)
    if (res.error) setError('Nu am putut salva regula.')
    load()
  }

  async function salveazaCamp(e) {
    e.preventDefault()
    setError('')
    const f = campEditat
    if (!f.eticheta.trim()) return setError('Scrie numele câmpului.')
    setBusy(true)
    const payload = {
      eticheta: f.eticheta.trim(), ajutor: f.ajutor.trim() || null,
      in_statistici: f.in_statistici, activ: f.activ,
    }
    const { error: err } = f.nou
      ? await supabase.from('rap_postev_campuri').insert({
          ...payload, cod: `${slug(f.eticheta)}_${Math.random().toString(36).slice(2, 5)}`, tip: f.tip, ordine: campuri.length + 1,
        })
      : await supabase.from('rap_postev_campuri').update(payload).eq('cod', f.cod)
    setBusy(false)
    if (err) return setError('Nu am putut salva câmpul.')
    setCampEditat(null)
    load()
  }

  if (loading) return <p className="text-sm text-slate-500">Se încarcă…</p>

  if (campEditat) {
    const f = campEditat
    return (
      <form onSubmit={salveazaCamp} className={`${cardCls} space-y-3`}>
        <h3 className="font-display text-base font-semibold text-slate-800">{f.nou ? 'Câmp nou' : 'Modifică câmpul'}</h3>
        <div>
          <label className={labelCls}>Nume câmp *</label>
          <input className={inputCls} value={f.eticheta} onChange={(e) => setCampEditat({ ...f, eticheta: e.target.value })} />
        </div>
        {f.nou && (
          <div>
            <label className={labelCls}>Tip</label>
            <select className={inputCls} value={f.tip} onChange={(e) => setCampEditat({ ...f, tip: e.target.value })}>
              {TIPURI_CAMP.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Text de ajutor</label>
          <textarea rows={2} className={inputCls} value={f.ajutor} onChange={(e) => setCampEditat({ ...f, ajutor: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.in_statistici} onChange={(e) => setCampEditat({ ...f, in_statistici: e.target.checked })} />
            Intră în statistici
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.activ} onChange={(e) => setCampEditat({ ...f, activ: e.target.checked })} />
            Activ
          </label>
        </div>
        {f.nou && <p className="text-xs text-slate-400">După salvare, stabilești în matrice la ce tipuri de eveniment apare.</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className={btnPrimary}>Salvează</button>
          <button type="button" onClick={() => setCampEditat(null)} className={btnGhost}>Anulează</button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className={cardCls}>
        <p className="text-sm font-medium text-slate-700">Tipuri de eveniment</p>
        <p className="mt-1 text-xs text-slate-500">
          Tipurile se administrează în Hub, la Calendar → Tipuri și statusuri. Un tip nou apare aici automat; poți să-l dezactivezi pentru rapoarte.
        </p>
        <div className="mt-3 space-y-2">
          {tipuri.map((t) => (
            <div key={t.cod} className="grid items-center gap-2 sm:grid-cols-[1fr_auto]">
              <span className={`text-sm font-medium ${t.activ ? 'text-slate-800' : 'text-slate-400'}`}>{t.nume}</span>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={t.activ} onChange={(e) => salveazaTip(t, { activ: e.target.checked })} /> Activ
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className={cardCls}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Câmpuri specifice și matricea pe tipuri</p>
          <button
            onClick={() => { setError(''); setCampEditat({ nou: true, eticheta: '', ajutor: '', tip: 'numar', in_statistici: true, activ: true }) }}
            className={btnGhost}
          >
            <Plus size={14} /> Câmp nou
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Pentru fiecare câmp alegi la ce tipuri apare. La o combinație de tipuri, câmpul apare o singură dată, cu regula cea mai strictă
          (obligatoriu &gt; după bifă &gt; facultativ). Câmpurile generale (responsabil, date, localități, locație, echipă, denumire, calitate)
          sunt fixe.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-3">Câmp</th>
                {tipuri.filter((t) => t.activ).map((t) => <th key={t.cod} className="px-1 py-2">{t.nume}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {campuri.map((c) => (
                <tr key={c.cod} className="border-t border-slate-100">
                  <td className={`py-2 pr-3 ${c.activ ? 'text-slate-800' : 'text-slate-400'}`}>
                    {c.eticheta}
                    <span className="block text-[11px] text-slate-400">{c.tip}{c.in_statistici ? ' · în statistici' : ''}</span>
                  </td>
                  {tipuri.filter((t) => t.activ).map((t) => (
                    <td key={t.cod} className="px-1 py-2">
                      <select
                        className="w-full rounded-lg border border-slate-300 bg-white px-1 py-1 text-xs focus-ring"
                        value={matrice.find((m) => m.camp_cod === c.cod && m.tip_cod === t.cod)?.mod || ''}
                        onChange={(e) => seteazaMod(c.cod, t.cod, e.target.value)}
                      >
                        {MODURI.map((m) => (
                          <option key={m.v} value={m.v}>{m.l}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td className="py-2 pl-2">
                    <button
                      onClick={() => { setError(''); setCampEditat({ ...c, ajutor: c.ajutor || '', nou: false }) }}
                      className="rounded-full p-1.5 text-slate-500 hover:bg-slate-50" title="Modifică"
                    >
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
