import { useEffect, useState } from 'react'
import { Pencil, Save, X as XIcon, Plus, Trash2, ArrowRight, Search } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { getHrProfil, getContracte, getContractPrincipal, etichetaContract } from '../../lib/leaveCalculations'
import { calculateVechime } from '../../lib/vechimeCalculations'

const CURRENT_YEAR = new Date().getFullYear()

const emptyVechime = { angajator: '', data_inceput: '', data_sfarsit: '', durata_luni: '' }

// Câmpurile pe care adminul le poate selecta la un "Act adițional" — practic
// toată fișa HR editabilă, exact cum a fost cerut ("din fișa completă").
const CAMPURI_MODIFICABILE = [
  { key: 'tip_contract', label: 'Tip contract', inActe: false, type: 'select', options: [
    { value: 'determinat', label: 'CIM Determinat' },
    { value: 'nedeterminat', label: 'CIM Nedeterminat' },
    { value: 'colaborator', label: 'Colaborator' },
  ] },
  { key: 'obiect_contract', label: 'Obiectul contractului (colaboratori)', soloColaborator: true, type: 'text' },
  { key: 'calitate_contract', label: 'Calitate (colaboratori)', soloColaborator: true, type: 'select', options: [
    { value: 'prestator', label: 'Prestator' },
    { value: 'cedent', label: 'Cedent' },
  ] },
  { key: 'data_final_contract', label: 'Prelungire contract (data final nouă)', fixedTermOnly: true, type: 'date' },
  { key: 'grad', label: 'Grad', type: 'text' },
  { key: 'atributie_id', label: 'Atribuție', type: 'attributie' },
  { key: 'norma_ore', label: 'Normă de lucru', type: 'select', options: [2, 4, 6, 8].map((v) => ({ value: String(v), label: `${v}h` })) },
  { key: 'interval_ora_inceput', label: 'Ora început', type: 'time' },
  { key: 'interval_ora_sfarsit', label: 'Ora sfârșit', type: 'time' },
  { key: 'are_fisa_postului', label: 'Fișa postului', type: 'boolean' },
  { key: 'functie_de_baza', label: 'Funcția de bază', type: 'boolean' },
  { key: 'adresa', label: 'Adresă', type: 'text' },
  { key: 'telefon', label: 'Telefon', type: 'text' },
  { key: 'cnp', label: 'CNP', type: 'text' },
  { key: 'iban', label: 'IBAN', type: 'text' },
  { key: 'act_serie', label: 'Act identitate — Serie', type: 'text' },
  { key: 'act_numar', label: 'Act identitate — Număr', type: 'text' },
  { key: 'act_eliberat_de', label: 'Act identitate — Eliberat de', type: 'text' },
  { key: 'act_data_eliberare', label: 'Act identitate — Data eliberării', type: 'date' },
  { key: 'act_data_expirare', label: 'Act identitate — Data expirării', type: 'date' },
  { key: 'observatii', label: 'Observații', type: 'text' },
]

// Câmpurile unui act adițional care țin de CONTRACT (se aplică pe contractul
// ales). Restul (CNP, IBAN, adresă etc.) țin de PERSOANĂ și se aplică fără
// alegerea unui contract.
const CHEI_CONTRACT = [
  'tip_contract',
  'obiect_contract',
  'calitate_contract',
  'data_final_contract',
  'grad',
  'atributie_id',
  'norma_ore',
  'interval_ora_inceput',
  'interval_ora_sfarsit',
  'are_fisa_postului',
  'functie_de_baza',
]
const esteCampContract = (key) => CHEI_CONTRACT.includes(key)

// Câmpuri mutate în taburile „Medicina Muncii" / „Evaluări"; rămân doar pentru actele adiționale vechi.
const ETICHETE_VECHI = {
  medicina_muncii_data: 'Medicina muncii — dată',
  evaluare_data: 'Evaluare — dată',
  prelungire_de_la: 'Prelungire de la',
}

