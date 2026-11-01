import { supabase } from '../../supabaseClient'

// ---- zile (mereu pe ora locală, nu UTC) -----------------------------------
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const azi = () => ymd(new Date())
export function plusZile(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return ymd(d)
}

const LUNI_SCURT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']
export function dataScurta(s) {
  if (!s) return ''
  return `${+s.slice(8, 10)} ${LUNI_SCURT[+s.slice(5, 7) - 1]}`
}
export const luna = (s) => LUNI_SCURT[+s.slice(5, 7) - 1]
export const zi = (s) => +s.slice(8, 10)

export function dataAzi() {
  const t = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Numele complet e scris „Nume Prenume ..." (ex.: „Niculae Cătălin Andrei") — prenumele e al doilea cuvânt.
export function prenume(numeComplet) {
  const c = (numeComplet || '').trim().split(/\s+/)
  return c.length > 1 ? c[1] : c[0] || ''
}

// ---- în ce grupă intră un task ---------------------------------------------
export const GRUPE = ['Întârziate', 'Azi', 'Următoarele 7 zile', 'Mai târziu', 'Fără termen']
export function grupa(t) {
  if (!t.termen) return 'Fără termen'
  const a = azi()
  if (t.termen < a) return 'Întârziate'
  if (t.termen === a) return 'Azi'
  if (t.termen <= plusZile(7)) return 'Următoarele 7 zile'
  return 'Mai târziu'
}
export const esteDeschis = (t) => t.status === 'de_facut' || t.status === 'in_lucru'

// ---- încărcarea datelor ----------------------------------------------------
export async function incarcaHome(me, areTaskuri) {
  const [ev, st] = await Promise.all([
    supabase.from('evenimente').select('id, nume, data, data_sfarsit, status, localitate, locatie, eveniment_pm(angajat_id)').order('data'),
    supabase.from('statusuri_eveniment').select('cod, nume, culoare, comportament, ordine').order('ordine'),
  ])
  const statusuri = st.data || []
  const comp = Object.fromEntries(statusuri.map((s) => [s.cod, s.comportament]))
  const evenimente = (ev.data || []).map((e) => ({ ...e, pm: (e.eveniment_pm || []).map((p) => p.angajat_id), comportament: comp[e.status] }))
  const rezultat = { evenimente, statusuri, taskuri: [], progres: {}, departamente: [], nume: {}, eroare: ev.error ? 'Nu am putut încărca evenimentele.' : '' }
  if (!areTaskuri) return rezultat

  const saptamanaTrecuta = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const COLOANE = 'id, tip, titlu, eveniment_id, grup_id, responsabil_id, termen, prioritate, status, creat_de, terminat_la'
  const filtruRecent = `status.in.(de_facut,in_lucru),and(status.eq.terminat,terminat_la.gte.${saptamanaTrecuta})`

  const [colab, gm, grupuri, ang, proprii] = await Promise.all([
    supabase.from('tsk_colaboratori').select('task_id').eq('angajat_id', me.id),
    supabase.from('tsk_grup_membri').select('grup_id, angajat_id, e_coordonator'),
    supabase.from('tsk_grupuri').select('id, nume, activ'),
    supabase.from('angajati').select('id, nume_complet'),
    supabase.from('tsk_taskuri').select(COLOANE).eq('responsabil_id', me.id).or(filtruRecent),
  ])
  rezultat.nume = Object.fromEntries((ang.data || []).map((a) => [a.id, a.nume_complet]))

  // taskuri la care sunt colaborator
  const idsColab = (colab.data || []).map((c) => c.task_id)
  let taskuri = proprii.data || []
  if (idsColab.length) {
    const { data } = await supabase.from('tsk_taskuri').select(COLOANE).in('id', idsColab).or(filtruRecent)
    const vazute = new Set(taskuri.map((t) => t.id))
    taskuri = [...taskuri, ...(data || []).filter((t) => !vazute.has(t.id))]
  }
  rezultat.taskuri = taskuri

  // progres pe evenimentele la care sunt PM (doar cele active)
  const evPm = evenimente.filter((e) => e.pm.includes(me.id) && ['deschis', 'organizare'].includes(e.comportament))
  if (evPm.length) {
    const { data } = await supabase.from('tsk_taskuri').select('eveniment_id, status').in('eveniment_id', evPm.map((e) => e.id))
    for (const t of data || []) {
      const p = (rezultat.progres[t.eveniment_id] ||= { total: 0, gata: 0 })
      if (t.status === 'anulat') continue
      p.total++
      if (t.status === 'terminat') p.gata++
    }
  }

  // departamentele pe care le coordonez: taskuri deschise pe fiecare membru
  const membri = gm.data || []
  const grupuriMele = (grupuri.data || []).filter((g) => g.activ && membri.some((m) => m.grup_id === g.id && m.angajat_id === me.id && m.e_coordonator))
  if (grupuriMele.length) {
    const idsMembri = [...new Set(membri.filter((m) => grupuriMele.some((g) => g.id === m.grup_id)).map((m) => m.angajat_id))]
    const { data } = await supabase.from('tsk_taskuri').select('responsabil_id, status').in('responsabil_id', idsMembri).in('status', ['de_facut', 'in_lucru'])
    const numara = {}
    for (const t of data || []) numara[t.responsabil_id] = (numara[t.responsabil_id] || 0) + 1
    rezultat.departamente = grupuriMele.map((g) => ({
      id: g.id,
      nume: g.nume,
      membri: membri
        .filter((m) => m.grup_id === g.id)
        .map((m) => ({ id: m.angajat_id, nume: rezultat.nume[m.angajat_id] || '—', nr: numara[m.angajat_id] || 0 }))
        .sort((a, b) => b.nr - a.nr),
    }))
  }
  return rezultat
}
