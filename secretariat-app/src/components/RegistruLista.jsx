import { useEffect, useState } from 'react'
import { Lock, Pencil, Plus, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { FLUX, REGISTRE, STATUSURI, esteStaff } from '../lib/roluri'
import { azi, formatData, mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Card, Eroare, StareBadge, Titlu } from './comun'
import { LocLiber, SerieChips } from './Serii'

const PE_PAGINA = 25

const FILTRE_IMPLICITE = () => ({
  an: new Date().getFullYear(),
  q: '',
  serie: '',
  status: '',
  tip: '',
  grup: '',
  de: '',
  pana: '',
  pagina: 1,
})

export function numeResponsabil(comune, doc) {
  const ang = doc.resp_angajat_id && comune.angajati.find((a) => a.id === doc.resp_angajat_id)
  const grup = doc.resp_grup_id && comune.grupuri.find((g) => g.id === doc.resp_grup_id)
  return [ang?.nume_complet, grup?.nume].filter(Boolean).join(' · ')
}

export default function RegistruLista({ registru, role, comune, filtre, setFiltre, versiune, onDeschide, onNou, onEdit, onLiber }) {
  const info = REGISTRE[registru]
  const [f, setF] = useState(() => filtre || FILTRE_IMPLICITE())
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState('')

  const ani = (() => {
    const a = new Date().getFullYear()
    return [a, a - 1, a - 2]
  })()

  useEffect(() => {
    setFiltre(f)
    const handle = setTimeout(incarca, f.q ? 300 : 0) // mică amânare cât se scrie în căutare
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, versiune])

  async function incarca() {
    setLoading(true)
    setEroare('')
    let query = supabase
      .from('sec_documente_lista')
      .select('*', { count: 'exact' })
      .eq('registru', registru)
      .eq('an', f.an)
    if (f.serie) query = query.eq('serie_id', f.serie)
    if (f.status) query = query.eq('status', f.status)
    if (f.tip) query = query.eq('tip_id', f.tip)
    if (f.de) query = query.gte('data_inreg', f.de)
    if (f.pana) query = query.lte('data_inreg', f.pana)
    if (f.grup) {
      const { data: membri } = await supabase.rpc('sec_membri_grup', { p_grup: f.grup })
      const ids = (membri || []).filter((x) => /^[0-9a-f-]{36}$/i.test(x))
      query = query.or([`resp_grup_id.eq.${f.grup}`, ids.length ? `resp_angajat_id.in.(${ids.join(',')})` : null].filter(Boolean).join(','))
    }
    const t = f.q.replace(/[,()*%\\:]/g, ' ').trim()
    if (t) {
      query = query.or(`numar_afisat.ilike.%${t}%,obiect.ilike.%${t}%,contact_denumire.ilike.%${t}%,nr_document_extern.ilike.%${t}%`)
    }
    const de = (f.pagina - 1) * PE_PAGINA
    const { data, count, error } = await query.order('data_inreg', { ascending: false }).order('created_at', { ascending: false }).range(de, de + PE_PAGINA - 1)
    if (error) setEroare(mesajEroare(error))
    setRows(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  const set = (cheie, valoare) => setF((v) => ({ ...v, [cheie]: valoare, pagina: cheie === 'pagina' ? valoare : 1 }))
  const nrPagini = Math.max(1, Math.ceil(total / PE_PAGINA))
  const filtrat = f.q || f.serie || f.status || f.tip || f.grup || f.de || f.pana
  const termenDepasit = (d) => d.termen_raspuns && d.termen_raspuns < azi() && !['solutionat', 'arhivat', 'anulat'].includes(d.status)

  return (
    <div className="space-y-4">
      <Titlu
        actiuni={
          esteStaff(role) && (
            <>
              <LocLiber registru={registru} role={role} serii={comune.serii} serieImplicita={f.serie} onGata={onLiber} />
              <button className={btnPrimary} onClick={() => onNou(f.serie)}>
                <Plus size={15} /> {info.nou}
              </button>
            </>
          )
        }
      >
        Registrul de {info.label.toLowerCase()}
      </Titlu>

      <SerieChips serii={comune.serii} valoare={f.serie} onChange={(v) => set('serie', v)} />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="cauta">Caută (număr, {info.contact.toLowerCase()}, obiect)</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="cauta" className={`${inputCls} pl-9`} value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="ex. 842 sau Primăria" />
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
              {[...FLUX[registru], 'liber', 'anulat'].map((s) => <option key={s} value={s}>{STATUSURI[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="tip">Tip document</label>
            <select id="tip" className={inputCls} value={f.tip} onChange={(e) => set('tip', e.target.value)}>
              <option value="">Toate</option>
              {comune.tipuri.map((t) => <option key={t.id} value={t.id}>{t.denumire}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="grup">Departament</label>
            <select id="grup" className={inputCls} value={f.grup} onChange={(e) => set('grup', e.target.value)}>
              <option value="">Toate</option>
              {comune.grupuri.map((g) => <option key={g.id} value={g.id}>{g.nume}</option>)}
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
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Număr</th>
              <th className="px-4 py-2.5 font-semibold">Data</th>
              <th className="px-4 py-2.5 font-semibold">{info.contact}</th>
              <th className="px-4 py-2.5 font-semibold">Obiect</th>
              <th className="px-4 py-2.5 font-semibold">{registru === 'intrari' ? 'Repartizat către' : 'Inițiator'}</th>
              {registru === 'intrari' && <th className="px-4 py-2.5 font-semibold">Termen</th>}
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5"><span className="sr-only">Acțiuni</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const liber = d.status === 'liber'
              const staff = esteStaff(role)
              const poateEdita = staff && !['anulat', 'arhivat', 'liber'].includes(d.status)
              return (
                <tr key={d.id} tabIndex={0} onClick={() => (liber ? staff && onEdit(d) : onDeschide(d.id))} onKeyDown={(e) => e.key === 'Enter' && (liber ? staff && onEdit(d) : onDeschide(d.id))}
                  className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 focus-ring ${liber ? 'bg-orange-50/40' : ''}`}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-accent">
                    {d.numar_afisat}
                    {d.confidential && <Lock size={12} className="ml-1.5 inline text-slate-400" aria-label="Confidențial" />}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{formatData(d.data_inreg)}</td>
                  {liber ? (
                    <>
                      <td className="px-4 py-2.5 italic text-slate-400">Loc liber</td>
                      <td className="px-4 py-2.5 italic text-slate-400">rezervat, necompletat</td>
                      <td className="px-4 py-2.5 text-slate-300">—</td>
                      {registru === 'intrari' && <td className="px-4 py-2.5 text-slate-300">—</td>}
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5">{d.contact_denumire}</td>
                      <td className="max-w-xs truncate px-4 py-2.5" title={d.obiect}>{d.obiect}</td>
                      <td className="px-4 py-2.5 text-slate-600">{numeResponsabil(comune, d)}</td>
                      {registru === 'intrari' && (
                        <td className={`whitespace-nowrap px-4 py-2.5 ${termenDepasit(d) ? 'font-semibold text-rose-600' : 'text-slate-600'}`}>
                          {formatData(d.termen_raspuns)}
                        </td>
                      )}
                    </>
                  )}
                  <td className="px-4 py-2.5"><StareBadge stare={d.status} /></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    {liber && staff && <button className={btnPrimary} onClick={(e) => { e.stopPropagation(); onEdit(d) }}>Completează</button>}
                    {poateEdita && (
                      <button className={btnGhost} onClick={(e) => { e.stopPropagation(); onEdit(d) }}><Pencil size={13} /> Editează</button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  {filtrat ? 'Niciun document nu se potrivește filtrelor.' : `Nu există încă documente în registrul de ${info.label.toLowerCase()} pe ${f.an}.`}
                </td>
              </tr>
            )}
            {loading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Se încarcă…</td></tr>
            )}
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
