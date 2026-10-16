// Integrazione con claude-mem (memoria persistente tra sessioni). Solo funzioni pure.
//
// Fonti verificate (docs.claude-mem.ai):
// - Strumenti MCP: search, timeline, get_observations, save_memory, smart_outline, smart_unfold.
// - Flusso consigliato a tre livelli: search (indice compatto, ~50-100 token a risultato),
//   timeline, poi get_observations solo sugli id filtrati (~500-1000 token a risultato).
// - smart_outline: simboli del file con le righe (~1-2k token); smart_unfold: un simbolo intero.
// - Impostazioni in ~/.claude-mem/settings.json: CLAUDE_MEM_CONTEXT_OBSERVATIONS (default 50),
//   CLAUDE_MEM_FILE_READ_GATE_ENABLED (default true: blocca le letture intere di codice già osservato ≥ 32 KB).

export type MemToolKey = 'search' | 'timeline' | 'get_observations' | 'save_memory' | 'smart_outline' | 'smart_unfold'

const KEYS: readonly MemToolKey[] = ['search', 'timeline', 'get_observations', 'save_memory', 'smart_outline', 'smart_unfold']

export type MemSettings = { contextObservations?: number; isReadGateOn?: boolean }

export type MemInfo = {
  isActive: boolean
  /** Il nome esatto con cui il modello chiama ogni strumento, se è stato visto. */
  tools: Partial<Record<MemToolKey, string>>
  settings: MemSettings
}

export const NO_MEM: MemInfo = { isActive: false, tools: {}, settings: {} }

const isMemName = (name: string): boolean => /claude[-_]?mem/i.test(name)

/** Gli strumenti di claude-mem tra quelli del modello, con il loro nome completo. */
export const findMemTools = (names: readonly string[]): Partial<Record<MemToolKey, string>> => {
  const tools: Partial<Record<MemToolKey, string>> = {}

  for (const name of names.filter(isMemName)) {
    const short = name.split('__').pop() ?? name
    const key = KEYS.find(candidate => short === candidate)

    if (key !== undefined && tools[key] === undefined) {
      tools[key] = name
    }
  }

  return tools
}

/** Le due impostazioni che contano per il contesto; le altre (anche eventuali chiavi API) si ignorano. */
export const parseMemSettings = (text: string): MemSettings => {
  try {
    const json = JSON.parse(text) as Record<string, unknown>
    const observations = Number(json.CLAUDE_MEM_CONTEXT_OBSERVATIONS)
    const gate = json.CLAUDE_MEM_FILE_READ_GATE_ENABLED

    return {
      contextObservations: Number.isFinite(observations) && observations > 0 ? observations : undefined,
      isReadGateOn: gate === undefined ? undefined : String(gate) !== 'false',
    }
  } catch {
    return {}
  }
}

/** Il nome da scrivere al modello: quello esatto se noto, altrimenti il nome breve. */
export const memTool = (info: MemInfo, key: MemToolKey): string => info.tools[key] ?? `${key} di claude-mem`

/** Poche righe per il prompt di sistema: usare la memoria invece di riesplorare. */
export const memGuide = (info: MemInfo): string => {
  const lines = [
    'claude-mem è attivo: il lavoro delle sessioni passate è in memoria. Per consumare meno contesto (se i suoi strumenti sono disponibili):',
    `- Prima di riesplorare codice o rileggere file già visti, cerca nella memoria: ${memTool(info, 'search')} (indice breve), ` +
      `poi ${memTool(info, 'timeline')}, e ${memTool(info, 'get_observations')} solo sugli id che servono davvero.`,
    `- File di codice grandi: ${memTool(info, 'smart_outline')} per la struttura, poi ${memTool(info, 'smart_unfold')} per il solo simbolo che serve; Read con offset e limit per righe precise.`,
    '- Non leggere la cartella .claude-mem (database e indici): solo settings.json, per le opzioni.',
    '- Chi vale: piano.json del mod gestione-sprint (piano_leggi) per piano, regole e decisioni approvate; CLAUDE.md e i file di memoria per le regole del progetto; claude-mem per la storia delle sessioni. ' +
      'Un\'osservazione che contraddice il piano non lo cambia: se e piu recente della decisione, chiedi all\'utente.',
  ]

  return lines.join('\n')
}

/** Richiesta di /passaggio con claude-mem: il riepilogo si salva in memoria invece di copiarlo a mano. */
export const memHandoffPrompt = (info: MemInfo): string =>
  `Salva con ${memTool(info, 'save_memory')} un riepilogo breve per ripartire: ` +
  'Obiettivo (1 riga). Decisioni prese. File toccati. Cosa manca. Massimo 15 righe. ' +
  'Poi rispondi solo con una riga di conferma.'

/** Nota per la compattazione: il dettaglio è già in memoria, il riassunto può essere più corto. */
export const MEM_COMPACT_NOTE =
  'Il dettaglio del lavoro è già salvato in claude-mem: nel riassunto tieni solo obiettivo, decisioni, file aperti, prossimo passo ' +
  'e gli id delle osservazioni utili; niente output di strumenti.'

const CODE_FILE = /\.(php|py|pyw|js|jsx|mjs|cjs|ts|tsx|go|rs|rb|java|kt|scala|swift|c|cc|cpp|h|hpp|lua|hs|zig|sh|css|scss|sql)$/i

/** File che smart_outline sa leggere. */
export const isOutlineable = (path: string): boolean => CODE_FILE.test(path)

/** Rimedio per un file di codice troppo grande, se claude-mem c'è. */
export const outlineRemedy = (info: MemInfo, path: string): string | undefined =>
  info.isActive && isOutlineable(path)
    ? `Usa ${memTool(info, 'smart_outline')} per vedere i simboli con le righe, poi ${memTool(info, 'smart_unfold')} sul simbolo che ti serve.`
    : undefined

/** Richiesta di molte osservazioni in una volta: meglio filtrare prima. */
export const observationsHint = (args: Record<string, unknown>, max = 10): string | undefined => {
  const ids = Array.isArray(args.ids) ? args.ids : undefined

  return ids !== undefined && ids.length > max
    ? `Hai chiesto ${ids.length} osservazioni intere (circa ${Math.round((ids.length * 750) / 1000)}k token). ` +
      'Filtra prima con timeline o search e chiedi solo gli id che servono.'
    : undefined
}

/** Righe per /peso: quanto pesa claude-mem e cosa regolare. */
export const memWeightLines = (info: MemInfo, mcpTokens: number, formatTokens: (n: number) => string): string[] => {
  if (!info.isActive) {
    return []
  }

  const lines = [`claude-mem: attivo${mcpTokens > 0 ? `, strumenti MCP ${formatTokens(mcpTokens)}` : ''}.`]
  const observations = info.settings.contextObservations

  if (observations !== undefined) {
    lines.push(`  - Osservazioni iniettate a inizio sessione: ${observations}.${observations > 30 ? ' Se le sessioni partono pesanti, abbassa CLAUDE_MEM_CONTEXT_OBSERVATIONS in ~/.claude-mem/settings.json (es. 20).' : ''}`)
  }
  if (info.settings.isReadGateOn === false) {
    lines.push('  - Il blocco delle letture intere di claude-mem è spento: riaccendilo con CLAUDE_MEM_FILE_READ_GATE_ENABLED=true.')
  }

  return lines
}
