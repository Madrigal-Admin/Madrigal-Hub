import { useState } from 'react'
import { actualizeaza } from '../../lib/taskuri/editare'
import { formatData } from '../../lib/taskuri/ui'

const MS_ZI = 86400000
const ms = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
export const diferentaZile = (de, la) => Math.round((ms(la) - ms(de)) / MS_ZI)
export const mutaData = (s, n) => new Date(ms(s) + n * MS_ZI).toISOString().slice(0, 10)

// Taskurile pe care utilizatorul le poate decala: deschise, cu termen, negestionate de altcineva, neînghețate.
export function taskuriDecalabile(ctx, eveniment_id) {
  if (!ctx || ctx.evenimentAnulat(eveniment_id)) return []
  return ctx.taskuri.filter((t) => t.eveniment_id === eveniment_id && (t.status === 'de_facut' || t.status === 'in_lucru') && t.termen && ctx.poateGestiona(t) && !ctx.inghetat(t))
}

// Fereastra „Decalezi termenele?" – apare după ce data unui eveniment a fost schimbată.
export default function DecalareTermene({ ctx, info, onClose }) {
  const taskuri = taskuriDecalabile(ctx, info.id)
  const n = diferentaZile(info.de, info.la)
  const [lucreaza, setLucreaza] = useState(false)
  const [eroare, setEroare] = useState('')
  const [rezultat, setRezultat] = useState('')

  async function decaleaza() {
    setLucreaza(true)
    setEroare('')
    let esuate = 0
    for (const t of taskuri) {
      if (await actualizeaza(t.id, { termen: mutaData(t.termen, n) })) esuate++
    }
    await ctx.reload()
    setLucreaza(false)
    if (esuate) {
      setEroare(`${esuate} din ${taskuri.length} taskuri nu au putut fi decalate. Verifică-le în lista de taskuri.`)
      setRezultat('parțial')
    } else onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Decalare termene">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-extrabold text-[#172036]">Decalezi și termenele taskurilor?</h3>
        <p className="mt-2 text-sm text-[#5B6578]">
          Data evenimentului s-a mutat de la <b>{formatData(info.de)}</b> la <b>{formatData(info.la)}</b> ({n > 0 ? `+${n}` : n} {Math.abs(n) === 1 ? 'zi' : 'zile'}).
        </p>
        <p className="mt-2 text-sm text-[#172036]">
          Pot muta cu aceeași diferență termenele a <b>{taskuri.length}</b> {taskuri.length === 1 ? 'task deschis' : 'taskuri deschise'}. Taskurile terminate, anulate sau fără termen nu se modifică.
        </p>
        {eroare && <p className="mt-3 text-sm text-[#B4332E]">{eroare}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={lucreaza} className="min-h-[44px] rounded-lg border border-[#D5DAE3] px-4 text-sm font-bold text-[#3A465C] hover:bg-slate-50">
            {rezultat ? 'Închide' : 'Nu, las termenele'}
          </button>
          {!rezultat && (
            <button type="button" onClick={decaleaza} disabled={lucreaza} className="min-h-[44px] rounded-lg bg-accent px-4 text-sm font-bold text-white disabled:opacity-60">
              {lucreaza ? 'Se decalează…' : `Decalează cu ${n > 0 ? '+' : ''}${n} ${Math.abs(n) === 1 ? 'zi' : 'zile'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