const ziUrmatoare = (iso) => {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

function labelPentruCamp(key) {
  return CAMPURI_MODIFICABILE.find((c) => c.key === key)?.label || ETICHETE_VECHI[key] || key
}

function formatValoare(key, value, attributions) {
  if (value === null || value === undefined || value === '') return '—'
  const camp = CAMPURI_MODIFICABILE.find((c) => c.key === key)
  if (camp?.type === 'boolean') return value === true || value === 'da' ? 'Da' : 'Nu'
  if (camp?.type === 'select') return camp.options.find((o) => o.value === String(value))?.label || value
  if (camp?.type === 'attributie') return attributions?.find((a) => a.id === value)?.name || value
  return String(value)
}

const norm = (t) => (t || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function EmployeesTab() {
  const [angajati, setAngajati] = useState([])
  const [cauta, setCauta] = useState('')
  const [attributions, setAttributions] = useState([])
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [rollingOver, setRollingOver] = useState(false)
  const [rolloverError, setRolloverError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data }, { data: attrData }, { data: depData }, { data: posData }] = await Promise.all([
      supabase
        .from('angajati')
        .select(
          '*, department:departments(name), position:positions(name), hr_profil_angajat(*), hr_contracte(*, attribution:attributions(name)), hr_vechime_anterioara(*)'
        )
        .eq('activ', true)
        .order('nume_complet'),
      supabase.from('attributions').select('*').order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('positions').select('id, name').order('name'),
    ])
    setAngajati(data || [])
    setAttributions(attrData || [])
    setDepartments(depData || [])
    setPositions(posData || [])
    setLoading(false)
  }

  async function handleRollover() {
    if (
      !confirm(
        `Avansezi soldurile TUTUROR contractelor la anul ${CURRENT_YEAR}? Recuperările nu sunt afectate — doar cele 3 categorii de solduri pe ani.`
      )
    )
      return
    setRollingOver(true)
    setRolloverError('')
    const { error } = await supabase.rpc('rollover_hr_contracte')
    setRollingOver(false)
    if (error) {
      setRolloverError('Nu am putut avansa anul. Încearcă din nou.')
      return
    }
    load()
  }

  const employeesNeedingRollover = angajati.filter((a) =>
    getContracte(a).some((c) => c.an_referinta != null && c.an_referinta < CURRENT_YEAR)
  )

  const editingAngajat = angajati.find((a) => a.id === editingId) || null

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        Lista angajaților activi vine din Hub — adăugarea, editarea sau ștergerea unui angajat se
        face acolo. Aici poți doar introduce datele specifice de HR pentru fiecare.
      </p>

      {employeesNeedingRollover.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Soldurile pe ani ale {employeesNeedingRollover.length}{' '}
            {employeesNeedingRollover.length === 1 ? 'angajat' : 'angajați'} sunt din anul trecut.
          </p>
          <button
            onClick={handleRollover}
            disabled={rollingOver}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 focus-ring"
          >
            <ArrowRight size={14} /> {rollingOver ? 'Se avansează…' : `Trece la anul ${CURRENT_YEAR}`}
          </button>
          {rolloverError && <p className="w-full text-xs text-rose-600">{rolloverError}</p>}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Se încarcă…</p>
      ) : (
        <>
        <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={cauta}
          onChange={(e) => setCauta(e.target.value)}
          placeholder="Caută după nume…"
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus-ring"
        />
      </div>
        <div className="max-h-[520px] space-y-2 overflow-y-auto">
          {angajati.filter((a) => !cauta.trim() || norm(a.nume_complet).includes(norm(cauta.trim()))).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{a.nume_complet}</p>
                <p className="text-xs text-slate-500">
                  {a.department?.name || '—'} {a.position?.name ? `· ${a.position.name}` : ''}
                  {a.email ? ` · ${a.email}` : ''}
                  {getContracte(a).length > 1 ? ` · ${getContracte(a).length} contracte` : ''}
                </p>
              </div>
              <button
                onClick={() => setEditingId(a.id)}
                className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 focus-ring"
              >
                <Pencil size={13} /> Editează / Introdu date HR
              </button>
            </div>
          ))}
          {angajati.length === 0 && <p className="text-sm text-slate-400">Niciun angajat activ găsit.</p>}
        </div>
        </>
      )}

      {editingAngajat && (
        <HrProfileEditor
          angajat={editingAngajat}
          attributions={attributions}
          departments={departments}
          positions={positions}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null)
            load()
          }}
        />
      )}
    </div>
  )
}

// Date PERSONALE (tabela hr_profil_angajat). Datele de contract sunt în
// EMPTY_CONTRACT (tabela hr_contracte), câte unul pentru fiecare contract.
const EMPTY_PROFIL = {
  sex: '',
  sold_recuperari: 0,
  adresa: '',
  cnp: '',
  act_serie: '',
  act_numar: '',
  act_eliberat_de: '',
  act_data_eliberare: '',
  act_data_expirare: '',
  telefon: '',
  iban: '',
  observatii: '',
}

const EMPTY_CONTRACT = {
  numar_contract: '',
  data_inceput_contract: '',
  tip_contract: '',
  obiect_contract: '',
  calitate_contract: '',
  data_final_contract: '',
  grad: '',
  atributie_id: '',
  departament_id: '',
  functie_id: '',
  norma_ore: '',
  interval_ora_inceput: '',
  interval_ora_sfarsit: '',
  are_fisa_postului: '',
  functie_de_baza: '',
  zile_concediu_baza_an: 21,
  sold_an_minus_2: 0,
  sold_an_minus_1: 0,
  sold_an_curent: 0,
}

const TABS = [
  { key: 'contract', label: 'Contract & Program' },
  { key: 'personal', label: 'Date personale & Acte' },
  { key: 'solduri', label: 'Solduri & Vechime' },
  { key: 'istoric', label: 'Acte adiționale' },
]

function boolToForm(v) {
  if (v === true) return 'da'
  if (v === false) return 'nu'
  return ''
}
function formToBool(v) {
  if (v === 'da') return true
  if (v === 'nu') return false
  return null
}

// rând din hr_contracte -> valori pentru formular (câmpurile goale devin '')
function contractToForm(row) {
  const f = { id: row.id, este_principal: !!row.este_principal, an_referinta: row.an_referinta }
  for (const [k, def] of Object.entries(EMPTY_CONTRACT)) {
    const v = row[k]
    if (['are_fisa_postului', 'functie_de_baza'].includes(k)) f[k] = boolToForm(v)
    else f[k] = v ?? def
  }
  // valori inițiale ale soldurilor, ca să știm dacă s-au schimbat la salvare
  f._soldInitial = [row.sold_an_minus_2, row.sold_an_minus_1, row.sold_an_curent, row.zile_concediu_baza_an].join('|')
  return f
}

