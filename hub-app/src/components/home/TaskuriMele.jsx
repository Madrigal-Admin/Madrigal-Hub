import { useState } from 'react'
import { GRUPE, esteDeschis, grupa } from './date'
import TabelTaskuri from '../taskuri/TabelTaskuri'
import ButonExport from '../taskuri/ButonExport'

// Secțiunile listei (constantă, ca tabelul să nu se recalculeze degeaba)
const GRUPARE = { ordine: GRUPE, fn: grupa }


function trecePrinFiltru(t, filtru, ctx) {
  if (filtru === 'Toate') return true
  if (filtru === 'Fără responsabil') return esteDeschis(t) && !t.responsabil_id
  if (filtru === 'Noi') return !!ctx?.necitite?.[t.id]
  if (filtru === 'Terminate') return t.status === 'terminat'
  return esteDeschis(t) && grupa(t) === filtru
}

export default function TaskuriMele({ taskuri, filtru, setFiltru, ctx, onOpen, vedere = 'atribuite', setVedere, comutator = null }) {
  const [eroare, setEroare] = useState('')
  const deschise = taskuri.filter(esteDeschis)
  const farResp = deschise.filter((t) => !t.responsabil_id).length
  const noi = taskuri.filter((t) => ctx?.necitite?.[t.id]).length
  const numara = (g) => deschise.filter((t) => grupa(t) === g).length
  const taburi = [
    ['Toate', deschise.length],
    ...((noi > 0 && vedere === 'atribuite') || filtru === 'Noi' ? [['Noi', noi]] : []),
    ...(vedere === 'deschise' && (farResp > 0 || filtru === 'Fără responsabil') ? [['Fără responsabil', farResp]] : []),
    ['Întârziate', numara('Întârziate')],
    ['Azi', numara('Azi')],
    ['Următoarele 7 zile', numara('Următoarele 7 zile')],
    ['Terminate', taskuri.filter((t) => t.status === 'terminat').length],
  ]
  const vizibile = taskuri.filter((t) => trecePrinFiltru(t, filtru, ctx))

  return (
    <section aria-label="Taskurile mele" className="min-w-0 overflow-hidden rounded-[14px] border border-[#E1E4EA] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        {comutator ? (
          <div role="group" aria-label="Alege lista" className="inline-flex rounded-full border border-[#CBD3E0] bg-white p-[3px]">
            {[['atribuite', 'Atribuite mie', comutator[0]], ['deschise', 'Deschise de mine', comutator[1]]].map(([k, eticheta, nr]) => (
              <button key={k} type="button" aria-pressed={vedere === k} onClick={() => setVedere(k)} className={`min-h-[38px] rounded-full px-3.5 text-sm font-bold ${vedere === k ? 'bg-accent text-white' : 'text-accent hover:bg-[#EEF3FB]'}`}>
                {eticheta} · {nr}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="text-[19px] font-extrabold">Taskurile mele</h2>
        )}
        <div className="flex flex-wrap items-center gap-2">
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
          <ButonExport taskuri={vizibile} ctx={ctx} numeFisier={vedere === 'deschise' ? 'taskuri-deschise-de-mine' : 'taskurile-mele'} clasa="hidden sm:inline-flex !rounded-full" filtre={[['Listă', vedere === 'deschise' ? 'Deschise de mine' : 'Taskurile mele'], ['Filtru', filtru]]} />
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
