import { ArrowLeft, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import Navbar from './components/Navbar'
import TaskLista from './components/TaskLista'
import TaskForm from './components/TaskForm'
import TaskDetaliu from './components/TaskDetaliu'
import Evenimente from './components/Evenimente'
import ChecklistAlege from './components/ChecklistAlege'
import GrupuriAdmin from './components/GrupuriAdmin'
import ChecklistAdmin from './components/ChecklistAdmin'
import { incarcaTot } from './lib/date'
import { construiesteCtx } from './lib/drepturi'

const ROLE_LABELS = { admin: 'Admin taskuri', angajat: 'Angajat' }

export default function App() {
  const [session, setSession] = useState(undefined)
  const [angajat, setAngajat] = useState(null)
  const [rol, setRol] = useState(null) // null = se verifică, 'none' = fără acces
  const [date, setDate] = useState(null)
  const [eroareIncarcare, setEroareIncarcare] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Se recalculează doar când se schimbă utilizatorul, nu la fiecare reînnoire de token.
  const userId = session === undefined ? undefined : session?.user?.id ?? null

  useEffect(() => {
    if (userId === undefined) return
    if (!userId) {
      window.location.href = '/'
      return
    }
    ;(async () => {
      const { data: a } = await supabase.from('angajati').select('id, nume_complet, email').eq('user_id', userId).maybeSingle()
      setAngajat(a || null)
      const { data: r } = await supabase.rpc('tsk_acces')
      setRol(a && r ? r : 'none')
    })()
  }, [userId])

  const reload = useCallback(async () => {
    try {
      setDate(await incarcaTot())
      setEroareIncarcare('')
    } catch {
      setEroareIncarcare('Nu am putut încărca datele. Reîncarcă pagina; dacă persistă, anunță administratorul.')
    }
  }, [])

  useEffect(() => {
    if (rol && rol !== 'none') reload()
  }, [rol, reload])

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const nume = angajat?.nume_complet || session?.user?.email || null

  if (!session || rol === null) return <p className="mx-auto max-w-5xl px-5 py-10 text-sm text-slate-500">Se încarcă…</p>

  if (rol === 'none') {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Navbar displayName={nume} onLogout={logout} />
        <main className="flex flex-1 flex-col items-center justify-center px-4">
          <a href="/" className="hub-back mb-4"><ArrowLeft size={15} /> Înapoi la Hub</a>
          <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
            Contul tău nu are acces la tool-ul Taskuri. Contactează un administrator din Hub, în secțiunea „Acces Tool-uri".
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar displayName={nume} roleLabel={ROLE_LABELS[rol]} onLogout={logout} />
      <main className="min-w-0 flex-1 p-6 md:p-8">
        <a href="/" className="hub-back mb-4"><ArrowLeft size={15} /> Înapoi la Hub</a>
        {eroareIncarcare && <p className="mb-4 text-sm text-rose-600">{eroareIncarcare}</p>}
        {!date ? <p className="text-sm text-slate-500">Se încarcă…</p> : <Continut date={date} angajat={angajat} rol={rol} reload={reload} />}
      </main>
    </div>
  )
}

function Continut({ date, angajat, rol, reload }) {
  const ctx = useMemo(() => ({ ...construiesteCtx(date, angajat, rol), reload }), [date, angajat, rol, reload])

  const taburi = [
    { key: 'mele', label: 'Taskurile mele' },
    ctx.sunPm || ctx.admin ? { key: 'evenimente', label: ctx.admin ? 'Evenimente' : 'Evenimentele mele' } : null,
    ctx.sunCoordonator || ctx.admin ? { key: 'departament', label: 'Tichete departament' } : null,
    ctx.admin ? { key: 'toate', label: 'Toate taskurile' } : null,
    ctx.admin ? { key: 'grupuri', label: 'Departamente' } : null,
    ctx.admin ? { key: 'checklist', label: 'Checklist' } : null,
  ].filter(Boolean)

  const [view, setView] = useState(() => (ctx.sunPm && !ctx.admin ? 'evenimente' : 'mele'))
  const [deschis, setDeschis] = useState(null) // id task deschis
  const [formular, setFormular] = useState(null) // { task?, eveniment? }
  const [checklist, setChecklist] = useState(null) // { mod, eveniment }

  const poateCrea = ctx.poateEveniment || ctx.poateOperational
  const dupaSalvare = async () => { setFormular(null); await reload() }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {taburi.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${view === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {poateCrea && (
          <button type="button" onClick={() => setFormular({})} className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
            <Plus size={15} /> Task nou
          </button>
        )}
      </div>

      {view === 'mele' && <TaskLista taskuri={ctx.taskuriMele} ctx={ctx} onOpen={(t) => setDeschis(t.id)} />}
      {view === 'evenimente' && (
        <Evenimente ctx={ctx} onOpen={(t) => setDeschis(t.id)} onTaskNou={(evId) => setFormular({ eveniment: evId })} onChecklist={(mod, eveniment) => setChecklist({ mod, eveniment })} />
      )}
      {view === 'departament' && <TaskLista taskuri={ctx.admin ? ctx.taskuri.filter((t) => t.tip === 'operational') : ctx.taskuriDepartament} ctx={ctx} onOpen={(t) => setDeschis(t.id)} />}
      {view === 'toate' && <TaskLista taskuri={ctx.taskuri} ctx={ctx} onOpen={(t) => setDeschis(t.id)} />}
      {view === 'grupuri' && <GrupuriAdmin ctx={ctx} />}
      {view === 'checklist' && <ChecklistAdmin ctx={ctx} />}

      {deschis && !formular && (
        <TaskDetaliu taskId={deschis} ctx={ctx} onClose={() => setDeschis(null)} onEdit={(task) => setFormular({ task })} />
      )}
      {formular && <TaskForm ctx={ctx} task={formular.task} evenimentImplicit={formular.eveniment} onClose={() => setFormular(null)} onSaved={dupaSalvare} />}
      {checklist && (
        <ChecklistAlege
          mod={checklist.mod}
          eveniment={checklist.eveniment}
          ctx={ctx}
          onClose={() => setChecklist(null)}
          onDone={async () => { setChecklist(null); await reload() }}
        />
      )}
    </div>
  )
}
