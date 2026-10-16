// Contraddizioni nella memoria della sessione: trovarle, farle scegliere a te, tenerle fuori dal riassunto.
// Solo funzioni pure: la chiamata al modello e i pulsanti stanno in register.tsx.
//
// Il problema: in una sessione lunga cambi idea ("usa MySQL", poi "passa a SQL Server").
// Un riassunto automatico può riportarle entrambe come valide, e da lì il modello lavora su una memoria rotta.
// La soluzione:
// 1. un innesco economico (parole come "invece", "non più", "cambia") e un controllo periodico;
// 2. un modello piccolo confronta le tue richieste e propone le contraddizioni, citandole alla lettera;
// 3. scegli tu quale vale, con un pulsante; la scelta entra subito nel contesto;
// 4. la compattazione riceve decisioni valide, superate e domande aperte, e il riassunto viene controllato.

export type Resolution = 'nuova' | 'vecchia' | 'entrambe' | 'nessuna'

export type Decision = {
  topic: string
  text: string
  status: 'valida' | 'superata'
  /** Per una decisione superata: quella che la sostituisce. */
  replacedBy?: string
}

export type Conflict = {
  id: string
  topic: string
  older: string
  newer: string
  status: 'aperta' | 'risolta'
  resolution?: Resolution
}

export type SessionMemory = {
  /** Le tue richieste, accorciate, dalla più vecchia: sopravvivono alle compattazioni. */
  history: string[]
  decisions: Decision[]
  conflicts: Conflict[]
  /** Quante richieste sono arrivate in tutto (contatore che non torna mai indietro). */
  total: number
  /** Fino a quale richiesta (nel contatore totale) il controllo è già stato fatto. */
  checked: number
  /** Note da dare al modello al prossimo messaggio (scelte appena fatte). */
  pending: string[]
}

export const EMPTY_MEMORY: SessionMemory = { history: [], decisions: [], conflicts: [], total: 0, checked: 0, pending: [] }

const MAX_HISTORY = 20
const MAX_DECISIONS = 30
const MAX_CONFLICTS = 10

const shorten = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

export const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

// ---- Storia e innesco ----

export const addToHistory = (memory: SessionMemory, request: string): SessionMemory => {
  const clean = request.trim()

  if (clean.length < 3 || clean.startsWith('/')) {
    return memory
  }

  const history = [...memory.history, shorten(clean, 240)]
  const dropped = Math.max(0, history.length - MAX_HISTORY)

  return { ...memory, history: history.slice(dropped), total: (memory.total ?? memory.history.length) + 1 }
}

// Parole che di solito annunciano un cambio di idea. Si cercano nel testo normalizzato
// (minuscole, senza accenti né punteggiatura): "Non più", "non piu'" e "NON PIÙ" sono la stessa cosa.
const CHANGE_WORDS = new RegExp(
  '(^| )(' +
    [
      'invece', 'anzi', 'non piu', 'cambia', 'cambiamo', 'cambiare', 'al posto di', 'al posto del', 'al posto della', 'lascia perdere', 'dimentica',
      'annulla', 'ripensandoci', 'meglio di no', 'non usare', 'smetti', 'torna a', 'tornare a',
      'instead', 'rather', 'actually', 'scratch that', 'don t use', 'do not use', 'switch to',
    ].join('|') +
    ')( |$)',
)

/** Se una richiesta sembra cambiare qualcosa detto prima: allora conviene controllare subito. */
export const looksLikeChange = (request: string): boolean => CHANGE_WORDS.test(normalize(request))

/** Le richieste non ancora controllate (al massimo quelle ancora nella storia). */
export const freshRequests = (memory: SessionMemory): string[] => {
  const count = Math.max(0, (memory.total ?? memory.history.length) - memory.checked)

  return count === 0 ? [] : memory.history.slice(-count)
}

/** Quando controllare: subito dopo una richiesta che cambia idea, altrimenti ogni 3 richieste nuove. */
export const shouldCheck = (memory: SessionMemory, isForced = false): boolean => {
  const fresh = freshRequests(memory)

  if (memory.history.length + memory.decisions.length < 2 || fresh.length === 0) {
    return false
  }

  return isForced || fresh.length >= 3 || fresh.some(looksLikeChange)
}

