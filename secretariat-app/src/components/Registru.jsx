import { useState } from 'react'
import RegistruLista from './RegistruLista'
import DocumentDetaliu from './DocumentDetaliu'
import DocumentForm from './DocumentForm'
import CircuitForm from './CircuitForm'
import CircuitLista from './CircuitLista'
import { Fereastra, Info } from './comun'
import { numarDin } from './Serii'
import { REGISTRE } from '../lib/roluri'

// Un registru are un singur ecran (lista). Orice document se deschide într-o singură fereastră (pop-up) care are trei moduri:
//   vezi  = toate detaliile documentului (stare, rezoluție, fișiere, legături, jurnal, acțiuni)
//   edit  = modificarea sau completarea documentului (același formular ca la adăugare)
//   nou   = adăugarea unui document
// Starea ferestrei: { mod, id, doc, prefill, serieImplicita, dinVedere }
export default function Registru({ registru, params, role, comune, go }) {
  const [fereastra, setFereastra] = useState(() => {
    if (params?.id) return { mod: 'vezi', id: params.id }
    if (params?.nou) return { mod: 'nou', prefill: params.nou }
    return null
  })
  const [titluVezi, setTitluVezi] = useState('') // numărul documentului deschis, aflat după încărcare
  const [versiune, setVersiune] = useState(0) // crește când lista sau documentul trebuie reîncărcate
  const [anunt, setAnunt] = useState(null) // { text, id }
  // Filtrele listei se păstrează cât timp ești în acest registru
  const [filtre, setFiltre] = useState(null)

  const info = REGISTRE[registru]
  const reincarca = () => setVersiune((v) => v + 1)
  const deschide = (id) => { setAnunt(null); setTitluVezi(''); setFereastra({ mod: 'vezi', id }) }
  const inchide = () => { setFereastra(null); reincarca() }

  function dupaSalvare(id, rezultat) {
    const f = fereastra
    // Adăugare din „Trimite la semnare” / „Înregistrează în Ieșiri” sau modificare făcută din fereastra documentului: se revine la document
    if (f?.mod === 'nou' ? f.prefill : f?.dinVedere) {
      deschide(id)
      reincarca()
      return
    }
    setFereastra(null)
    const completare = f?.doc?.status === 'liber'
    const numar = rezultat?.nr ? numarDin(registru, { ...rezultat, serie_id: rezultat.serie_id || f?.doc?.serie_id }, comune.serii) : ''
    setAnunt({ id, text: f?.doc ? `Salvat: ${f.doc.numar_afisat}.` : numar ? `Înregistrat: ${numar}.` : 'Documentul a fost înregistrat.', completare })
    reincarca()
  }

  const Lista = registru === 'circuit' ? CircuitLista : RegistruLista
  const Formular = registru === 'circuit' ? CircuitForm : DocumentForm
  const doc = fereastra?.doc || null

  let titlu = ''
  let subtitlu
  let latime = 'max-w-3xl'
  if (fereastra?.mod === 'vezi') {
    titlu = titluVezi || 'Se încarcă…'
    latime = 'max-w-6xl'
  } else if (fereastra?.mod === 'edit') {
    titlu = doc?.status === 'liber' ? `Completează ${doc.numar_afisat}` : `Modificare ${doc?.numar_afisat || ''}`
  } else if (fereastra?.mod === 'nou') {
    titlu = info.nou
    subtitlu = 'Numărul se acordă automat la salvare. Dacă renunți, nu se pierde niciun număr.'
  }

  return (
    <>
      <div className="space-y-4">
        {anunt && (
          <Info>
            {anunt.text}{' '}
            <button className="font-semibold underline" onClick={() => deschide(anunt.id)}>Deschide</button>
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
          onDeschide={deschide}
          onNou={(serieImplicita) => { setAnunt(null); setFereastra({ mod: 'nou', serieImplicita }) }}
          onEdit={(d) => { setAnunt(null); setFereastra({ mod: 'edit', id: d.id, doc: d, dinVedere: false }) }}
          onLiber={(text) => { setAnunt({ id: null, text }); reincarca() }}
        />
      </div>

      {fereastra && (
        <Fereastra titlu={titlu} subtitlu={subtitlu} latime={latime} onInchide={inchide}>
          {fereastra.mod === 'vezi' ? (
            <DocumentDetaliu
              key={`${fereastra.id}-${versiune}`}
              id={fereastra.id}
              role={role}
              comune={comune}
              onInchide={inchide}
              onIncarcat={(d) => setTitluVezi(d ? d.numar_afisat : 'Document')}
              onEdit={(d) => setFereastra({ mod: 'edit', id: d.id, doc: d, dinVedere: true })}
              onDeschide={(reg, id) => (reg === registru ? deschide(id) : go(reg, { id }))}
              onNou={(reg, nou) => go(reg, { nou: { ...nou, ts: Date.now() } })}
            />
          ) : (
            <Formular
              registru={registru}
              doc={doc}
              prefill={fereastra.prefill || null}
              serieImplicita={fereastra.serieImplicita || ''}
              role={role}
              comune={comune}
              onSalvat={dupaSalvare}
              onRenunta={() => (fereastra.dinVedere ? deschide(fereastra.id) : setFereastra(null))}
            />
          )}
        </Fereastra>
      )}
    </>
  )
}
