import { useEffect, useMemo, useState } from 'react'
import { Check, X, Eye, RotateCcw, Pencil } from 'lucide-react'
import { formatData } from '../lib/luni'
import { supabase } from '../supabaseClient'
import { LUNI } from '../lib/luni'
import { STARI } from '../lib/roluri'
import { inputCls, labelCls, btnGhost, btnPrimary, btnDanger } from '../lib/ui'
import RaportCard from './RaportCard'
import RaportForm from './RaportForm'

const LIMITA = 300

export default function Verificare() {
  const [loading, setLoading] = useState(true)
  const [rapoarte, setRapoarte] = useState([])
  const [campuri, setCampuri] = useState([])
  const [filtruStare, setFiltruStare] = useState('')
  const [filtruAn, setFiltruAn] = useState('')
  const [filtruLuna, setFiltruLuna] = useState('')
  const [cauta, setCauta] = useState('')
  const [motivPentru, setMotivPentru] = useState(null) // { id, tip: 'respins' | 'redeschis' }
  const [motiv, setMotiv] = useState('')
  const [editat, setEditat] = useState(null)
  // data de pe documentul Word: { id, mod: 'aproba' | 'schimba', alege: 'sistem' | 'alta', data: 'AAAA-LL-ZZ' }
  const [dataPentru, setDataPentru] = useState(null)
  const [zileLibere, setZileLibere] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: r }, { data: f }] = await Promise.all([
      supabase
        .from('rap_activitate')
        .select('*, contract:rap_contracte(*, persoana:rap_persoane(*))')
        .order('an', { ascending: false })
        .order('luna', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(LIMITA),
      supabase.from('rap_campuri').select('*').eq('modul', 'activitate').eq('activ', true).order('ordine'),
    ])
    supabase.from('legal_holidays').select('start_date, end_date, label').then(({ data: z }) => setZileLibere(z || []))
    setRapoarte(r || [])
    setCampuri(f || [])
    setLoading(false)
  }

  // zi liberă = sâmbătă / duminică / zi liberă legală (din HR → Zile libere legale)
  function motivZiLibera(iso) {
    if (!iso) return ''
    const d = new Date(`${iso}T00:00:00`)
    if (d.getDay() === 6) return 'sâmbătă'
    if (d.getDay() === 0) return 'duminică'
    const z = zileLibere.find((x) => iso >= x.start_date && iso <= x.end_date)
    return z ? `zi liberă legală${z.label ? ` (${z.label})` : ''}` : ''
  }

  function deschideData(r, mod) {
    setMotivPentru(null)
    setDataPentru({ id: r.id, mod, alege: r.data_document ? 'alta' : 'sistem', data: r.data_document || '' })
  }

  async function salveazaData() {
    const r = rapoarte.find((x) => x.id === dataPentru.id)
    const dataAleasa = dataPentru.alege === 'alta' ? dataPentru.data : null
    if (dataPentru.alege === 'alta' && !dataAleasa) {
      setError('Alege data care va apărea pe document.')
      return
    }
    if (dataPentru.mod === 'aproba') {
      const ok = await schimbaStarea(r.id, 'aprobat', null, { data_document: dataAleasa })
      if (!ok) return
    } else {
      setError('')
      const { error: err } = await supabase.from('rap_activitate').update({ data_document: dataAleasa }).eq('id', r.id)
      if (err) { setError(err.message || 'Nu am putut salva data.'); return }
      load()
    }
    setDataPentru(null)
  }

  async function schimbaStarea(id, stare, motivText, extra = {}) {
    setError('')
    const { error: err } = await supabase
      .from('rap_activitate')
      .update({ stare, motiv_stare: motivText ?? null, ...extra })
      .eq('id', id)
    if (err) {
      setError(err.message || 'Nu am putut schimba starea.')
      return false
    }
    setMotivPentru(null)
    setMotiv('')
    load()
    return true
  }

  const ani = useMemo(() => [...new Set(rapoarte.map((r) => r.an))].sort((a, b) => b - a), [rapoarte])

  const filtrate = rapoarte.filter((r) => {
    if (filtruStare && r.stare !== filtruStare) return false
    if (filtruAn && String(r.an) !== filtruAn) return false
    if (filtruLuna && String(r.luna) !== filtruLuna) return false
    if (cauta && !(r.contract?.persoana?.nume || '').toLowerCase().includes(cauta.toLowerCase())) return false
    return true
  })

  if (editat) {
    return (
      <RaportForm
        contracte={[editat.contract]}
        campuri={campuri}
        raport={editat}
        onCancel={() => setEditat(null)}
        onSaved={() => {
          setEditat(null)
          load()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold text-slate-800">Rapoarte de activitate de verificat</h2>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <div>
          <label className={labelCls}>Stare</label>
          <select className={inputCls} value={filtruStare} onChange={(e) => setFiltruStare(e.target.value)}>
            <option value="">Toate</option>
            {Object.entries(STARI).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>An</label>
          <select className={inputCls} value={filtruAn} onChange={(e) => setFiltruAn(e.target.value)}>
            <option value="">Toți</option>
            {ani.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Luna</label>
          <select className={inputCls} value={filtruLuna} onChange={(e) => setFiltruLuna(e.target.value)}>
            <option value="">Toate</option>
            {LUNI.map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Caută după nume</label>
          <input className={inputCls} value={cauta} onChange={(e) => setCauta(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Se încarcă…</p>}
      {!loading && filtrate.length === 0 && <p className="text-sm text-slate-500">Niciun raport pentru filtrele alese.</p>}
      {rapoarte.length >= LIMITA && (
        <p className="text-xs text-slate-400">Se afișează ultimele {LIMITA} rapoarte; folosește filtrele pentru a le restrânge.</p>
      )}

      {filtrate.map((r) => (
        <div key={r.id} className="space-y-2">
          <RaportCard
            raport={r}
            contract={r.contract}
            persoana={r.contract?.persoana}
            campuri={campuri}
            aratAutor
            aratIntarziere
            onSchimbaData={() => deschideData(r, 'schimba')}
            actiuni={
              <>
                {r.stare === 'trimis' && (
                  <button onClick={() => schimbaStarea(r.id, 'in_verificare')} className={btnGhost}>
                    <Eye size={14} /> Preia în verificare
                  </button>
                )}
                {(r.stare === 'trimis' || r.stare === 'in_verificare') && (
                  <>
                    <button onClick={() => deschideData(r, 'aproba')} className={btnPrimary}>
                      <Check size={14} /> Aprobă
                    </button>
                    <button onClick={() => { setMotivPentru({ id: r.id, tip: 'respins' }); setMotiv('') }} className={btnDanger}>
                      <X size={14} /> Respinge
                    </button>
                  </>
                )}
                {r.stare === 'aprobat' && (
                  <button onClick={() => { setMotivPentru({ id: r.id, tip: 'redeschis' }); setMotiv('') }} className={btnGhost}>
                    <RotateCcw size={14} /> Redeschide
                  </button>
                )}
                {r.stare !== 'aprobat' && (
                  <button onClick={() => setEditat(r)} className={btnGhost}>
                    <Pencil size={14} /> Editează
                  </button>
                )}
              </>
            }
          />

          {dataPentru?.id === r.id && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-800">
                {dataPentru.mod === 'aproba' ? 'Aprobi raportul. Ce dată să apară pe documentul Word?' : 'Ce dată să apară pe documentul Word?'}
              </p>
              {r.cu_intarziere && <p className="mt-1 text-xs text-orange-700">Raportul a fost completat cu întârziere.</p>}
              <label className="mt-2 flex items-start gap-2">
                <input type="radio" name={`data-${r.id}`} checked={dataPentru.alege === 'sistem'} onChange={() => setDataPentru({ ...dataPentru, alege: 'sistem' })} className="mt-1" />
                <span><strong>Data completării din sistem</strong> ({formatData(r.created_at)})</span>
              </label>
              <label className="mt-2 flex items-start gap-2">
                <input type="radio" name={`data-${r.id}`} checked={dataPentru.alege === 'alta'} onChange={() => setDataPentru({ ...dataPentru, alege: 'alta' })} className="mt-1" />
                <span>
                  <strong>Altă dată:</strong>{' '}
                  <input type="date" className="rounded border border-slate-300 px-2 py-1" value={dataPentru.data} onFocus={() => setDataPentru({ ...dataPentru, alege: 'alta' })} onChange={(e) => setDataPentru({ ...dataPentru, alege: 'alta', data: e.target.value })} />
                </span>
              </label>
              {dataPentru.alege === 'alta' && motivZiLibera(dataPentru.data) && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                  Atenție: data aleasă este {motivZiLibera(dataPentru.data)}. O poți folosi totuși, dacă e cazul.
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">Data reală a completării rămâne în sistem și în istoric; schimbarea afectează doar documentul generat.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={salveazaData} className={btnPrimary}>{dataPentru.mod === 'aproba' ? 'Aprobă' : 'Salvează data'}</button>
                <button onClick={() => setDataPentru(null)} className={btnGhost}>Anulează</button>
              </div>
            </div>
          )}

          {motivPentru?.id === r.id && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className={labelCls}>
                {motivPentru.tip === 'respins' ? 'Motivul respingerii' : 'Motivul redeschiderii (raportul iese din statistici și revine „În verificare")'}
              </label>
              <textarea rows={3} className={inputCls} value={motiv} onChange={(e) => setMotiv(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <button
                  disabled={!motiv.trim()}
                  onClick={() => schimbaStarea(r.id, motivPentru.tip === 'respins' ? 'respins' : 'in_verificare', motiv.trim())}
                  className={btnPrimary}
                >
                  Confirmă
                </button>
                <button onClick={() => setMotivPentru(null)} className={btnGhost}>Anulează</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
