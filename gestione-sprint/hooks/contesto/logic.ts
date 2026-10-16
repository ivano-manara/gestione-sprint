// Funzioni pure del mod: nessun accesso a `$`, quindi facili da testare.

export type Level = 0 | 1 | 2

export const parseList = (value: string): string[] =>
  value
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(item => item.length > 0)

// I segmenti mantengono le maiuscole: "Target" o "Build" in PascalCase sono namespace PHP, non cartelle generate.
const segments = (path: string): string[] =>
  path
    .split(/[\\/]+/)
    .filter(part => part.length > 0)

// Uguale alla voce; oppure uguale senza badare alle maiuscole, purché non sia in PascalCase:
// "VENDOR" o "node_Modules" (Windows) vanno bloccati, "app/Models/Target" o "App\\Build" (namespace PHP) no.
const sameSegment = (part: string, entry: string): boolean =>
  part === entry ||
  (part.toLowerCase() === entry && (part.charAt(0) === part.charAt(0).toLowerCase() || part === part.toUpperCase()))

/**
 * Se una voce dell'elenco compare nel percorso. Tre forme:
 * - `vendor`: un segmento uguale;
 * - `storage/framework`: segmenti consecutivi;
 * - `*.egg-info`: un segmento che finisce così.
 */
const entryMatches = (parts: readonly string[], entry: string): boolean => {
  if (entry.startsWith('*')) {
    const suffix = entry.slice(1)

    return parts.some(part => part.toLowerCase().endsWith(suffix) && part.length > suffix.length)
  }

  const wanted = entry.split('/').filter(part => part.length > 0)

  return parts.some((_, start) => wanted.every((part, offset) => sameSegment(parts[start + offset] ?? '', part)))
}

/** La cartella esclusa contenuta nel percorso, se c'è. Un'esclusione (`!...`) non conta. */
export const blockedDirIn = (path: string, dirs: readonly string[]): string | undefined => {
  if (path.trim().startsWith('!')) {
    return undefined
  }

  const parts = segments(path)

  return dirs.find(dir => entryMatches(parts, dir))
}

// Comandi che leggono o cercano: per ognuno, quanti argomenti iniziali sono un pattern e non un percorso.
const SEARCH_COMMANDS: Readonly<Record<string, 'paths' | 'pattern-first' | 'find'>> = {
  ls: 'paths', dir: 'paths', tree: 'paths', du: 'paths', cat: 'paths', type: 'paths',
  head: 'paths', tail: 'paths', less: 'paths', more: 'paths', 'get-childitem': 'paths', gci: 'paths',
  grep: 'pattern-first', egrep: 'pattern-first', fgrep: 'pattern-first', rg: 'pattern-first',
  ag: 'pattern-first', fd: 'pattern-first', 'select-string': 'pattern-first',
  find: 'find',
}

