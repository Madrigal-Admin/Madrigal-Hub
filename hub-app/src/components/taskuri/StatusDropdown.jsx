import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { STATUSURI } from '../../lib/taskuri/ui'

const PUNCT = { de_facut: '#9AA6B8', in_lucru: '#E0A21B', terminat: '#2E9E6B', anulat: '#C0554F' }
const CLS = {
  de_facut: 'bg-[#EEF1F6] text-[#3A465C]',
  in_lucru: 'bg-[#FFF1D6] text-[#8A5A00]',
  terminat: 'bg-[#DDF3E6] text-[#1E6B43]',
  anulat: 'bg-[#FBE3E1] text-[#9B2C27]',
}

// Butonul de status dintr-o listă: la click se deschide meniul cu statusurile posibile.
// Dacă nu ai dreptul să schimbi statusul, apare doar eticheta.
export default function StatusDropdown({ status, poate, poateAnula, onChange, compact = false }) {
  const [deschis, setDeschis] = useState(false)
  const [poz, setPoz] = useState(null)
  const buton = useRef(null)
  const nume = STATUSURI.find((s) => s.cod === status)?.nume || status
  const marime = compact ? 'h-7 min-w-[92px] px-2.5 text-xs' : 'min-h-[44px] px-3 text-xs'
  const eticheta = `inline-flex items-center justify-center gap-1 rounded-md font-bold ${CLS[status]} ${marime}`

  useLayoutEffect(() => {
    if (!deschis || !buton.current) return
    const r = buton.current.getBoundingClientRect()
    const sus = r.bottom + 190 > window.innerHeight && r.top > 190
    setPoz({ left: Math.min(r.left, window.innerWidth - 176), top: sus ? undefined : r.bottom + 4, bottom: sus ? window.innerHeight - r.top + 4 : undefined })
  }, [deschis])

  useEffect(() => {
    if (!deschis) return
    const inchide = () => setDeschis(false)
    const tasta = (e) => e.key === 'Escape' && (e.stopPropagation(), setDeschis(false))
    window.addEventListener('scroll', inchide, true)
    window.addEventListener('resize', inchide)
    window.addEventListener('keydown', tasta, true)
    return () => {
      window.removeEventListener('scroll', inchide, true)
      window.removeEventListener('resize', inchide)
      window.removeEventListener('keydown', tasta, true)
    }
  }, [deschis])

  if (!poate) return <span className={eticheta}>{nume}</span>

  const optiuni = STATUSURI.filter((s) => s.cod !== 'anulat' || poateAnula || status === 'anulat')
  return (
    <>
      <button ref={buton} type="button" aria-haspopup="listbox" aria-expanded={deschis} onClick={(e) => { e.stopPropagation(); setDeschis((d) => !d) }} className={`${eticheta} hover:brightness-95 focus-ring`} title="Schimbă statusul">
        {nume} <ChevronDown size={13} aria-hidden="true" />
      </button>
      {deschis && poz && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setDeschis(false)} />
          <ul role="listbox" style={poz} className="fixed z-[61] w-44 overflow-hidden rounded-xl border border-[#E1E4EA] bg-white py-1 shadow-lg">
            {optiuni.map((s) => (
              <li key={s.cod}>
                <button
                  type="button"
                  role="option"
                  aria-selected={s.cod === status}
                  onClick={() => { setDeschis(false); if (s.cod !== status) onChange(s.cod) }}
                  className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-sm font-medium text-[#172036] hover:bg-[#F6F8FB]"
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PUNCT[s.cod] }} />
                  <span className="flex-1">{s.nume}</span>
                  {s.cod === status && <Check size={15} className="text-accent" />}
                </button>
              </li>
            ))}
          </ul>
        </>,
        document.body
      )}
    </>
  )
}
