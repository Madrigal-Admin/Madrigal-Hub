import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { incarcaTaskuri } from '../../lib/taskuri/date'
import { construiesteCtx } from '../../lib/taskuri/drepturi'
import TaskDetaliu from './TaskDetaliu'
import TaskForm from './TaskForm'
import ChecklistAlege from './ChecklistAlege'

const Ctx = createContext(null)
export const useTaskuri = () => useContext(Ctx)

// Încarcă o singură dată datele de taskuri/evenimente pentru tot Hub-ul și ține ferestrele pop-up
// (task nou, detaliu task, checklist) deasupra oricărei pagini — pagina din fundal nu se schimbă.
export function TaskuriProvider({ angajat, accesTooluri, children }) {
  const rol = accesTooluri.find((a) => a.tool === 'taskuri')?.rol || null
  const [date, setDate] = useState(null)
  const [eroare, setEroare] = useState('')
  const [fereastra, setFereastra] = useState(null) // { tip: 'detaliu'|'form'|'checklist', ... }

  const reload = useCallback(async () => {
    try {
      setDate(await incarcaTaskuri())
      setEroare('')
    } catch {
      setEroare('Nu am putut încărca datele. Reîncarcă pagina; dacă persistă, anunță administratorul.')
    }
  }, [])
  useEffect(() => { reload() }, [reload])

  const ctx = useMemo(() => (date ? { ...construiesteCtx(date, angajat, rol), reload } : null), [date, angajat, rol, reload])

  const acte = useMemo(
    () => ({
      deschideTask: (id) => setFereastra({ tip: 'detaliu', id }),
      taskNou: (eveniment) => setFereastra({ tip: 'form', eveniment }),
      editeaza: (task) => setFereastra({ tip: 'form', task }),
      checklist: (mod, eveniment) => setFereastra({ tip: 'checklist', mod, eveniment }),
      inchide: () => setFereastra(null),
    }),
    []
  )

  const valoare = useMemo(() => ({ ctx, acte, eroare, areTaskuri: !!rol }), [ctx, acte, eroare, rol])

  return (
    <Ctx.Provider value={valoare}>
      {children}
      {ctx && fereastra?.tip === 'detaliu' && (
        <TaskDetaliu taskId={fereastra.id} ctx={ctx} onClose={acte.inchide} onEdit={(task) => setFereastra({ tip: 'form', task, revenire: task.id })} />
      )}
      {ctx && fereastra?.tip === 'form' && (
        <TaskForm
          ctx={ctx}
          task={fereastra.task}
          evenimentImplicit={fereastra.eveniment}
          onClose={() => setFereastra(fereastra.revenire ? { tip: 'detaliu', id: fereastra.revenire } : null)}
          onSaved={async () => {
            await reload()
            setFereastra(fereastra.revenire ? { tip: 'detaliu', id: fereastra.revenire } : null)
          }}
        />
      )}
      {ctx && fereastra?.tip === 'checklist' && (
        <ChecklistAlege
          mod={fereastra.mod}
          eveniment={fereastra.eveniment}
          ctx={ctx}
          onClose={acte.inchide}
          onDone={async () => { await reload(); setFereastra(null) }}
        />
      )}
    </Ctx.Provider>
  )
}
