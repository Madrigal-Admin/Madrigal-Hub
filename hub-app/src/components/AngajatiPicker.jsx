import { useMemo, useRef, useState } from 'react'
import { X as XIcon } from 'lucide-react'

// Alegere de angajați (unul sau mai mulți): scrii și apar sugestii, sau dai click
// direct pe o persoană din listă. Lista vine mereu din tabelul de angajați.
export default function AngajatiPicker({ angajati, valoare, onChange, placeholder = 'Caută un angajat…' }) {
  const [text, setText] = useState('')
  const [deschis, setDeschis] = useState(false)
  const inchideRef = useRef(null)

  const selectati = useMemo(
    () => valoare.map((id) => angajati.find((a) => a.id === id)).filter(Boolean),
    [valoare, angajati]
  )

  const sugestii = useMemo(() => {
    const q = text.trim().toLowerCase()
    return angajati
      .filter((a) => a.activ && !valoare.includes(a.id))
      .filter((a) => !q || (a.nume_complet || '').toLowerCase().includes(q))
  }, [angajati, valoare, text])

  function adauga(id) {
    onChange([...valoare, id])
    setText('')
  }

  function scoate(id) {
    onChange(valoare.filter((x) => x !== id))
  }

  return (
    <div className="relative">
      {selectati.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectati.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {a.nume_complet}
              <button type="button" onClick={() => scoate(a.id)} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600" title="Scoate">
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          setDeschis(true)
        }}
        onFocus={() => {
          clearTimeout(inchideRef.current)
          setDeschis(true)
        }}
        onBlur={() => {
          inchideRef.current = setTimeout(() => setDeschis(false), 150)
        }}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />
      {deschis && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {sugestii.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">Niciun angajat găsit.</p>
          ) : (
            sugestii.map((a) => (
              <button
                key={a.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => adauga(a.id)}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {a.nume_complet}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
