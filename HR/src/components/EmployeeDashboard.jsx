import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  calculateBalances,
  etichetaContract,
  formatDate,
  getContracte,
  STATUS_LABELS_EMPLOYEE,
  STATUS_STYLES,
  CERTIFICATE_STATUS_LABELS,
  CERTIFICATE_STATUS_STYLES,
} from '../lib/leaveCalculations'
import { TIP_CONTROL, CALIFICATIVE, eticheta, formatNota } from '../lib/istoricHr'

const TIP_CONTRACT_LABEL = { determinat: 'CIM determinat', nedeterminat: 'CIM nedeterminat', colaborator: 'Colaborare' }

// Perioada contractului: interval (data → data) sau data – nedeterminat
function perioadaContract(c) {
  const de = formatDate(c.data_inceput_contract)
  if (c.tip_contract === 'nedeterminat') return `${de} – nedeterminat`
  if (c.data_final_contract) return `${de} → ${formatDate(c.data_final_contract)}`
  return `${de} – fără dată de final`
}

export default function EmployeeDashboard({ employee, onNavigate }) {
  const [requests, setRequests] = useState([])
  const [certificateRequests, setCertificateRequests] = useState([])
  const [recoveries, setRecoveries] = useState([])
  const [medicina, setMedicina] = useState([])
  const [evaluari, setEvaluari] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (employee?.id) loadData()
  }, [employee])

  async function loadData() {
    setLoading(true)
    const [{ data: reqs }, { data: certReqs }, { data: recs }, { data: med }, { data: evals }] = await Promise.all([
      supabase
        .from('leave_requests')
        .select('*')
        .eq('angajat_id', employee.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('certificate_requests')
        .select('*')
        .eq('angajat_id', employee.id)
        .order('created_at', { ascending: false }),
      supabase.from('overtime_recoveries').select('*').eq('angajat_id', employee.id),
      supabase.from('hr_medicina_muncii').select('*').eq('angajat_id', employee.id).order('data_control', { ascending: false }),
      supabase.from('hr_evaluari').select('*').eq('angajat_id', employee.id).order('data_evaluare', { ascending: false }),
    ])
    setRequests(reqs || [])
    setCertificateRequests(certReqs || [])
    setRecoveries(recs || [])
    setMedicina(med || [])
    setEvaluari(evals || [])
    setLoading(false)
  }

  if (loading) return <p className="text-sm text-slate-500">Se încarcă…</p>

  const approved = requests.filter((r) => r.status === 'approved')
  const balances = calculateBalances(employee, approved, recoveries)
  const balance = balances[0]
  const multiple = balances.length > 1

  const cardsPentru = (b, cuRecuperari) => [
    ...(cuRecuperari ? [{ label: 'Recuperări', value: b.recoveries, sub: 'ore suplimentare' }] : []),
    {
      label: `${b.yearY2}`,
      value: b.y2,
      sub: b.y2Expired ? 'expirate la 30 iunie' : 'expiră 30 iunie',
    },
    { label: `${b.yearY1}`, value: b.y1, sub: 'reportate anul trecut' },
    { label: `${b.year} (curent)`, value: b.y, sub: 'alocarea anului curent' },
  ]
  const cards = cardsPentru(balance, true)
  const subtotalAni = (b) => Math.round((b.y2 + b.y1 + b.y) * 10) / 10

  const contracteCuPerioada = getContracte(employee).filter((c) => c.data_inceput_contract)

  const combinedRequests = [
    ...requests.map((r) => ({ ...r, kind: 'leave' })),
    ...certificateRequests.map((r) => ({ ...r, kind: 'certificate' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">
        Bună, {employee.nume_complet.split(' ')[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {employee.department?.name} {employee.position?.name ? `· ${employee.position.name}` : ''}
      </p>

      {contracteCuPerioada.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {contracteCuPerioada.length > 1 ? 'Contractele mele' : 'Contractul meu'}
          </p>
          <div className="mt-1">
            {contracteCuPerioada.map((c) => (
              <div key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-100 py-2 first:border-t-0">
                <span className="text-sm text-slate-700">
                  {TIP_CONTRACT_LABEL[c.tip_contract] || 'Contract'}
                  {c.numar_contract ? ` · nr. ${c.numar_contract}` : ''}
                </span>
                <span className="text-sm font-medium text-ink">{perioadaContract(c)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!multiple && (
        <>
          <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-5">
            <p className="text-sm font-medium text-brand-800">Sold total disponibil</p>
            <p className={`font-display text-4xl font-semibold ${balance.total < 0 ? 'text-rose-600' : 'text-brand-900'}`}>
              {balance.total} zile
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
                <p className={`font-display text-2xl font-semibold ${c.value < 0 ? 'text-rose-600' : 'text-ink'}`}>
                  {c.value}
                </p>
                <p className="text-xs text-slate-400">{c.sub}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {multiple && (
        <>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Recuperări</p>
            <p className={`font-display text-2xl font-semibold ${balance.recoveries < 0 ? 'text-rose-600' : 'text-ink'}`}>
              {balance.recoveries}
            </p>
            <p className="text-xs text-slate-400">ore suplimentare — se scad o singură dată, indiferent de contract</p>
          </div>

          {balances.map((b, idx) => (
            <div key={b.contract?.id || idx} className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-brand-900">{etichetaContract(b.contract, idx)}</p>
                <p className={`font-display text-2xl font-semibold ${subtotalAni(b) < 0 ? 'text-rose-600' : 'text-brand-900'}`}>
                  {subtotalAni(b)} zile
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {cardsPentru(b, false).map((c) => (
                  <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
                    <p className={`font-display text-xl font-semibold ${c.value < 0 ? 'text-rose-600' : 'text-ink'}`}>
                      {c.value}
                    </p>
                    <p className="text-xs text-slate-400">{c.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="mt-2 text-xs text-slate-500">
            O cerere de concediu se scade din fiecare contract în vigoare în perioada respectivă.
          </p>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => onNavigate('leave')}
          className="rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus-ring"
        >
          Cerere concediu
        </button>
        <button
          onClick={() => onNavigate('certificate')}
          className="rounded-full border border-brand-300 px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-ring"
        >
          Cerere adeverințe
        </button>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold text-ink">Cererile mele</h2>
      <div className="mt-3 space-y-2">
        {combinedRequests.length === 0 && (
          <p className="text-sm text-slate-500">Nu ai trimis nicio cerere încă.</p>
        )}
        {combinedRequests.map((r) => (
          <div
            key={`${r.kind}-${r.id}`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
          >
            {r.kind === 'leave' ? (
              <div>
                <p className="text-sm font-medium text-ink">
                  {r.leave_type} — {formatDate(r.start_date)} → {formatDate(r.end_date)}
                </p>
                <p className="text-xs text-slate-400">{r.working_days} zile · trimisă {formatDate(r.created_at)}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-ink">{r.certificate_type}</p>
                <p className="text-xs text-slate-400">{r.delivery_method} · trimisă {formatDate(r.created_at)}</p>
              </div>
            )}
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                r.kind === 'leave' ? STATUS_STYLES[r.status] : CERTIFICATE_STATUS_STYLES[r.status]
              }`}
            >
              {r.kind === 'leave' ? STATUS_LABELS_EMPLOYEE[r.status] : CERTIFICATE_STATUS_LABELS[r.status]}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-8">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Medicina muncii</h2>
          <div className="mt-3 space-y-2">
            {medicina.length === 0 && <p className="text-sm text-slate-500">Nicio înregistrare.</p>}
            {medicina.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-ink">{formatDate(m.data_control)}</p>
                <p className="text-xs text-slate-500">{eticheta(TIP_CONTROL, m.tip_control) || '—'}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Evaluările mele</h2>
          <div className="mt-3 space-y-2">
            {evaluari.length === 0 && <p className="text-sm text-slate-500">Nicio înregistrare.</p>}
            {evaluari.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-medium text-ink">{formatDate(e.data_evaluare)}</p>
                <p className="text-xs text-slate-500">
                  {[eticheta(CALIFICATIVE, e.calificativ), formatNota(e.nota)].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
