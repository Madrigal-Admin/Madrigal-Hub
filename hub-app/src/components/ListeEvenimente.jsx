import { useState } from 'react'
import { X as XIcon, Plus, Trash2, Lock } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { PALETA, slug } from '../lib/evenimente'

const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-accent focus:outline-none'

// Gestionarea listelor editabile: tipurile de eveniment și statusurile.
export default function ListeEvenimente({ tipuri, statusuri, evenimente, onClose, onChanged }) {
  const [tab, setTab] = useState('tipuri')
  const [error, setError] = useState('')
  const [nou, setNou] = useState('')

  const eTipuri = tab === 'tipuri'
  const tabel = eTipuri ? 'tipuri_eveniment' : 'statusuri_eveniment'
  const lista = eTipuri ? tipuri : statusuri

  const folosit = (cod) =>
    eTipuri ? evenimente.filter((e) => e.tipuri.includes(cod)).length : evenimente.filter((e) => e.status === cod).length

  async function salveaza(cod, patch) {
    setError('')
    const { error: err } = await supabase.from(tabel).update(patch).eq('cod', cod)
    if (err) setError(err.message?.includes('nu se pot schimba') || err.message?.includes('de bază') ? err.message : 'Nu am putut salva modificarea.')
    onChanged()
  }

  async function adauga(e) {
    e.preventDefault()
    setError('')
    const nume = nou.trim()
    if (!nume) return setError('Scrie un nume.')
    const cod = slug(nume)
    if (!cod || lista.some((x) => x.cod === cod || x.nume.toLowerCase() === nume.toLowerCase())) {
      return setError('Există deja un element cu acest nume.')
    }
    const ordine = Math.max(0, ...lista.map((x) => x.ordine || 0)) + 1
    const rand = eTipuri
      ? { cod, nume, culoare: PALETA[lista.length % PALETA.length], ordine }
      : { cod, nume, culoare: PALETA[lista.length % PALETA.length], comportament: 'organizare', ordine }
    const { error: err } = await supabase.from(tabel).insert(rand)
    if (err) return setError('Nu am putut adăuga elementul.')
    setNou('')
    onChanged()
  }

  async function sterge(x) {
    setError('')
    const nr = folosit(x.cod)
    if (nr > 0) {
      return setError(
        eTipuri
          ? `„${x.nume}" e folosit de ${nr} evenimente. Dezactivează-l în loc să-l ștergi: dispare din alegeri, dar istoricul rămâne.`
          : `Statusul „${x.nume}" e folosit de ${nr} evenimente. Mută-le întâi pe alt status.`
      )
    }
    if (!window.confirm(`Ștergi „${x.nume}"?`)) return
    const { error: err } = await supabase.from(tabel).delete().eq('cod', x.cod)
    if (err) setError(err.message?.includes('de bază') ? err.message : 'Nu am putut șterge elementul (poate e folosit în altă parte).')
    onChanged()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Liste editabile</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <XIcon size={16} />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {[['tipuri', 'Tipuri de eveniment'], ['statusuri', 'Statusuri']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => { setTab(k); setError(''); setNou('') }}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${tab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {!eTipuri && (
          <p className="mb-3 text-xs text-slate-500">
            Cele patru statusuri de bază (Deschis, În organizare, Finalizat, Anulat) se pot redenumi și recolora, dar nu se pot șterge.
            Un status adăugat de tine se comportă ca „În organizare".
          </p>
        )}

        <div className="space-y-2">
          {lista.map((x) => (
            <div key={x.cod} className="flex items-center gap-2">
              <input
                type="color"
                value={x.culoare}
                onChange={(e) => salveaza(x.cod, { culoare: e.target.value })}
                className="h-8 w-8 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                title="Culoare"
              />
              <input
                className={`${inputCls} ${eTipuri && !x.activ ? 'text-slate-400' : ''}`}
                defaultValue={x.nume}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== x.nume) salveaza(x.cod, { nume: v })
                  else e.target.value = x.nume
                }}
              />
              {eTipuri ? (
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={x.activ} onChange={(e) => salveaza(x.cod, { activ: e.target.checked })} />
                  Activ
                </label>
              ) : null}
              <span className="w-8 shrink-0 text-center text-xs text-slate-400" title="Evenimente care îl folosesc">{folosit(x.cod)}</span>
              {!eTipuri && x.de_sistem ? (
                <span className="shrink-0 p-1.5 text-slate-300" title="Status de bază"><Lock size={14} /></span>
              ) : (
                <button onClick={() => sterge(x)} className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Șterge">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={adauga} className="mt-4 flex gap-2">
          <input className={inputCls} placeholder={eTipuri ? 'Tip nou (nume)' : 'Status nou (nume)'} value={nou} onChange={(e) => setNou(e.target.value)} />
          <button type="submit" className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover">
            <Plus size={14} /> Adaugă
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <p className="mt-3 text-xs text-slate-400">Numărul din dreapta arată câte evenimente folosesc elementul.</p>
      </div>
    </div>
  )
}
