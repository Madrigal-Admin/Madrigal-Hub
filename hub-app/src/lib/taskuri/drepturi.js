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

  // Structura taskurilor: categorii (Media: Design grafic, Foto-video…) și câmpuri suplimentare per tip
  const categMap = Object.fromEntries((date.categorii || []).map((c) => [c.id, c]))
  const categorieTip = (tip) => (date.categorii || []).find((c) => c.tip === tip && c.tip !== 'solicitare')
  // Responsabilii unei categorii Media = membrii departamentului destinatar (cu acces la Taskuri); implicit = cel setat în Structură task
  const responsabiliCategorie = (categorieId) => {
    const c = categMap[categorieId]
    if (!c?.grup_id) return []
    return date.membri.filter((m) => m.grup_id === c.grup_id && date.acces[m.angajat_id] && angajatiMap[m.angajat_id]?.activ).map((m) => ({ angajat_id: m.angajat_id, implicit: m.angajat_id === c.responsabil_implicit_id }))
  }
  // Categoriile în care pot deschide taskuri: aceleași reguli ca la taskurile normale (admin / PM / coordonator)
  const poateCreaSolicitare = admin || sunPm || sunCoordonator
  const categoriiActive = (date.categorii || []).filter((c) => c.tip === 'solicitare' && c.activ && c.grup_id)
  const campuriCategorie = (categorieId) => (date.sabloane || []).filter((s) => s.categorie_id === categorieId).sort((a, b) => a.ordine - b.ordine)
  const eticheta = (t) => (t.tip === 'solicitare' ? `Media · ${categMap[t.categorie_id]?.nume || 'Solicitare'}` : '')

  const poateGestiona = (t) =>
    admin ||
    t.creat_de === me.id ||
    (t.tip === 'eveniment' && pmLaEveniment(t.eveniment_id)) ||
    (t.grup_id && grupuriCoordonate.has(t.grup_id))
  const poateDelega = (t) =>
    poateGestiona(t) ||
    (t.responsabil_id && oamenii.has(t.responsabil_id)) ||
    (t.responsabil_id === me.id && sunCoordonator)
  // La taskurile Media statusul îl schimbă responsabilul, coordonatorul departamentului și adminul; cel care a deschis taskul îl poate doar anula.
  const poateAnula = (t) =>
    t.tip === 'solicitare' ? admin || (t.creat_de === me.id && (t.status === 'de_facut' || t.status === 'in_lucru')) : poateGestiona(t)
  const poateSchimbaStatus = (t) =>
    t.tip === 'solicitare' ? admin || t.responsabil_id === me.id || !!(t.grup_id && grupuriCoordonate.has(t.grup_id)) :
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
    categMap, categorieTip, responsabiliCategorie, poateCreaSolicitare, categoriiActive, campuriCategorie, eticheta, poateAnula,
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