function formToContractPayload(f, principal) {
  return {
    numar_contract: String(f.numar_contract || '').trim() || null,
    data_inceput_contract: f.data_inceput_contract || null,
    tip_contract: f.tip_contract || null,
    data_final_contract: ['determinat', 'colaborator'].includes(f.tip_contract) ? f.data_final_contract || null : null,
    calitate_contract: f.tip_contract === 'colaborator' ? f.calitate_contract || null : null,
    obiect_contract: f.tip_contract === 'colaborator' ? String(f.obiect_contract || '').trim() || null : null,
    grad: String(f.grad || '').trim() || null,
    atributie_id: f.atributie_id || null,
    // contractul principal folosește departamentul/funcția din Hub
    departament_id: principal ? null : f.departament_id || null,
    functie_id: principal ? null : f.functie_id || null,
    norma_ore: f.norma_ore ? Number(f.norma_ore) : null,
    interval_ora_inceput: f.interval_ora_inceput || null,
    interval_ora_sfarsit: f.interval_ora_sfarsit || null,
    are_fisa_postului: formToBool(f.are_fisa_postului),
    functie_de_baza: formToBool(f.functie_de_baza),
    zile_concediu_baza_an: Number(f.zile_concediu_baza_an) || 0,
    sold_an_minus_2: Number(f.sold_an_minus_2) || 0,
    sold_an_minus_1: Number(f.sold_an_minus_1) || 0,
    sold_an_curent: Number(f.sold_an_curent) || 0,
  }
}

let contorContractNou = 0

