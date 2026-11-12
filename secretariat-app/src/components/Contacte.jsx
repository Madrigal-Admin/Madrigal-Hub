import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { esteStaff } from '../lib/roluri'
import { mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary, inputCls, labelCls } from '../lib/ui'
import { Card, Eroare, Info, Titlu } from './comun'

const GOL = { denumire: '', tip: 'institutie', email: '', telefon: '', adresa: '', observatii: '', activ: true }
const LIMITA = 50

// Lista comună de contacte: expeditori la Intrări, destinatari la Ieșiri.
export default function Contacte({ role }) {
  const staff = esteStaff(role)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [arataInactive, setArataInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null) // contact în curs de adăugare / modificare
  const [eroare, setEroare] = useState('')
  const [mesaj, setMesaj] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const handle = setTimeout(incarca, q ? 250 : 0)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, arataInactive])

  async function incarca() {
    setLoading(true)
    let query = supabase.from('sec_contacte').select('*', { count: 'exact' }).order('denumire').limit(LIMITA)
    if (!arataInactive) query = query.eq('activ', true)
    const t = q.replace(/[,()*%\\:]/g, ' ').trim()
    if (t) query = query.ilike('denumire', `%${t}%`)
    const { data, count, error } = await query
    if (error) setEroare(mesajEroare(error))
    setRows(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  async function salveaza(e) {
    e.preventDefault()
    setEroare('')
    setMesaj('')
    if (!form.denumire.trim()) return setEroare('Scrie denumirea contactului.')
    setBusy(true)
    const valori = {
      denumire: form.denumire.trim(),
      tip: form.tip,
      email: form.email?.trim() || null,
      telefon: form.telefon?.trim() || null,
      adresa: form.adresa?.trim() || null,
      observatii: form.observatii?.trim() || null,
      activ: form.activ,
    }
    const { error } = form.id
      ? await supabase.from('sec_contacte').update(valori).eq('id', form.id)
      : await supabase.from('sec_contacte').insert(valori)
    setBusy(false)
    if (error) return setEroare(mesajEroare(error))
    setMesaj('Contactul a fost salvat.')
    setForm(null)
    incarca()
  }

  return (
    <div className="space-y-4">
      <Titlu actiuni={staff && !form && <button className={btnPrimary} onClick={() => { setMesaj(''); setForm({ ...GOL }) }}><Plus size={15} /> Contact nou</button>}>
        Contacte
      </Titlu>
      <p className="text-sm text-slate-600">Lista comună folosită ca expeditor (Intrări) și ca destinatar (Ieșiri). Un contact dezactivat nu mai apare la alegere, dar rămâne la documentele vechi.</p>
      {mesaj && <Info>{mesaj}</Info>}
      <Eroare>{eroare}</Eroare>

      {form && (
        <Card>
          <form onSubmit={salveaza} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">{form.id ? 'Modifică contactul' : 'Contact nou'}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Denumire *</label>
                <input className={inputCls} value={form.denumire} onChange={(e) => setForm({ ...form, denumire: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Tip</label>
                <select className={inputCls} value={form.tip} onChange={(e) => setForm({ ...form, tip: e.target.value })}>
                  <option value="institutie">Instituție</option>
                  <option value="persoana">Persoană</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Telefon</label>
                <input className={inputCls} value={form.telefon || ''} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>E-mail</label>
                <input type="email" className={inputCls} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Adresă</label>
                <input className={inputCls} value={form.adresa || ''} onChange={(e) => setForm({ ...form, adresa: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Observații</label>
                <textarea rows={2} className={inputCls} value={form.observatii || ''} onChange={(e) => setForm({ ...form, observatii: e.target.value })} />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.activ} onChange={(e) => setForm({ ...form, activ: e.target.checked })} /> Activ
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={busy}>Salvează</button>
              <button type="button" className={btnGhost} onClick={() => setForm(null)}>Renunță</button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className={labelCls} htmlFor="cauta_c">Caută după denumire</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="cauta_c" className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={arataInactive} onChange={(e) => setArataInactive(e.target.checked)} /> Arată și contactele dezactivate
          </label>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Denumire</th>
              <th className="px-4 py-2.5 font-semibold">Tip</th>
              <th className="px-4 py-2.5 font-semibold">E-mail</th>
              <th className="px-4 py-2.5 font-semibold">Telefon</th>
              {staff && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className={`px-4 py-2.5 ${c.activ ? '' : 'text-slate-400 line-through'}`}>{c.denumire}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.tip === 'persoana' ? 'Persoană' : 'Instituție'}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.email}</td>
                <td className="px-4 py-2.5 text-slate-600">{c.telefon}</td>
                {staff && (
                  <td className="px-4 py-2.5 text-right">
                    <button className={btnGhost} onClick={() => { setMesaj(''); setForm({ ...c }) }}>Modifică</button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Niciun contact găsit.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-sm text-slate-500">{total > LIMITA ? `Se afișează primele ${LIMITA} din ${total}. Restrânge căutarea ca să vezi restul.` : `${total} ${total === 1 ? 'contact' : 'contacte'}`}</p>
    </div>
  )
}
