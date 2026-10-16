// Logica pura del piano: nessuna chiamata a $, cosi si prova con i test.

import type {
  AggiornamentoMemoria,
  Conflitto,
  Decisione,
  Domanda,
  Esigenza,
  FonteBusiness,
  Origine,
  Piano,
  Rischio,
  Sprint,
  StatoDomanda,
  StatoLavoro,
  Task,
  VoceMemoria,
} from '../../types'

export const STATI_LAVORO: readonly StatoLavoro[] = ['da-fare', 'in-corso', 'completato', 'bloccato', 'annullato']
const STATI_DOMANDA: readonly StatoDomanda[] = ['aperta', 'in-conflitto', 'risposta', 'delegata', 'superata']
const ORIGINI: readonly Origine[] = ['esistente', 'migliorato', 'nuovo']
const TIPI_MEMORIA = ['vincolo', 'convenzione', 'architettura', 'business', 'stack'] as const
const TIPI_FONTE = ['email', 'documento', 'verbale', 'ticket', 'altro'] as const
const PRIORITA = ['alta', 'media', 'bassa'] as const
const MAX_REGISTRO = 150
const STIME = [1, 2, 3, 5, 8, 13] as const

export const DOD_BASE: readonly string[] = [
  'criteri di accettazione verificati con test o comando, prova nella nota',
  'nessun test esistente rotto',
  'file originali del progetto (rif) aggiornati',
  'nessuna regola di memoria violata',
]

type Libero = Record<string, unknown>

const isOggetto = (v: unknown): v is Libero => typeof v === 'object' && v !== null && !Array.isArray(v)
const testo = (v: unknown, base = ''): string => (typeof v === 'string' ? v.trim() : base)
const opz = (v: unknown): string | undefined => testo(v) || undefined
const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(x => testo(x)).filter(x => x.length > 0) : []
const scegli = <T extends string>(v: unknown, ammessi: readonly T[], base: T): T =>
  ammessi.includes(v as T) ? (v as T) : base
const unione = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])]
const oggetti = (v: unknown): Libero[] => (Array.isArray(v) ? v.filter(isOggetto) : [])
const uguali = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

// ---------- creazione e lettura tollerante ----------

export const pianoVuoto = (nome: string, ora: string): Piano => ({
  versione: 2,
  progetto: { nome, obiettivo: '', fileLogica: [], fonti: [], dod: [...DOD_BASE] },
  aggiornato: ora,
  sprint: [],
  domande: [],
  decisioni: [],
  business: [],
  memoria: [],
  aggiornamentiMemoria: [],
  rischi: [],
  registro: [{ data: ora, testo: 'piano creato' }],
})

const leggiTask = (raw: unknown, sprintId: string, i: number): Task => {
  const r = isOggetto(raw) ? raw : {}
  return {
    id: testo(r.id, `${sprintId}-T${i + 1}`),
    titolo: testo(r.titolo, 'task senza titolo'),
    descrizione: opz(r.descrizione),
    stato: scegli(r.stato, STATI_LAVORO, 'da-fare'),
    origine: scegli(r.origine, ORIGINI, 'nuovo'),
    criteri: lista(r.criteri),
    dipendeDa: lista(r.dipendeDa),
    requisiti: lista(r.requisiti),
    rif: opz(r.rif),
    note: opz(r.note),
    stima: leggiStima(r.stima),
    vincoli: lista(r.vincoli),
    daRivedere: opz(r.daRivedere),
  }
}

const leggiStima = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? (STIME.find(x => x >= n) ?? 13) : undefined
}

const leggiAzione = (v: unknown): Domanda['azione'] => {
  if (!isOggetto(v)) return undefined
  if (v.tipo === 'voce-memoria' && testo(v.id)) return { tipo: 'voce-memoria', id: testo(v.id) }
  if (v.tipo === 'ipotesi' && testo(v.id)) return { tipo: 'ipotesi', id: testo(v.id) }
  if (v.tipo === 'impatto' && testo(v.task)) return { tipo: 'impatto', task: testo(v.task) }
  return undefined
}

const leggiSprint = (raw: unknown, i: number): Sprint => {
  const r = isOggetto(raw) ? raw : {}
  const id = testo(r.id, `S${i + 1}`)
  return {
    id,
    titolo: testo(r.titolo, `sprint ${i + 1}`),
    obiettivo: testo(r.obiettivo),
    stato: scegli(r.stato, STATI_LAVORO, 'da-fare'),
    origine: scegli(r.origine, ORIGINI, 'nuovo'),
    rif: opz(r.rif),
    task: Array.isArray(r.task) ? r.task.map((t, j) => leggiTask(t, id, j)) : [],
    chiusura: isOggetto(r.chiusura) && testo(r.chiusura.esito) ? { data: testo(r.chiusura.data), esito: testo(r.chiusura.esito) } : undefined,
  }
}

const leggiConflitto = (v: unknown): Conflitto | undefined => {
  if (!isOggetto(v) || lista(v.con).length === 0) {
    return undefined
  }
  return { con: lista(v.con), spiegazione: testo(v.spiegazione), rispostaProposta: testo(v.rispostaProposta), nuovo: opz(v.nuovo) }
}

const leggiDomanda = (raw: unknown, i: number): Domanda => {
  const r = isOggetto(raw) ? raw : {}
  const conflitto = leggiConflitto(r.conflitto)
  return {
    id: testo(r.id, `D${i + 1}`),
    testo: testo(r.testo, 'domanda senza testo'),
    perche: opz(r.perche),
    sprint: opz(r.sprint),
    task: opz(r.task),
    opzioni: lista(r.opzioni),
    raccomandata: opz(r.raccomandata),
    bloccante: r.bloccante !== false,
    tipo: conflitto || r.tipo === 'conflitto' ? 'conflitto' : 'normale',
    autore: r.autore === 'utente' ? 'utente' : 'claude',
    stato: scegli(r.stato, STATI_DOMANDA, 'aperta'),
    conflitto,
    azione: leggiAzione(r.azione),
    risposta: opz(r.risposta),
    fonte: r.fonte === 'chat' ? 'chat' : r.fonte === 'pannello' ? 'pannello' : undefined,
    rispostaIl: opz(r.rispostaIl),
  }
}

const leggiDecisione = (raw: unknown, i: number): Decisione => {
  const r = isOggetto(raw) ? raw : {}
  return {
    id: testo(r.id, `DEC${i + 1}`),
    testo: testo(r.testo),
    fonte: scegli(r.fonte, ['utente', 'memoria', 'analisi'] as const, 'analisi'),
    data: testo(r.data),
    domanda: opz(r.domanda),
    superata: r.superata === true ? true : undefined,
    confermata: r.confermata === true ? true : undefined,
  }
}

const leggiEsigenza = (raw: unknown, fonteId: string, i: number): Esigenza => {
  const r = isOggetto(raw) ? raw : {}
  return {
    id: testo(r.id, `${fonteId}-E${i + 1}`),
    testo: testo(r.testo),
    priorita: scegli(r.priorita, PRIORITA, 'media'),
    stato: r.stato === 'superata' ? 'superata' : 'valida',
  }
}

const leggiFonte = (raw: unknown, i: number): FonteBusiness => {
  const r = isOggetto(raw) ? raw : {}
  const id = testo(r.id, `F${i + 1}`)
  return {
    id,
    titolo: testo(r.titolo, `fonte ${i + 1}`),
    tipo: scegli(r.tipo, TIPI_FONTE, 'altro'),
    data: testo(r.data),
    file: testo(r.file),
    stato: r.stato === 'analizzata' ? 'analizzata' : 'da-analizzare',
    impronta: opz(r.impronta),
    sintesi: opz(r.sintesi),
    esigenze: oggetti(r.esigenze).map((e, j) => leggiEsigenza(e, id, j)).filter(e => e.testo),
  }
}

const leggiMemoria = (raw: unknown, i: number): VoceMemoria => {
  const r = isOggetto(raw) ? raw : {}
  return {
    id: testo(r.id, `M${i + 1}`),
    testo: testo(r.testo),
    fonte: testo(r.fonte, 'non indicata'),
    tipo: scegli(r.tipo, TIPI_MEMORIA, 'vincolo'),
    stato: r.stato === 'superata' ? 'superata' : r.stato === 'da-verificare' ? 'da-verificare' : 'valida',
    sostituitaDa: opz(r.sostituitaDa),
    estratto: opz(r.estratto),
    vietato: regexValida(testo(r.vietato)),
    ambito: opz(r.ambito),
  }
}

/** Un divieto si salva solo se e un'espressione regolare valida e non vuota. */
const regexValida = (v: string): string | undefined => {
  if (!v) return undefined
  try {
    new RegExp(v, 'i')
    return v
  } catch {
    return undefined
  }
}

const leggiRischio = (raw: unknown, i: number): Rischio => {
  const r = isOggetto(raw) ? raw : {}
  return {
    id: testo(r.id, `R${i + 1}`),
    testo: testo(r.testo),
    probabilita: scegli(r.probabilita, PRIORITA, 'media'),
    impatto: scegli(r.impatto, ['alto', 'medio', 'basso'] as const, 'medio'),
    mitigazione: testo(r.mitigazione),
    task: opz(r.task),
    stato: scegli(r.stato, ['aperto', 'mitigato', 'chiuso'] as const, 'aperto'),
  }
}

const leggiAggiornamento = (raw: unknown, i: number): AggiornamentoMemoria => {
  const r = isOggetto(raw) ? raw : {}
  return {
    id: testo(r.id, `U${i + 1}`),
    testo: testo(r.testo),
    file: opz(r.file),
    motivo: testo(r.motivo),
    stato: r.stato === 'applicato' ? 'applicato' : 'da-applicare',
    nota: opz(r.nota),
  }
}

