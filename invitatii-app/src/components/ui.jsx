// Piese de interfață comune (tema Invitații: fundal alb, albastru #22406B, butoane rotunjite)

export function PageHeader({ titlu, descriere, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[22px] font-extrabold text-slate-900">{titlu}</h2>
        {descriere && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500">{descriere}</p>}
      </div>
      {children}
    </div>
  )
}

const BTN = 'inline-flex items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'

export function Btn({ variant = 'secondary', className = '', ...props }) {
  const stiluri = {
    primary: 'bg-accent text-white hover:bg-accent-hover border border-accent px-4 py-2',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-4 py-2',
    danger: 'bg-white text-rose-700 border border-rose-700 hover:bg-rose-50 px-4 py-2',
    small: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 text-xs',
    smallPrimary: 'bg-accent text-white border border-accent hover:bg-accent-hover px-3 py-1.5 text-xs',
  }
  return <button type="button" className={`${BTN} ${stiluri[variant]} ${className}`} {...props} />
}

const PILL = {
  gri: 'bg-slate-100 text-slate-600',
  albastru: 'bg-[#e9eef6] text-accent',
  verde: 'bg-green-100 text-green-800',
  rosu: 'bg-rose-100 text-rose-800',
  galben: 'bg-amber-100 text-amber-800',
}

export function Pill({ culoare = 'gri', children, className = '' }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PILL[culoare]} ${className}`}>
      {children}
    </span>
  )
}

export function FilterChip({ activ, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
        activ ? 'border-accent bg-accent font-semibold text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

export function Card({ className = '', children }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-sm ${className}`}>{children}</div>
}

// Bară de locuri: confirmați (albastru închis) + aprobați (albastru deschis) + în așteptare (galben)
export function BaraLocuri({ locuri, inaltime = 'h-2.5' }) {
  const { confirmati = 0, aprobati = 0, in_asteptare: asteptare = 0, plafon } = locuri
  if (!plafon) return null
  const pct = (n) => Math.min(100, (n / plafon) * 100)
  return (
    <div
      className={`flex ${inaltime} overflow-hidden rounded-full bg-slate-200`}
      role="img"
      aria-label={`${confirmati + aprobati + asteptare} locuri ocupate din ${plafon}`}
    >
      <div className="bg-accent" style={{ width: `${pct(confirmati)}%` }} />
      <div className="bg-[#6b86ad]" style={{ width: `${pct(aprobati)}%` }} />
      <div className="bg-amber-500" style={{ width: `${pct(asteptare)}%` }} />
    </div>
  )
}

export function LegendaLocuri({ locuri }) {
  const { confirmati = 0, aprobati = 0, in_asteptare: asteptare = 0 } = locuri
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-accent" />{confirmati} confirmați (lista fixă)</span>
      <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#6b86ad]" />{aprobati} invitați aprobați ai angajaților</span>
      <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-amber-500" />{asteptare} cereri în așteptare</span>
    </div>
  )
}

export function totalLocuri(locuri) {
  return (locuri.confirmati || 0) + (locuri.aprobati || 0) + (locuri.in_asteptare || 0)
}
