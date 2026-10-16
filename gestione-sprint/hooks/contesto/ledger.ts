// Registro del lavoro della sessione e garanzia di continuità dopo una compattazione.
// Solo funzioni pure: il registro è un valore, ogni funzione ne restituisce uno nuovo.
//
// Idea: la compattazione è un riassunto fatto da un modello, quindi può perdere pezzi.
// Il mod tiene un registro piccolo e certo (file modificati, errori aperti, ultime richieste),
// lo passa al riassunto come elenco di punti obbligatori e, a compattazione fatta,
// controlla che ci siano. Quello che manca torna al modello come nota breve al messaggio dopo.

export type LedgerError = { command: string; line: string }

export type Ledger = {
  /** File modificati, il più recente in fondo. */
  files: string[]
  /** Errori ancora aperti: comando e prima riga d'errore. */
  errors: LedgerError[]
  /** Ultime richieste dell'utente, accorciate. */
  requests: string[]
}

export const EMPTY_LEDGER: Ledger = { files: [], errors: [], requests: [] }

const MAX_FILES = 25
const MAX_ERRORS = 5
const MAX_REQUESTS = 3

const shorten = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

/** Il comando senza variabili d'ambiente davanti e spazi in più: la chiave per riconoscerlo. */
export const commandKey = (command: string): string =>
  command
    .trim()
    .split(/\s+/)
    .filter(word => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word))
    .join(' ')

export const addFile = (ledger: Ledger, path: string): Ledger => {
  const clean = path.trim()

  return clean.length === 0
    ? ledger
    : { ...ledger, files: [...ledger.files.filter(file => file !== clean), clean].slice(-MAX_FILES) }
}

export const addFailure = (ledger: Ledger, command: string, line: string): Ledger => {
  const key = commandKey(command)
  const error = { command: shorten(key, 120), line: shorten(line, 200) }

  return { ...ledger, errors: [...ledger.errors.filter(item => item.command !== error.command), error].slice(-MAX_ERRORS) }
}

/**
 * Un comando riuscito chiude l'errore aperto dello stesso comando, e anche quelli di una sua
 * versione più ristretta: "php artisan test" che passa chiude "php artisan test --filter Iban".
 */
export const resolveCommand = (ledger: Ledger, command: string): Ledger => {
  const key = shorten(commandKey(command), 120)
  const isCovered = (failed: string) => failed === key || (key.length >= 6 && failed.startsWith(`${key} `))

  return ledger.errors.some(item => isCovered(item.command))
    ? { ...ledger, errors: ledger.errors.filter(item => !isCovered(item.command)) }
    : ledger
}

export const addRequest = (ledger: Ledger, text: string): Ledger => {
  const clean = text.trim()

  // I comandi (/peso, /alleggerisci) non sono richieste di lavoro.
  return clean.length < 3 || clean.startsWith('/')
    ? ledger
    : { ...ledger, requests: [...ledger.requests, shorten(clean, 200)].slice(-MAX_REQUESTS) }
}

export const isEmpty = (ledger: Ledger): boolean =>
  ledger.files.length === 0 && ledger.errors.length === 0 && ledger.requests.length === 0

/** La prima riga d'errore di un output: quella da ricordare. */
export const firstErrorLine = (text: string): string | undefined =>
  text
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0 && /(error|exception|fail|fatal|traceback|sqlstate|denied|not found)/i.test(line))

// ---- Compattazione: istruzioni strutturate ----

export const COMPACT_MARK = '[gestione-sprint]'

/** Struttura fissa del riassunto: sezioni sempre uguali, dettagli copiati alla lettera. */
export const COMPACT_TEMPLATE = [
  `${COMPACT_MARK} Scrivi il riassunto con queste sezioni, in quest'ordine:`,
  '1. Obiettivo e ultime richieste dell\'utente, con le sue parole.',
  '2. Decisioni prese e vincoli, ciascuno con il motivo in una riga.',
  '3. File modificati: percorso → cosa è cambiato.',
  '4. Stato: cosa funziona (test passati) ed errori ancora aperti, con il testo esatto.',
  '5. Prossimo passo concreto.',
  'Copia alla lettera nomi di file, classi, funzioni, tabelle, comandi, messaggi d\'errore e numeri: non parafrasarli.',
  'Togli output di strumenti, letture ripetute e tentativi falliti già risolti.',
].join('\n')

/** I punti che il riassunto deve contenere per forza, dal registro. */
export const ledgerChecklist = (ledger: Ledger): string => {
  const parts: string[] = []

  if (ledger.files.length > 0) {
    parts.push(`File modificati da citare tutti: ${ledger.files.join(', ')}.`)
  }
  if (ledger.errors.length > 0) {
    parts.push(`Errori aperti da riportare alla lettera: ${ledger.errors.map(item => `"${item.line}" (${item.command})`).join('; ')}.`)
  }
  if (ledger.requests.length > 0) {
    parts.push(`Ultime richieste dell'utente: ${ledger.requests.map(request => `"${request}"`).join('; ')}.`)
  }

  return parts.join('\n')
}

/** Le istruzioni complete: struttura, punti obbligatori, note del mod e dell'utente. */
export const compactInstructions = (ledger: Ledger, notes: readonly string[]): string =>
  [COMPACT_TEMPLATE, ledgerChecklist(ledger), ...notes].filter(part => part.trim().length > 0).join('\n')

// ---- Verifica dopo la compattazione ----

const normalize = (text: string): string => text.toLowerCase().replace(/[\\/]+/g, '/').replace(/\s+/g, ' ')

const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path

/** I punti del registro che il riassunto ha perso. */
export const missingFromSummary = (ledger: Ledger, summary: string): Ledger => {
  const text = normalize(summary)
  // Un errore conta come presente se ne compare l'inizio (i primi 40 caratteri significativi).
  const errorProbe = (line: string) => normalize(line).replace(/^\[[^\]]*\]\s*/, '').slice(0, 40)

  return {
    files: ledger.files.filter(file => !text.includes(normalize(baseName(file)))),
    errors: ledger.errors.filter(item => !text.includes(errorProbe(item.line))),
    // Le richieste sono parafrasate per natura: si recupera solo l'ultima, se manca del tutto.
    requests: ledger.requests.slice(-1).filter(request => !text.includes(normalize(request).slice(0, 30))),
  }
}

/** Quanti punti ha conservato il riassunto, su quanti attesi. */
export const coverage = (ledger: Ledger, missing: Ledger): { kept: number; total: number } => {
  const total = ledger.files.length + ledger.errors.length + Math.min(1, ledger.requests.length)
  const lost = missing.files.length + missing.errors.length + missing.requests.length

  return { kept: total - lost, total }
}

/** La nota di continuità per il messaggio dopo la compattazione: solo ciò che manca, breve. */
export const recoveryNote = (missing: Ledger): string | undefined => {
  if (isEmpty(missing)) {
    return undefined
  }

  const lines = ['Promemoria di continuità (gestione-sprint): il riassunto della compattazione non riportava questi punti.']

  if (missing.files.length > 0) {
    lines.push(`- File già modificati in questa sessione: ${missing.files.join(', ')}`)
  }
  for (const item of missing.errors) {
    lines.push(`- Errore ancora aperto in "${item.command}": ${item.line}`)
  }
  if (missing.requests.length > 0) {
    lines.push(`- Ultima richiesta dell'utente prima della compattazione: "${missing.requests[0]}"`)
  }

  return lines.join('\n')
}

/** Testo del riassunto dai messaggi dopo la compattazione. */
export const summaryText = (messages: readonly { text: string }[]): string =>
  messages.map(message => message.text).join('\n')