// ---- Richiesta al modello ----

export const CHECK_SYSTEM =
  'Sei un controllore di coerenza. Ricevi le decisioni già valide di una sessione di lavoro e le richieste ' +
  "dell'utente in ordine di tempo. Rispondi SOLO con JSON valido, senza testo prima o dopo."

/** Il testo per il modello: decisioni valide, richieste numerate, formato della risposta. */
export const checkPrompt = (memory: SessionMemory): string => {
  const valid = memory.decisions.filter(decision => decision.status === 'valida')

  return [
    'Decisioni già valide:',
    valid.length === 0 ? '(nessuna)' : valid.map(decision => `- [${decision.topic}] ${decision.text}`).join('\n'),
    '',
    "Richieste dell'utente, dalla più vecchia:",
    memory.history.map((request, index) => `${index + 1}. ${request}`).join('\n'),
    '',
    'Compiti:',
    '1. "decisioni": le scelte stabili espresse nelle richieste (tecnologia, struttura, vincoli, cosa non fare). Massimo 8, brevi.',
    '2. "contraddizioni": coppie in cui una richiesta più recente è incompatibile con una precedente o con una decisione valida, ' +
      'sullo stesso argomento. Un dettaglio aggiunto o una precisazione NON è una contraddizione.',
    'Per "prima" e "poi" copia alla lettera un pezzo breve (massimo 120 caratteri) del testo originale.',
    'Formato: {"decisioni":[{"tema":"...","testo":"..."}],"contraddizioni":[{"tema":"...","prima":"...","poi":"..."}]}',
    'Se non ci sono contraddizioni usa una lista vuota.',
  ].join('\n')
}

type Reply = { decisions: { topic: string; text: string }[]; conflicts: { topic: string; older: string; newer: string }[] }

const asText = (value: unknown, max: number): string => (typeof value === 'string' ? shorten(value, max) : '')

/** Legge la risposta del modello in modo tollerante: il primo oggetto JSON, campi controllati, liste limitate. */
export const parseReply = (text: string): Reply | undefined => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')

  if (start === -1 || end <= start) {
    return undefined
  }

  try {
    const json = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    const list = (value: unknown): Record<string, unknown>[] =>
      Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null) : []

    return {
      decisions: list(json.decisioni)
        .map(item => ({ topic: asText(item.tema, 40), text: asText(item.testo, 160) }))
        .filter(item => item.topic.length > 0 && item.text.length > 0)
        .slice(0, 8),
      conflicts: list(json.contraddizioni)
        .map(item => ({ topic: asText(item.tema, 40), older: asText(item.prima, 120), newer: asText(item.poi, 120) }))
        .filter(item => item.topic.length > 0 && item.older.length > 0 && item.newer.length > 0 && normalize(item.older) !== normalize(item.newer))
        .slice(0, 5),
    }
  } catch {
    return undefined
  }
}

const conflictId = (topic: string, older: string, newer: string): string =>
  normalize(`${topic}|${older}|${newer}`).slice(0, 120)

/**
 * Unisce la risposta alla memoria. Una contraddizione già vista (aperta, risolta o ignorata) non torna;
 * una decisione su un tema già deciso e superato non ritorna valida da sola.
 */
