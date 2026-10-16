// Memoria del progetto: cosa cercare, come riconoscere il metodo gia in uso, verifica dei conflitti.

import type { Domanda } from '../../types'
import type { Voce } from './logic'

/** File e cartelle dove i progetti tengono memoria e logica di sviluppo. */
export const CANDIDATI: readonly { percorso: string; metodo?: string; tipo: 'memoria' | 'logica' }[] = [
  { percorso: 'CLAUDE.md', tipo: 'memoria' },
  { percorso: 'CLAUDE.local.md', tipo: 'memoria' },
  { percorso: '.claude/CLAUDE.md', tipo: 'memoria' },
  { percorso: '.claude/memory', tipo: 'memoria' },
  { percorso: 'AGENTS.md', tipo: 'memoria' },
  { percorso: 'memory-bank', metodo: 'memory bank', tipo: 'memoria' },
  { percorso: '.cursor/rules', tipo: 'memoria' },
  { percorso: '.github/copilot-instructions.md', tipo: 'memoria' },
  { percorso: 'README.md', tipo: 'memoria' },
  { percorso: 'docs', tipo: 'memoria' },
  { percorso: 'docs/superpowers/specs', metodo: 'superpowers (spec + plan)', tipo: 'logica' },
  { percorso: 'docs/superpowers/plans', metodo: 'superpowers (spec + plan)', tipo: 'logica' },
  { percorso: 'docs/plans', metodo: 'piani in docs/plans', tipo: 'logica' },
  { percorso: '.planning/ROADMAP.md', metodo: 'GSD (.planning)', tipo: 'logica' },
  { percorso: '.planning/STATE.md', metodo: 'GSD (.planning)', tipo: 'logica' },
  { percorso: '.planning/REQUIREMENTS.md', metodo: 'GSD (.planning)', tipo: 'logica' },
  { percorso: '.specify', metodo: 'spec-kit', tipo: 'logica' },
  { percorso: 'specs', metodo: 'spec-kit', tipo: 'logica' },
  { percorso: '.taskmaster/tasks/tasks.json', metodo: 'Taskmaster', tipo: 'logica' },
  { percorso: '.bmad-core', metodo: 'BMAD', tipo: 'logica' },
  { percorso: 'docs/prd.md', metodo: 'BMAD', tipo: 'logica' },
  { percorso: 'docs/stories', metodo: 'BMAD', tipo: 'logica' },
  { percorso: 'ROADMAP.md', metodo: 'roadmap markdown', tipo: 'logica' },
  { percorso: 'TODO.md', metodo: 'todo markdown', tipo: 'logica' },
  { percorso: 'SPRINT.md', metodo: 'sprint markdown', tipo: 'logica' },
  { percorso: 'PLAN.md', metodo: 'piano markdown', tipo: 'logica' },
  { percorso: 'CHANGELOG.md', tipo: 'memoria' },
]

export type Rilevazione = {
  memoria: string[]
  logica: string[]
  metodi: string[]
  strumentiMemoria: string[]
  isSuperpowers: boolean | undefined
  /** comandi di test, lint e build letti dai file del progetto */
  comandi?: string[]
  /** dimensione in KB dei file trovati, per leggerli a pezzi quando servono */
  dimensioni?: Record<string, number>
  /** confronto con l'analisi precedente */
  modifiche?: Modifiche
  /** riassunto del piano gia presente: l'analisi lo integra, non lo rifà */
  pianoEsistente?: string
}

export type Modifiche = { nuovi: string[]; cambiati: string[]; invariati: string[] }

/** File nuovi, cambiati o uguali rispetto alle impronte salvate all'analisi precedente. */
export const confrontaImpronte = (prima: Readonly<Record<string, string>> | undefined, ora: Readonly<Record<string, string>>): Modifiche => {
  const m: Modifiche = { nuovi: [], cambiati: [], invariati: [] }
  for (const [file, h] of Object.entries(ora)) {
    const vecchia = prima?.[file]
    if (vecchia === undefined) m.nuovi.push(file)
    else if (vecchia !== h) m.cambiati.push(file)
    else m.invariati.push(file)
  }
  return m
}

/** Manifesti da cui ricavare i comandi di verifica del progetto. */
export const MANIFESTI = ['composer.json', 'package.json', 'pyproject.toml', 'requirements.txt', 'requirements-dev.txt', 'pytest.ini', 'phpunit.xml', 'phpunit.xml.dist', 'Makefile', 'go.mod', 'Cargo.toml'] as const

