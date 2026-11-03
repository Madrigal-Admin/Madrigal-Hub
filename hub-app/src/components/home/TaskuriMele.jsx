import { useState } from 'react'
import { GRUPE, esteDeschis, grupa } from './date'
import TabelTaskuri from '../taskuri/TabelTaskuri'

// Secțiunile listei (constantă, ca tabelul să nu se recalculeze degeaba)
const GRUPARE = { ordine: GRUPE, fn: grupa }


function trecePrinFiltru(t, filtru) {
  if (filtru === 'Toate') return true
  if (filtru === 'Terminate') return t.status === 'terminat'
  return esteDeschis(t) && grupa(t) === filtru
}

export default function TaskuriMele({ taskuri, filtru, setFiltru, ctx, onOpen }) {
  const [eroare, setEroare] = useState('')
  const deschise = taskuri.filter(esteDeschis)
  const numara = (g) => deschise.filter((t) => grupa(t) === g).length
  const taburi = [
    ['Toate', deschise.length],
    ['Întârziate', numara('Întârziate')],
    ['Azi', numara('Azi')],
    ['Următoarele 7 zile', numara('Următoarele 7 zile')],
    ['Terminate', taskuri.filter((t) => t.status === 'terminat').length],
  ]
  const vizibile = taskuri.filter((t) => trecePrinFiltru(t, filtru))

  return (
    <section aria-label="Taskurile mele" className="min-w-0 overflow-hidden rounded-[14px] border border-[#E1E4EA] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h2 className="text-[19px] font-extrabold">Taskurile mele</h2>
        <div className="flex flex-wrap gap-2">
          {taburi.map(([nume, nr]) => (
            <button
              key={nume}
              type="button"
              aria-pressed={filtru === nume}
              onClick={() => setFiltru(nume)}
              className={`min-h-[40px] rounded-full border px-3.5 text-sm font-semibold ${nume === 'Următoarele 7 zile' || nume === 'Terminate' ? 'hidden sm:block' : ''} ${
                filtru === nume ? 'border-accent bg-accent text-white' : 'border-[#CBD3E0] bg-white text-accent'
              }`}
            >
              {nume === 'Următoarele 7 zile' ? '7 zile' : nume} · {nr}
            </button>
          ))}
        </div>
      </div>
      {eroare && <p className="px-5 pb-2 text-sm text-rose-600">{eroare}</p>}

      {vizibile.length > 0 ? (
        <div className="border-t border-[#E1E4EA]">
          <TabelTaskuri taskuri={vizibile} ctx={ctx} onOpen={onOpen} onEroare={setEroare} arataEveniment grupare={filtru === 'Terminate' ? null : GRUPARE} />
        </div>
      ) : (
        <div className="border-t border-[#EEF0F4] px-5 py-7 text-center text-sm text-[#5B6578]">
          {taskuri.length === 0 ? 'Nu ai niciun task alocat. Când primești unul, apare aici.' : 'Niciun task în această categorie.'}
        </div>
      )}
    </section>
  )
}