export const mergeReply = (memory: SessionMemory, reply: Reply, seenTotal = memory.total ?? memory.history.length): SessionMemory => {
  const conflicts = [...memory.conflicts]
  const decisions = [...memory.decisions]
  const isSuperseded = (text: string) =>
    decisions.some(decision => decision.status === 'superata' && similar(decision.text, text))
  const isValid = (text: string) => decisions.some(decision => decision.status === 'valida' && similar(decision.text, text))

  for (const item of reply.conflicts) {
    // Il modello può citare la stessa coppia con parole un po' diverse: conta come già vista.
    const isKnown = conflicts.some(conflict => similar(conflict.older, item.older) && similar(conflict.newer, item.newer))
    // Già chiarita nei fatti: uno dei due testi è superato e l'altro è valido.
    const isSettled =
      (isSuperseded(item.older) && isValid(item.newer)) || (isSuperseded(item.newer) && isValid(item.older))

    if (!isKnown && !isSettled) {
      conflicts.push({ id: conflictId(item.topic, item.older, item.newer), topic: item.topic, older: item.older, newer: item.newer, status: 'aperta' })
    }
  }

  for (const item of reply.decisions) {
    // Niente doppioni riformulati, e una decisione superata non torna valida da sola.
    if (!decisions.some(decision => similar(decision.text, item.text))) {
      decisions.push({ topic: item.topic, text: item.text, status: 'valida' })
    }
  }

  // Le contraddizioni aperte restano tutte; delle risolte si tengono le più recenti.
  const open = conflicts.filter(conflict => conflict.status === 'aperta')
  const closed = conflicts.filter(conflict => conflict.status !== 'aperta').slice(-Math.max(0, MAX_CONFLICTS - open.length))
  const kept = conflicts.filter(conflict => open.includes(conflict) || closed.includes(conflict))

  return {
    ...memory,
    decisions: decisions.slice(-MAX_DECISIONS),
    conflicts: kept,
    // Solo le richieste che il modello ha visto contano come controllate: quelle arrivate durante la chiamata no.
    checked: Math.max(memory.checked, seenTotal),
  }
}

/** Due testi dicono la stessa cosa: uguali normalizzati o con quasi tutte le parole significative in comune. */
export const similar = (a: string, b: string): boolean => {
  if (normalize(a) === normalize(b)) {
    return true
  }

  // Numeri diversi (versioni, porte, anni) cambiano il senso: "MySQL 5" e "MySQL 8" non sono la stessa cosa.
  const digits = (text: string) => normalize(text).split(' ').filter(word => /\d/.test(word)).sort().join(' ')

  return digits(a) === digits(b) && overlap(a, b) >= 0.8 && overlap(b, a) >= 0.8
}

// ---- Risoluzione ----

export const openConflicts = (memory: SessionMemory): Conflict[] => memory.conflicts.filter(conflict => conflict.status === 'aperta')

const upsertDecision = (decisions: Decision[], decision: Decision): Decision[] => [
  ...decisions.filter(item => normalize(item.text) !== normalize(decision.text)),
  decision,
]

/** Applica la tua scelta: aggiorna le decisioni e prepara la nota per il modello. */
export const resolveConflict = (memory: SessionMemory, id: string, resolution: Resolution): SessionMemory => {
  const conflict = memory.conflicts.find(item => item.id === id)

  if (conflict === undefined || conflict.status !== 'aperta') {
    return memory
  }

  let decisions = memory.decisions
  let note: string | undefined

  switch (resolution) {
    case 'nuova':
      decisions = upsertDecision(decisions, { topic: conflict.topic, text: conflict.older, status: 'superata', replacedBy: conflict.newer })
      decisions = upsertDecision(decisions, { topic: conflict.topic, text: conflict.newer, status: 'valida' })
      note = `Chiarimento dell'utente su «${conflict.topic}»: vale «${conflict.newer}». «${conflict.older}» è superata: non seguirla.`
      break
    case 'vecchia':
      decisions = upsertDecision(decisions, { topic: conflict.topic, text: conflict.newer, status: 'superata', replacedBy: conflict.older })
      decisions = upsertDecision(decisions, { topic: conflict.topic, text: conflict.older, status: 'valida' })
      note = `Chiarimento dell'utente su «${conflict.topic}»: vale ancora «${conflict.older}». Ignora «${conflict.newer}».`
      break
    case 'entrambe':
      decisions = upsertDecision(decisions, { topic: conflict.topic, text: conflict.older, status: 'valida' })
      decisions = upsertDecision(decisions, { topic: conflict.topic, text: conflict.newer, status: 'valida' })
      note = `Chiarimento dell'utente su «${conflict.topic}»: valgono sia «${conflict.older}» sia «${conflict.newer}», in contesti diversi. Se non è chiaro quando vale l'una o l'altra, chiedilo.`
      break
    case 'nessuna':
      break
  }

  return {
    ...memory,
    decisions: decisions.slice(-MAX_DECISIONS),
    conflicts: memory.conflicts.map(item => (item.id === id ? { ...item, status: 'risolta', resolution } : item)),
    pending: note === undefined ? memory.pending : [...memory.pending, note],
  }
}

