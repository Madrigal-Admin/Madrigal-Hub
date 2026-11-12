export const ROLE_LABELS = {
  admin: 'Admin Hub',
  secretariat: 'Secretariat',
  conducere: 'Conducere',
  angajat: 'Angajat',
}

// Înregistrează, modifică, încarcă fișiere, anulează
export const esteStaff = (rol) => rol === 'admin' || rol === 'secretariat'
// Vede toate documentele (inclusiv confidențialele)
export const veziTot = (rol) => rol === 'admin' || rol === 'secretariat' || rol === 'conducere'

export const REGISTRE = {
  intrari: {
    label: 'Intrări',
    prefix: 'INT',
    contact: 'Expeditor',
    canal: 'Canal de primire',
    resp: 'Repartizat către',
    nou: 'Înregistrare document intrat',
  },
  iesiri: {
    label: 'Ieșiri',
    prefix: 'IEȘ',
    contact: 'Destinatar',
    canal: 'Mod de transmitere',
    resp: 'Departament / persoană inițiatoare',
    nou: 'Înregistrare document ieșit',
  },
  circuit: {
    label: 'Circuit de semnare',
    prefix: 'CS',
    contact: 'Contact',
    canal: 'Canal',
    resp: 'Inițiator (persoană / departament)',
    nou: 'Document nou pentru semnare',
  },
}

const gri = 'bg-slate-100 text-slate-600'
const albastru = 'bg-sky-50 text-sky-700'
const galben = 'bg-amber-50 text-amber-700'
const verde = 'bg-emerald-50 text-emerald-700'
const anulat = 'bg-slate-100 text-slate-400 line-through'

export const STATUSURI = {
  inregistrat: { label: 'Înregistrat', clasa: gri },
  repartizat: { label: 'Repartizat', clasa: albastru },
  in_lucru: { label: 'În lucru', clasa: galben },
  solutionat: { label: 'Soluționat', clasa: verde },
  transmis: { label: 'Transmis', clasa: albastru },
  confirmat: { label: 'Confirmat de destinatar', clasa: verde },
  arhivat: { label: 'Arhivat', clasa: 'bg-violet-50 text-violet-700' },
  // Circuit de semnare (în baza de date: ciorna / in_circuit / semnat / refuzat)
  ciorna: { label: 'Ciornă', clasa: gri },
  in_circuit: { label: 'În lucru', clasa: galben },
  semnat: { label: 'Finalizat', clasa: verde },
  refuzat: { label: 'Refuzat', clasa: 'bg-rose-50 text-rose-700' },
  anulat: { label: 'Anulat', clasa: anulat },
}

// Ordinea statusurilor în fiecare registru (anularea se face separat, cu motiv)
export const FLUX = {
  intrari: ['inregistrat', 'repartizat', 'in_lucru', 'solutionat', 'arhivat'],
  iesiri: ['inregistrat', 'transmis', 'confirmat', 'arhivat'],
}

export const STARE_SEMNATAR = {
  asteapta: { label: 'Așteaptă', clasa: gri },
  primit: { label: 'Primit', clasa: galben },
  semnat: { label: 'Semnat', clasa: verde },
  refuzat: { label: 'Refuzat', clasa: 'bg-rose-50 text-rose-700' },
}

export const ORDINE_SEMNARE = {
  pe_rand: 'Pe rând (în ordinea din listă)',
  paralel: 'În paralel (în orice ordine)',
}

export const MOD_SEMNARE_SCURT = { fizica: 'Semnătură fizică', electronica: 'Semnătură electronică' }

export const MOD_SEMNARE = {
  fizica: 'Fizică (pe hârtie, se scanează)',
  electronica: 'Electronică (se încarcă fișierul semnat)',
}

export const ETICHETE_CAMPURI = {
  data_document: 'Data documentului',
  nr_document_extern: 'Nr. document primit',
  contact_id: 'Expeditor / destinatar',
  obiect: 'Obiect',
  canal_id: 'Canal / mod de transmitere',
  tip_id: 'Tip document',
  mod_semnare: 'Mod de semnare',
  resp_angajat_id: 'Persoană repartizată / inițiatoare',
  resp_grup_id: 'Departament',
  semnatar_id: 'Semnatar',
  data_transmitere: 'Data transmiterii',
  rezolutie: 'Rezoluție',
  rezolutie_data: 'Data rezoluției',
  legat_de: 'Legătură cu alt document',
  termen_raspuns: 'Termen de răspuns',
  ordine_semnare: 'Ordinea de semnare',
  locatie_hartie: 'Locația documentului',
  runda: 'Runda de semnare',
  confidential: 'Confidențial',
  status: 'Status',
  motiv_anulare: 'Motiv anulare',
  anulat_la: 'Data anulării',
  anulat_de: 'Anulat de',
}
