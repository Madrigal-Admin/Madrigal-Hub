import { useRef, useState } from 'react'
import { ExternalLink, Upload } from 'lucide-react'
import { deschideFisier, incarcaVersiune } from '../lib/fisiere'
import { formatDataOra, formatMarime, mesajEroare } from '../lib/util'
import { btnGhost, btnPrimary } from '../lib/ui'
import { Card, Eroare, Info } from './comun'

// Fișierele unui document, cu versiuni. Versiunea înlocuită rămâne în istoric.
export default function Fisiere({ doc, fisiere, poateIncarca, comune, reload }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [eroare, setEroare] = useState('')
  const [mesaj, setMesaj] = useState('')

  const numeAng = (id) => comune.angajati.find((a) => a.id === id)?.nume_complet || ''
  const curenta = fisiere.find((x) => x.curenta)
  const inchis = doc.status === 'anulat'

  async function alege(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setEroare('')
    setMesaj('')
    setBusy(true)
    try {
      await incarcaVersiune(doc.id, file)
      setMesaj(curenta ? 'Versiunea nouă a fost încărcată. Cea veche a rămas în istoric.' : 'Fișierul a fost încărcat.')
      await reload()
    } catch (err) {
      setEroare(mesajEroare(err))
    }
    setBusy(false)
  }

  async function deschide(path) {
    setEroare('')
    try {
      await deschideFisier(path)
    } catch (err) {
      setEroare(mesajEroare(err))
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Fișiere</h3>
        {poateIncarca && !inchis && (
          <>
            <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={alege} />
            <button className={curenta ? btnGhost : btnPrimary} disabled={busy} onClick={() => input.current?.click()}>
              <Upload size={14} /> {busy ? 'Se încarcă…' : curenta ? 'Încarcă versiune nouă' : 'Încarcă scanul / fișierul'}
            </button>
          </>
        )}
      </div>

      {poateIncarca && !inchis && (
        <p className="text-xs text-slate-500">
          Acceptat: PDF (max. 25 MB), JPEG sau PNG (max. 10 MB; pozele se micșorează automat).
          {doc.mod_semnare === 'electronica'
            ? ' Document cu semnătură electronică: fișierul se păstrează exact cum l-ai încărcat, fără nicio modificare.'
            : ' Scanează la 200 dpi, alb-negru sau tonuri de gri, ca să ocupe cât mai puțin spațiu.'}
        </p>
      )}
      {mesaj && <Info>{mesaj}</Info>}
      <Eroare>{eroare}</Eroare>

      {fisiere.length === 0 ? (
        <p className="text-sm text-slate-500">Nu a fost încărcat niciun fișier.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {fisiere.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <p className={`truncate ${x.curenta ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                  Versiunea {x.versiune} · {x.nume_original}
                  {x.curenta && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Curentă</span>}
                </p>
                <p className="text-xs text-slate-400">
                  {formatMarime(x.marime)} · încărcat {formatDataOra(x.incarcat_la)}{x.incarcat_de ? ` de ${numeAng(x.incarcat_de)}` : ''}
                  {x.inlocuit_la ? ` · înlocuit la ${formatDataOra(x.inlocuit_la)}` : ''}
                </p>
              </div>
              <button className={btnGhost} onClick={() => deschide(x.path)}>
                <ExternalLink size={14} /> Deschide
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
