import { useState } from 'react'
import RegistruLista from './RegistruLista'
import DocumentDetaliu from './DocumentDetaliu'
import DocumentForm from './DocumentForm'
import CircuitForm from './CircuitForm'
import CircuitLista from './CircuitLista'

// Un registru (Intrări sau Ieșiri) are trei ecrane: lista, detaliul unui document și formularul.
export default function Registru({ registru, params, role, comune, go }) {
  const [ecran, setEcran] = useState(params?.id ? { tip: 'detaliu', id: params.id } : { tip: 'lista' })
  // La revenirea în listă se păstrează filtrele, ca să nu se piardă căutarea
  const [filtre, setFiltre] = useState(null)

  const lista = () => setEcran({ tip: 'lista' })

  if (ecran.tip === 'form') {
    const Formular = registru === 'circuit' ? CircuitForm : DocumentForm
    return (
      <Formular
        registru={registru}
        doc={ecran.doc || null}
        role={role}
        comune={comune}
        onSalvat={(id) => setEcran({ tip: 'detaliu', id })}
        onRenunta={() => (ecran.doc ? setEcran({ tip: 'detaliu', id: ecran.doc.id }) : lista())}
      />
    )
  }
  if (ecran.tip === 'detaliu') {
    return (
      <DocumentDetaliu
        id={ecran.id}
        role={role}
        comune={comune}
        onInapoi={lista}
        onEdit={(doc) => setEcran({ tip: 'form', doc })}
        onDeschide={(reg, id) => (reg === registru ? setEcran({ tip: 'detaliu', id }) : go(reg, { id }))}
      />
    )
  }
  const Lista = registru === 'circuit' ? CircuitLista : RegistruLista
  return (
    <Lista
      registru={registru}
      role={role}
      comune={comune}
      filtre={filtre}
      setFiltre={setFiltre}
      onDeschide={(id) => setEcran({ tip: 'detaliu', id })}
      onNou={() => setEcran({ tip: 'form', doc: null })}
    />
  )
}
