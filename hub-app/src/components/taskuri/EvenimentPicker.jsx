import { useMemo, useState } from 'react'
import { Search, X as XIcon } from 'lucide-react'
import { azi, formatData, inputCls } from '../../lib/taskuri/ui'
import { culoareText } from '../../lib/evenimente'

const LUNI_SCURT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']

function Insigna({ data }) {
  if (!data) return <div className="h-11 w-11 shrink-0 rounded-lg bg-slate-100" />
  return (
    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 leading-none">
      <span className="text-[10px] font-semibold uppercase text-accent">{LUNI_SCURT[+data.slice(5, 7) - 1]}</span>
      <span className="mt-0.5 text-base font-bold text-slate-800">{+data.slice(8, 10)}</span>
    </div>
  )
}

function Rand({ e, ctx, onClick, activ }) {
  const st = ctx.statusMap[e.status]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 ${activ ? 'bg-indigo-50' : ''}`}
    >
      <Insigna data={e.data} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-800">{e.nume}</span>
        <span className="block truncate text-xs text-slate-500">
          {formatData(e.data)}
          {e.data_sfarsit && e.data_sfarsit !== e.data ? ` – ${formatData(e.data_sfarsit)}` : ''}
          {e.localitate ? ` · ${e.localitate}` : ''}
        </span>
      </span>
      {st && (
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${st.culoare}26`, color: culoareText(st.culoare) }}>
          {st.nume}
        </span>
      )}
    </button>
  )
}

// Alegerea unui eveniment: căutare după nume/oraș, cele viitoare întâi, trecutele ascunse implicit.
export default function EvenimentPicker({ evenimente, ctx, valoare, onChange, dezactivat }) {
  const [text, setText] = useState('')
  const [trecute, setTrecute] = useState(false)
  const ales = evenimente.find((e) => e.id === valoare)

  const lista = useMemo(() => {
    const q = text.trim().toLowerCase()
    const astazi = azi()
    return evenimente
      .filter((e) => trecute || !e.data || (e.data_sfarsit || e.data) >= astazi)
      .filter((e) => !q || e.nume.toLowerCase().includes(q) || (e.localitate || '').toLowerCase().includes(q))
      .sort((a, b) => (trecute ? (b.data || '').localeCompare(a.data || '') : (a.data || '').localeCompare(b.data || '')))
  }, [evenimente, text, trecute])

  if (ales) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="flex items-center">
          <div className="min-w-0 flex-1"><Rand e={ales} ctx={ctx} onClick={() => {}} /></div>
          {!dezactivat && (
            <button type="button" onClick={() => onChange('')} className="mr-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100" title="Alege alt eveniment">
              <XIcon size={15} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex items-center gap-3 border-b border-slate-100 p-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pl-8`} placeholder="Caută după nume sau oraș…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={trecute} onChange={(e) => setTrecute(e.target.checked)} />
          Și cele trecute
        </label>
      </div>
      <div className="max-h-64 divide-y divide-slate-50 overflow-y-auto">
        {lista.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-slate-400">
            Niciun eveniment găsit.{!trecute && ' Bifează „Și cele trecute" ca să cauți și printre evenimentele deja petrecute.'}
          </p>
        ) : (
          lista.map((e) => <Rand key={e.id} e={e} ctx={ctx} onClick={() => onChange(e.id)} />)
        )}
      </div>
    </div>
  )
}
