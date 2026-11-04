import { PRIORITATE_DUPA_COD, STATUS_DUPA_COD } from './ui'

const data = (s) => (s ? new Date(`${s.slice(0, 10)}T00:00:00`) : '')
const dataOra = (s) => (s ? new Date(s) : '')

// Exportă în Excel exact lista primită (cu filtrele deja aplicate). `filtre` = rânduri [eticheta, valoare] pentru foaia „Filtre".
// Biblioteca Excel se încarcă doar când apeși butonul, ca să nu încetinească restul site-ului.
export async function exportaTaskuri(taskuri, ctx, filtre = [], numeFisier = 'taskuri') {
  const XLSX = await import('xlsx')
  const antet = ['Titlu', 'Status', 'Responsabil', 'Termen', 'Prioritate', 'Tag', 'Tip', 'Eveniment / Departament', 'Data eveniment', 'Colaboratori', 'Deschis de', 'Creat la', 'Terminat la', 'Document', 'Descriere']
  const randuri = taskuri.map((t) => {
    const ev = t.tip === 'eveniment' ? ctx.evMap?.[t.eveniment_id] : null
    return [
      t.titlu,
      STATUS_DUPA_COD[t.status]?.nume || t.status,
      t.responsabil_id ? ctx.nume(t.responsabil_id) : '',
      data(t.termen),
      PRIORITATE_DUPA_COD[t.prioritate]?.nume || '',
      t.tag || '',
      t.tip === 'eveniment' ? 'Eveniment' : 'Operațional',
      t.tip === 'eveniment' ? ev?.nume || '' : ctx.grupMap?.[t.grup_id]?.nume || '',
      ev ? data(ev.data) : '',
      (ctx.colabDupaTask?.[t.id] || []).map((id) => ctx.nume(id)).join(', '),
      t.creat_de ? ctx.nume(t.creat_de) : '',
      dataOra(t.created_at),
      dataOra(t.terminat_la),
      t.link_document || '',
      t.descriere || '',
    ]
  })
  const foaie = XLSX.utils.aoa_to_sheet([antet, ...randuri], { cellDates: true })
  // coloanele cu date se afișează ca zz.ll.aaaa (și se pot sorta ca date în Excel)
  const formatCol = { 3: 'dd.mm.yyyy', 8: 'dd.mm.yyyy', 11: 'dd.mm.yyyy hh:mm', 12: 'dd.mm.yyyy hh:mm' }
  randuri.forEach((_, r) => {
    for (const [c, z] of Object.entries(formatCol)) {
      const cel = foaie[XLSX.utils.encode_cell({ r: r + 1, c: +c })]
      if (cel && cel.t === 'd') cel.z = z
    }
  })
  foaie['!cols'] = [46, 12, 24, 12, 11, 16, 12, 34, 14, 30, 24, 17, 17, 30, 50].map((wch) => ({ wch }))
  foaie['!autofilter'] = { ref: foaie['!ref'] }

  const rezumat = XLSX.utils.aoa_to_sheet([
    ['Export taskuri — Hub Madrigal'],
    ['Exportat la', new Date().toLocaleString('ro-RO')],
    ['Exportat de', ctx.me?.nume_complet || ''],
    ['Număr taskuri', taskuri.length],
    [],
    ['Filtre aplicate'],
    ...(filtre.length ? filtre : [['(niciun filtru)', '']]),
  ])
  rezumat['!cols'] = [{ wch: 26 }, { wch: 40 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, foaie, 'Taskuri')
  XLSX.utils.book_append_sheet(wb, rezumat, 'Filtre')
  const zi = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${numeFisier}-${zi}.xlsx`, { cellDates: true })
}
