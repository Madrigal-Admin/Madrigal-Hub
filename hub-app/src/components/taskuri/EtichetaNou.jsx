// Eticheta „Nou" / „Menționat" – rămâne pe task până îl deschizi.
export function EtichetaNou({ ctx, t }) {
  const motiv = ctx.necitite?.[t.id]
  if (!motiv) return null
  return (
    <span className="mr-1.5 inline-flex shrink-0 items-center rounded-full bg-[#22406B] px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wide text-white" title={motiv === 'mentiune' ? 'Ai fost menționat într-un comentariu' : 'Task primit, încă nedeschis'}>
      {motiv === 'mentiune' ? 'Menționat' : 'Nou'}
    </span>
  )
}
