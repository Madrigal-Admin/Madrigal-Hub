import { useEffect, useState } from 'react'
import { ExternalLink, Lock, Plus, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { MOD_SEMNARE_SCURT, REGISTRE, STATUSURI, esteStaff } from '../lib/roluri'
import { deschideFisier } from '../lib/fisiere'
import { formatData, mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Card, Eroare, ModSemnareBadge, StareBadge, Titlu } from './comun'
import { numeResponsabil } from './RegistruLista'

const PE_PAGINA = 25
const STATUSURI_CIRCUIT = ['ciorna', 'in_circuit', 'semnat', 'refuzat', 'anulat']
const FILTRE_IMPLICITE = () => ({ an: new Date().getFullYear(), q: '', status: '', mod: '', de: '', pana: '', pagina: 1 })

export default function CircuitLista({ role, comune, filtre, setFiltre, onDeschide, onNou }) {
  const info = REGISTRE.circuit
  const [f, setF] = useState(() => filtre || FILTRE_IMPLICITE())
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState('')
  const ani = (() => { const a = new Date().getFullYear(); return [a, a - 1, a - 2] })()

  useEffect(() => {
    setFiltre(f)
    const handle = setTimeout(incarca, f.q ? 300 : 0)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])

  async function incarca() {
    setLoading(true)
    setEroare('')
    let query = supabase.from('sec_documente_lista').select('*', { count: 'exact' }).eq('registru', 'circuit').eq('an', f.an)
    if (f.status) query = query.eq('status', f.status)
    if (f.mod) query = query.eq('mod_semnare', f.mod)
    if (f.de) query = query.gte('data_inreg', f.de)
    if (f.pana) query = query.lte('data_inreg', f.pana)
    const t = f.q.replace(/[,()*%\\:]/g, ' ').trim()
    if (t) query = query.or(`numar_afisat.ilike.%${t}%,obiect.ilike.%${t}%`)
    const de = (f.pagina - 1) * PE_PAGINA
    const { data, count, error } = await query.order('nr', { ascending: false }).range(de, de + PE_PAGINA - 1)
    if (error) setEroare(mesajEroare(error))
    setRows(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  const set = (cheie, valoare) => setF((v) => ({ ...v, [cheie]: valoare, pagina: cheie === 'pagina' ? valoare : 1 }))
  const nrPagini = Math.max(1, Math.ceil(total / PE_PAGINA))
  const filtrat = f.q || f.status || f.mod || f.de || f.pana

  async function deschideLink(e, path) {
    e.stopPropagation()
    try { await deschideFisier(path) } catch (err) { setEroare(mesajEroare(err)) }
  }

  const locatieSauFisier = (d) => {
    if (d.status === 'anulat') return <span className="text-slate-400">—</span>
    if (d.mod_semnare === 'electronica') {
      return d.fisier_curent_path ? (
        <button className="inline-flex items-center gap-1 font-medium text-accent hover:underline focus-ring" onClick={(e) => deschideLink(e, d.fisier_curent_path)}>
          <ExternalLink size={13} /> Deschide fișierul
        </button>
      ) : <span className="text-slate-500">Fișier neîncărcat</span>
    }
    return d.locatie_hartie || <span className="text-slate-400">—</span>
  }

  return (
    <div className="space-y-4">
      <Titlu actiuni={esteStaff(role) && <button className={btnPrimary} onClick={onNou}><Plus size={15} /> {info.nou}</button>}>
        {info.label}
      </Titlu>

      <Card>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="cauta">Caută (număr, obiect)</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input id="cauta" className={`${inputCls} pl-9`} value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="ex. 12 sau contract" />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="an">An</label>
            <select id="an" className={inputCls} value={f.an} onChange={(e) => set('an', Number(e.target.value))}>
              {ani.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="status">Status</label>
            <select id="status" className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Toate</option>
              {STATUSURI_CIRCUIT.map((s) => <option key={s} value={s}>{STATUSURI[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="mod">Mod de semnare</label>
            <select id="mod" className={inputCls} value={f.mod} onChange={(e) => set('mod', e.target.value)}>
              <option value="">Toate</option>
              {Object.entries(MOD_SEMNARE_SCURT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="de">De la data</label>
            <input id="de" type="date" className={inputCls} value={f.de} onChange={(e) => set('de', e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="pana">Până la data</label>
            <input id="pana" type="date" className={inputCls} value={f.pana} onChange={(e) => set('pana', e.target.value)} />
          </div>
        </div>
        {filtrat && (
          <div className="mt-3">
            <button className={btnGhost} onClick={() => setF({ ...FILTRE_IMPLICITE(), an: f.an })}>Șterge filtrele</button>
          </div>
        )}
      </Card>

      <Eroare>{eroare}</Eroare>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Număr</th>
              <th className="px-4 py-2.5 font-semibold">Data</th>
              <th className="px-4 py-2.5 font-semibold">Obiect</th>
              <th className="px-4 py-2.5 font-semibold">Inițiator</th>
              <th className="px-4 py-2.5 font-semibold">Mod</th>
              <th className="px-4 py-2.5 font-semibold">Semnatari</th>
              <th className="px-4 py-2.5 font-semibold">Locație / fișier</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} tabIndex={0} onClick={() => onDeschide(d.id)} onKeyDown={(e) => e.key === 'Enter' && onDeschide(d.id)}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 focus-ring">
                <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-accent">
                  {d.numar_afisat}
                  {d.confidential && <Lock size={12} className="ml-1.5 inline text-slate-400" aria-label="Confidențial" />}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatData(d.data_inreg)}</td>
                <td className="max-w-xs truncate px-4 py-2.5" title={d.obiect}>{d.obiect}</td>
                <td className="px-4 py-2.5 text-slate-600">{numeResponsabil(comune, d)}</td>
                <td className="px-4 py-2.5"><ModSemnareBadge mod={d.mod_semnare} /></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                  {d.semnatari_total > 0 ? `${d.semnatari_semnat} din ${d.semnatari_total}` : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{locatieSauFisier(d)}</td>
                <td className="px-4 py-2.5"><StareBadge stare={d.status} /></td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                {filtrat ? 'Niciun document nu se potrivește filtrelor.' : `Nu există încă documente în Circuitul de semnare pe ${f.an}.`}
              </td></tr>
            )}
            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Se încarcă…</td></tr>}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>{total} {total === 1 ? 'document' : 'documente'}</span>
        <div className="flex items-center gap-2">
          <button className={btnGhost} disabled={f.pagina <= 1} onClick={() => set('pagina', f.pagina - 1)}>Înapoi</button>
          <span>Pagina {f.pagina} din {nrPagini}</span>
          <button className={btnGhost} disabled={f.pagina >= nrPagini} onClick={() => set('pagina', f.pagina + 1)}>Înainte</button>
        </div>
      </div>
    </div>
  )
}
