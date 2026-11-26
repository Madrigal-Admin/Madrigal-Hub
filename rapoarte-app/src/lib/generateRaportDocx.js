import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { supabase } from '../supabaseClient'
import { numeLuna, formatData } from './luni'

function valoareExtra(camp, valoare) {
  if (valoare === undefined || valoare === null || valoare === '') return ''
  if (camp.tip === 'da_nu') return valoare === true || valoare === 'da' ? 'Da' : 'Nu'
  if (camp.tip === 'data') return formatData(valoare)
  return String(valoare)
}

/**
 * Generează documentul Word al unui raport de activitate din șablonul
 * (versiunea reținută la aprobare, altfel cea activă) și pornește descărcarea.
 * raport: rând rap_activitate; contract: rând rap_contracte; persoana: rând rap_persoane.
 */
export async function descarcaRaportWord(raport, contract, persoana, campuri) {
  // 1. sexul (din HR pentru angajați)
  const { data: sex, error: sexErr } = await supabase.rpc('rap_sex_persoana', { p_persoana: persoana.id })
  if (sexErr) throw new Error('Nu am putut citi sexul persoanei.')
  if (sex !== 'M' && sex !== 'F') {
    throw new Error(
      persoana.tip === 'angajat'
        ? `Sexul lui ${persoana.nume} nu este completat în Resurse Umane (Date HR → Date personale). Completează-l și încearcă din nou.`
        : `Sexul lui ${persoana.nume} nu este completat. Adaugă-l în Persoane și contracte.`
    )
  }

  // 1b. calitatea (Prestator / Cedent) din contract
  if (contract.calitate !== 'prestator' && contract.calitate !== 'cedent') {
    throw new Error(
      `Contractul nr. ${contract.numar_contract || '—'} al lui ${persoana.nume} nu are calitatea completată (Prestator sau Cedent). ` +
        (persoana.tip === 'angajat'
          ? 'Completeaz-o în Resurse Umane (contractul de colaborator) și încearcă din nou.'
          : 'Completeaz-o în Rapoarte → Persoane și contracte și încearcă din nou.')
    )
  }

  // 2. șablonul
  let query = supabase.from('rap_sabloane').select('*').eq('modul', 'activitate')
  query = raport.sablon_id ? query.eq('id', raport.sablon_id) : query.eq('activ', true)
  const { data: sabloane, error: sabErr } = await query.limit(1)
  if (sabErr) throw new Error('Nu am putut citi șablonul Word.')
  const sablon = sabloane?.[0]
  if (!sablon) throw new Error('Nu există niciun șablon Word încărcat. Cere Adminului general să-l încarce.')

  const zip = new PizZip(sablon.continut_base64, { base64: true })
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  })

  const date = {
    LUNA: numeLuna(raport.luna).toUpperCase(),
    AN: String(raport.an),
    luna2: numeLuna(raport.luna),
    sex_T: sex === 'M' ? 'ul' : 'a',
    nume: persoana.nume,
    tip: contract.calitate === 'cedent' ? 'Cedent' : 'Prestator',
    departament: contract.departament || '',
    NrContract: contract.numar_contract || '',
    activitati: raport.activitati || '',
    // data de pe document: cea setată de admin (dacă există), altfel data completării
    dataT: formatData(raport.data_document ? `${raport.data_document}T00:00:00` : raport.created_at),
  }
  for (const camp of campuri || []) {
    if (camp.marker) date[camp.marker] = valoareExtra(camp, raport.extra?.[camp.cod])
  }

  doc.render(date)

  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  const sigur = (persoana.nume || 'raport').replace(/[^\p{L}\p{N}]+/gu, '-')
  const nume = `raport-activitate-${sigur}-${numeLuna(raport.luna)}-${raport.an}.docx`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nume
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