function HrProfileEditor({ angajat, attributions, departments, positions, onClose, onSaved }) {
  const existingProfil = Array.isArray(angajat.hr_profil_angajat)
    ? angajat.hr_profil_angajat[0]
    : angajat.hr_profil_angajat

  const [tab, setTab] = useState('contract')

  const [form, setForm] = useState({
    ...EMPTY_PROFIL,
    ...Object.fromEntries(
      Object.keys(EMPTY_PROFIL).map((k) => [k, existingProfil?.[k] ?? EMPTY_PROFIL[k]])
    ),
  })

  // contractele angajatului, ca formulare editabile
  const [contracte, setContracte] = useState(() => {
    const lista = getContracte(angajat).map(contractToForm)
    if (lista.length === 0) {
      return [{ ...EMPTY_CONTRACT, id: `nou-${++contorContractNou}`, este_principal: true, an_referinta: CURRENT_YEAR }]
    }
    return lista
  })
  const [contractId, setContractId] = useState(() => (getContractPrincipal(angajat)?.id) || null)
  const contractActiv = contracte.find((c) => c.id === contractId) || contracte[0]
  const cf = contractActiv
  const esteNou = String(cf.id).startsWith('nou-')

  const [vechime, setVechime] = useState(angajat.hr_vechime_anterioara || [])
  const [newVechime, setNewVechime] = useState(emptyVechime)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const vechimeCalc = calculateVechime(angajat, [])

  function upd(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // modifică un câmp al contractului selectat
  function updC(key, value) {
    setContracte((lista) => lista.map((c) => (c.id === cf.id ? { ...c, [key]: value } : c)))
  }

  function adaugaContract() {
    const id = `nou-${++contorContractNou}`
    setContracte((lista) => [
      ...lista,
      { ...EMPTY_CONTRACT, id, este_principal: false, an_referinta: CURRENT_YEAR },
    ])
    setContractId(id)
    setTab('contract')
  }

  function etichetaDraft(c, idx) {
    const atributie = attributions.find((a) => a.id === c.atributie_id)?.name
    return etichetaContract(
      { attribution: atributie ? { name: atributie } : null, numar_contract: c.numar_contract, este_principal: c.este_principal },
      idx
    )
  }

  async function setPrincipal() {
    if (esteNou || cf.este_principal) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.rpc('seteaza_contract_principal', { p_contract: cf.id })
    setSaving(false)
    if (err) {
      setError('Nu am putut schimba contractul principal.')
      return
    }
    onSaved()
  }

  async function stergeContract() {
    if (cf.este_principal) return
    if (!confirm('Ștergi acest contract? Zilele deja scăzute din el rămân în istoricul cererilor.')) return
    if (!esteNou) {
      const { error: err } = await supabase.from('hr_contracte').delete().eq('id', cf.id)
      if (err) {
        setError('Nu am putut șterge contractul.')
        return
      }
    }
    const rest = contracte.filter((c) => c.id !== cf.id)
    setContracte(rest)
    setContractId(rest.find((c) => c.este_principal)?.id || rest[0]?.id)
    if (!esteNou) onSaved()
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')

    for (const c of contracte) {
      if (c.tip_contract === 'determinat' && !c.data_final_contract) {
        setError(`Contractul "${etichetaDraft(c, contracte.indexOf(c))}" (determinat) are nevoie de o dată de final.`)
        setContractId(c.id)
        setTab('contract')
        return
      }
    }
    for (const c of contracte) {
      if (c.tip_contract === 'colaborator' && !String(c.obiect_contract || '').trim()) {
        setError(`Contractul "${etichetaDraft(c, contracte.indexOf(c))}" (colaborator) are nevoie de obiectul contractului.`)
        setContractId(c.id)
        setTab('contract')
        return
      }
      if (c.tip_contract === 'colaborator' && !c.calitate_contract) {
        setError(`Contractul "${etichetaDraft(c, contracte.indexOf(c))}" (colaborator) are nevoie de calitate (Prestator sau Cedent).`)
        setContractId(c.id)
        setTab('contract')
        return
      }
    }
    if (form.observatii && form.observatii.length > 200) {
      setError('Observațiile pot avea maximum 200 de caractere.')
      setTab('personal')
      return
    }

    setSaving(true)

    const principalDraft = contracte.find((c) => c.este_principal) || contracte[0]
    const principalPayload = formToContractPayload(principalDraft, true)

    // 1) datele personale (+ copie a contractului principal în coloanele
    //    vechi, doar ca rezervă pentru eventuala revenire)
    const { error: profilError } = await supabase.from('hr_profil_angajat').upsert({
      angajat_id: angajat.id,
      sex: form.sex || null,
      sold_recuperari: Number(form.sold_recuperari) || 0,
      adresa: form.adresa.trim() || null,
      cnp: form.cnp.trim() || null,
      act_serie: form.act_serie.trim() || null,
      act_numar: form.act_numar.trim() || null,
      act_eliberat_de: form.act_eliberat_de.trim() || null,
      act_data_eliberare: form.act_data_eliberare || null,
      act_data_expirare: form.act_data_expirare || null,
      telefon: form.telefon.trim() || null,
      iban: form.iban.trim() || null,
      observatii: form.observatii.trim() || null,
      numar_contract: principalPayload.numar_contract,
      data_inceput_contract: principalPayload.data_inceput_contract,
      tip_contract: principalPayload.tip_contract,
      data_final_contract: principalPayload.data_final_contract,
      grad: principalPayload.grad,
      atributie_id: principalPayload.atributie_id,
      norma_ore: principalPayload.norma_ore,
      interval_ora_inceput: principalPayload.interval_ora_inceput,
      interval_ora_sfarsit: principalPayload.interval_ora_sfarsit,
      are_fisa_postului: principalPayload.are_fisa_postului,
      functie_de_baza: principalPayload.functie_de_baza,
      zile_concediu_baza_an: principalPayload.zile_concediu_baza_an,
      sold_an_minus_2: principalPayload.sold_an_minus_2,
      sold_an_minus_1: principalPayload.sold_an_minus_1,
      sold_an_curent: principalPayload.sold_an_curent,
      an_referinta: CURRENT_YEAR,
    })

    if (profilError) {
      setSaving(false)
      setError('Nu am putut salva profilul HR.')
      return
    }

    // 2) fiecare contract: nou -> insert, existent -> update
    for (const c of contracte) {
      const payload = formToContractPayload(c, c.este_principal)
      const soldSchimbat =
        [payload.sold_an_minus_2, payload.sold_an_minus_1, payload.sold_an_curent, payload.zile_concediu_baza_an].join('|') !==
        c._soldInitial
      let err
      if (String(c.id).startsWith('nou-')) {
        ;({ error: err } = await supabase.from('hr_contracte').insert({
          ...payload,
          angajat_id: angajat.id,
          este_principal: c.este_principal,
          an_referinta: CURRENT_YEAR,
        }))
      } else {
        ;({ error: err } = await supabase
          .from('hr_contracte')
          .update({ ...payload, ...(soldSchimbat ? { an_referinta: CURRENT_YEAR } : {}) })
          .eq('id', c.id))
      }
      if (err) {
        setSaving(false)
        setError('Nu am putut salva unul dintre contracte.')
        return
      }
    }

    setSaving(false)
    onSaved()
  }

  async function addVechime(e) {
    e.preventDefault()
    if (!newVechime.angajator.trim()) return
    const { data, error } = await supabase
      .from('hr_vechime_anterioara')
      .insert({
        angajat_id: angajat.id,
        angajator: newVechime.angajator.trim(),
        data_inceput: newVechime.data_inceput || null,
        data_sfarsit: newVechime.data_sfarsit || null,
        durata_luni: newVechime.durata_luni ? Number(newVechime.durata_luni) : null,
      })
      .select()
      .single()
    if (!error && data) {
      setVechime((v) => [...v, data])
      setNewVechime(emptyVechime)
    }
  }

  async function removeVechime(id) {
    await supabase.from('hr_vechime_anterioara').delete().eq('id', id)
    setVechime((v) => v.filter((row) => row.id !== id))
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 pb-4">
          <h3 className="font-display text-lg font-semibold text-ink">Date HR — {angajat.nume_complet}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 focus-ring">
            <XIcon size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          <form onSubmit={handleSave} className="space-y-4">
                        {(tab === 'contract' || tab === 'solduri') && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {contracte.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setContractId(c.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        c.id === cf.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {etichetaDraft(c, i)}
                      {String(c.id).startsWith('nou-') ? ' · nou' : ''}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={adaugaContract}
                    className="flex items-center gap-1 rounded-full border border-dashed border-brand-400 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                  >
                    <Plus size={12} /> Contract nou
                  </button>
                </div>
                {contracte.length > 1 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {cf.este_principal ? (
                      <span>Acesta este contractul principal (departamentul și funcția vin din Hub).</span>
                    ) : (
                      <>
                        {!esteNou && (
                          <button type="button" onClick={setPrincipal} disabled={saving}
                            className="rounded-full bg-white px-3 py-1 font-medium text-brand-700 border border-brand-200 hover:bg-brand-50">
                            Setează ca principal
                          </button>
                        )}
                        <button type="button" onClick={stergeContract}
                          className="rounded-full bg-white px-3 py-1 font-medium text-rose-600 border border-rose-200 hover:bg-rose-50">
                          Șterge contractul
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'contract' && (
              <div className="space-y-4">
                {!cf.este_principal && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Departament (acest contract)</label>
                      <select value={cf.departament_id || ''} onChange={(e) => updC('departament_id', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-ring">
                        <option value="">— Alege —</option>
                        {(departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Funcție (acest contract)</label>
                      <select value={cf.functie_id || ''} onChange={(e) => updC('functie_id', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-ring">
                        <option value="">— Alege —</option>
                        {(positions || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Tip contract</label>
                    <select
                      value={cf.tip_contract}
                      onChange={(e) => updC('tip_contract', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-ring"
                    >
                      <option value="">— Alege —</option>
                      <option value="determinat">CIM Determinat</option>
                      <option value="nedeterminat">CIM Nedeterminat</option>
                      <option value="colaborator">Colaborator</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Numărul contractului</label>
                    <input
                      value={cf.numar_contract}
                      onChange={(e) => updC('numar_contract', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Data început contract</label>
                    <input
                      type="date"
                      value={cf.data_inceput_contract || ''}
                      onChange={(e) => updC('data_inceput_contract', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                    />
                  </div>
                  {(cf.tip_contract === 'determinat' || cf.tip_contract === 'colaborator') && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Data final contract{' '}
                        {cf.tip_contract === 'determinat' ? <span className="text-rose-500">*</span> : <span className="text-slate-400">(opțional)</span>}
                      </label>
                      <input
                        type="date"
                        value={cf.data_final_contract || ''}
                        onChange={(e) => updC('data_final_contract', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                      />
                    </div>
                  )}
                  {cf.tip_contract === 'colaborator' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Calitate <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={cf.calitate_contract || ''}
                        onChange={(e) => updC('calitate_contract', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-ring"
                      >
                        <option value="">— Alege —</option>
                        <option value="prestator">Prestator</option>
                        <option value="cedent">Cedent</option>
                      </select>
                    </div>
                  )}
                  {cf.tip_contract === 'colaborator' && (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Obiectul contractului <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={cf.obiect_contract || ''}
                        onChange={(e) => updC('obiect_contract', e.target.value)}
                        placeholder='ex. „Servicii de comunicare"'
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Se preia automat în Rapoarte de activitate (împreună cu numărul și perioada contractului).
                        Atribuția rămâne doar notă internă.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Vechime calculată curent: <strong>{vechimeCalc.total.years} ani, {vechimeCalc.total.months} luni</strong>
                  {' · '}Gradație: <strong>Gradația {vechimeCalc.gradatie}</strong>{' '}
                  <span className="text-slate-400">(calculată automat, vezi Centralizator Vechime pentru detalii)</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Grad</label>
                    <input
                      value={cf.grad}
                      onChange={(e) => updC('grad', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Atribuție</label>
                    <select
                      value={cf.atributie_id}
                      onChange={(e) => updC('atributie_id', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-ring"
                    >
                      <option value="">— Alege —</option>
                      {attributions.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Normă de lucru</label>
                    <select
                      value={cf.norma_ore}
                      onChange={(e) => updC('norma_ore', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-ring"
                    >
                      <option value="">— Alege —</option>
                      {[2, 4, 6, 8].map((h) => (
                        <option key={h} value={h}>{h}h</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Ora început</label>
                      <input
                        type="time"
                        value={cf.interval_ora_inceput}
                        onChange={(e) => updC('interval_ora_inceput', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Ora sfârșit</label>
                      <input
                        type="time"
                        value={cf.interval_ora_sfarsit}
                        onChange={(e) => updC('interval_ora_sfarsit', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Fișa postului</label>
                    <select
                      value={cf.are_fisa_postului}
                      onChange={(e) => updC('are_fisa_postului', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-ring"
                    >
                      <option value="">— Alege —</option>
                      <option value="da">Da</option>
                      <option value="nu">Nu</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Funcția de bază</label>
                    <select
                      value={cf.functie_de_baza}
                      onChange={(e) => updC('functie_de_baza', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-ring"
                    >
                      <option value="">— Alege —</option>
                      <option value="da">Da</option>
                      <option value="nu">Nu</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {tab === 'personal' && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Sex</label>
                    <select value={form.sex || ''} onChange={(e) => upd('sex', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-ring">
                      <option value="">— Alege —</option>
                      <option value="F">Feminin</option>
                      <option value="M">Masculin</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Adresă</label>
                    <input
                      value={form.adresa}
                      onChange={(e) => upd('adresa', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Telefon</label>
                    <input
                      value={form.telefon}
                      onChange={(e) => upd('telefon', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">CNP</label>
                    <input
                      value={form.cnp}
                      onChange={(e) => upd('cnp', e.target.value)}
                      maxLength={13}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">IBAN</label>
                    <input
                      value={form.iban}
                      onChange={(e) => upd('iban', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-600">Act de identitate</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      placeholder="Serie"
                      value={form.act_serie}
                      onChange={(e) => upd('act_serie', e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus-ring"
                    />
                    <input
                      placeholder="Număr"
                      value={form.act_numar}
                      onChange={(e) => upd('act_numar', e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus-ring"
                    />
                    <input
                      placeholder="Eliberat de"
                      value={form.act_eliberat_de}
                      onChange={(e) => upd('act_eliberat_de', e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus-ring"
                    />
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-500">La data de</label>
                      <input
                        type="date"
                        value={form.act_data_eliberare}
                        onChange={(e) => upd('act_data_eliberare', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus-ring"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-500">Data expirării</label>
                      <input
                        type="date"
                        value={form.act_data_expirare}
                        onChange={(e) => upd('act_data_expirare', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus-ring"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Observații <span className="text-slate-400">({form.observatii.length}/200)</span>
                  </label>
                  <textarea
                    value={form.observatii}
                    onChange={(e) => upd('observatii', e.target.value.slice(0, 200))}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                  />
                </div>
              </div>
            )}

            {tab === 'solduri' && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Zile de bază / an</label>
                  <input
                    type="number"
                    step="0.5"
                    value={cf.zile_concediu_baza_an}
                    onChange={(e) => updC('zile_concediu_baza_an', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                  />
                </div>

                <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
                  <p className="text-xs font-semibold text-brand-800">Solduri (situația actuală)</p>
                  <p className="mt-0.5 text-xs text-brand-700">
                    Aceste solduri avansează automat la anul nou (verificat zilnic, în fundal).
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Recuperări (la persoană)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={form.sold_recuperari}
                        onChange={(e) => upd('sold_recuperari', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Anul {CURRENT_YEAR - 2} <span className="text-slate-400">(expiră 30 iun. {CURRENT_YEAR})</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={cf.sold_an_minus_2}
                        onChange={(e) => updC('sold_an_minus_2', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Anul {CURRENT_YEAR - 1}</label>
                      <input
                        type="number"
                        step="0.5"
                        value={cf.sold_an_minus_1}
                        onChange={(e) => updC('sold_an_minus_1', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        Anul {CURRENT_YEAR} <span className="text-slate-400">(curent)</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={cf.sold_an_curent}
                        onChange={(e) => updC('sold_an_curent', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-600">Vechime anterioară</p>
                  <div className="space-y-1.5">
                    {vechime.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs"
                      >
                        <span>
                          {v.angajator}
                          {v.data_inceput ? ` · ${v.data_inceput}` : ''}
                          {v.data_sfarsit ? ` → ${v.data_sfarsit}` : ''}
                          {v.durata_luni ? ` · ${v.durata_luni} luni` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeVechime(v.id)}
                          className="rounded-full p-1 text-rose-500 hover:bg-rose-50 focus-ring"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {vechime.length === 0 && (
                      <p className="text-xs text-slate-400">Nicio vechime anterioară adăugată.</p>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    <input
                      placeholder="Angajator"
                      value={newVechime.angajator}
                      onChange={(e) => setNewVechime({ ...newVechime, angajator: e.target.value })}
                      className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus-ring sm:col-span-1"
                    />
                    <input
                      type="date"
                      value={newVechime.data_inceput}
                      onChange={(e) => setNewVechime({ ...newVechime, data_inceput: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus-ring"
                    />
                    <input
                      type="date"
                      value={newVechime.data_sfarsit}
                      onChange={(e) => setNewVechime({ ...newVechime, data_sfarsit: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus-ring"
                    />
                    <input
                      type="number"
                      placeholder="Luni"
                      value={newVechime.durata_luni}
                      onChange={(e) => setNewVechime({ ...newVechime, durata_luni: e.target.value })}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus-ring"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addVechime}
                    className="mt-2 flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 focus-ring"
                  >
                    <Plus size={13} /> Adaugă vechime
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-rose-600">{error}</p>}

            {tab !== 'istoric' && (
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 focus-ring"
                >
                  <Save size={14} /> {saving ? 'Se salvează…' : 'Salvează'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 focus-ring"
                >
                  <XIcon size={14} /> Închide
                </button>
              </div>
            )}
          </form>

          {tab === 'istoric' && (
            <ActeAditionale
              angajat={angajat}
              profil={form}
              contracte={contracte}
              etichetaDraft={etichetaDraft}
              attributions={attributions}
              onApplied={(updates, contractIdAplicat) => {
                const pers = {}
                const contr = {}
                for (const [k, v] of Object.entries(updates)) (esteCampContract(k) ? contr : pers)[k] = v
                if (Object.keys(pers).length) setForm((f) => ({ ...f, ...pers }))
                if (contractIdAplicat && Object.keys(contr).length)
                  setContracte((l) => l.map((c) => (c.id === contractIdAplicat ? { ...c, ...contr } : c)))
                onSaved()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ActeAditionale({ angajat, profil, contracte, etichetaDraft, attributions, onApplied }) {
  const salvate = contracte.filter((c) => !String(c.id).startsWith('nou-'))
  const [contractAles, setContractAles] = useState(
    () => (salvate.find((c) => c.este_principal) || salvate[0])?.id || ''
  )
  const contractSel = salvate.find((c) => c.id === contractAles)
  // valoarea actuală a unui câmp: din contractul ales sau din datele personale
  // Câmpurile care pot fi alese pentru contractul selectat
  const tipCtr = contractSel?.tip_contract
  const campuriDisponibile = CAMPURI_MODIFICABILE.filter((c) => {
    if (c.inActe === false) return false
    if (c.soloColaborator && tipCtr && tipCtr !== 'colaborator') return false
    if (c.fixedTermOnly && tipCtr === 'nedeterminat') return false
    return true
  })
  const valoareActuala = (key) => (esteCampContract(key) ? contractSel?.[key] : profil[key])
  const [istoric, setIstoric] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [numarAct, setNumarAct] = useState('')
  const [prelungireDe, setPrelungireDe] = useState('')
  const [selectate, setSelectate] = useState({})
  const [valoriNoi, setValoriNoi] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('hr_acte_aditionale')
      .select('*')
      .eq('angajat_id', angajat.id)
      .order('data', { ascending: false })
    setIstoric(data || [])
    setLoading(false)
  }

  function toggleCamp(key) {
    setSelectate((s) => ({ ...s, [key]: !s[key] }))
    if (!valoriNoi[key]) {
      setValoriNoi((v) => ({ ...v, [key]: valoareActuala(key) ?? '' }))
    }
    if (key === 'data_final_contract' && !prelungireDe) setPrelungireDe(ziUrmatoare(contractSel?.data_final_contract))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!numarAct.trim()) {
      setError('Completează numărul actului adițional.')
      return
    }
    if (!data) {
      setError('Completează data actului adițional.')
      return
    }
    const anAct = data.slice(0, 4)
    if (istoric.some((a) => String(a.numar_act || '').trim().toLowerCase() === numarAct.trim().toLowerCase() && String(a.data || '').slice(0, 4) === anAct)) {
      setError(`Există deja un act adițional cu numărul ${numarAct.trim()} în anul ${anAct}.`)
      return
    }

    const campuriAlese = Object.keys(selectate).filter((k) => selectate[k] && campuriDisponibile.some((c) => c.key === k))
    if (campuriAlese.includes('data_final_contract')) {
      const nou = valoriNoi.data_final_contract
      const actual = contractSel?.data_final_contract
      if (!nou) {
        setError('Completează noua dată de final a contractului.')
        return
      }
      if (actual && nou <= actual) {
        setError('Noua dată de final trebuie să fie după data de final actuală.')
        return
      }
      if (prelungireDe && nou < prelungireDe) {
        setError('Data de final nu poate fi înaintea începutului prelungirii.')
        return
      }
    }
    if (campuriAlese.length === 0) {
      setError('Bifează cel puțin un câmp de modificat.')
      return
    }

    setSaving(true)

    const modificari = {}
    const updatePayload = {}
    const updateContract = {}
    if (campuriAlese.some(esteCampContract) && !contractSel) {
      setSaving(false)
      setError('Alege contractul la care se aplică actul adițional.')
      return
    }
    for (const key of campuriAlese) {
      const camp = CAMPURI_MODIFICABILE.find((c) => c.key === key)
      let valoareNoua = valoriNoi[key]
      if (camp.type === 'boolean') valoareNoua = valoareNoua === 'da'
      if (camp.type === 'select' && ['norma_ore'].includes(key)) valoareNoua = Number(valoareNoua)

      modificari[key] = { de_la: valoareActuala(key) ?? null, la: valoareNoua }
      ;(esteCampContract(key) ? updateContract : updatePayload)[key] = valoareNoua === '' ? null : valoareNoua
    }

    if (campuriAlese.includes('data_final_contract') && prelungireDe) {
      modificari.prelungire_de_la = { de_la: null, la: prelungireDe }
    }

    const aplicatPeContract = campuriAlese.some(esteCampContract)
    const { error: err1 } = await supabase.from('hr_acte_aditionale').insert({
      angajat_id: angajat.id,
      data,
      numar_act: numarAct.trim(),
      modificari,
      contract_id: aplicatPeContract ? contractSel.id : null,
    })
    let err2 = null
    if (Object.keys(updatePayload).length) {
      ;({ error: err2 } = await supabase.from('hr_profil_angajat').update(updatePayload).eq('angajat_id', angajat.id))
    }
    if (!err2 && Object.keys(updateContract).length) {
      ;({ error: err2 } = await supabase.from('hr_contracte').update(updateContract).eq('id', contractSel.id))
      // contractul principal: păstrăm și copia din coloanele vechi
      if (!err2 && contractSel.este_principal) {
        const { atributie_id, ...rest } = updateContract
        await supabase.from('hr_profil_angajat').update({ ...rest, ...(atributie_id !== undefined ? { atributie_id } : {}) }).eq('angajat_id', angajat.id)
      }
    }

    setSaving(false)
    if (err1 || err2) {
      setError('Nu am putut salva actul adițional.')
      return
    }

    // reflectăm imediat noile valori în formularul principal
    const formUpdates = {}
    for (const key of campuriAlese) {
      const camp = CAMPURI_MODIFICABILE.find((c) => c.key === key)
      formUpdates[key] = camp.type === 'boolean' ? (valoriNoi[key] === 'da' ? 'da' : 'nu') : valoriNoi[key]
    }

    setSelectate({})
    setValoriNoi({})
    setNumarAct('')
    setPrelungireDe('')
    setShowForm(false)
    onApplied(formUpdates, aplicatPeContract ? contractSel.id : null)
    load()
  }

  return (
    <div className="mt-2">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">Istoric acte adiționale</p>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 focus-ring"
        >
          <Plus size={13} /> {showForm ? 'Anulează' : 'Act adițional nou'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl border border-slate-200 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Număr act adițional <span className="text-rose-500">*</span>
              </label>
              <input
                value={numarAct}
                onChange={(e) => setNumarAct(e.target.value)}
                placeholder="ex. 3"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Data actului adițional <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-ring"
              />
            </div>
          </div>

          {salvate.length === 0 && (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              Actele adiționale se aplică pe contracte salvate. Salvează mai întâi contractul (butonul de salvare de jos), apoi adaugă actul.
            </p>
          )}

          {salvate.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">La ce contract se aplică (pentru câmpurile de contract)</label>
              <select
                value={contractAles}
                onChange={(e) => { setContractAles(e.target.value); setValoriNoi({}); setSelectate({}) }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus-ring"
              >
                {salvate.map((c) => (
                  <option key={c.id} value={c.id}>{etichetaDraft(c, contracte.indexOf(c))}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">Ce se modifică?</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {campuriDisponibile.map((c) => (
                <label key={c.key} className="flex items-center gap-1.5 text-xs text-slate-700">
                  <input type="checkbox" checked={!!selectate[c.key]} onChange={() => toggleCamp(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {Object.keys(selectate).some((k) => selectate[k]) && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-2.5">
              {campuriDisponibile.filter((c) => selectate[c.key]).map((c) => (
                <div key={c.key}>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    {c.label} <span className="text-slate-400">(actual: {formatValoare(c.key, valoareActuala(c.key), attributions)})</span>
                  </label>
                  {c.type === 'select' && (
                    <select
                      value={valoriNoi[c.key] ?? ''}
                      onChange={(e) => setValoriNoi((v) => ({ ...v, [c.key]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus-ring"
                    >
                      <option value="">— Alege —</option>
                      {c.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                  {c.type === 'attributie' && (
                    <select
                      value={valoriNoi[c.key] ?? ''}
                      onChange={(e) => setValoriNoi((v) => ({ ...v, [c.key]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus-ring"
                    >
                      <option value="">— Alege —</option>
                      {attributions.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  )}
                  {c.type === 'boolean' && (
                    <select
                      value={valoriNoi[c.key] === true || valoriNoi[c.key] === 'da' ? 'da' : valoriNoi[c.key] === false || valoriNoi[c.key] === 'nu' ? 'nu' : ''}
                      onChange={(e) => setValoriNoi((v) => ({ ...v, [c.key]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs focus-ring"
                    >
                      <option value="">— Alege —</option>
                      <option value="da">Da</option>
                      <option value="nu">Nu</option>
                    </select>
                  )}
                  {c.key === 'data_final_contract' && (
                    <div className="mb-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Prelungirea începe la</label>
                      <input
                        type="date"
                        value={prelungireDe}
                        onChange={(e) => setPrelungireDe(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus-ring"
                      />
                      {contractSel?.data_final_contract && prelungireDe && prelungireDe > ziUrmatoare(contractSel.data_final_contract) && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          Între finalul actual ({contractSel.data_final_contract}) și începutul prelungirii există o pauză; vechimea o va include.
                        </p>
                      )}
                      <label className="mb-1 mt-2 block text-[11px] font-medium text-slate-600">Prelungirea se încheie la (noua dată de final)</label>
                    </div>
                  )}
                  {(c.type === 'date' || c.type === 'time') && (
                    <input
                      type={c.type}
                      value={valoriNoi[c.key] ?? ''}
                      onChange={(e) => setValoriNoi((v) => ({ ...v, [c.key]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus-ring"
                    />
                  )}
                  {c.type === 'text' && (
                    <input
                      value={valoriNoi[c.key] ?? ''}
                      onChange={(e) => setValoriNoi((v) => ({ ...v, [c.key]: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus-ring"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 focus-ring"
          >
            <Save size={13} /> {saving ? 'Se salvează…' : 'Salvează actul adițional'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Se încarcă…</p>
      ) : istoric.length === 0 ? (
        <p className="text-xs text-slate-400">Niciun act adițional înregistrat încă.</p>
      ) : (
        <div className="space-y-2">
          {istoric.map((act) => (
            <div key={act.id} className="rounded-lg border border-slate-100 p-2.5 text-xs">
              <p className="mb-1 font-medium text-slate-700">
                Act adițional {act.numar_act ? `nr. ${act.numar_act}` : '(fără număr)'} din {act.data}
                {act.contract_id && contracte.length > 1 && contracte.find((c) => c.id === act.contract_id)
                  ? ` · ${etichetaDraft(contracte.find((c) => c.id === act.contract_id), contracte.findIndex((c) => c.id === act.contract_id))}`
                  : ''}
              </p>
              {Object.entries(act.modificari).map(([key, { de_la, la }]) => (
                <p key={key} className="text-slate-500">
                  {labelPentruCamp(key)}: {formatValoare(key, de_la, attributions)} → <strong className="text-slate-700">{formatValoare(key, la, attributions)}</strong>
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
