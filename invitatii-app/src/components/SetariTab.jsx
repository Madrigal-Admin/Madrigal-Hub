import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { fetchAll } from '../lib/fetchAll'
import { Btn, Card, PageHeader } from './ui'

const INPUT = 'rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent'

export default function SetariTab() {
  return (
    <div>
      <PageHeader
        titlu="Setări"
        descriere="Limitele de invitații pentru angajați și categoriile persoanelor din lista fixă."
      />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <SectiuneLimite />
        <SectiuneCategorii />
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Limita de invitații per angajat: standard + excepții individuale
// -------------------------------------------------------------------------
function SectiuneLimite() {
  const [standard, setStandard] = useState('')
  const [standardSalvat, setStandardSalvat] = useState(null)
  const [exceptii, setExceptii] = useState([])
  const [angajati, setAngajati] = useState([])
  const [angajatNou, setAngajatNou] = useState('')
  const [limitaNoua, setLimitaNoua] = useState('')
  const [editId, setEditId] = useState(null)
  const [editValoare, setEditValoare] = useState('')
  const [mesaj, setMesaj] = useState('')

  const load = useCallback(async () => {
    const [s, ex, ang] = await Promise.all([
      supabase.from('invitatii_setari').select('limita_standard').maybeSingle(),
      supabase.from('invitatii_limite_exceptii').select('angajat_id, limita'),
      supabase.from('angajati').select('id, nume_complet, activ').order('nume_complet'),
    ])
    setStandardSalvat(s.data?.limita_standard ?? 2)
    setStandard(String(s.data?.limita_standard ?? 2))
    setExceptii(ex.data || [])
    setAngajati(ang.data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const numeAngajat = (id) => angajati.find((a) => a.id === id)?.nume_complet || 'Angajat necunoscut'
  const nrValid = (v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0

  async function salveazaStandard() {
    if (!nrValid(standard)) return setMesaj('Introdu un număr întreg, 0 sau mai mare.')
    const { error } = await supabase.from('invitatii_setari').update({ limita_standard: Number(standard) }).eq('id', true)
    if (error) return setMesaj(error.message)
    setMesaj('Limita standard a fost salvată.')
    load()
  }

  async function adaugaExceptie() {
    if (!angajatNou) return setMesaj('Alege un angajat.')
    if (!nrValid(limitaNoua)) return setMesaj('Introdu limita ca număr întreg, 0 sau mai mare.')
    const { error } = await supabase
      .from('invitatii_limite_exceptii')
      .upsert({ angajat_id: angajatNou, limita: Number(limitaNoua) })
    if (error) return setMesaj(error.message)
    setAngajatNou('')
    setLimitaNoua('')
    setMesaj('')
    load()
  }

  async function salveazaEditare(angajatId) {
    if (!nrValid(editValoare)) return setMesaj('Introdu limita ca număr întreg, 0 sau mai mare.')
    const { error } = await supabase
      .from('invitatii_limite_exceptii')
      .update({ limita: Number(editValoare) })
      .eq('angajat_id', angajatId)
    if (error) return setMesaj(error.message)
    setEditId(null)
    setMesaj('')
    load()
  }

  async function stergeExceptie(angajatId) {
    if (!confirm(`Ștergi excepția pentru ${numeAngajat(angajatId)}? Va reveni la limita standard.`)) return
    await supabase.from('invitatii_limite_exceptii').delete().eq('angajat_id', angajatId)
    load()
  }

  const folositi = new Set(exceptii.map((e) => e.angajat_id))
  const disponibili = angajati.filter((a) => a.activ !== false && !folositi.has(a.id))
  const sortate = [...exceptii].sort((a, b) => numeAngajat(a.angajat_id).localeCompare(numeAngajat(b.angajat_id), 'ro'))

  return (
    <Card>
      <p className="text-[15px] font-bold text-slate-900">Limita de invitații per angajat</p>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">
        Se aplică fiecărui angajat, la fiecare eveniment. Excepțiile le stabilești tu, individual (de exemplu pentru
        conducere). Nu depinde de funcția din HR.
      </p>
      <label htmlFor="lim-std" className="mb-1.5 block text-xs font-bold text-slate-600">Limită standard</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="lim-std"
          type="number"
          min="0"
          value={standard}
          onChange={(e) => setStandard(e.target.value)}
          className={`${INPUT} w-24`}
        />
        <Btn variant="smallPrimary" onClick={salveazaStandard} disabled={String(standardSalvat) === standard}>
          Salvează
        </Btn>
      </div>

      <p className="mb-1 mt-5 text-[15px] font-bold text-slate-900">Excepții</p>
      {sortate.length === 0 && <p className="py-2 text-sm text-slate-400">Nicio excepție. Toți angajații au limita standard.</p>}
      {sortate.map((e) => (
        <div key={e.angajat_id} className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 py-2.5 text-sm last:border-b-0">
          <span>{numeAngajat(e.angajat_id)}</span>
          <div className="flex flex-wrap items-center gap-2">
            {editId === e.angajat_id ? (
              <>
                <input
                  type="number"
                  min="0"
                  value={editValoare}
                  onChange={(ev) => setEditValoare(ev.target.value)}
                  aria-label="Limită nouă"
                  className={`${INPUT} w-24`}
                />
                <Btn variant="smallPrimary" onClick={() => salveazaEditare(e.angajat_id)}>Salvează</Btn>
                <Btn variant="small" onClick={() => setEditId(null)}>Anulează</Btn>
              </>
            ) : (
              <>
                <span className="font-extrabold text-accent">{e.limita} invitații</span>
                <Btn
                  variant="small"
                  onClick={() => {
                    setEditId(e.angajat_id)
                    setEditValoare(String(e.limita))
                  }}
                >
                  Modifică
                </Btn>
                <Btn variant="small" onClick={() => stergeExceptie(e.angajat_id)}>Șterge</Btn>
              </>
            )}
          </div>
        </div>
      ))}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={angajatNou}
          onChange={(e) => setAngajatNou(e.target.value)}
          aria-label="Alege angajat"
          className={`${INPUT} min-w-[180px] flex-1`}
        >
          <option value="">Alege un angajat…</option>
          {disponibili.map((a) => (
            <option key={a.id} value={a.id}>{a.nume_complet}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          value={limitaNoua}
          onChange={(e) => setLimitaNoua(e.target.value)}
          placeholder="Limită"
          aria-label="Limită"
          className={`${INPUT} w-24`}
        />
        <Btn variant="smallPrimary" onClick={adaugaExceptie}>Adaugă excepție</Btn>
      </div>
      {mesaj && <p className="mt-3 text-sm text-slate-600">{mesaj}</p>}
    </Card>
  )
}

// -------------------------------------------------------------------------
// Categoriile de invitați
// -------------------------------------------------------------------------
function SectiuneCategorii() {
  const [categorii, setCategorii] = useState([])
  const [numar, setNumar] = useState({})
  const [noua, setNoua] = useState('')
  const [editId, setEditId] = useState(null)
  const [editNume, setEditNume] = useState('')
  const [mesaj, setMesaj] = useState('')

  const load = useCallback(async () => {
    const [cat, pers] = await Promise.all([
      supabase.from('invitatii_categorii').select('id, nume, arhivata').order('nume'),
      fetchAll((a, b) => supabase.from('persoane').select('id, categorie').range(a, b)),
    ])
    const n = {}
    for (const p of pers.data || []) if (p.categorie) n[p.categorie] = (n[p.categorie] || 0) + 1
    setCategorii(cat.data || [])
    setNumar(n)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function eroareCategorie(error) {
    if (error.code === '23505') return 'O categorie cu acest nume există deja.'
    return error.message
  }

  async function adauga() {
    const nume = noua.trim()
    if (!nume) return
    const { error } = await supabase.from('invitatii_categorii').insert({ nume })
    if (error) return setMesaj(eroareCategorie(error))
    setNoua('')
    setMesaj('')
    load()
  }

  async function redenumeste(id) {
    const nume = editNume.trim()
    if (!nume) return
    const { error } = await supabase.from('invitatii_categorii').update({ nume }).eq('id', id)
    if (error) return setMesaj(eroareCategorie(error))
    setEditId(null)
    setMesaj('')
    load()
  }

  async function sterge(c) {
    if (numar[c.nume] > 0) {
      return setMesaj(`„${c.nume}” are ${numar[c.nume]} persoane. Mută-le mai întâi în altă categorie, din tabul Persoane.`)
    }
    if (!confirm(`Ștergi categoria „${c.nume}”?`)) return
    const { error } = await supabase.from('invitatii_categorii').delete().eq('id', c.id)
    if (error) return setMesaj(eroareCategorie(error))
    setMesaj('')
    load()
  }

  const active = categorii.filter((c) => !c.arhivata)
  const arhivateCuPersoane = categorii.filter((c) => c.arhivata && numar[c.nume] > 0)

  return (
    <Card>
      <p className="text-[15px] font-bold text-slate-900">Categorii de invitați</p>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-slate-500">
        Lista fixă de persoane se împarte pe aceste categorii. Poți adăuga, redenumi sau șterge. O categorie cu
        persoane nu se șterge până nu le muți în alta.
      </p>
      {active.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 py-2.5 text-sm">
          {editId === c.id ? (
            <>
              <input
                value={editNume}
                onChange={(e) => setEditNume(e.target.value)}
                aria-label="Nume nou"
                className={`${INPUT} min-w-[160px] flex-1`}
              />
              <div className="flex gap-2">
                <Btn variant="smallPrimary" onClick={() => redenumeste(c.id)}>Salvează</Btn>
                <Btn variant="small" onClick={() => setEditId(null)}>Anulează</Btn>
              </div>
            </>
          ) : (
            <>
              <div>
                {c.nume}
                <p className="text-xs text-slate-500">{numar[c.nume] || 0} persoane</p>
              </div>
              <div className="flex gap-2">
                <Btn
                  variant="small"
                  onClick={() => {
                    setEditId(c.id)
                    setEditNume(c.nume)
                  }}
                >
                  Redenumește
                </Btn>
                <Btn variant="small" onClick={() => sterge(c)}>Șterge</Btn>
              </div>
            </>
          )}
        </div>
      ))}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={noua}
          onChange={(e) => setNoua(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adauga()}
          placeholder="Categorie nouă, ex: Parteneri media"
          aria-label="Categorie nouă"
          className={`${INPUT} min-w-[200px] flex-1`}
        />
        <Btn variant="smallPrimary" onClick={adauga}>Adaugă</Btn>
      </div>
      {mesaj && <p className="mt-3 text-sm text-amber-800">{mesaj}</p>}
      {arhivateCuPersoane.length > 0 && (
        <div className="mt-3 rounded-[10px] bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          {arhivateCuPersoane.map((c) => (
            <p key={c.id}>
              <strong>{c.nume}</strong> nu se mai oferă în listă, pentru că invitații angajaților intră acum prin
              solicitări. Persoanele existente din această categorie (în prezent {numar[c.nume]}) le muți tu într-o
              altă categorie sau le ștergi, din tabul Persoane, după un backup.
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}