/** Legge un piano da JSON qualsiasi (anche versione 1), riempiendo i campi mancanti. */
const soloTesti = (o: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(o).filter((x): x is [string, string] => typeof x[1] === 'string'))

/** Salva le impronte dei file letti in un'analisi. */
export const conImpronte = (piano: Piano, impronte: Readonly<Record<string, string>>): Piano =>
  ({ ...piano, progetto: { ...piano.progetto, impronte: { ...piano.progetto.impronte, ...impronte } } })

export const normalizza = (raw: unknown, nome: string, ora: string): Piano => {
  if (!isOggetto(raw)) {
    return pianoVuoto(nome, ora)
  }
  const p = isOggetto(raw.progetto) ? raw.progetto : {}
  return {
    versione: 2,
    progetto: {
      nome: testo(p.nome, nome),
      obiettivo: testo(p.obiettivo),
      stack: opz(p.stack),
      metodo: opz(p.metodo),
      fileLogica: lista(p.fileLogica),
      fonti: lista(p.fonti),
      dod: Array.isArray(p.dod) ? lista(p.dod) : [...DOD_BASE],
      ...(isOggetto(p.impronte) ? { impronte: soloTesti(p.impronte) } : {}),
    },
    aggiornato: testo(raw.aggiornato, ora),
    sprint: Array.isArray(raw.sprint) ? raw.sprint.map(leggiSprint) : [],
    domande: Array.isArray(raw.domande) ? raw.domande.map(leggiDomanda) : [],
    decisioni: Array.isArray(raw.decisioni) ? raw.decisioni.map(leggiDecisione).filter(d => d.testo) : [],
    business: Array.isArray(raw.business) ? raw.business.map(leggiFonte) : [],
    memoria: Array.isArray(raw.memoria) ? raw.memoria.map(leggiMemoria).filter(m => m.testo) : [],
    aggiornamentiMemoria: Array.isArray(raw.aggiornamentiMemoria)
      ? raw.aggiornamentiMemoria.map(leggiAggiornamento).filter(u => u.testo)
      : [],
    rischi: Array.isArray(raw.rischi) ? raw.rischi.map(leggiRischio).filter(x => x.testo) : [],
    registro: oggetti(raw.registro)
      .map(e => ({ data: testo(e.data), testo: testo(e.testo) }))
      .slice(-MAX_REGISTRO),
  }
}

// ---------- id ----------

export const prossimoNumero = (ids: readonly string[], prefisso: string): number => {
  const re = new RegExp(`^${prefisso.replace(/[-]/g, '\\-')}(\\d+)$`)
  const nums = ids.map(id => re.exec(id)?.[1]).filter((n): n is string => n !== undefined).map(Number)
  return (nums.length ? Math.max(...nums) : 0) + 1
}

export const nuovoIdFonte = (piano: Piano): string => `F${prossimoNumero(piano.business.map(f => f.id), 'F')}`

// ---------- voci a cui si puo contraddire ----------

export type Voce = { id: string; testo: string; tipo: 'memoria' | 'decisione' | 'esigenza' }

/** Tutto cio che una nuova risposta non deve contraddire senza che l'utente lo sappia. */
export const vociVincolanti = (piano: Piano, escludiDomanda?: string): Voce[] => [
  ...piano.memoria.filter(m => m.stato !== 'superata').map(m => ({ id: m.id, testo: m.testo, tipo: 'memoria' as const })),
  ...piano.decisioni
    .filter(d => !d.superata && (!escludiDomanda || d.domanda !== escludiDomanda))
    .map(d => ({ id: d.id, testo: d.testo, tipo: 'decisione' as const })),
  ...piano.business
    .flatMap(f => f.esigenze)
    .filter(e => e.stato === 'valida')
    .map(e => ({ id: e.id, testo: e.testo, tipo: 'esigenza' as const })),
]

export const voce = (piano: Piano, id: string): Voce | undefined => vociVincolanti(piano).find(v => v.id === id)

// ---------- modifiche dal modello: solo aggiunte e miglioramenti ----------

export type Patch = {
  progetto?: Libero
  sprint?: Libero[]
  domande?: Libero[]
  decisioni?: Libero[]
  business?: Libero[]
  memoria?: Libero[]
  rischi?: Libero[]
  annulla?: string[]
  rimuovi?: string[]
  nota?: string
}

export type Esito = { piano: Piano; cambi: string[]; rifiuti: string[] }

const conRegistro = (piano: Piano, ora: string, righe: readonly string[]): Piano => ({
  ...piano,
  aggiornato: ora,
  registro: [...piano.registro, ...righe.map(t => ({ data: ora, testo: t }))].slice(-MAX_REGISTRO),
})

const isProtetto = (o: Origine): boolean => o !== 'nuovo'

const fondiTask = (vecchio: Task, r: Libero, cambi: string[], rifiuti: string[]): Task => {
  const nuovoTitolo = testo(r.titolo)
  if (nuovoTitolo && nuovoTitolo !== vecchio.titolo && isProtetto(vecchio.origine)) {
    rifiuti.push(`${vecchio.id}: titolo esistente mantenuto`)
  }
  if (r.stato !== undefined && r.stato !== vecchio.stato) {
    rifiuti.push(`${vecchio.id}: stato solo con task_stato`)
  }
  const fuso: Task = {
    ...vecchio,
    titolo: isProtetto(vecchio.origine) || !nuovoTitolo ? vecchio.titolo : nuovoTitolo,
    descrizione: testo(r.descrizione) || vecchio.descrizione,
    note: testo(r.note) || vecchio.note,
    rif: vecchio.rif ?? opz(r.rif),
    criteri: unione(vecchio.criteri, lista(r.criteri)),
    dipendeDa: unione(vecchio.dipendeDa, lista(r.dipendeDa)),
    requisiti: unione(vecchio.requisiti, lista(r.requisiti)),
    vincoli: unione(vecchio.vincoli, lista(r.vincoli)),
    stima: leggiStima(r.stima) ?? vecchio.stima,
    daRivedere: r.rivisto === true ? undefined : vecchio.daRivedere,
  }
  if (r.rivisto === true && vecchio.daRivedere) {
    cambi.push(`${vecchio.id} rivisto`)
  }
  if (uguali(fuso, vecchio)) {
    return vecchio
  }
  cambi.push(`${vecchio.id} migliorato`)
  return { ...fuso, origine: vecchio.origine === 'esistente' ? 'migliorato' : vecchio.origine }
}

/** Stesso id a meno delle maiuscole: "s1-t1" e "S1-T1" sono lo stesso task. */
const stessoId = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase()

/**
 * Unisce le modifiche a uno sprint. altrove: id dei task degli altri sprint, con lo sprint che li contiene:
 * un task nuovo non puo prendere l'id di un task che esiste gia altrove (sarebbero due task con lo stesso id).
 */
const fondiSprint = (vecchio: Sprint, r: Libero, cambi: string[], rifiuti: string[], altrove: ReadonlyMap<string, string> = new Map()): Sprint => {
  const nuovoTitolo = testo(r.titolo)
  if (nuovoTitolo && nuovoTitolo !== vecchio.titolo && isProtetto(vecchio.origine)) {
    rifiuti.push(`${vecchio.id}: titolo esistente mantenuto`)
  }
  let task = [...vecchio.task]
  for (const rt of oggetti(r.task)) {
    const id = testo(rt.id)
    const i = id ? task.findIndex(t => stessoId(t.id, id)) : -1
    if (i >= 0) {
      task[i] = fondiTask(task[i] as Task, rt, cambi, rifiuti)
    } else {
      const sprintAltro = id ? altrove.get(id.toUpperCase()) : undefined
      if (sprintAltro) {
        rifiuti.push(`${id}: e un task di ${sprintAltro}; i task non si spostano tra sprint: aggiornalo in ${sprintAltro} o crea un task nuovo senza id`)
        continue
      }
      const nuovoId = id || `${vecchio.id}-T${prossimoNumero(task.map(t => t.id), `${vecchio.id}-T`)}`
      const t = leggiTask({ ...rt, id: nuovoId, stato: 'da-fare' }, vecchio.id, task.length)
      task = [...task, { ...t, origine: rt.origine === 'esistente' ? 'esistente' : 'nuovo' }]
      cambi.push(`${nuovoId} aggiunto`)
    }
  }
  const isTitolo = !isProtetto(vecchio.origine) && nuovoTitolo !== '' && nuovoTitolo !== vecchio.titolo
  const obiettivo = testo(r.obiettivo) || vecchio.obiettivo
  let chiusura = vecchio.chiusura
  if (isOggetto(r.chiusura) && testo(r.chiusura.esito)) {
    const tuttiFatti = task.filter(t => t.stato !== 'annullato').every(t => t.stato === 'completato')
    if (!tuttiFatti || task.length === 0) {
      rifiuti.push(`${vecchio.id}: si chiude solo uno sprint con tutti i task completati`)
    } else {
      chiusura = { data: testo(r.chiusura.data) || new Date().toISOString().slice(0, 10), esito: testo(r.chiusura.esito) }
      cambi.push(`${vecchio.id} chiuso (revisione e retrospettiva)`)
    }
  }
  if (obiettivo !== vecchio.obiettivo || isTitolo) {
    cambi.push(`${vecchio.id} migliorato`)
  }
  return {
    ...vecchio,
    titolo: isTitolo ? nuovoTitolo : vecchio.titolo,
    obiettivo,
    rif: vecchio.rif ?? opz(r.rif),
    task,
    chiusura,
    origine: vecchio.origine === 'esistente' && obiettivo !== vecchio.obiettivo ? 'migliorato' : vecchio.origine,
  }
}