/** Le note da dare al modello adesso, e la memoria senza di esse. */
export const takePending = (memory: SessionMemory): [string[], SessionMemory] => [memory.pending, { ...memory, pending: [] }]

// ---- Compattazione pulita ----

/** Sezione per le istruzioni di compattazione: cosa vale, cosa è superato, cosa è ancora aperto. */
export const memoryChecklist = (memory: SessionMemory): string => {
  const valid = memory.decisions.filter(decision => decision.status === 'valida')
  const superseded = memory.decisions.filter(decision => decision.status === 'superata')
  const open = openConflicts(memory)
  const parts: string[] = []

  if (valid.length > 0) {
    parts.push(`Decisioni valide da riportare: ${valid.map(decision => `[${decision.topic}] ${decision.text}`).join('; ')}.`)
  }
  if (superseded.length > 0) {
    parts.push(
      `Decisioni SUPERATE: non riportarle come valide; al massimo scrivi "sostituita da …": ` +
        `${superseded.map(decision => `«${decision.text}»${decision.replacedBy === undefined ? '' : ` → «${decision.replacedBy}»`}`).join('; ')}.`,
    )
  }
  if (open.length > 0) {
    parts.push(
      `Contraddizioni NON ancora chiarite dall'utente: riportale come domanda aperta, senza scegliere tu: ` +
        `${open.map(conflict => `[${conflict.topic}] «${conflict.older}» oppure «${conflict.newer}»`).join('; ')}.`,
    )
  }

  return parts.join('\n')
}

const words = (text: string): string[] => normalize(text).split(' ').filter(word => word.length >= 4)

/** Quanto una frase ricopre un testo: parole significative in comune sul totale del testo. */
export const overlap = (text: string, sentence: string): number => {
  const wanted = new Set(words(text))

  if (wanted.size === 0) {
    return 0
  }

  const present = new Set(words(sentence))
  let hits = 0

  for (const word of wanted) {
    if (present.has(word)) {
      hits += 1
    }
  }

  return hits / wanted.size
}

const REPLACED_MARK = /(superat|sostituit|non (piu|più)|abbandonat|scartat|annullat|replaced|superseded|no longer|instead)/i

/** Frasi del riassunto, abbastanza fini da isolare una decisione. */
const sentences = (summary: string): string[] => summary.split(/(?<=[.!?;])\s+|\n+/).filter(part => part.trim().length > 0)

/**
 * Controllo del riassunto contro la memoria:
 * - decisioni valide che non compaiono;
 * - decisioni superate riportate come se valessero ancora (senza "superata", "sostituita", "non più").
 */
export const checkSummary = (memory: SessionMemory, summary: string): { missing: Decision[]; stale: Decision[] } => {
  const parts = sentences(summary)
  const best = (text: string) => parts.reduce<{ score: number; sentence: string }>(
    (top, sentence) => {
      const score = overlap(text, sentence)

      return score > top.score ? { score, sentence } : top
    },
    { score: 0, sentence: '' },
  )

  const missing = memory.decisions.filter(decision => decision.status === 'valida' && best(decision.text).score < 0.5)
  const stale = memory.decisions.filter(decision => {
    if (decision.status !== 'superata') {
      return false
    }

    const match = best(decision.text)

    return match.score >= 0.6 && !REPLACED_MARK.test(match.sentence)
  })

  return { missing, stale }
}

/** Nota di continuità per il modello dopo la compattazione, solo se serve. */
export const memoryRecoveryNote = (result: { missing: Decision[]; stale: Decision[] }, memory: SessionMemory): string | undefined => {
  const lines: string[] = []

  for (const decision of result.stale) {
    lines.push(`- ATTENZIONE: «${decision.text}» è superata${decision.replacedBy === undefined ? '' : ` da «${decision.replacedBy}»`}. Non seguirla.`)
  }
  for (const decision of result.missing) {
    lines.push(`- Decisione ancora valida: [${decision.topic}] ${decision.text}`)
  }
  for (const conflict of openConflicts(memory)) {
    lines.push(`- Da chiarire con l'utente: [${conflict.topic}] «${conflict.older}» oppure «${conflict.newer}»?`)
  }

  return lines.length === 0 ? undefined : ['Memoria della sessione (gestione-sprint), dopo la compattazione:', ...lines].join('\n')
}
