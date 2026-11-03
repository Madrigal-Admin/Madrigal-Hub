import { useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { inputCls, mesajEroare } from '../../lib/taskuri/ui'

// Gestionarea tagurilor (admin taskuri): vezi câte taskuri are fiecare, redenumești sau ștergi un tag.
// Un tag există cât timp e pe cel puțin un task sau e o secțiune din Checklist.
export default function TaguriAdmin({ ctx }) {
  const [redenumit, setRedenumit] = useState(null) // { cheie, text }
  const [eroare, setEroare] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const taguri = useMemo(() => {
    const m = new Map()
    const intrare = (t) => {
      const k = t.trim().toLowerCase()
      if (!m.has(k)) m.set(k, { cheie: k, nume: t.trim(), variante: new Set(), nr: 0, checklist: false })
      return m.get(k)
    }
    ctx.sectiuni.forEach((s) => { if (s.nume?.trim()) intrare(s.nume).checklist = true })
    ctx.taskuri.forEach((t) => {
      if (!t.tag?.trim()) return
      const x = intrare(t.tag)
      x.variante.add(t.tag)
      x.nr++
    })
    return [...m.values()].sort((a, b) => a.nume.localeCompare(b.nume, 'ro'))
  }, [ctx.taskuri, ctx.sectiuni])

  async function aplica(tag, valoareNoua, mesajOk) {
    setBusy(true)
    setEroare('')
    setInfo('')
    const { error } = await supabase.from('tsk_taskuri').update({ tag: valoareNoua }).in('tag', [...tag.variante])
    if (error) setEroare(mesajEroare(error, 'Nu am putut modifica tagul.'))
    else {
      setInfo(mesajOk)
      await ctx.reload()
    }
    setBusy(false)
    setRedenumit(null)
  }

  function sterge(tag) {
    if (!window.confirm(`Ștergi tagul „${tag.nume}"? Se scoate de pe ${tag.nr} ${tag.nr === 1 ? 'task' : 'taskuri'}. Taskurile rămân, doar fără tag.`)) return
    aplica(tag, null, `Tagul „${tag.nume}" a fost șters.`)
  }
  function redenumeste(tag) {
    const nou = redenumit.text.trim()
    if (!nou) return setEroare('Scrie noul nume.')
    if (nou.length > 60) return setEroare('Numele poate avea cel mult 60 de caractere.')
    const existent = taguri.find((t) => t.cheie === nou.toLowerCase() && t.cheie !== tag.cheie)
    if (existent && !window.confirm(`Există deja tagul „${existent.nume}". Taskurile lui „${tag.nume}" se mută pe el. Continui?`)) return
    aplica(tag, existent ? existent.nume : nou, `Tagul „${tag.nume}" a fost redenumit în „${existent ? existent.nume : nou}".`)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Un tag apare aici cât timp e pe cel puțin un task. Tagurile marcate „din checklist" sunt secțiunile checklistului și se gestionează în tabul Checklist.
      </p>
      {eroare && <p className="text-sm text-rose-600">{eroare}</p>}
      {info && <p className="text-sm text-emerald-700">{info}</p>}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {taguri.length === 0 && <p className="p-5 text-center text-sm text-slate-400">Niciun tag încă.</p>}
        {taguri.map((t) => (
          <div key={t.cheie} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
            {redenumit?.cheie === t.cheie ? (
              <>
                <input autoFocus className={`${inputCls} max-w-xs`} maxLength={60} value={redenumit.text} onChange={(e) => setRedenumit({ cheie: t.cheie, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') redenumeste(t); if (e.key === 'Escape') setRedenumit(null) }} aria-label="Nume nou" />
                <button type="button" disabled={busy} onClick={() => redenumeste(t)} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50">Salvează</button>
                <button type="button" onClick={() => setRedenumit(null)} className="text-xs text-slate-500 underline">Renunță</button>
              </>
            ) : (
              <>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-sm font-semibold text-slate-700">{t.nume}</span>
                {t.checklist && <span className="text-xs text-slate-400">din checklist</span>}
                <span className="text-xs text-slate-500">{t.nr} {t.nr === 1 ? 'task' : 'taskuri'}</span>
                {!t.checklist && (
                  <span className="ml-auto flex gap-2">
                    <button type="button" disabled={busy} onClick={() => { setEroare(''); setInfo(''); setRedenumit({ cheie: t.cheie, text: t.nume }) }} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Redenumește</button>
                    <button type="button" disabled={busy} onClick={() => sterge(t)} className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">Șterge tagul</button>
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
