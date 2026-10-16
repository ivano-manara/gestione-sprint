// Compressione intelligente dell'output dei comandi. Solo funzioni pure.
//
// Regola d'oro: le righe importanti (errori, eccezioni, avvisi, test falliti)
// non vengono mai tolte. Si riduce solo il rumore ripetitivo.

export type CompressLevel = 'full' | 'light' | 'none'

export type CompressResult = {
  text: string
  isChanged: boolean
  linesBefore: number
  linesAfter: number
  charsSaved: number
  /** Il livello davvero applicato (dopo eventuali ripieghi). */
  level: CompressLevel
  /** Quante passate sono state scartate perché perdevano informazioni. */
  fallbacks: number
}

/** Marcatore che chiede l'output originale: `CC_RAW=1 comando`. */
export const RAW_MARKER = /(^|\s)CC_RAW=1(\s|$)/

// ---- Quale livello per quale comando ----

const commandWords = (command: string): string[] =>
  command
    .trim()
    .split(/\s+/)
    .filter(word => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word))

// Output dove ogni riga conta: mai compressi.
const NEVER = /^(git\s+(diff|show|blame|log\s+.*-p)|diff|cat|type|sed|awk|jq|yq|grep|egrep|fgrep|rg|ag|find|fd|ls|dir|tree|echo|printf|wc|stat|file|xxd|od)(\s|$)/

// Output rumorosi e ripetitivi: compressione completa.
const FULL = [
  /^php\s+artisan\s+(test|migrate|db:seed|queue:work|optimize|ide-helper)/,
  /^(\.\/)?vendor\/bin\/(phpunit|pest|paratest|phpstan|psalm|pint)/,
  /^(phpunit|pest|pytest|py\.test|tox|nox|phpstan|psalm)(\s|$)/,
  /^python3?\s+-m\s+(pytest|pip|unittest)/,
  /^(uv|poetry|pipenv|pdm|hatch)\s+(run\s+pytest|add|install|sync|lock|update)/,
  /^(pip3?|uv\s+pip)\s+install/,
  /^composer\s+(install|update|require|remove|dump-autoload|dumpautoload)/,
  /^(npm|pnpm|yarn)\s+(install|ci|i|add|update|run\s+(build|dev|test)|test|build)(\s|$)/,
  /^(npx\s+)?(vite|webpack|tsc|eslint|jest|vitest)(\s|$)/,
  /^(make|docker\s+(build|compose\s+build)|docker-compose\s+build)(\s|$)/,
  // PHP: analisi e stile; Laravel: comandi lunghi
  /^(\.\/)?vendor\/bin\/(rector|phpcs|phpcbf|php-cs-fixer|phpmd|infection)/,
  /^php\s+artisan\s+(dusk|queue:listen|horizon|schedule:run|schedule:work|test:parallel)/,
  // Python: linter e type checker, anche come modulo o tramite uv/poetry
  /^((uv|poetry|pipenv|pdm|hatch)\s+run\s+)?(python3?\s+-m\s+)?(ruff|mypy|pylint|flake8|black|isort|pyright|bandit)(\s|$)/,
  /^(uv\s+pip|pip3?)\s+(download|wheel)|^conda\s+(install|create|env\s+(create|update))/,
  // LangGraph CLI e server di sviluppo
  /^((uv|poetry)\s+run\s+)?langgraph\s+(dev|build|up|test)/,
]

/** Il livello di compressione adatto al comando (l'ultimo di una catena con && o |). */
export const levelFor = (command: string): CompressLevel => {
  if (RAW_MARKER.test(command)) {
    return 'none'
  }

  const segments = command.split(/&&|\|\||;|\|/).map(part => commandWords(part).join(' ')).filter(Boolean)
  const last = segments[segments.length - 1] ?? ''

  // Una pipe verso head/tail: l'utente ha già scelto quanto vedere.
  if (/^(head|tail)(\s|$)/.test(last)) {
    return 'light'
  }
  if (segments.some(segment => NEVER.test(segment))) {
    return 'none'
  }
  if (segments.some(segment => FULL.some(rule => rule.test(segment)))) {
    return 'full'
  }

  return 'light'
}

