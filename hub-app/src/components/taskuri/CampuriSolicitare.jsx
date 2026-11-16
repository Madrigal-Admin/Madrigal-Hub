import { inputCls, labelCls } from '../../lib/taskuri/ui'
import { esteAltul, optiuniCamp } from '../../lib/taskuri/solicitari'
import AngajatiPicker from './AngajatiPicker'
import SelectieMultipla from './SelectieMultipla'

// Câmpurile din șablonul unei categorii (Design grafic, Foto-video…), în ordinea din Setări.
export default function CampuriSolicitare({ campuri, valori, setValoare, ctx, eveniment }) {
  const angajati = ctx.angajati.filter((a) => a.activ)
  return (
    <>
      {campuri.filter((c) => c.activ).map((c) => {
        const v = valori[c.cheie]
        const optiuni = c.tip === 'lista' || c.tip === 'multi' ? optiuniCamp(c, eveniment) : []
        const altulAles = c.tip === 'lista' ? esteAltul(optiuni.find((o) => o.cod === v)?.eticheta) : c.tip === 'multi' ? (v || []).some((cod) => esteAltul(optiuni.find((o) => o.cod === cod)?.eticheta)) : false
        const id = `camp-${c.cheie}`
        return (
          <div key={c.id}>
            <label htmlFor={id} className={labelCls}>{c.eticheta}{c.obligatoriu ? ' *' : ''}</label>
            {c.tip === 'lista' && (
              <select id={id} className={inputCls} value={v || ''} onChange={(e) => setValoare(c.cheie, e.target.value)}>
                <option value="">— alege —</option>
                {optiuni.map((o) => <option key={o.cod} value={o.cod}>{o.eticheta}</option>)}
              </select>
            )}
            {c.tip === 'multi' && <SelectieMultipla id={id} optiuni={optiuni} valoare={v || []} onChange={(x) => setValoare(c.cheie, x)} />}
            {c.tip === 'persoana' && <AngajatiPicker single angajati={angajati} valoare={v ? [v] : []} onChange={(x) => setValoare(c.cheie, x[0] || '')} />}
            {c.tip === 'text' && <input id={id} className={inputCls} maxLength={200} value={v || ''} onChange={(e) => setValoare(c.cheie, e.target.value)} />}
            {c.tip === 'paragraf' && <textarea id={id} className={inputCls} rows={3} maxLength={2000} value={v || ''} onChange={(e) => setValoare(c.cheie, e.target.value)} />}
            {c.tip === 'numar' && <input id={id} type="number" min="1" step="1" className={inputCls} value={v || ''} onChange={(e) => setValoare(c.cheie, e.target.value)} />}
            {c.tip === 'data' && <input id={id} type="date" className={inputCls} value={v || ''} onChange={(e) => setValoare(c.cheie, e.target.value)} />}
            {c.tip === 'ora' && <input id={id} type="time" className={inputCls} value={v || ''} onChange={(e) => setValoare(c.cheie, e.target.value)} />}
            {c.tip === 'link' && <input id={id} className={inputCls} placeholder="https://…" value={v || ''} onChange={(e) => setValoare(c.cheie, e.target.value)} />}
            {altulAles && <p className="mt-1 text-xs text-amber-700">Ai ales „Altul”: explică în câmpul Descriere de mai jos.</p>}
            {c.ajutor && !altulAles && <p className="mt-1 text-xs text-slate-400">{c.ajutor}</p>}
          </div>
        )
      })}
    </>
  )
}