const jsonDi = (t: string | undefined): Record<string, unknown> => {
  try {
    const v = JSON.parse(t ?? '')
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Comandi di test, lint e build del progetto, letti dai manifesti: i criteri di accettazione
 * e la definition of done li citano invece di frasi generiche come "funziona".
 */
export const comandiVerifica = (file: Readonly<Partial<Record<(typeof MANIFESTI)[number], string>>>): string[] => {
  const out: string[] = []
  const composer = jsonDi(file['composer.json'])
  const req = { ...(composer.require as object), ...(composer['require-dev'] as object) } as Record<string, unknown>
  const scriptComposer = (composer.scripts ?? {}) as Record<string, unknown>
  if ('laravel/framework' in req) out.push('php artisan test')
  else if ('phpunit/phpunit' in req || file['phpunit.xml'] !== undefined || file['phpunit.xml.dist'] !== undefined) out.push('vendor/bin/phpunit')
  if ('test' in scriptComposer && !out.length) out.push('composer test')
  if ('phpstan/phpstan' in req || 'larastan/larastan' in req || 'nunomaduro/larastan' in req) out.push('vendor/bin/phpstan analyse')
  if ('laravel/pint' in req) out.push('vendor/bin/pint --test')
  const pkg = jsonDi(file['package.json'])
  const script = (pkg.scripts ?? {}) as Record<string, unknown>
  for (const k of ['test', 'lint', 'typecheck', 'build']) {
    if (typeof script[k] === 'string' && !/no test specified/.test(String(script[k]))) out.push(k === 'test' ? 'npm test' : `npm run ${k}`)
  }
  const py = `${file['pyproject.toml'] ?? ''}\n${file['requirements.txt'] ?? ''}\n${file['requirements-dev.txt'] ?? ''}`
  if (file['pytest.ini'] !== undefined || /\bpytest\b/i.test(py)) out.push('pytest -q')
  if (/\bruff\b/i.test(py)) out.push('ruff check .')
  if (/\bmypy\b/i.test(py)) out.push('mypy .')
  if (file['go.mod'] !== undefined) out.push('go test ./...')
  if (file['Cargo.toml'] !== undefined) out.push('cargo test')
  if (/^test\s*:/m.test(file.Makefile ?? '') && !out.length) out.push('make test')
  return [...new Set(out)]
}

const kb = (r: Rilevazione, f: string): string => {
  const n = r.dimensioni?.[f]
  return n === undefined ? f : n >= 20 ? `${f} (${n} KB: leggilo a pezzi)` : `${f} (${n} KB)`
}

export const descriviRilevazione = (r: Rilevazione): string =>
  [
    r.pianoEsistente ? `Piano gia presente: ${r.pianoEsistente}. Integralo e miglioralo: non ricrearlo, non duplicare voci gia registrate.` : '',
    `File di memoria trovati: ${r.memoria.map(f => kb(r, f)).join(', ') || 'nessuno'}.`,
    `File di logica di sviluppo trovati: ${r.logica.map(f => kb(r, f)).join(', ') || 'nessuno'}.`,
    r.modifiche && (r.modifiche.cambiati.length || r.modifiche.invariati.length)
      ? [
          r.modifiche.nuovi.length ? `Mai letti prima: ${r.modifiche.nuovi.join(', ')} (leggili).` : '',
          r.modifiche.cambiati.length ? `Cambiati dall'ultima analisi: ${r.modifiche.cambiati.join(', ')} (rileggili e confrontali con la memoria registrata).` : '',
          r.modifiche.invariati.length ? `Uguali all'ultima analisi: ${r.modifiche.invariati.join(', ')} (la memoria registrata basta: rileggili solo se serve un dettaglio).` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '',
    `Metodo gia in uso: ${r.metodi.join(' + ') || 'nessuno riconosciuto'}.`,
    r.comandi?.length
      ? `Comandi di verifica del progetto: ${r.comandi.join(', ')}. Usali nei criteri di accettazione e nella definition of done.`
      : `Comandi di verifica: nessuno trovato nei manifesti. Chiedi come si prova il progetto (domanda bloccante sul primo sprint) invece di inventarli.`,
    `Strumenti di memoria MCP: ${r.strumentiMemoria.join(', ') || 'nessuno'}.`,
  ]
    .filter(Boolean)
    .join('\n')

/** Gli strumenti di memoria (claude-mem e simili) tra quelli del modello. */
export const strumentiDiMemoria = (nomi: readonly string[]): string[] =>
  nomi.filter(n => /claude-mem|mem-search|memory|mcp__mem/i.test(n) && !n.startsWith('mcp__gestione-sprint')).slice(0, 8)

// ---------- verifica dei conflitti ----------

export const SISTEMA_CONFLITTO =
  'Sei un revisore di coerenza. Rispondi solo con un oggetto JSON, senza altro testo.'

export const promptConflitto = (d: Domanda, risposta: string, voci: readonly Voce[]): string =>
  [
    'Una nuova risposta dell\'utente contraddice una delle voci gia registrate per il progetto?',
    'Contraddire = non possono essere vere entrambe, o applicarle insieme da risultati incompatibili.',
    'Non e contraddizione: argomento vicino, dettaglio in piu, precisazione compatibile.',
    '',
    `Domanda ${d.id}: ${d.testo}`,
    `Nuova risposta: ${risposta}`,
    '',
    'Voci registrate:',
    ...voci.map(v => `${v.id} (${v.tipo}): ${v.testo}`),
    '',
    'Formato: {"conflitto":true|false,"con":["id",...],"spiegazione":"una frase in italiano"}',
  ].join('\n')

export type EsitoConflitto = { con: string[]; spiegazione: string } | null

/** Legge la risposta del modello; tiene solo id esistenti. Null se non c'e conflitto. */
export const leggiEsitoConflitto = (testo: string, ammessi: readonly string[]): EsitoConflitto => {
  const json = /\{[\s\S]*\}/.exec(testo)?.[0]
  if (!json) {
    return null
  }
  try {
    const r = JSON.parse(json) as { conflitto?: unknown; con?: unknown; spiegazione?: unknown }
    const con = Array.isArray(r.con) ? r.con.map(String).filter(id => ammessi.includes(id)) : []
    return r.conflitto === true && con.length
      ? { con, spiegazione: typeof r.spiegazione === 'string' ? r.spiegazione : '' }
      : null
  } catch {
    return null
  }
}

/** Solo le voci che condividono qualche parola con domanda e risposta: meno token alla verifica. */
export const vociPertinenti = (voci: readonly Voce[], testo: string, max = 60): Voce[] => {
  if (voci.length <= max) {
    return [...voci]
  }
  const parole = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9àèéìòù]+/)
        .filter(p => p.length > 3),
    )
  const chiave = parole(testo)
  const punteggio = (v: Voce) => [...parole(v.testo)].filter(p => chiave.has(p)).length
  const ordinate = [...voci].map(v => ({ v, s: punteggio(v) })).sort((a, b) => b.s - a.s)
  const utili = ordinate.filter(x => x.s > 0).map(x => x.v)
  // se nessuna parola coincide, si controllano comunque memoria e decisioni piu recenti
  return (utili.length ? utili : voci.filter(v => v.tipo !== 'esigenza').slice(-15)).slice(0, max)
}

