// Eticheta „Nou" / „Menționat" / „Actualizat" – rămâne pe task până îl deschizi.
const TITLURI = {
  mentiune: 'Ai fost menționat într-un comentariu',
  actualizat: 'Taskul a fost actualizat (status, livrare sau comentariu nou)',
  atribuit: 'Task primit, încă nedeschis',
}
const TEXTE = { mentiune: 'Menționat', actualizat: 'Actualizat', atribuit: 'Nou' }
export function EtichetaNou({ ctx, t }) {
  const motiv = ctx.necitite?.[t.id]
  if (!motiv) return null
  return (
    <span className="mr-1.5 inline-flex shrink-0 items-center rounded-full bg-[#22406B] px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wide text-white" title={TITLURI[motiv]}>
      {TEXTE[motiv] || 'Nou'}
    </span>
  )
}