// ---- Riconoscimento delle righe ----

const IMPORTANT =
  /(error|exception|fail|fatal|warn|deprecat|traceback|sqlstate|panic|denied|refused|not found|undefined|uncaught|assert|expected|actual|timeout|killed|segmentation|✗|⨯|✘|×|FAILED|ERRORS?\b|risky|incomplete|skipped)/i

/** Righe che non si toccano mai. */
export const isImportant = (line: string): boolean => IMPORTANT.test(line)

// Frame di uno stack trace: PHP (#3 /path...), Collision (  12  vendor/...), Python (File "...", line 3), JS (at ...).
// Limite per le espressioni regolari: le righe più lunghe si esaminano solo nel loro inizio.
// Evita tempi quadratici su righe enormi (JSON minificato, payload), che bloccherebbero Claude Code.
export const LINE_CAP = 2000

/** L'inizio della riga che le regole esaminano. */
export const capped = (line: string): string => (line.length > LINE_CAP ? line.slice(0, LINE_CAP) : line)

const FRAME = /^\s*(#\d+\s|\d+\s{2,}\S+\.php|File\s+"[^"\n]*",\s+line\s+\d+|at\s+\S+[^\n]*[:(]\d+)/

// Anche percorsi relativi ("  1   vendor/laravel/..."), come li stampa Collision.
const LIBRARY = /((^|[\s\\/"'(])(vendor|site-packages|dist-packages|node_modules)[\\/]|[\\/]lib[\\/]python\d|<frozen\s)/

// Un frame non è mai lungo migliaia di caratteri.
export const isFrame = (line: string): boolean => line.length <= LINE_CAP && FRAME.test(line)

export const isLibraryFrame = (line: string): boolean => isFrame(line) && LIBRARY.test(line)

const isPythonFrame = (line: string): boolean => /^\s*File\s+".*",\s+line\s+\d+/.test(line)

// Righe di test superati: ✓ nome, PASS file, "test_x PASSED".
const PASSED = /^\s*(✓|✔|√|PASS\s|PASSED\s|ok\s+\d+\s)|\sPASSED(\s|$)/

export const isPassedTest = (line: string): boolean => PASSED.test(line) && !/fail/i.test(line)

/** La "forma" di una riga: i valori variabili (numeri, percorsi, orari) diventano ⋯. */
export const shapeOf = (line: string): string =>
  capped(line).replace(/\S*[\d\\/.:@=#[\]()]\S*/g, '⋯').replace(/\s+/g, ' ').trim()

// ---- Passaggi ----

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g

/** Toglie colori e barre di avanzamento (resta l'ultimo stato di ogni riga). */
export const cleanTerminal = (text: string): string =>
  text
    .replace(ANSI, '')
    .split('\n')
    .map(line => {
      const parts = line.split('\r').filter(part => part.length > 0)

      return parts[parts.length - 1] ?? ''
    })
    .join('\n')

/** Blocchi di frame delle librerie: resta il primo, il resto diventa un conteggio. */
export const collapseLibraryFrames = (lines: readonly string[]): string[] => {
  const out: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (!isLibraryFrame(line)) {
      out.push(line)
      index += 1
      continue
    }

    // Un blocco di frame di libreria consecutivi (in Python ogni frame ha la riga di codice sotto).
    const start = index
    let frames = 0

    while (index < lines.length && isLibraryFrame(lines[index] ?? '')) {
      const python = isPythonFrame(lines[index] ?? '')
      frames += 1
      index += 1

      if (python && index < lines.length && /^\s{4,}\S/.test(lines[index] ?? '') && !isFrame(lines[index] ?? '')) {
        index += 1
      }
    }

    const first = lines[start] ?? ''
    out.push(first)

    // Riga di codice del primo frame Python
    if (isPythonFrame(first) && /^\s{4,}\S/.test(lines[start + 1] ?? '') && !isFrame(lines[start + 1] ?? '')) {
      out.push(lines[start + 1] ?? '')
    }
    if (frames > 1) {
      const indent = first.match(/^\s*/)?.[0] ?? ''
      out.push(`${indent}… ${frames - 1} frame di librerie omessi`)
    }
  }

  return out
}

/** Righe identiche consecutive: una sola, con il conteggio. */
export const collapseDuplicates = (lines: readonly string[]): string[] => {
  const out: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    let count = 1

    while (index + count < lines.length && lines[index + count] === line) {
      count += 1
    }

    out.push(count > 1 && line.trim().length > 0 ? `${line} (×${count})` : line)
    index += count
  }

  return out
}

// Righe di log di basso livello: INFO, DEBUG, NOTICE (Laravel "local.INFO:", Python "INFO ...").
const LOW_LEVEL_LOG = /(\.(INFO|DEBUG|NOTICE):|^\s*(\[[^\]]*\]\s*)?(INFO|DEBUG)\b|\s(INFO|DEBUG)\s*[:\]-])/

export const isLowLevelLog = (line: string): boolean => LOW_LEVEL_LOG.test(line)

// Righe di pip e uv che cambiano solo nel nome del pacchetto.
const FAMILIES =
  /^\s*(Requirement already satisfied|Collecting|Downloading|Using cached|Obtaining|Building wheels? for|Created wheel for|Stored in directory|Attempting uninstall|Found existing installation|Uninstalling|Successfully uninstalled|Preparing metadata|Getting requirements|Installing build dependencies|Resolved|Prepared|Audited)\b/

export const familyOf = (line: string): string | undefined => {
  const match = line.match(FAMILIES)

  return match === null ? undefined : `§${match[1]}`
}

/**
 * Sequenze di righe della stessa forma (log INFO, "Installing …", test superati).
 * `eligible` limita quali righe si possono raggruppare.
 */
export const collapseSimilar = (
  lines: readonly string[],
  minRun = 5,
  eligible: (line: string) => boolean = () => true,
): string[] => {
  const out: string[] = []
  let index = 0

  const keyOf = (line: string): string | undefined => {
    if (line.trim().length === 0 || isImportant(line) || isFrame(line) || !eligible(line)) {
      return undefined
    }

    return isPassedTest(line) ? '§passed' : (familyOf(line) ?? shapeOf(line))
  }

  while (index < lines.length) {
    const key = keyOf(lines[index] ?? '')

    if (key === undefined) {
      out.push(lines[index] ?? '')
      index += 1
      continue
    }

    let end = index + 1

    while (end < lines.length && keyOf(lines[end] ?? '') === key) {
      end += 1
    }

    const run = end - index

    if (run >= minRun) {
      const what = key === '§passed' ? 'test superati omessi' : 'righe simili omesse'
      out.push(lines[index] ?? '', lines[index + 1] ?? '', `  … ${run - 3} ${what}`, lines[end - 1] ?? '')
    } else {
      out.push(...lines.slice(index, end))
    }

    index = end
  }

  return out
}

/**
 * Se è ancora troppo lungo: inizio e fine, più le righe importanti del mezzo
 * con una riga di contesto prima e dopo (spesso spiega l'errore), finché c'è spazio.
 */
export const keepHeadTail = (lines: readonly string[], maxLines: number, context = 1): string[] => {
  if (lines.length <= maxLines) {
    return [...lines]
  }

  const head = Math.floor(maxLines * 0.3)
  const tail = Math.floor(maxLines * 0.5)
  const budget = Math.max(0, maxLines - head - tail - 2)
  const from = head
  const to = lines.length - tail
  const picked = new Set<number>()

  // Prima tutte le righe importanti, poi il loro contesto se resta spazio.
  for (let index = from; index < to && picked.size < budget; index += 1) {
    if (isImportant(lines[index] ?? '')) {
      picked.add(index)
    }
  }
  for (const index of [...picked].sort((a, b) => a - b)) {
    for (let offset = -context; offset <= context; offset += 1) {
      const near = index + offset

      if (picked.size < budget && near >= from && near < to && (lines[near] ?? '').trim().length > 0) {
        picked.add(near)
      }
    }
  }

  const out = [...lines.slice(0, head)]
  let last = from - 1

  for (const index of [...picked].sort((a, b) => a - b)) {
    if (index > last + 1) {
      out.push(`  … ${index - last - 1} righe omesse`)
    }
    out.push(lines[index] ?? '')
    last = index
  }
  if (to > last + 1) {
    out.push(`  … ${to - last - 1} righe omesse`)
  }

  return [...out, ...lines.slice(to)]
}

/**
 * Righe della stessa forma sparse nell'output (log intrecciati di più richieste):
 * restano le prime due di ogni forma frequente, con il conteggio delle altre.
 * Come l'algoritmo Drain per i log, ma prudente: mai righe importanti, frame o righe vuote.
 */
export const collapseInterleaved = (
  lines: readonly string[],
  minCount = 8,
  eligible: (line: string) => boolean = () => true,
): string[] => {
  const keyOf = (line: string): string | undefined =>
    line.trim().length === 0 || isImportant(line) || isFrame(line) || !eligible(line) ? undefined : shapeOf(line)

  const counts = new Map<string, number>()

  for (const line of lines) {
    const key = keyOf(line)

    if (key !== undefined) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  const seen = new Map<string, number>()
  const out: string[] = []

  for (const line of lines) {
    const key = keyOf(line)
    const total = key === undefined ? 0 : (counts.get(key) ?? 0)

    if (key === undefined || total < minCount) {
      out.push(line)
      continue
    }

    const number = (seen.get(key) ?? 0) + 1
    seen.set(key, number)

    if (number === 1) {
      out.push(line)
    } else if (number === 2) {
      out.push(line, `  … altre ${total - 2} righe come questa, sparse nell'output`)
    }
  }

  return out
}

// ---- LangChain, LangGraph e Python scientifico ----

/** Liste lunghe di numeri (embedding, array numpy): restano i primi tre e il conteggio. */
// Un numero si legge in un solo modo e tra due numeri il separatore è obbligatorio:
// così l'espressione non può esplodere su una lunga sequenza di cifre.
const NUMBER = String.raw`-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?`
const NUMBER_LIST = new RegExp(String.raw`\[\s*(?:${NUMBER}(?:\s*,\s*|\s+)){15,}${NUMBER}\s*\]`, 'gi')

export const foldNumberLists = (line: string): string =>
  line.replace(NUMBER_LIST, match => {
    const numbers = match.match(new RegExp(NUMBER, 'gi')) ?? []

    return `[${numbers.slice(0, 3).join(', ')}, … ${numbers.length} numeri]`
  })

/** Righe fatte solo di numeri (array stampati su più righe). */
export const isNumericLine = (line: string): boolean =>
  line.length <= LINE_CAP &&
  /^\s*\[*\s*(-?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?[\s,]+){4,}-?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?\s*\]*,?\s*$/i.test(line)

/** Fine dell'argomento che inizia in `start`: rispetta parentesi e stringhe. */
const argumentEnd = (text: string, start: number): number => {
  let depth = 0
  let quote = ''

  for (let index = start; index < text.length; index += 1) {
    const char = text[index] ?? ''

    if (quote !== '') {
      if (char === '\\') {
        index += 1
      } else if (char === quote) {
        quote = ''
      }
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
    } else if ('([{'.includes(char)) {
      depth += 1
    } else if (')]}'.includes(char)) {
      if (depth === 0) {
        return index
      }
      depth -= 1
    } else if (char === ',' && depth === 0) {
      return index
    }
  }

  return text.length
}

// Metadati che LangChain stampa in ogni messaggio e che quasi mai servono.
const NOISY_KWARGS = [
  'additional_kwargs', 'response_metadata', 'usage_metadata', 'tool_call_chunks',
  'invalid_tool_calls', 'example', 'lc_attributes',
]

/** Toglie un argomento `nome=valore` (con la virgola) da una repr Python. */
const dropKwarg = (line: string, name: string): string => {
  const pattern = new RegExp(String.raw`,?\s*\b${name}=`, 'g')
  let out = line
  let match: RegExpExecArray | null

  while ((match = pattern.exec(out)) !== null) {
    const end = argumentEnd(out, match.index + match[0].length)
    out = out.slice(0, match.index) + out.slice(end)
    pattern.lastIndex = match.index
  }

  return out
}

/** Accorcia una stringa `content='...'` troppo lunga. */
const shortenContent = (line: string, maxChars: number): string =>
  line.replace(/\bcontent=(['"])((?:\\.|(?!\1).)*)\1/g, (whole, quote: string, body: string) =>
    body.length <= maxChars
      ? whole
      : `content=${quote}${body.slice(0, maxChars)}…[+${body.length - maxChars} caratteri]${quote}`,
  )

const MESSAGE_REPR = /\b(AI|Human|System|Tool|Function|Chat)Message(Chunk)?\(|\bDocument\(/

/**
 * Messaggi LangChain stampati (AIMessage(...), Document(...)): via metadati,
 * id di esecuzione e testi molto lunghi. Contenuto e tool_calls restano.
 */
export const slimLangChainRepr = (line: string, maxContent = 600): string => {
  if (!MESSAGE_REPR.test(line)) {
    return line
  }

  let out = NOISY_KWARGS.reduce(dropKwarg, line)
  out = out.replace(/,?\s*\bid=['"](run-|lc_run-)[^'"]*['"]/g, '')
  out = out.replace(/,?\s*\bmetadata=\{\}/g, '')

  return shortenContent(out, maxContent).replace(/\(\s*,\s*/g, '(')
}

const TRACE_HEADER = /^\s*\[(chain|llm|tool|retriever|parser|prompt)\/(start|end|error)\]/

/**
 * Tracciati di `set_debug(True)` di LangChain: ogni passo stampa un blocco JSON enorme.
 * I blocchi lunghi restano con inizio e fine; quelli di errore restano interi.
 */
export const truncateTraceBlocks = (lines: readonly string[], maxBlock = 24): string[] => {
  const out: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    out.push(line)
    index += 1

    const header = line.match(TRACE_HEADER)

    if (header === null || header[2] === 'error' || !/^\s*\{/.test(lines[index] ?? '')) {
      continue
    }

    const start = index

    while (index < lines.length && !TRACE_HEADER.test(lines[index] ?? '')) {
      index += 1
      if (/^\}\s*$/.test(lines[index - 1] ?? '')) {
        break
      }
    }

    const block = lines.slice(start, index)

    if (block.length <= maxBlock) {
      out.push(...block)
    } else {
      const important = block.slice(10, -3).filter(isImportant).slice(0, 10)
      out.push(...block.slice(0, 10), `    … ${block.length - 13 - important.length} righe del tracciato omesse`, ...important, ...block.slice(-3))
    }
  }

  return out
}

// ---- Righe ripetute non consecutive ----

const ERRORISH = /(error|exception|fail|fatal|traceback|sqlstate|panic|uncaught)/i
const WARNISH = /(warn|deprecat)/i

// Famiglie di avvisi che cambiano solo nel nome del pacchetto.
const WARNING_FAMILIES: readonly [RegExp, string][] = [
  [/^\s*npm\s+warn\s+deprecated\b/i, 'npm WARN deprecated'],
  [/^\s*(PHP\s+)?Deprecated:/, 'PHP Deprecated'],
  [/LangChainDeprecationWarning|LangSmithMissingAPIKeyWarning|LangChainBetaWarning/, 'LangChain warning'],
  [/PydanticDeprecatedSince\d+/, 'Pydantic deprecation'],
]

/** Chiave di un avviso: la famiglia, se nota; altrimenti la forma. */
const warningKey = (line: string): string =>
  WARNING_FAMILIES.find(([rule]) => rule.test(line))?.[1] ?? shapeOf(line)

/** Chiave di un errore: la riga esatta, senza data e ora. */
const errorKey = (line: string): string =>
  line
    .replace(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g, '⋯')
    .replace(/\b\d{2}:\d{2}:\d{2}(\.\d+)?\b/g, '⋯')
    .trim()

// Righe che accompagnano un errore ripetuto: frame, [stacktrace], chiusura del log Laravel.
const isErrorTail = (line: string): boolean =>
  isFrame(line) ||
  /^\s*\[stacktrace\]\s*$/.test(line) ||
  /^\s*#\d+\s+\{main\}/.test(line) ||
  /^\s*"\}\s*$/.test(line) ||
  /^\s*… \d+ frame di librerie omessi/.test(line)

/**
 * Lo stesso avviso ripetuto in punti diversi (pytest "warnings summary", npm, PHP Deprecated):
 * resta la prima volta con il conteggio. Lo stesso errore identico: restano le prime tre volte.
 */
export const dedupeRepeated = (lines: readonly string[], keepErrors = 3): string[] => {
  type Kind = 'warn' | 'error'

  const keyOf = (line: string): [Kind, string] | undefined => {
    if (line.trim().length < 12 || isFrame(line)) {
      return undefined
    }
    if (ERRORISH.test(line)) {
      return ['error', errorKey(line)]
    }
    if (WARNISH.test(line)) {
      return ['warn', warningKey(line)]
    }

    return undefined
  }

  const counts = new Map<string, number>()
  const lastStamp = new Map<string, string>()
  const STAMP = /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|\b\d{2}:\d{2}:\d{2}\b/

  for (const line of lines) {
    const key = keyOf(line)

    if (key !== undefined) {
      counts.set(key.join('|'), (counts.get(key.join('|')) ?? 0) + 1)
      const stamp = line.match(STAMP)?.[0]

      if (stamp !== undefined) {
        lastStamp.set(key.join('|'), stamp)
      }
    }
  }

  const seen = new Map<string, number>()
  const out: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const key = keyOf(line)
    index += 1

    if (key === undefined) {
      out.push(line)
      continue
    }

    const id = key.join('|')
    const total = counts.get(id) ?? 1
    const number = (seen.get(id) ?? 0) + 1
    seen.set(id, number)
    const keep = key[0] === 'warn' ? 1 : keepErrors

    if (number === 1) {
      // Per un errore ripetuto conta anche quando è successo l'ultima volta.
      const stamp = lastStamp.get(id)
      const last = key[0] === 'error' && stamp !== undefined && !line.includes(stamp) ? `; l'ultima alle ${stamp}` : ''
      out.push(total > keep ? `${line} [ripetuto ${total} volte${key[0] === 'warn' ? '' : `, mostrate le prime ${keep}`}${last}]` : line)
    } else if (number <= keep) {
      out.push(line)
    } else if (key[0] === 'warn') {
      // La riga "warnings.warn(...)" sotto un avviso ripetuto se ne va con lui.
      if (/^\s+warnings\.warn\(/.test(lines[index] ?? '')) {
        index += 1
      }
    } else {
      while (index < lines.length && isErrorTail(lines[index] ?? '')) {
        index += 1
      }
    }
  }

  return out
}

const looksLikeJson = (text: string): boolean => {
  const trimmed = text.trim()

  return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

/**
 * Righe enormi (JSON minificato in un log, una query lunga, un payload): restano inizio e fine.
 * Verificata come le altre: se nel mezzo c'era un errore o un riferimento al codice, si ripiega.
 */
export const truncateLongLine = (line: string, max = 2000): string =>
  line.length <= max ? line : `${line.slice(0, 1200)} …[${line.length - 1600} caratteri omessi]… ${line.slice(-400)}`

// ---- Garanzia di qualità: ancore che la compressione non può perdere ----

// Riepiloghi finali di test e analisi: la riga deve restare identica.
const SUMMARY_LINE =
  /^\s*(Tests?:\s|Assertions:|Time:|Duration:|=+.*\b(passed|failed|errors?)\b.*=+\s*$|\d+ (passed|failed)\b|FAILURES!|ERRORS!|OK \(\d+ tests?|Ran \d+ tests?|Found \d+ errors?|\[OK\]|\[ERROR\] Found|Success: no issues|exit code|Process finished)/i

// Riferimenti file:riga del codice del progetto (non delle librerie).
const CODE_EXT = /\.(?:php|py|pyw|js|mjs|cjs|ts|tsx|jsx|vue|rb|go|java|kt|cs)(?::\d+|\(\d+\))/
const PY_REF = /File "([^"\n]{1,400})", line (\d+)/g

/**
 * Riferimenti file:riga del codice, in tempo lineare: si spezza la riga in parole
 * e si esamina solo la parola che contiene un'estensione di codice.
 */
export const userRefs = (line: string): string[] => {
  const text = capped(line)
  const refs: string[] = []

  for (const match of text.matchAll(PY_REF)) {
    refs.push(`${match[1]}", line ${match[2]}`)
  }
  for (const word of text.split(/[\s"'`<>,;{}[\]]+/)) {
    if (word.length > 0 && word.length <= 400) {
      const ext = word.match(CODE_EXT)

      if (ext !== null && ext.index !== undefined) {
        refs.push(word.slice(0, ext.index + ext[0].length))
      }
    }
  }

  return refs
}

// Segni aggiunti dalla compressione stessa: si tolgono prima di confrontare.
const MARKERS = /( \[ripetuto \d+ volte[^\]]*\]| \(×\d+\))+\s*$/

/** La chiave di una riga che deve sopravvivere (errore o avviso), come la usa dedupeRepeated. */
export const lineAnchor = (line: string): string | undefined => {
  const clean = line.replace(MARKERS, '')

  if (clean.trim().length < 12 || isFrame(clean)) {
    return undefined
  }
  if (ERRORISH.test(clean)) {
    return `e|${errorKey(clean)}`
  }
  if (WARNISH.test(clean)) {
    return `w|${warningKey(clean)}`
  }

  return undefined
}

/**
 * Le ancore di un testo: errori e avvisi distinti, riepiloghi, riferimenti al codice del progetto.
 * Le righe di codice sotto un frame di libreria Python vanno via con il frame: non sono ancore.
 */
export const anchorsOf = (lines: readonly string[]): { keys: Set<string>; exact: Set<string> } => {
  const keys = new Set<string>()
  const exact = new Set<string>()

  lines.forEach((line, index) => {
    const previous = lines[index - 1] ?? ''

    if (isLibraryFrame(previous) && isPythonFrame(previous) && !isFrame(line)) {
      return
    }

    const key = lineAnchor(line)

    if (key !== undefined) {
      keys.add(key)
    }
    if (SUMMARY_LINE.test(capped(line))) {
      exact.add(line.replace(MARKERS, '').trim())
    }
    if (!LIBRARY.test(line)) {
      for (const ref of userRefs(line)) {
        exact.add(ref)
      }
    }
  })

  return { keys, exact }
}

/** Le ancore del testo di partenza che mancano nel risultato: vuoto = compressione sicura. */
export const missingAnchors = (before: readonly string[], after: readonly string[]): string[] => {
  const wanted = anchorsOf(before)
  const kept = anchorsOf(after)
  const joined = after.join('\n')
  const missing = [...wanted.keys].filter(key => !kept.keys.has(key))

  for (const text of wanted.exact) {
    if (!joined.includes(text)) {
      missing.push(text)
    }
  }

  return missing
}

export type CompressOptions = { maxLines?: number }

/** Una passata di compressione a un livello, con le righe di partenza per la verifica. */
const compressOnce = (
  text: string,
  level: Exclude<CompressLevel, 'none'>,
  maxLines: number,
): { base: string[]; lines: string[] } => {
  // Trasformazioni di una riga alla volta: tolgono solo colori, metadati e liste di numeri.
  const base = cleanTerminal(text).split('\n').map(line => slimLangChainRepr(foldNumberLists(line)))

  // Passaggi che tolgono righe o parti di riga: sono questi a essere verificati.
  let lines = truncateTraceBlocks(base).map(line => truncateLongLine(line))
  lines = collapseLibraryFrames(lines)
  lines = dedupeRepeated(lines)
  lines = collapseDuplicates(lines)

  if (level === 'full') {
    lines = collapseSimilar(lines)
    lines = collapseInterleaved(lines)
    lines = keepHeadTail(lines, maxLines)
  } else {
    // Livello leggero: si raggruppano solo log INFO/DEBUG, righe di numeri e righe di pip.
    const isNoise = (line: string) => isLowLevelLog(line) || isNumericLine(line) || familyOf(line) !== undefined
    lines = collapseSimilar(lines, 5, isNoise)
    lines = collapseInterleaved(lines, 12, isLowLevelLog)
  }

  return { base, lines }
}

/**
 * Comprime un output con garanzia: se una passata perde un errore, un avviso, un riepilogo
 * o un riferimento al codice del progetto, si riprova al livello più leggero e, se serve,
 * si lascia l'originale. Lascia l'originale anche quando è breve, è JSON o il guadagno è sotto il 20%.
 */
export const compressOutput = (
  text: string,
  level: CompressLevel,
  minChars: number,
  maxLines = 400,
): CompressResult => {
  const unchanged: CompressResult = {
    text,
    isChanged: false,
    linesBefore: text.split('\n').length,
    linesAfter: text.split('\n').length,
    charsSaved: 0,
    level: 'none',
    fallbacks: 0,
  }

  if (level === 'none' || text.length < minChars || looksLikeJson(text)) {
    return unchanged
  }

  let fallbacks = 0

  for (const attempt of level === 'full' ? (['full', 'light'] as const) : (['light'] as const)) {
    const { base, lines } = compressOnce(text, attempt, maxLines)

    if (missingAnchors(base, lines).length > 0) {
      fallbacks += 1
      continue
    }

    const result = lines.join('\n')

    if (result.length > text.length * 0.8) {
      return { ...unchanged, fallbacks }
    }

    return {
      text: result,
      isChanged: true,
      linesBefore: unchanged.linesBefore,
      linesAfter: lines.length,
      charsSaved: text.length - result.length,
      level: attempt,
      fallbacks,
    }
  }

  return { ...unchanged, fallbacks }
}

/** Budget adattivo: più il contesto è pieno, meno righe si concedono a un output. */
export const budgetFor = (percent: number | undefined, minChars: number): { maxLines: number; minChars: number } =>
  percent === undefined || percent < 40
    ? { maxLines: 600, minChars }
    : percent < 70
      ? { maxLines: 400, minChars }
      : { maxLines: 250, minChars: Math.round(minChars * 0.6) }

export const compressionHeader = (result: CompressResult, rawPath?: string): string =>
  `[gestione-sprint: output compresso da ${result.linesBefore} a ${result.linesAfter} righe (verificato: ` +
  'errori, avvisi, riepiloghi e riferimenti al tuo codice sono tutti presenti). ' +
  'Ridotti frame di librerie, righe e avvisi ripetuti, metadati LangChain, liste di numeri. ' +
  (rawPath === undefined
    ? 'Per l\'output originale ripeti il comando con CC_RAW=1 davanti (non per comandi che modificano dati, come migrate).]'
    : `Originale completo in ${rawPath}: cercalo con Grep o leggilo con Read e offset/limit, senza rieseguire il comando.]`)