const fondiDomanda = (vecchia: Domanda, r: Libero, cambi: string[], rifiuti: string[]): Domanda => {
  if (vecchia.stato !== 'aperta') {
    if (r.stato === 'superata' && vecchia.stato !== 'superata' && vecchia.stato !== 'in-conflitto') {
      cambi.push(`${vecchia.id} superata`)
      return { ...vecchia, stato: 'superata' }
    }
    rifiuti.push(`${vecchia.id}: gia decisa dall'utente`)
    return vecchia
  }
  if (r.risposta !== undefined) {
    rifiuti.push(`${vecchia.id}: la risposta la da l'utente`)
  }
  const fusa: Domanda = {
    ...vecchia,
    testo: testo(r.testo) || vecchia.testo,
    perche: testo(r.perche) || vecchia.perche,
    sprint: testo(r.sprint) || vecchia.sprint,
    task: testo(r.task) || vecchia.task,
    opzioni: unione(vecchia.opzioni, lista(r.opzioni)),
    raccomandata: testo(r.raccomandata) || vecchia.raccomandata,
    bloccante: typeof r.bloccante === 'boolean' ? r.bloccante : vecchia.bloccante,
    stato: r.stato === 'superata' ? 'superata' : 'aperta',
  }
  if (!uguali(fusa, vecchia)) {
    cambi.push(`${vecchia.id} aggiornata`)
  }
  return fusa
}

/** Unisce una modifica del modello al piano senza cancellare il lavoro gia fatto. */
export const applicaPatch = (piano: Piano, patch: Patch, ora: string): Esito => {
  const cambi: string[] = []
  const rifiuti: string[] = []
  let p: Piano = piano

  if (isOggetto(patch.progetto)) {
    const r = patch.progetto
    const progetto = {
      ...p.progetto,
      nome: testo(r.nome) || p.progetto.nome,
      obiettivo: testo(r.obiettivo) || p.progetto.obiettivo,
      stack: testo(r.stack) || p.progetto.stack,
      metodo: testo(r.metodo) || p.progetto.metodo,
      fileLogica: unione(p.progetto.fileLogica, lista(r.fileLogica)),
      fonti: unione(p.progetto.fonti, lista(r.fonti)),
      dod: unione(p.progetto.dod, lista(r.dod)),
    }
    if (!uguali(progetto, p.progetto)) {
      cambi.push('progetto aggiornato')
      p = { ...p, progetto }
    }
  }

  // memoria: solo aggiunte. Una voce valida si cambia solo con un conflitto risolto dall'utente.
  for (const rm of patch.memoria ?? []) {
    if (!isOggetto(rm)) {
      continue
    }
    const t = testo(rm.testo)
    if (testo(rm.id) && p.memoria.some(m => m.id === testo(rm.id))) {
      rifiuti.push(`${testo(rm.id)}: la memoria esistente non si modifica, crea una domanda di conflitto`)
      continue
    }
    if (!t || p.memoria.some(m => m.testo === t)) {
      continue
    }
    const id = `M${prossimoNumero(p.memoria.map(m => m.id), 'M')}`
    p = { ...p, memoria: [...p.memoria, { ...leggiMemoria({ ...rm, id, stato: 'valida' }, 0) }] }
    cambi.push(`${id} in memoria`)
    if (testo(rm.vietato) && !regexValida(testo(rm.vietato))) {
      rifiuti.push(`${id}: "vietato" non e un'espressione regolare valida (${testo(rm.vietato)}): regola salvata SENZA controllo sul codice, crea una voce nuova con l'espressione corretta`)
    }
  }

  // business: le fonti si arricchiscono con esigenze e sintesi
  for (const rb of oggetti(patch.business)) {
    const id = testo(rb.id)
    const i = p.business.findIndex(f => f.id === id)
    if (i < 0) {
      rifiuti.push(`${id || 'fonte'}: fonte non trovata (si aggiunge dal pannello o con testo)`)
      continue
    }
    const f = p.business[i] as FonteBusiness
    let esigenze = [...f.esigenze]
    for (const re of oggetti(rb.esigenze)) {
      const t = testo(re.testo)
      if (!t || esigenze.some(e => e.testo === t)) {
        continue
      }
      const eid = `${f.id}-E${prossimoNumero(esigenze.map(e => e.id), `${f.id}-E`)}`
      esigenze = [...esigenze, leggiEsigenza({ ...re, id: eid, stato: 'valida' }, f.id, 0)]
      cambi.push(`${eid} estratta`)
    }
    const nuova: FonteBusiness = {
      ...f,
      titolo: testo(rb.titolo) || f.titolo,
      tipo: scegli(rb.tipo, TIPI_FONTE, f.tipo),
      sintesi: testo(rb.sintesi) || f.sintesi,
      stato: rb.stato === 'analizzata' ? 'analizzata' : f.stato,
      esigenze,
    }
    if (!uguali(nuova, f)) {
      const business = [...p.business]
      business[i] = nuova
      p = { ...p, business }
      if (nuova.stato !== f.stato) {
        cambi.push(`${f.id} analizzata`)
      }
    }
  }

  for (const rs of oggetti(patch.sprint)) {
    const id = testo(rs.id)
    const i = id ? p.sprint.findIndex(s => stessoId(s.id, id)) : -1
    // id dei task che stanno negli altri sprint
    const altrove = new Map(p.sprint.filter((_, k) => k !== i).flatMap(s => s.task.map(t => [t.id.toUpperCase(), s.id] as const)))
    if (i >= 0) {
      const sprint = [...p.sprint]
      sprint[i] = fondiSprint(sprint[i] as Sprint, rs, cambi, rifiuti, altrove)
      p = { ...p, sprint }
    } else {
      const nuovoId = id || `S${prossimoNumero(p.sprint.map(s => s.id), 'S')}`
      const base = leggiSprint({ ...rs, id: nuovoId, task: [], stato: 'da-fare' }, p.sprint.length)
      const vuoto: Sprint = { ...base, origine: rs.origine === 'esistente' ? 'esistente' : 'nuovo' }
      cambi.push(`${nuovoId} aggiunto`)
      p = { ...p, sprint: [...p.sprint, fondiSprint(vuoto, { task: rs.task }, cambi, rifiuti, altrove)] }
    }
  }

  for (const rd of oggetti(patch.domande)) {
    const id = testo(rd.id)
    const i = id ? p.domande.findIndex(d => stessoId(d.id, id)) : -1
    if (i >= 0) {
      const domande = [...p.domande]
      domande[i] = fondiDomanda(domande[i] as Domanda, rd, cambi, rifiuti)
      p = { ...p, domande }
      continue
    }
    if (!testo(rd.testo)) {
      continue
    }
    const nuovoId = id || `D${prossimoNumero(p.domande.map(d => d.id), 'D')}`
    const con = lista(rd.conflittoCon)
    if (con.length) {
      const ignoti = con.filter(c => !voce(p, c))
      if (ignoti.length) {
        rifiuti.push(`${nuovoId}: voci di conflitto inesistenti ${ignoti.join(', ')}`)
        continue
      }
      const d = leggiDomanda(
        {
          ...rd,
          id: nuovoId,
          autore: 'claude',
          stato: 'in-conflitto',
          bloccante: true,
          conflitto: { con, spiegazione: testo(rd.perche), rispostaProposta: testo(rd.raccomandata) || testo(rd.testo) },
        },
        0,
      )
      p = { ...p, domande: [...p.domande, d] }
      cambi.push(`${nuovoId} conflitto con ${con.join(', ')}`)
      continue
    }
    const d = leggiDomanda({ ...rd, id: nuovoId, stato: 'aperta', tipo: 'normale', autore: 'claude', risposta: undefined, conflitto: undefined }, 0)
    p = { ...p, domande: [...p.domande, d] }
    cambi.push(`${nuovoId} aggiunta`)
  }

  for (const rdec of oggetti(patch.decisioni)) {
    const t = testo(rdec.testo)
    if (!t || p.decisioni.some(d => d.testo === t)) {
      continue
    }
    const id = `DEC${prossimoNumero(p.decisioni.map(d => d.id), 'DEC')}`
    const fonte = rdec.fonte === 'memoria' ? 'memoria' : 'analisi'
    p = { ...p, decisioni: [...p.decisioni, { id, testo: t, fonte, data: ora }] }
    cambi.push(`${id} registrata`)
  }

  for (const rr of oggetti(patch.rischi)) {
    const id = testo(rr.id)
    const i = id ? p.rischi.findIndex(x => x.id === id) : -1
    if (i >= 0) {
      const vecchio = p.rischi[i] as Rischio
      const nuovo = leggiRischio({ ...vecchio, ...rr, id: vecchio.id }, 0)
      if (!uguali(nuovo, vecchio)) {
        const rischi = [...p.rischi]
        rischi[i] = nuovo
        p = { ...p, rischi }
        cambi.push(`${vecchio.id} aggiornato`)
      }
    } else if (testo(rr.testo) && !p.rischi.some(x => x.testo === testo(rr.testo))) {
      const nid = `R${prossimoNumero(p.rischi.map(x => x.id), 'R')}`
      p = { ...p, rischi: [...p.rischi, leggiRischio({ ...rr, id: nid, stato: 'aperto' }, 0)] }
      cambi.push(`${nid} registrato`)
    }
  }

  for (const id of patch.annulla ?? []) {
    const r = impostaStato(p, id, 'annullato', 'annullato in pianificazione', ora, true)
    if (r.errore) {
      rifiuti.push(r.errore)
    } else {
      p = r.piano
      cambi.push(`${id} annullato`)
    }
  }

  for (const id of patch.rimuovi ?? []) {
    const sprint = p.sprint.find(s => s.id === id)
    const task = p.sprint.flatMap(s => s.task).find(t => t.id === id)
    const domanda = p.domande.find(d => d.id === id)
    const v = sprint ?? task
    if (v && v.origine !== 'nuovo') {
      rifiuti.push(`${id}: lavoro esistente, solo annulla`)
    } else if (v && v.stato !== 'da-fare') {
      rifiuti.push(`${id}: gia iniziato, solo annulla`)
    } else if (sprint) {
      p = { ...p, sprint: p.sprint.filter(s => s.id !== id) }
      cambi.push(`${id} rimosso`)
    } else if (task) {
      p = { ...p, sprint: p.sprint.map(s => ({ ...s, task: s.task.filter(t => t.id !== id) })) }
      cambi.push(`${id} rimosso`)
    } else if (domanda && domanda.stato === 'aperta') {
      p = { ...p, domande: p.domande.map(d => (d.id === id ? { ...d, stato: 'superata' as const } : d)) }
      cambi.push(`${id} superata`)
    } else {
      rifiuti.push(`${id}: non rimovibile`)
    }
  }

  const righe = [...cambi]
  if (testo(patch.nota)) {
    righe.push(`nota: ${testo(patch.nota)}`)
  }
  return { piano: righe.length ? conRegistro(ricalcolaSprint(p), ora, righe) : p, cambi, rifiuti }
}