const WRAPPERS = new Set(['sudo', 'time', 'nice', 'xargs', 'command', 'env'])
const EXCLUSION_MARK = /(-prune|--exclude|--exclude-dir|--ignore|--glob\s+['"]?!|-not\s|!\s*-path|-I\b)/

const unquote = (word: string): string => word.replace(/^(["'])(.*)\1$/, '$2')

const commandName = (word: string): string =>
  unquote(word).split(/[\\/]/).pop()?.toLowerCase().replace(/\.exe$/, '') ?? ''

/** I percorsi che un singolo comando (senza pipe) legge o in cui cerca. */
export const searchedPaths = (segment: string): string[] => {
  const words = segment.trim().match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  let index = 0

  // Salta assegnazioni (VAR=x) e comandi involucro (sudo, xargs) con le loro opzioni
  while (index < words.length) {
    const word = words[index] ?? ''

    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) {
      index += 1
    } else if (WRAPPERS.has(commandName(word))) {
      index += 1
      while (index < words.length && (words[index] ?? '').startsWith('-')) {
        index += 1
      }
    } else {
      break
    }
  }

  const kind = SEARCH_COMMANDS[commandName(words[index] ?? '')]

  if (kind === undefined || EXCLUSION_MARK.test(segment)) {
    return []
  }

  const args = words.slice(index + 1).map(unquote)

  if (kind === 'find') {
    const paths: string[] = []

    for (const arg of args) {
      if (arg.startsWith('-') || arg.startsWith('(') || arg.startsWith('!')) {
        break
      }
      paths.push(arg)
    }

    return paths
  }

  const positional = args.filter(arg => !arg.startsWith('-'))

  return kind === 'pattern-first' ? positional.slice(1) : positional
}

/** Cartella esclusa in cui un comando di terminale legge o cerca. */
export const blockedDirInCommand = (
  command: string,
  dirs: readonly string[],
): string | undefined => {
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    for (const path of searchedPaths(segment)) {
      const dir = blockedDirIn(path, dirs)

      if (dir !== undefined) {
        return dir
      }
    }
  }

  return undefined
}

const SKIP_SIZE = /\.(png|jpe?g|gif|webp|bmp|svg|pdf|ico)$/i

/** Immagini e PDF il lettore li gestisce a parte: non vanno limitati per byte. */
export const isSizeChecked = (path: string): boolean => !SKIP_SIZE.test(path)

export const formatTokens = (tokens: number): string =>
  tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(tokens)

export const levelOf = (percent: number, warn: number, strong: number): Level =>
  percent >= strong ? 2 : percent >= warn ? 1 : 0

export const statusText = (
  percent: number,
  tokens: number | undefined,
  window: number,
  level: Level,
): string => {
  const detail = tokens === undefined ? '' : ` (${formatTokens(tokens)}/${formatTokens(window)})`
  const hint = level === 2 ? ' - meglio una nuova sessione' : level === 1 ? ' - attenzione' : ''

  return `Contesto ${Math.round(percent)}%${detail}${hint}`
}

export const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback

// ---- Rimedi per alleggerire il contesto ----

export const REMEDY_HINT = ' Prova /alleggerisci, /peso oppure /passaggio.'

export type Row = { name: string; tokens: number }

/** Le righe più pesanti, ordinate, senza spazio libero e righe vuote. */
export const topRows = (rows: readonly Row[], count: number): Row[] =>
  rows
    .filter(row => row.tokens > 0)
    .slice()
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, count)

export const formatRows = (rows: readonly Row[]): string =>
  rows.map(row => `  - ${row.name}: ${formatTokens(row.tokens)}`).join('\n')

/** Un consiglio per ogni categoria che pesa. */
export const adviceFor = (name: string): string | undefined => {
  const key = name.toLowerCase()

  if (key.includes('message')) {
    return 'Messaggi: /alleggerisci riassume la conversazione; /passaggio prepara una sessione nuova.'
  }
  if (key.includes('mcp')) {
    return 'Strumenti MCP: disattiva i server che non usi in questo progetto.'
  }
  if (key.includes('memory') || key.includes('claude.md')) {
    return 'File di memoria: accorcia CLAUDE.md e sposta i dettagli in file letti su richiesta.'
  }
  if (key.includes('skill')) {
    return 'Skill: disattiva quelle che non usi.'
  }
  return undefined
}

export const compactSummary = (before?: number, after?: number): string =>
  before !== undefined && after !== undefined
    ? `Sessione compattata: da ${formatTokens(before)} a ${formatTokens(after)} token.`
    : 'Sessione compattata.'

export const HANDOFF_PROMPT =
  'Scrivi un riepilogo breve per ripartire in una sessione nuova, in questo formato: ' +
  'Obiettivo (1 riga). Decisioni prese (elenco). File toccati (elenco). Cosa manca (elenco). ' +
  'Massimo 15 righe. Se esiste current-feature.md, aggiornalo con lo stesso contenuto.'

/** Soglia di compattazione automatica: 0 o meno significa spenta. */
export const shouldAutoCompact = (percent: number, threshold: number, done: boolean): boolean =>
  threshold > 0 && percent >= threshold && !done