// ---------- verifica delle modifiche del modello contro la memoria ----------

export const promptModifiche = (nuovi: readonly { id: string; testo: string }[], voci: readonly Voce[]): string =>
  [
    'Contenuti NUOVI di un piano di progetto. Quali contraddicono le voci GIA REGISTRATE (memoria, decisioni, esigenze)?',
    'Contraddire = non possono valere entrambi, o realizzarli insieme da risultati incompatibili (tecnologia, regola, dato, comportamento diversi).',
    'Non e contraddizione: argomento vicino, dettaglio in piu, precisazione compatibile. Nel dubbio, non segnalare.',
    '',
    'NUOVI:',
    ...nuovi.map(n => `${n.id}: ${n.testo}`),
    '',
    'GIA REGISTRATE:',
    ...voci.map(v => `${v.id} (${v.tipo}): ${v.testo}`),
    '',
    'Formato: {"conflitti":[{"nuovo":"id nuovo","con":["id registrata"],"spiegazione":"una frase in italiano"}]} (lista vuota se nessuno)',
  ].join('\n')

export const leggiEsitoModifiche = (
  testo: string,
  nuovi: readonly string[],
  voci: readonly string[],
): { nuovo: string; con: string[]; spiegazione: string }[] => {
  const json = /\{[\s\S]*\}/.exec(testo)?.[0]
  if (!json) return []
  try {
    const r = JSON.parse(json) as { conflitti?: unknown }
    if (!Array.isArray(r.conflitti)) return []
    return r.conflitti
      .map(c => c as { nuovo?: unknown; con?: unknown; spiegazione?: unknown })
      .map(c => ({
        nuovo: String(c.nuovo ?? ''),
        con: Array.isArray(c.con) ? c.con.map(String).filter(id => voci.includes(id)) : [],
        spiegazione: typeof c.spiegazione === 'string' ? c.spiegazione : '',
      }))
      .filter(c => nuovi.includes(c.nuovo) && c.con.length > 0)
  } catch {
    return []
  }
}

/** Confronto tollerante: spazi, maiuscole e marcatori markdown non contano. */
export const contieneEstratto = (file: string, estratto: string): boolean => {
  const n = (s: string) => s.toLowerCase().replace(/[*_`#>\-]+/g, ' ').replace(/\s+/g, ' ').replace(/\s+([:;,.])/g, '$1').trim()
  return n(file).includes(n(estratto))
}