// ---------- fonti di business ----------

/** Riconosce tipo e titolo di un testo incollato (email, verbale, documento). */
export const riconosciFonte = (raw: string): { titolo: string; tipo: FonteBusiness['tipo'] } => {
  const righe = raw.split(/\r?\n/).map(r => r.trim()).filter(Boolean)
  const oggetto = righe.map(r => /^(oggetto|subject)\s*:\s*(.+)$/i.exec(r)?.[2]).find(Boolean)
  const isEmail = oggetto !== undefined || righe.some(r => /^(da|from|a|to|inviato|sent)\s*:/i.test(r))
  const isVerbale = /verbale|riunione|meeting|minute/i.test(righe.slice(0, 3).join(' '))
  const isTicket = /^(ticket|issue|jira|bug|richiesta n)/i.test(righe[0] ?? '')
  const titolo = (oggetto ?? righe[0] ?? 'fonte senza titolo').replace(/^#+\s*/, '').slice(0, 80)
  return { titolo, tipo: isEmail ? 'email' : isVerbale ? 'verbale' : isTicket ? 'ticket' : 'documento' }
}

/** Impronta breve di un testo (spazi e maiuscole non contano). */
export const impronta = (t: string): string => {
  const s = t.toLowerCase().replace(/\s+/g, ' ').trim()
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return `${h.toString(36)}-${s.length}`
}

export const aggiungiFonte = (
  piano: Piano,
  dati: { id: string; titolo: string; tipo: FonteBusiness['tipo']; file: string; impronta?: string },
  ora: string,
): Piano =>
  conRegistro(
    { ...piano, business: [...piano.business, { ...dati, data: ora, stato: 'da-analizzare', esigenze: [] }] },
    ora,
    [`fonte ${dati.id} aggiunta (${dati.tipo})`],
  )

export type Copertura = { esigenza: Esigenza; task: string[] }

export const copertura = (piano: Piano): Copertura[] => {
  const vivi = piano.sprint.flatMap(s => s.task).filter(t => t.stato !== 'annullato')
  return piano.business
    .flatMap(f => f.esigenze)
    .filter(e => e.stato === 'valida')
    .map(e => ({ esigenza: e, task: vivi.filter(t => t.requisiti.includes(e.id)).map(t => t.id) }))
}

export const percentuale = (n: number, d: number): number => (d === 0 ? 100 : Math.round((n / d) * 100))

// ---------- stato dei task ----------

/** Lo stato di uno sprint segue i suoi task. */
export const ricalcolaSprint = (piano: Piano): Piano => ({
  ...piano,
  sprint: piano.sprint.map(s => {
    if (s.stato === 'annullato' || s.task.length === 0) {
      return s
    }
    const vivi = s.task.filter(t => t.stato !== 'annullato')
    const stato: StatoLavoro =
      vivi.length === 0
        ? 'annullato'
        : vivi.every(t => t.stato === 'completato')
        ? 'completato'
        : vivi.some(t => t.stato === 'bloccato')
          ? 'bloccato'
          : vivi.some(t => t.stato === 'in-corso' || t.stato === 'completato')
            ? 'in-corso'
            : 'da-fare'
    return stato === s.stato ? s : { ...s, stato }
  }),
})

export const impostaStato = (
  piano: Piano,
  id: string,
  stato: StatoLavoro,
  nota: string,
  ora: string,
  isAncheSprint = false,
): { piano: Piano; errore?: string } => {
  const sIndex = piano.sprint.findIndex(s => s.task.some(t => t.id === id))
  if (sIndex < 0) {
    const sprint = isAncheSprint ? piano.sprint.find(s => s.id === id) : undefined
    if (!sprint) {
      return { piano, errore: `${id}: non trovato` }
    }
    if (stato !== 'annullato' && stato !== 'bloccato') {
      return { piano, errore: `${id}: lo stato di uno sprint segue i task; su uno sprint si usa solo annullato o bloccato` }
    }
    const p = {
      ...piano,
      sprint: piano.sprint.map(s =>
        s.id === id ? { ...s, stato, task: s.task.map(t => (t.stato === 'completato' ? t : { ...t, stato })) } : s,
      ),
    }
    return { piano: conRegistro(p, ora, [`${id}: ${stato}${nota ? ` (${nota})` : ''}`]) }
  }
  const p = {
    ...piano,
    sprint: piano.sprint.map((s, i) =>
      i !== sIndex
        ? s
        : {
            ...s,
            task: s.task.map(t =>
              t.id === id ? { ...t, stato, note: nota ? [t.note, nota].filter(Boolean).join(' | ') : t.note } : t,
            ),
          },
    ),
  }
  return { piano: conRegistro(ricalcolaSprint(p), ora, [`${id}: ${stato}${nota ? ` (${nota})` : ''}`]) }
}

// ---------- domande e risposte dell'utente ----------

export const DELEGATA = 'decidi tu con la scelta piu sicura'

export const nuovaDomandaUtente = (
  piano: Piano,
  dati: { testo: string; sprint?: string; task?: string; bloccante: boolean },
  ora: string,
): Piano => {
  const id = `D${prossimoNumero(piano.domande.map(d => d.id), 'D')}`
  const d = leggiDomanda({ ...dati, id, autore: 'utente', stato: 'aperta' }, 0)
  return conRegistro({ ...piano, domande: [...piano.domande, d] }, ora, [`${id} aggiunta dall'utente`])
}

const testoRisposta = (d: Domanda, risposta: string): string =>
  risposta === DELEGATA && d.raccomandata ? `${d.raccomandata} (delegata a Claude)` : risposta

/**
 * Registra una risposta. Se contraddice la memoria (conflitto non vuoto) la domanda
 * passa in-conflitto: resta bloccante finche l'utente non sceglie.
 */
export const rispondi = (
  piano: Piano,
  id: string,
  risposta: string,
  fonte: 'pannello' | 'chat',
  ora: string,
  conflitto?: { con: string[]; spiegazione: string },
): { piano: Piano; errore?: string } => {
  const d = piano.domande.find(x => x.id === id)
  if (!d) {
    return { piano, errore: `${id}: domanda non trovata` }
  }
  if (d.stato === 'in-conflitto') {
    return { piano, errore: `${id}: prima scegli come risolvere il conflitto` }
  }
  const pulita = risposta.trim()
  if (!pulita) {
    return { piano, errore: 'risposta vuota' }
  }
  const finale = testoRisposta(d, pulita)
  if (conflitto && conflitto.con.length) {
    const domande = piano.domande.map(x =>
      x.id === id
        ? {
            ...x,
            stato: 'in-conflitto' as const,
            tipo: 'conflitto' as const,
            bloccante: true,
            fonte,
            conflitto: { ...conflitto, rispostaProposta: finale },
          }
        : x,
    )
    return { piano: conRegistro({ ...piano, domande }, ora, [`${id}: risposta in conflitto con ${conflitto.con.join(', ')}`]) }
  }
  const isDelegata = pulita === DELEGATA
  const domande = piano.domande.map(x =>
    x.id === id
      ? { ...x, stato: (isDelegata ? 'delegata' : 'risposta') as StatoDomanda, risposta: finale, fonte, rispostaIl: ora }
      : x,
  )
  const decId = `DEC${prossimoNumero(piano.decisioni.map(x => x.id), 'DEC')}`
  const decisioni: Decisione[] = [
    ...piano.decisioni,
    { id: decId, testo: `${d.testo} -> ${finale}`, fonte: 'utente', data: ora, domanda: id },
  ]
  const dopo = conRegistro({ ...piano, domande, decisioni }, ora, [`risposta a ${id}`])
  return { piano: d.azione ? applicaAzione(dopo, d, finale, ora) : dopo }
}

/**
 * La scelta obbligata su un conflitto. 'memoria': vale quanto gia scritto.
 * 'nuova': la nuova scelta sostituisce le voci contraddette e si prepara l'aggiornamento della memoria.
 */
export const risolviConflitto = (
  piano: Piano,
  id: string,
  scelta: 'memoria' | 'nuova',
  ora: string,
): { piano: Piano; errore?: string } => {
  const d = piano.domande.find(x => x.id === id)
  if (!d || d.stato !== 'in-conflitto' || !d.conflitto) {
    return { piano, errore: `${id}: nessun conflitto da risolvere` }
  }
  const c = d.conflitto
  const voci = c.con.map(v => voce(piano, v)).filter((v): v is Voce => v !== undefined)
  const decId = `DEC${prossimoNumero(piano.decisioni.map(x => x.id), 'DEC')}`
  if (scelta === 'memoria') {
    const risposta = voci.length ? `resta valido: ${voci.map(v => `${v.id} ${v.testo}`).join('; ')}` : 'resta valida la memoria'
    const domande = piano.domande.map(x =>
      x.id === id ? { ...x, stato: 'risposta' as const, risposta, rispostaIl: ora } : x,
    )
    const decisioni = [
      ...piano.decisioni,
      { id: decId, testo: `${d.testo} -> mantenuta la memoria (${c.con.join(', ')}), scartato: ${c.rispostaProposta}`, fonte: 'utente' as const, data: ora, domanda: id },
    ]
    let p = conRegistro({ ...piano, domande, decisioni }, ora, [`${id}: conflitto risolto, mantenuta la memoria`])
    if (c.nuovo) {
      p = scartaVoce(p, c.nuovo, decId)
    }
    return { piano: p }
  }
  const con = new Set(c.con)
  const memoria = piano.memoria.map(m => (con.has(m.id) ? { ...m, stato: 'superata' as const, sostituitaDa: decId } : m))
  const decisioni = [
    ...piano.decisioni.map(x => (con.has(x.id) ? { ...x, superata: true } : x)),
    { id: decId, testo: `${d.testo} -> ${c.rispostaProposta} (sostituisce ${c.con.join(', ')})`, fonte: 'utente' as const, data: ora, domanda: id },
  ]
  const business = piano.business.map(f => ({
    ...f,
    esigenze: f.esigenze.map(e => (con.has(e.id) ? { ...e, stato: 'superata' as const } : e)),
  }))
  let aggiornamenti = [...piano.aggiornamentiMemoria]
  for (const m of piano.memoria.filter(x => con.has(x.id) && x.fonte !== 'non indicata' && x.fonte.trim())) {
    const uid = `U${prossimoNumero(aggiornamenti.map(u => u.id), 'U')}`
    // Una voce nata da claude-mem non ha un file da correggere: la correzione si annota in claude-mem.
    const isMem = /claude-mem/i.test(m.fonte)
    aggiornamenti = [
      ...aggiornamenti,
      {
        id: uid,
        testo: isMem
          ? `annotare in claude-mem (save_memory) che "${m.testo}" non vale piu: vale "${c.rispostaProposta}"`
          : `sostituire "${m.testo}" con "${c.rispostaProposta}"`,
        ...(isMem ? {} : { file: m.fonte }),
        motivo: `scelta dell'utente su ${id} (${decId})`,
        stato: 'da-applicare',
      },
    ]
  }
  const domande = piano.domande.map(x =>
    x.id === id ? { ...x, stato: 'risposta' as const, risposta: c.rispostaProposta, rispostaIl: ora } : x,
  )
  // altri conflitti che contraddicevano solo voci ora superate: diventano domande normali da rivedere
  const superate = new Set(c.con)
  const domandeFinali = domande.map(x =>
    x.id !== id && x.stato === 'in-conflitto' && x.conflitto && x.conflitto.con.every(v => superate.has(v))
      ? {
          ...x,
          stato: 'aperta' as const,
          tipo: 'normale' as const,
          perche: `${x.perche ?? ''} (la voce contraddetta ${x.conflitto.con.join(', ')} e stata sostituita da ${decId}: verifica con la nuova scelta)`.trim(),
          opzioni: x.opzioni.length ? x.opzioni : ['si, e coerente con la nuova scelta', 'no, va cambiato'],
          conflitto: undefined,
        }
      : x,
  )
  const p = conRegistro(
    { ...piano, domande: domandeFinali, decisioni, memoria, business, aggiornamentiMemoria: aggiornamenti },
    ora,
    [`${id}: conflitto risolto, nuova scelta sostituisce ${c.con.join(', ')}`],
  )
  return { piano: applicaImpatto(p, c.con, `superate da ${decId}`, ora) }
}

/** Una voce nuova scartata dall'utente perche contraddiceva la memoria. */
const scartaVoce = (piano: Piano, id: string, decId: string): Piano => ({
  ...piano,
  memoria: piano.memoria.map(m => (m.id === id ? { ...m, stato: 'superata' as const, sostituitaDa: decId } : m)),
  decisioni: piano.decisioni.map(d => (d.id === id ? { ...d, superata: true } : d)),
  business: piano.business.map(f => ({ ...f, esigenze: f.esigenze.map(e => (e.id === id ? { ...e, stato: 'superata' as const } : e)) })),
})

export const isAffermativa = (d: Domanda, risposta: string): boolean =>
  risposta === d.opzioni[0] || /^s[iì]\b/i.test(risposta.trim())

/** Gli effetti di una risposta a una domanda generata dal mod. */
const applicaAzione = (piano: Piano, d: Domanda, risposta: string, ora: string): Piano => {
  const a = d.azione
  if (!a) return piano
  const si = isAffermativa(d, risposta)
  if (a.tipo === 'voce-memoria') {
    if (si) {
      const memoria = piano.memoria.map(m => (m.id === a.id ? { ...m, stato: 'valida' as const, estratto: undefined } : m))
      return conRegistro({ ...piano, memoria }, ora, [`${a.id} confermata dall'utente`])
    }
    const memoria = piano.memoria.map(m => (m.id === a.id ? { ...m, stato: 'superata' as const, sostituitaDa: d.id } : m))
    return applicaImpatto(conRegistro({ ...piano, memoria }, ora, [`${a.id} superata dall'utente`]), [a.id], `superata (${d.id})`, ora)
  }
  if (a.tipo === 'ipotesi') {
    return confermaIpotesi(piano, a.id, si, ora)
  }
  if (si) {
    const t = piano.sprint.flatMap(x => x.task).find(x => x.id === a.task)
    if (t && t.stato === 'completato') {
      const r = impostaStato(piano, a.task, 'da-fare', `da adeguare (${d.id})`, ora)
      return mappaTask(r.piano, a.task, x => ({ ...x, daRivedere: t.daRivedere ?? `da adeguare (${d.id})` }))
    }
  }
  return piano
}

const mappaTask = (piano: Piano, id: string, fn: (t: Task) => Task): Piano => ({
  ...piano,
  sprint: piano.sprint.map(s => ({ ...s, task: s.task.map(t => (t.id === id ? fn(t) : t)) })),
})

/**
 * Analisi d'impatto: le voci superate toccano i task che si basavano su di esse.
 * Un task gia completato riceve una domanda bloccante; uno da fare viene segnato da rivedere.
 */
export const applicaImpatto = (piano: Piano, ids: readonly string[], motivo: string, ora: string): Piano => {
  const set = new Set(ids)
  let p = piano
  for (const s of piano.sprint) {
    for (const t of s.task) {
      const tocca = [...t.vincoli, ...t.requisiti].filter(v => set.has(v))
      if (!tocca.length || t.stato === 'annullato') continue
      if (t.stato === 'completato') {
        const gia = p.domande.some(d => d.azione?.tipo === 'impatto' && d.azione.task === t.id && d.stato === 'aperta')
        if (gia) continue
        const id = `D${prossimoNumero(p.domande.map(d => d.id), 'D')}`
        const d = leggiDomanda(
          {
            id,
            testo: `${t.id} "${t.titolo}" e stato completato basandosi su ${tocca.join(', ')}, ora ${motivo}. Va adeguato?`,
            perche: 'cambio di requisito o di regola: il lavoro fatto potrebbe non essere piu coerente (analisi d impatto)',
            sprint: s.id,
            task: t.id,
            opzioni: ['si, va adeguato', 'no, resta valido cosi'],
            raccomandata: 'si, va adeguato',
            bloccante: true,
            azione: { tipo: 'impatto', task: t.id },
          },
          0,
        )
        p = { ...p, domande: [...p.domande, d] }
      } else {
        p = mappaTask(p, t.id, x => ({ ...x, daRivedere: `${tocca.join(', ')} ${motivo}` }))
      }
    }
  }
  return p === piano ? piano : conRegistro(p, ora, [`impatto di ${ids.join(', ')} sui task`])
}

/** Ipotesi di Claude: l'utente conferma o respinge. Respinta, diventa una domanda e tocca i task che la usavano. */
export const confermaIpotesi = (piano: Piano, id: string, ok: boolean, ora: string): Piano => {
  const dec = piano.decisioni.find(d => d.id === id)
  if (!dec) return piano
  if (ok) {
    const decisioni = piano.decisioni.map(d => (d.id === id ? { ...d, confermata: true } : d))
    return conRegistro({ ...piano, decisioni }, ora, [`ipotesi ${id} confermata`])
  }
  const decisioni = piano.decisioni.map(d => (d.id === id ? { ...d, superata: true } : d))
  const did = `D${prossimoNumero(piano.domande.map(d => d.id), 'D')}`
  const domanda = leggiDomanda(
    { id: did, testo: `Ipotesi respinta: "${dec.testo}". Cosa vale invece?`, perche: 'Claude aveva deciso da solo su questo punto', bloccante: true, autore: 'claude' },
    0,
  )
  const p = conRegistro({ ...piano, decisioni, domande: [...piano.domande, domanda] }, ora, [`ipotesi ${id} respinta`])
  return applicaImpatto(p, [id], 'respinta', ora)
}

export const ipotesiDaConfermare = (piano: Piano): Decisione[] =>
  piano.decisioni.filter(d => d.fonte === 'analisi' && !d.confermata && !d.superata)

/** Memoria cambiata fuori dal piano: la voce passa da verificare e nasce una domanda bloccante. */
export const segnaDaVerificare = (piano: Piano, ids: readonly string[], ora: string): Piano => {
  let p = piano
  for (const id of ids) {
    const m = p.memoria.find(x => x.id === id)
    if (!m || m.stato !== 'valida') continue
    const gia = p.domande.some(d => d.azione?.tipo === 'voce-memoria' && d.azione.id === id && d.stato === 'aperta')
    p = { ...p, memoria: p.memoria.map(x => (x.id === id ? { ...x, stato: 'da-verificare' as const } : x)) }
    if (gia) continue
    const did = `D${prossimoNumero(p.domande.map(d => d.id), 'D')}`
    const d = leggiDomanda(
      {
        id: did,
        testo: `La regola ${id} "${m.testo}" non si ritrova piu in ${m.fonte}. E ancora valida?`,
        perche: 'la memoria e cambiata fuori dal piano: i task che si basano su questa regola potrebbero rompersi',
        opzioni: ['si, resta valida', 'no, e superata'],
        raccomandata: 'si, resta valida',
        bloccante: true,
        azione: { tipo: 'voce-memoria', id },
      },
      0,
    )
    p = { ...p, domande: [...p.domande, d] }
  }
  return p === piano ? piano : conRegistro(p, ora, [`memoria da verificare: ${ids.join(', ')}`])
}

export type Nuovo = { id: string; testo: string; task?: string; sprint?: string }

/** Cio che una modifica del modello ha aggiunto: da confrontare con la memoria. */
export const testiNuovi = (prima: Piano, dopo: Piano): Nuovo[] => {
  const out: Nuovo[] = []
  const memPrima = new Set(prima.memoria.map(m => m.id))
  for (const m of dopo.memoria) if (!memPrima.has(m.id)) out.push({ id: m.id, testo: m.testo })
  const decPrima = new Set(prima.decisioni.map(d => d.id))
  for (const d of dopo.decisioni) if (!decPrima.has(d.id) && d.fonte !== 'utente') out.push({ id: d.id, testo: d.testo })
  const esPrima = new Set(prima.business.flatMap(f => f.esigenze).map(e => e.id))
  for (const e of dopo.business.flatMap(f => f.esigenze)) if (!esPrima.has(e.id)) out.push({ id: e.id, testo: e.testo })
  const taskPrima = new Map(prima.sprint.flatMap(s => s.task).map(t => [t.id, t]))
  for (const s of dopo.sprint) {
    for (const t of s.task) {
      const v = taskPrima.get(t.id)
      const nuoviCriteri = v ? t.criteri.filter(c => !v.criteri.includes(c)) : t.criteri
      const descr = !v || v.descrizione !== t.descrizione ? t.descrizione : undefined
      const parti = [!v ? t.titolo : '', descr ?? '', ...nuoviCriteri].filter(Boolean)
      if (parti.length) out.push({ id: t.id, testo: parti.join('; '), task: t.id, sprint: s.id })
    }
  }
  return out.slice(0, 30)
}

/** Trasforma i contrasti trovati in domande di conflitto (scelta obbligata). */
export const aggiungiConflitti = (
  piano: Piano,
  trovati: readonly { nuovo: Nuovo; con: string[]; spiegazione: string }[],
  ora: string,
): Piano => {
  let p = piano
  for (const c of trovati) {
    const con = c.con.filter(id => id !== c.nuovo.id && voce(p, id))
    // Un contenuto vuoto non contraddice nulla: niente domanda da decidere.
    if (!con.length || !c.nuovo.testo.trim()) continue
    const isVoce = /^(M|DEC|F)\d/.test(c.nuovo.id) && !c.nuovo.task
    const id = `D${prossimoNumero(p.domande.map(d => d.id), 'D')}`
    const d = leggiDomanda(
      {
        id,
        testo: `Nuovo ${isVoce ? c.nuovo.id : `contenuto di ${c.nuovo.id}`}: "${c.nuovo.testo.slice(0, 200)}" contraddice ${con.join(', ')}`,
        perche: c.spiegazione,
        sprint: c.nuovo.sprint,
        task: c.nuovo.task,
        bloccante: true,
        stato: 'in-conflitto',
        autore: 'claude',
        conflitto: { con, spiegazione: c.spiegazione, rispostaProposta: c.nuovo.testo.slice(0, 300), nuovo: isVoce ? c.nuovo.id : undefined },
      },
      0,
    )
    p = { ...p, domande: [...p.domande, d] }
  }
  return p === piano ? piano : conRegistro(p, ora, [`${p.domande.length - piano.domande.length} conflitti rilevati sulle modifiche`])
}

/** Regole di memoria con un divieto verificabile, violate dal testo che si sta scrivendo in un file. */
export const violazioni = (piano: Piano, file: string, contenuto: string): VoceMemoria[] => {
  const f = normalizzaPercorso(file)
  return piano.memoria.filter(m => {
    if (m.stato === 'superata' || !m.vietato) return false
    const ambiti = (m.ambito ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
    if (ambiti.length && !ambiti.some(a => (a.startsWith('.') ? f.endsWith(a) : f.includes(a)))) return false
    try {
      return new RegExp(m.vietato, 'i').test(contenuto)
    } catch {
      return false
    }
  })
}

/** Una scelta fatta dall'utente fuori dal pannello (es. in chat): entra nel piano come decisione sua. */
export const aggiungiDecisioneUtente = (piano: Piano, testo: string, ora: string): Piano => {
  const t = testo.trim()
  if (!t || piano.decisioni.some(d => d.testo === t)) return piano
  const id = `DEC${prossimoNumero(piano.decisioni.map(d => d.id), 'DEC')}`
  return conRegistro({ ...piano, decisioni: [...piano.decisioni, { id, testo: t, fonte: 'utente', data: ora }] }, ora, [`${id} dalla chat`])
}

/** Riapre una domanda (solo dal pannello, quindi per scelta dell'utente). */
export const riapri = (piano: Piano, id: string, ora: string): Piano => {
  const d = piano.domande.find(x => x.id === id)
  if (!d || d.stato === 'aperta' || d.stato === 'in-conflitto') {
    return piano
  }
  const domande = piano.domande.map(x =>
    x.id === id ? { ...x, stato: 'aperta' as const, risposta: undefined, fonte: undefined, rispostaIl: undefined } : x,
  )
  const decisioni = piano.decisioni.map(x => (x.domanda === id ? { ...x, superata: true } : x))
  return conRegistro({ ...piano, domande, decisioni }, ora, [`${id} riaperta`])
}

export const segnaAggiornamento = (piano: Piano, id: string, nota: string, ora: string): { piano: Piano; errore?: string } => {
  if (!piano.aggiornamentiMemoria.some(u => u.id === id && u.stato === 'da-applicare')) {
    return { piano, errore: `${id}: nessun aggiornamento da applicare` }
  }
  const aggiornamentiMemoria = piano.aggiornamentiMemoria.map(u =>
    u.id === id ? { ...u, stato: 'applicato' as const, nota: nota || undefined } : u,
  )
  return { piano: conRegistro({ ...piano, aggiornamentiMemoria }, ora, [`${id} applicato in memoria`]) }
}

// ---------- letture ----------

export const sprintCorrente = (piano: Piano): Sprint | undefined =>
  piano.sprint.find(s => s.stato === 'in-corso' || s.stato === 'bloccato') ??
  piano.sprint.find(s => s.stato === 'da-fare')

export const domandeAperte = (piano: Piano): Domanda[] =>
  piano.domande.filter(d => d.stato === 'aperta' || d.stato === 'in-conflitto')

/** In ordine di urgenza: conflitti, bloccanti, il resto. */
export const codaDomande = (piano: Piano): Domanda[] => {
  const peso = (d: Domanda) => (d.stato === 'in-conflitto' ? 0 : d.bloccante ? 1 : 2)
  return [...domandeAperte(piano)].sort((a, b) => peso(a) - peso(b))
}

/** Domande che fermano un task: le sue, quelle del suo sprint senza task, quelle generali. I conflitti bloccano sempre. */
export const bloccantiPer = (piano: Piano, sprintId: string | undefined, taskId?: string): Domanda[] =>
  domandeAperte(piano).filter(
    d => (d.bloccante || d.stato === 'in-conflitto') && (!d.sprint || d.sprint === sprintId) && (!d.task || d.task === taskId),
  )

export const prossimoTask = (piano: Piano): { sprint: Sprint; task: Task } | undefined => {
  const s = sprintCorrente(piano)
  if (!s) {
    return undefined
  }
  const fatti = new Set(piano.sprint.flatMap(x => x.task).filter(t => t.stato === 'completato').map(t => t.id))
  const task =
    s.task.find(t => t.stato === 'in-corso') ??
    s.task.find(t => t.stato === 'da-fare' && t.dipendeDa.every(d => fatti.has(d)))
  return task ? { sprint: s, task } : undefined
}

export type Riepilogo = {
  sprintTotali: number
  sprintFatti: number
  taskTotali: number
  taskFatti: number
  aperte: number
  bloccanti: number
  conflitti: number
  esigenze: number
  esigenzeCoperte: number
  fontiNuove: number
  memoriaDaAggiornare: number
  corrente?: Sprint
  prossimo?: Task
  bloccantiProssimo: Domanda[]
}

export const riepilogo = (piano: Piano): Riepilogo => {
  const vivi = piano.sprint.filter(s => s.stato !== 'annullato')
  const task = vivi.flatMap(s => s.task).filter(t => t.stato !== 'annullato')
  const aperte = domandeAperte(piano)
  const pt = prossimoTask(piano)
  const cop = copertura(piano)
  return {
    sprintTotali: vivi.length,
    sprintFatti: vivi.filter(s => s.stato === 'completato').length,
    taskTotali: task.length,
    taskFatti: task.filter(t => t.stato === 'completato').length,
    aperte: aperte.length,
    bloccanti: aperte.filter(d => d.bloccante || d.stato === 'in-conflitto').length,
    conflitti: aperte.filter(d => d.stato === 'in-conflitto').length,
    esigenze: cop.length,
    esigenzeCoperte: cop.filter(c => c.task.length > 0).length,
    fontiNuove: piano.business.filter(f => f.stato === 'da-analizzare').length,
    memoriaDaAggiornare: piano.aggiornamentiMemoria.filter(u => u.stato === 'da-applicare').length,
    corrente: sprintCorrente(piano),
    prossimo: pt?.task,
    bloccantiProssimo: pt ? bloccantiPer(piano, pt.sprint.id, pt.task.id) : [],
  }
}

export type Velocita = { media: number; restanti: number; sprintStimati?: number; fatti: number }

/** Velocita (punti completati per sprint chiuso o completato) e previsione degli sprint rimanenti. */
export const velocita = (piano: Piano): Velocita => {
  const punti = (t: Task) => t.stima ?? 1
  const completati = piano.sprint.filter(s => s.stato === 'completato')
  const fatti = completati.reduce((n, s) => n + s.task.filter(t => t.stato === 'completato').reduce((m, t) => m + punti(t), 0), 0)
  const media = completati.length ? Math.round((fatti / completati.length) * 10) / 10 : 0
  const restanti = piano.sprint
    .filter(s => s.stato !== 'annullato')
    .flatMap(s => s.task)
    .filter(t => t.stato !== 'completato' && t.stato !== 'annullato')
    .reduce((n, t) => n + punti(t), 0)
  return { media, restanti, fatti, sprintStimati: media > 0 && restanti > 0 ? Math.ceil(restanti / media) : undefined }
}

/** Sprint completati senza revisione e retrospettiva. */
export const sprintDaChiudere = (piano: Piano): Sprint[] => piano.sprint.filter(s => s.stato === 'completato' && !s.chiusura)

export const testoStato = (piano: Piano): string => {
  const r = riepilogo(piano)
  const parti = [`sprint ${r.corrente?.id ?? '-'} ${r.taskFatti}/${r.taskTotali}`]
  if (r.conflitti) parti.push(`${r.conflitti} conflitti`)
  if (r.bloccanti - r.conflitti) parti.push(`${r.bloccanti - r.conflitti} bloccanti`)
  if (r.fontiNuove) parti.push(`${r.fontiNuove} fonti nuove`)
  return parti.join(' · ')
}

// ---------- testi compatti per il modello (pochi token) ----------

const riga = (t: Task): string =>
  `${t.id} [${t.stato}] ${t.titolo}${t.stima ? ` pt:${t.stima}` : ''}${t.dipendeDa.length ? ` dopo:${t.dipendeDa.join(',')}` : ''}${t.requisiti.length ? ` req:${t.requisiti.join(',')}` : ''}${t.vincoli.length ? ` vincoli:${t.vincoli.join(',')}` : ''}${t.rif ? ` rif:${t.rif}` : ''}${t.daRivedere ? ` DA RIVEDERE:${t.daRivedere}` : ''}`

/**
 * Sezione del system prompt: solo regole, testo fisso. Non cambia quando cambia il piano,
 * cosi non invalida la cache del prompt (costerebbe la riscrittura di tutta la conversazione).
 */
export const sezionePrompt = (percorso: string, modo: string): string =>
  [
    `## Piano sprint (mod gestione-sprint, file ${percorso})`,
    'Lo stato aggiornato del piano arriva come contesto con i messaggi; i dettagli con piano_leggi (riepilogo, sprint, memoria, business).',
    'Regole: il piano si cambia solo con gli strumenti mcp__gestione-sprint__*; non inventare risposte, registra i dubbi come domande;',
    'se qualcosa contraddice memoria, decisioni o esigenze crea una domanda con conflittoCon e fermati; task_stato in-corso prima e completato dopo la verifica;',
    `se il piano indica un metodo del progetto aggiorna anche i file originali (rif) senza cambiarne la struttura. Sicurezza: ${modo}.`,
  ].join('\n')

/** Stato del piano in poche righe: va come contesto del messaggio, solo quando cambia. */
export const statoBreve = (piano: Piano): string => {
  const r = riepilogo(piano)
  const out = [
    `[piano sprint] ${r.taskFatti}/${r.taskTotali} task · ${r.aperte} domande (${r.bloccanti} bloccanti, ${r.conflitti} conflitti) · business coperto ${percentuale(r.esigenzeCoperte, r.esigenze)}%`,
  ]
  if (piano.progetto.metodo) out.push(`metodo del progetto: ${piano.progetto.metodo}`)
  if (r.corrente) out.push(`sprint corrente ${r.corrente.id}: ${r.corrente.titolo}`)
  if (r.prossimo) out.push(`prossimo: ${riga(r.prossimo)}${r.bloccantiProssimo.length ? ` · bloccato da ${r.bloccantiProssimo.map(d => d.id).join(',')}` : ''}`)
  if (r.memoriaDaAggiornare) out.push(`${r.memoriaDaAggiornare} aggiornamenti di memoria approvati da applicare (piano_leggi formato memoria)`)
  const daChiudere = sprintDaChiudere(piano)
  if (daChiudere.length) out.push(`sprint completati da chiudere con revisione e retrospettiva: ${daChiudere.map(x => x.id).join(', ')}`)
  const v = velocita(piano)
  if (v.media) out.push(`velocita ${v.media} punti/sprint, restano ${v.restanti} punti${v.sprintStimati ? ` (circa ${v.sprintStimati} sprint)` : ''}`)
  return out.join('\n')
}

/** Vista per il modello del solo sprint corrente: task, domande, esigenze e vincoli che servono. */
export const vistaSprint = (piano: Piano, sprintId?: string): string => {
  const s = sprintId ? piano.sprint.find(x => x.id === sprintId) : sprintCorrente(piano)
  if (!s) return 'Nessuno sprint.'
  const req = new Set(s.task.flatMap(t => t.requisiti))
  const esig = piano.business.flatMap(f => f.esigenze).filter(e => req.has(e.id))
  const dom = domandeAperte(piano).filter(d => d.sprint === s.id || s.task.some(t => t.id === d.task) || (!d.sprint && !d.task))
  const out = [`${s.id} [${s.stato}] ${s.titolo}${s.rif ? ` rif:${s.rif}` : ''}`, `obiettivo: ${s.obiettivo || '-'}`]
  for (const t of s.task) {
    out.push(`- ${riga(t)}`)
    if (t.descrizione) out.push(`  ${t.descrizione}`)
    for (const c of t.criteri) out.push(`  criterio: ${c}`)
  }
  if (esig.length) out.push('esigenze:', ...esig.map(e => `- ${e.id} (${e.priorita}${e.stato === 'superata' ? ', superata' : ''}) ${e.testo}`))
  if (dom.length) out.push('domande aperte:', ...dom.map(d => `- ${d.id}${d.stato === 'in-conflitto' ? ' CONFLITTO' : d.bloccante ? ' bloccante' : ''}${d.task ? ` ${d.task}` : ''}: ${d.testo}`))
  const vincoli = piano.memoria.filter(m => m.stato !== 'superata')
  if (vincoli.length) out.push('memoria valida:', ...vincoli.slice(0, 30).map(m => `- ${m.id}${m.stato === 'da-verificare' ? ' (da verificare)' : ''} ${m.testo}${m.vietato ? ` [vieta: ${m.vietato}]` : ''}`))
  const rischi = piano.rischi.filter(r => r.stato === 'aperto' && (!r.task || s.task.some(t => t.id === r.task)))
  if (rischi.length) out.push('rischi:', ...rischi.map(r => `- ${r.id} (${r.probabilita}/${r.impatto}) ${r.testo} -> ${r.mitigazione || 'senza mitigazione'}`))
  if (piano.progetto.dod.length) out.push(`definition of done: ${piano.progetto.dod.join('; ')}`)
  const dec = piano.decisioni.filter(d => !d.superata).slice(-15)
  if (dec.length) out.push('decisioni:', ...dec.map(d => `- ${d.id} ${d.testo}`))
  return out.join('\n')
}

export const vistaRiepilogo = (piano: Piano): string => {
  const r = riepilogo(piano)
  const out = [
    `${piano.progetto.nome}: ${piano.progetto.obiettivo || 'obiettivo da definire'}`,
    piano.progetto.metodo ? `metodo: ${piano.progetto.metodo} (${piano.progetto.fileLogica.join(', ')})` : '',
    `task ${r.taskFatti}/${r.taskTotali} · domande ${r.aperte} · conflitti ${r.conflitti} · esigenze coperte ${r.esigenzeCoperte}/${r.esigenze}`,
    ...piano.sprint.map(s => `${s.id} [${s.stato}] ${s.titolo} (${s.task.filter(t => t.stato === 'completato').length}/${s.task.length})`),
  ]
  return out.filter(Boolean).join('\n')
}

export const vistaMemoria = (piano: Piano): string => {
  const out = [
    'memoria:',
    ...piano.memoria.map(m => `- ${m.id} [${m.stato}${m.sostituitaDa ? `>${m.sostituitaDa}` : ''}] (${m.tipo}, ${m.fonte}) ${m.testo}${m.vietato ? ` [vieta: ${m.vietato}${m.ambito ? ` in ${m.ambito}` : ''}]` : ''}${m.estratto ? '' : ' [senza estratto]'}`),
    'ipotesi di Claude da confermare:',
    ...ipotesiDaConfermare(piano).map(d => `- ${d.id} ${d.testo}`),
    'rischi:',
    ...piano.rischi.map(r => `- ${r.id} [${r.stato}] (${r.probabilita}/${r.impatto}) ${r.testo} -> ${r.mitigazione || '-'}${r.task ? ` (${r.task})` : ''}`),
    'aggiornamenti da applicare (applica e poi memoria_applicata):',
    ...piano.aggiornamentiMemoria.filter(u => u.stato === 'da-applicare').map(u => `- ${u.id} ${u.file ?? ''}: ${u.testo} (${u.motivo})`),
    'decisioni:',
    ...piano.decisioni.map(d => `- ${d.id}${d.superata ? ' [superata]' : ''} (${d.fonte}) ${d.testo}`),
  ]
  return out.join('\n')
}

export const vistaBusiness = (piano: Piano): string => {
  const cop = new Map(copertura(piano).map(c => [c.esigenza.id, c.task]))
  const out: string[] = []
  for (const f of piano.business) {
    out.push(`${f.id} [${f.stato}] ${f.tipo}: ${f.titolo}${f.sintesi ? ` - ${f.sintesi}` : ''}`)
    for (const e of f.esigenze) {
      const t = cop.get(e.id) ?? []
      out.push(`- ${e.id} (${e.priorita}${e.stato === 'superata' ? ', superata' : ''}) ${e.testo} -> ${t.length ? t.join(',') : 'NON COPERTA'}`)
    }
  }
  return out.join('\n') || 'Nessuna fonte di business.'
}

export const comeMarkdown = (piano: Piano): string => {
  const r = riepilogo(piano)
  const simbolo: Record<StatoLavoro, string> = {
    'da-fare': '[ ]',
    'in-corso': '[~]',
    completato: '[x]',
    bloccato: '[!]',
    annullato: '[-]',
  }
  const out: string[] = [
    `# Piano sprint - ${piano.progetto.nome}`,
    '',
    '> Generato dal mod gestione-sprint da piano.json. Non modificarlo a mano.',
    '',
    `Obiettivo: ${piano.progetto.obiettivo || 'da definire'}`,
    piano.progetto.metodo ? `Metodo: ${piano.progetto.metodo}` : '',
    `Avanzamento: ${r.taskFatti}/${r.taskTotali} task · ${r.aperte} domande aperte · business coperto ${percentuale(r.esigenzeCoperte, r.esigenze)}%`,
    `Aggiornato: ${piano.aggiornato}`,
    '',
  ]
  for (const s of piano.sprint) {
    out.push(`## ${simbolo[s.stato]} ${s.id} - ${s.titolo}`, '', s.obiettivo ? `Obiettivo: ${s.obiettivo}` : '', '')
    for (const t of s.task) {
      out.push(`- ${simbolo[t.stato]} ${t.id} ${t.titolo}${t.requisiti.length ? ` (copre ${t.requisiti.join(', ')})` : ''}`)
      for (const c of t.criteri) out.push(`  - criterio: ${c}`)
    }
    out.push('')
  }
  out.push('## Domande aperte', '')
  const aperte = codaDomande(piano)
  if (!aperte.length) out.push('Nessuna.')
  for (const d of aperte) out.push(`- ${d.id}${d.stato === 'in-conflitto' ? ' (conflitto)' : d.bloccante ? ' (bloccante)' : ''}: ${d.testo}`)
  if (piano.business.length) {
    out.push('', '## Esigenze di business', '')
    for (const c of copertura(piano)) out.push(`- ${c.esigenza.id}: ${c.esigenza.testo} -> ${c.task.join(', ') || 'non coperta'}`)
  }
  out.push('', '## Memoria e decisioni', '')
  for (const m of piano.memoria) out.push(`- ${m.id}${m.stato === 'superata' ? ' (superata)' : ''}: ${m.testo} [${m.fonte}]`)
  for (const d of piano.decisioni) out.push(`- ${d.id}${d.superata ? ' (superata)' : ''}: ${d.testo}`)
  return out.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n') + '\n'
}

// ---------- percorsi ----------

export const unisci = (radice: string, ...parti: string[]): string => {
  const sep = radice.includes('\\') && !radice.includes('/') ? '\\' : '/'
  const pulite = parti.flatMap(p => p.split(/[\\/]+/)).filter(x => x && x !== '.')
  return [radice.replace(/[\\/]+$/, ''), ...pulite].join(sep)
}

export const nomeCartella = (radice: string): string => radice.split(/[\\/]+/).filter(Boolean).at(-1) ?? 'progetto'

export const normalizzaPercorso = (p: string): string => p.replace(/\\/g, '/').toLowerCase()

/** File di memoria del progetto: si modificano solo per applicare scelte gia approvate. */
export const isFileMemoria = (p: string): boolean => {
  const n = normalizzaPercorso(p)
  return /(^|\/)(claude|claude\.local|agents)\.md$/.test(n) || /(^|\/)(\.claude\/memory|memory-bank)\//.test(n)
}

/**
 * Dati di claude-mem (database, indici, log, porta del worker): si toccano solo con i suoi strumenti.
 * settings.json resta modificabile: e li che si regolano le sue opzioni.
 */
export const isDatiClaudeMem = (p: string): boolean => {
  const n = normalizzaPercorso(p)
  return /(^|\/)\.claude-mem\//.test(n) && !/(^|\/)\.claude-mem\/settings\.json$/.test(n)
}

/** Voce di memoria che viene dallo storico di claude-mem e non da un file. */
export const isDaClaudeMem = (fonte: string): boolean => /claude-mem/i.test(fonte)

/** Il file da modificare compare tra gli aggiornamenti di memoria approvati? (fonte "file:riga") */
export const isAggiornamentoApprovato = (piano: Piano, file: string): boolean => {
  const f = normalizzaPercorso(file)
  return piano.aggiornamentiMemoria.some(u => {
    if (u.stato !== 'da-applicare' || !u.file) return false
    const atteso = normalizzaPercorso(u.file.replace(/:\d+(-\d+)?$/, '')).replace(/^\.\//, '')
    return atteso.length > 0 && (f === atteso || f.endsWith(`/${atteso}`))
  })
}

// ---------- scritture da terminale ----------

const parole = (segmento: string): string[] =>
  (segmento.match(/"[^"]*"|'[^']*'|[^\s]+/g) ?? []).map(w => w.replace(/^(["'])(.*)\1$/, '$2'))

const SCRITTORI = new Set([
  'tee', 'rm', 'del', 'erase', 'mv', 'move', 'cp', 'copy', 'truncate', 'unlink', 'touch',
  'set-content', 'add-content', 'out-file', 'remove-item', 'move-item', 'copy-item', 'new-item', 'clear-content',
])

/**
 * I file che un comando di terminale scrive, sposta o cancella: redirezioni (> e >>),
 * tee, sed -i, perl -i, rm, mv, cp, Set-Content, Out-File e simili. Le letture non contano.
 */
const INTERPRETI = new Set(['powershell', 'pwsh', 'cmd', 'bash', 'sh', 'zsh'])

export const fileScrittiDaComando = (comando: string, profondita = 0): string[] => {
  const out: string[] = []
  for (const segmento of comando.split(/&&|\|\||[;|\n]/)) {
    const w = parole(segmento)
    for (let i = 0; i < w.length; i++) {
      const p = w[i] as string
      const red = /^\d?>{1,2}(.*)$/.exec(p)
      if (red && !p.includes('&')) {
        const bersaglio = red[1] || w[i + 1]
        if (bersaglio) out.push(bersaglio)
      }
    }
    const nome = (w[0] ?? '').split(/[\\/]/).pop()?.toLowerCase().replace(/\.exe$/, '') ?? ''
    // Un comando dentro un altro interprete (powershell -Command, cmd /c, bash -c): si analizza anche quello.
    if (INTERPRETI.has(nome)) {
      const i = w.findIndex((x, k) => k > 0 && /^(-c|-command|\/c|\/k)$/i.test(x))
      if (i > 0 && profondita < 3) {
        out.push(...fileScrittiDaComando(w.slice(i + 1).join(' '), profondita + 1))
      }
      continue
    }
    // git checkout -- file e git restore file riscrivono il file con un'altra versione.
    if (nome === 'git' && (w[1] === 'checkout' || w[1] === 'restore')) {
      const dopo = w.indexOf('--')
      const file = dopo > 0 ? w.slice(dopo + 1) : w[1] === 'restore' ? w.slice(2).filter(x => !x.startsWith('-')) : []
      out.push(...file)
      continue
    }
    const argomenti = w.slice(1).filter(x => !x.startsWith('-') && !/^\d?>/.test(x))
    const isInPlace = (nome === 'sed' || nome === 'perl') && w.some(x => /^-i/.test(x) || x === '--in-place')
    // Con cp/copy si scrive solo la destinazione (l'ultimo argomento); la sorgente resta com'e.
    const isCopia = nome === 'cp' || nome === 'copy' || nome === 'copy-item'
    if (isCopia) {
      const dest = argomenti.at(-1)
      if (dest && argomenti.length > 1) out.push(dest)
    } else if (SCRITTORI.has(nome) || isInPlace) {
      out.push(...argomenti)
    }
  }
  return out.filter(f => f && f !== '/dev/null' && f.toLowerCase() !== 'nul')
}

/** "1 conflitto", "3 conflitti". */
export const pl = (n: number, uno: string, tanti: string): string => `${n} ${n === 1 ? uno : tanti}`

export const ETICHETTA_STATO: Record<StatoLavoro, string> = {
  'da-fare': 'da fare',
  'in-corso': 'in corso',
  completato: 'completato',
  bloccato: 'bloccato',
  annullato: 'annullato',
}

export const barra = (frazione: number, larghezza: number): string => {
  const pieni = Math.round(Math.max(0, Math.min(1, frazione)) * larghezza)
  return '█'.repeat(pieni) + '░'.repeat(Math.max(0, larghezza - pieni))
}
