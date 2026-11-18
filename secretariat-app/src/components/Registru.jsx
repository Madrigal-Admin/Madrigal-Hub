import { useState } from 'react'
import RegistruLista from './RegistruLista'
import DocumentDetaliu from './DocumentDetaliu'
import DocumentForm from './DocumentForm'
import CircuitForm from './CircuitForm'
import CircuitLista from './CircuitLista'
import { Fereastra, Info } from './comun'
import { numarDin } from './Serii'
import { REGISTRE } from '../lib/roluri'

// Un registru are două ecrane (lista și detaliul unui document). Adăugarea și modificarea se fac într-o fereastră (pop-up).
export default function Registru({ registru, params, role, comune, go }) {
  const [ecran, setEcran] = useState(() => (params?.id ? { tip: 'detaliu', id: params.id } : { tip: 'lista' }))
  // Fereastra de adăugare/modificare/completare: { doc, prefill, serieImplicita, dupaSalvare }
  const [fereastra, setFereastra] = useState(() => (params?.nou ? { doc: null, prefill: params.nou, dupaSalvare: 'detaliu' } : null))
  const [versiune, setVersiune] = useState(0) // crește când lista sau detaliul trebuie reîncărcate
  const [anunt, setAnunt] = useState(null) // { text, id }
  // La revenirea în listă se păstrează filtrele, ca să nu se piardă căutarea
  const [filtre, setFiltre] = useState(null)

  const info = REGISTRE[registru]
  const lista = () => setEcran({ tip: 'lista' })
  const reincarca = () => setVersiune((v) => v + 1)

  function dupaSalvare(id, rezultat) {
    const f = fereastra
    setFereastra(null)
    if (f?.dupaSalvare === 'detaliu' || ecran.tip === 'detaliu') {
      setEcran({ tip: 'detaliu', id })
      reincarca()
      return
    }
    const completare = f?.doc?.status === 'liber'
    const numar = rezultat?.nr ? numarDin(registru, { ...rezultat, serie_id: rezultat.serie_id || f?.doc?.serie_id }, comune.serii) : ''
    setAnunt({ id, text: f?.doc ? `Salvat: ${f.doc.numar_afisat}.` : numar ? `Înregistrat: ${numar}.` : 'Documentul a fost înregistrat.', completare })
    reincarca()
  }

  let continut
  if (ecran.tip === 'detaliu') {
    continut = (
      <DocumentDetaliu
        key={`${ecran.id}-${versiune}`}
        id={ecran.id}
        role={role}
        comune={comune}
        onInapoi={lista}
        onEdit={(doc) => setFereastra({ doc })}
        onDeschide={(reg, id) => (reg === registru ? setEcran({ tip: 'detaliu', id }) : go(reg, { id }))}
        onNou={(reg, nou) => go(reg, { nou: { ...nou, ts: Date.now() } })}
      />
    )
  } else {
    const Lista = registru === 'circuit' ? CircuitLista : RegistruLista
    continut = (
      <div className="space-y-4">
        {anunt && (
          <Info>
            {anunt.text}{' '}
            <button className="font-semibold underline" onClick={() => { setEcran({ tip: 'detaliu', id: anunt.id }); setAnunt(null) }}>Deschide</button>
            <button className="ml-3 text-slate-500 hover:underline" onClick={() => setAnunt(null)}>Închide</button>
          </Info>
        )}
        <Lista
          registru={registru}
          role={role}
          comune={comune}
          filtre={filtre}
          setFiltre={setFiltre}
          versiune={versiune}
          onDeschide={(id) => { setAnunt(null); setEcran({ tip: 'detaliu', id }) }}
          onNou={(serieImplicita) => { setAnunt(null); setFereastra({ doc: null, serieImplicita }) }}
          onEdit={(doc) => { setAnunt(null); setFereastra({ doc }) }}
          onLiber={(text) => { setAnunt({ id: null, text }); reincarca() }}
        />
      </div>
    )
  }

  const Formular = registru === 'circuit' ? CircuitForm : DocumentForm
  const doc = fereastra?.doc || null
  const titlu = doc ? (doc.status === 'liber' ? `Completează ${doc.numar_afisat}` : `Modificare ${doc.numar_afisat}`) : info.nou
  const subtitlu = doc
    ? undefined
    : 'Numărul se acordă automat la salvare. Dacă renunți, nu se pierde niciun număr.'

  return (
    <>
      {continut}
      {fereastra && (
        <Fereastra titlu={titlu} subtitlu={subtitlu} onInchide={() => setFereastra(null)}>
          <Formular
            registru={registru}
            doc={doc}
            prefill={fereastra.prefill || null}
            serieImplicita={fereastra.serieImplicita || ''}
            role={role}
            comune={comune}
            onSalvat={dupaSalvare}
            onRenunta={() => setFereastra(null)}
          />
        </Fereastra>
      )}
    </>
  )
}
