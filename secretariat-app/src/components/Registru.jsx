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
//   nou   = adăugarea unui document
// În modul vezi, `editare` face ca aceleași câmpuri ale documentului să devină editabile pe loc (în aceeași fereastră).
// Starea ferestrei: { mod, id, editare, prefill, serieImplicita }
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
  const deschide = (id, editare = false) => { setAnunt(null); setTitluVezi(''); setFereastra({ mod: 'vezi', id, editare }) }
  const inchide = () => { setFereastra(null); reincarca() }

  // Salvarea din fereastra unui document (modificare sau completarea unui loc liber): fereastra rămâne deschisă, pe document
  function dupaModificare(id) {
    setFereastra({ mod: 'vezi', id, editare: false })
    reincarca()
  }
  // Salvarea unui document nou
  function dupaSalvare(id, rezultat) {
    const f = fereastra
    // Adăugare din „Trimite la semnare” / „Înregistrează în Ieșiri”: se deschide documentul nou
    if (f?.prefill) {
      deschide(id)
      reincarca()
      return
    }
    setFereastra(null)
    const numar = rezultat?.nr ? numarDin(registru, rezultat, comune.serii) : ''
    setAnunt({ id, text: numar ? `Înregistrat: ${numar}.` : 'Documentul a fost înregistrat.' })
    reincarca()
  }

  const Lista = registru === 'circuit' ? CircuitLista : RegistruLista
  const Formular = registru === 'circuit' ? CircuitForm : DocumentForm

  let titlu = ''
  let subtitlu
  let latime = 'max-w-3xl'
  if (fereastra?.mod === 'vezi') {
    titlu = titluVezi || 'Se încarcă…'
    latime = 'max-w-6xl'
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
          onEdit={(d) => deschide(d.id, true)}
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
              editare={!!fereastra.editare}
              onEditare={(e) => setFereastra({ ...fereastra, editare: e })}
              onSalvat={dupaModificare}
              onDeschide={(reg, id) => (reg === registru ? deschide(id) : go(reg, { id }))}
              onNou={(reg, nou) => go(reg, { nou: { ...nou, ts: Date.now() } })}
            />
          ) : (
            <Formular
              registru={registru}
              doc={null}
              prefill={fereastra.prefill || null}
              serieImplicita={fereastra.serieImplicita || ''}
              role={role}
              comune={comune}
              onSalvat={dupaSalvare}
              onRenunta={() => setFereastra(null)}
            />
          )}
        </Fereastra>
      )}
    </>
  )
}
