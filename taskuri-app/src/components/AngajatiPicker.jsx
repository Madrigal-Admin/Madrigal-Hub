import { useMemo, useRef, useState } from 'react'
import { X as XIcon } from 'lucide-react'
import { inputCls } from '../lib/ui'

// Alegere de angajați cu căutare. `single` = o singură persoană (o nouă alegere o înlocuiește).
export default function AngajatiPicker({ angajati, valoare, onChange, single = false, placeholder = 'Caută un angajat…' }) {
  const [text, setText] = useState('')
  const [deschis, setDeschis] = useState(false)
  const inchideRef = useRef(null)

  const selectati = useMemo(() => valoare.map((id) => angajati.find((a) => a.id === id)).filter(Boolean), [valoare, angajati])
  const sugestii = useMemo(() => {
    const q = text.trim().toLowerCase()
    return angajati.filter((a) => !valoare.includes(a.id)).filter((a) => !q || (a.nume_complet || '').toLowerCase().includes(q))
  }, [angajati, valoare, text])

  function alege(id) {
    onChange(single ? [id] : [...valoare, id])
    setText('')
    if (single) setDeschis(false)
  }

  return (
    <div className="relative">
      {selectati.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectati.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {a.nume_complet}
              <button type="button" onClick={() => onChange(valoare.filter((x) => x !== a.id))} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200" title="Scoate">
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={text}
        placeholder={single && selectati.length ? 'Schimbă persoana…' : placeholder}
        onChange={(e) => { setText(e.target.value); setDeschis(true) }}
        onFocus={() => { clearTimeout(inchideRef.current); setDeschis(true) }}
        onBlur={() => { inchideRef.current = setTimeout(() => setDeschis(false), 150) }}
        className={inputCls}
      />
      {deschis && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {sugestii.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">Niciun angajat găsit.</p>
          ) : (
            sugestii.map((a) => (
              <button key={a.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => alege(a.id)} className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                {a.nume_complet}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
