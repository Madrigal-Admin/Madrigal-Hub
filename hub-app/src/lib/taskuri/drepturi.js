import { esteIntarziat } from './ui'

// Reunește datele încărcate cu "cine sunt eu" și calculează ce am voie să fac.
// Atenție: asta e doar pentru interfață (ce butoane arăt). Regulile reale sunt în baza de date.
export function construiesteCtx(date, me, rol) {
  const admin = rol === 'admin'
  const angajatiMap = Object.fromEntries(date.angajati.map((a) => [a.id, a]))
  const grupMap = Object.fromEntries(date.grupuri.map((g) => [g.id, g]))
  const evMap = Object.fromEntries(date.evenimente.map((e) => [e.id, e]))
  const statusMap = Object.fromEntries(date.statusuri.map((s) => [s.cod, s]))

  const grupuriCoordonate = new Set(date.membri.filter((m) => m.angajat_id === me.id && m.e_coordonator).map((m) => m.grup_id))
  const membriGrup = (gid) => date.membri.filter((m) => m.grup_id === gid).map((m) => m.angajat_id)
  const oamenii = new Set() // oamenii din departamentele pe care le coordonez
  for (const g of grupuriCoordonate) for (const id of membriGrup(g)) oamenii.add(id)

  const evenimenteMele = date.evenimente.filter((e) => e.pm.includes(me.id))
  const sunPm = evenimenteMele.length > 0
  const sunCoordonator = grupuriCoordonate.size > 0

  const colabDupaTask = {}
  for (const c of date.colaboratori) (colabDupaTask[c.task_id] ||= []).push(c.angajat_id)

  const comportament = (evId) => statusMap[evMap[evId]?.status]?.comportament
  const evenimentAnulat = (evId) => comportament(evId) === 'anulat'
  const pmLaEveniment = (evId) => !!evMap[evId]?.pm.includes(me.id)

  const poateGestiona = (t) =>
    admin ||
    t.creat_de === me.id ||
    (t.tip === 'eveniment' && pmLaEveniment(t.eveniment_id)) ||
    (t.grup_id && grupuriCoordonate.has(t.grup_id))
  const poateDelega = (t) =>
    poateGestiona(t) ||
    (t.responsabil_id && oamenii.has(t.responsabil_id)) ||
    (t.responsabil_id === me.id && sunCoordonator)
  const poateSchimbaStatus = (t) =>
    poateGestiona(t) || t.responsabil_id === me.id || (colabDupaTask[t.id] || []).includes(me.id)
  const inghetat = (t) => t.tip === 'eveniment' && evenimentAnulat(t.eveniment_id) && t.status === 'anulat'

  const taskuriMele = date.taskuri.filter(
    (t) => t.responsabil_id === me.id || t.creat_de === me.id || (colabDupaTask[t.id] || []).includes(me.id)
  )
  const taskuriDepartament = date.taskuri.filter(
    (t) => (t.grup_id && grupuriCoordonate.has(t.grup_id)) || (t.responsabil_id && oamenii.has(t.responsabil_id))
  )

  return {
    me, rol, admin,
    ...date,
    angajatiMap, grupMap, evMap, statusMap,
    grupuriCoordonate, evenimenteMele, sunPm, sunCoordonator,
    colabDupaTask, comportament, evenimentAnulat, pmLaEveniment,
    poateGestiona, poateDelega, poateSchimbaStatus, inghetat,
    taskuriMele, taskuriDepartament,
    nume: (id) => angajatiMap[id]?.nume_complet || '—',
    // angajații activi care au acces la Taskuri (doar ei pot primi taskuri)
    angajatiCuAcces: date.angajati.filter((a) => a.activ && date.acces[a.id]),
    // pot crea taskuri de eveniment / operaționale?
    poateEveniment: admin || sunPm,
    poateOperational: admin || sunCoordonator,
    intarziate: (lista) => lista.filter(esteIntarziat).length,
  }
}
