// Regole per tipo di progetto: PHP, Laravel, Python, LangChain/LangGraph. Solo funzioni pure.

export type Profile = 'laravel' | 'php' | 'python' | 'langchain'

export const PROFILES: readonly Profile[] = ['laravel', 'php', 'python', 'langchain']

// ---- Riconoscimento del progetto ----

/** File che, nella cartella del progetto, indicano il tipo. */
export const PROFILE_MARKERS: Readonly<Record<Profile, readonly string[]>> = {
  laravel: ['artisan'],
  php: ['composer.json'],
  python: ['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'Pipfile'],
  // LangGraph: il file della CLI. Altrimenti si riconosce dalle dipendenze (mentionsLangChain).
  langchain: ['langgraph.json'],
}

/** File delle dipendenze Python in cui cercare langchain e langgraph. */
export const PYTHON_DEPENDENCY_FILES = ['pyproject.toml', 'requirements.txt', 'requirements-dev.txt', 'Pipfile', 'setup.cfg']

/** Se il testo delle dipendenze cita LangChain o LangGraph. */
export const mentionsLangChain = (text: string): boolean =>
  /(^|[\s"'=\[,])lang(chain|graph)([-_][a-z-]+)?\s*([<>=~!\[;"',]|$)/im.test(text)

/**
 * I profili attivi, dai file presenti. Laravel include PHP; Python si somma.
 * `forced` è la scelta dell'utente nelle opzioni ('auto' = riconoscimento).
 */
export const detectProfiles = (present: ReadonlySet<string>, forced: string): Profile[] => {
  if (forced !== 'auto') {
    // LangChain è un progetto Python: valgono anche le regole di Python.
    if (forced === 'langchain') {
      return ['python', 'langchain']
    }

    return PROFILES.includes(forced as Profile) ? [forced as Profile] : []
  }

  const has = (profile: Profile) => PROFILE_MARKERS[profile].some(file => present.has(file))
  const found: Profile[] = []

  if (has('laravel')) {
    found.push('laravel')
  } else if (has('php')) {
    found.push('php')
  }
  if (has('python') || has('langchain')) {
    found.push('python')
  }
  if (has('langchain')) {
    found.push('langchain')
  }

  return found
}

// ---- Cartelle escluse per profilo ----

export const PROFILE_DIRS: Readonly<Record<Profile, readonly string[]>> = {
  // storage/logs resta leggibile: i log servono, li governa la regola sui file pesanti.
  laravel: [
    'vendor', 'storage/framework', 'bootstrap/cache', 'public/build', 'public/vendor',
    'public/hot', '.phpunit.cache',
  ],
  php: ['vendor', '.phpunit.cache'],
  python: [
    '.venv', 'venv', 'site-packages', '__pycache__', '.mypy_cache', '.pytest_cache',
    '.ruff_cache', '.tox', '.nox', '*.egg-info', 'htmlcov', '.ipynb_checkpoints',
  ],
  // Dati dei vector store e del server di sviluppo LangGraph: binari o enormi, mai codice.
  langchain: [
    '.langgraph_api', 'chroma_db', '.chroma', 'faiss_index', '.lancedb', 'qdrant_storage', 'mlruns', 'wandb',
  ],
}

export const dirsFor = (base: readonly string[], profiles: readonly Profile[]): string[] => [
  ...new Set([...base, ...profiles.flatMap(profile => PROFILE_DIRS[profile])]),
]

// ---- File pesanti per tipo ----

export type HeavyKind = 'log' | 'lock' | 'generated' | 'minified' | 'data' | 'notebook' | 'binary'

const HEAVY_RULES: readonly { kind: HeavyKind; test: RegExp }[] = [
  { kind: 'lock', test: /(^|[\\/])(composer\.lock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|uv\.lock|pipfile\.lock)$/i },
  { kind: 'log', test: /\.log(\.\d+)?$|(^|[\\/])laravel-\d{4}-\d{2}-\d{2}\.log$/i },
  { kind: 'generated', test: /(^|[\\/])(_ide_helper(_models)?\.php|\.phpstorm\.meta\.php|\.phpunit\.result\.cache)$/i },
  { kind: 'minified', test: /\.(min\.(js|css)|js\.map|css\.map)$/i },
  // .sql da solo è codice (procedure, viste, migrazioni T-SQL): conta come dati solo se è un dump o un backup.
  { kind: 'data', test: /\.(csv|tsv|sqlite|sqlite3|db|parquet|pkl|pickle|jsonl|ndjson)$/i },
  { kind: 'data', test: /(dump|backup|bak|export|seed|data)[^\\/]*\.sql$/i },
  { kind: 'notebook', test: /\.ipynb$/i },
  // Indici vettoriali e pesi dei modelli (FAISS, numpy, PyTorch, GGUF, ONNX).
  { kind: 'binary', test: /\.(faiss|ann|npy|npz|safetensors|pt|pth|ckpt|gguf|onnx|h5|joblib)$/i },
]

export const heavyKindOf = (path: string): HeavyKind | undefined =>
  HEAVY_RULES.find(rule => rule.test.test(path))?.kind

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path

/** Il rimedio da proporre al modello, per tipo di file pesante. */
export const heavyRemedy = (kind: HeavyKind, path: string): string => {
  const name = fileName(path)

  switch (kind) {
    case 'log':
      return `È un log: leggi solo la fine con Bash "tail -n 100 ${path}", oppure cerca gli errori con Grep (es. "\\.ERROR|Exception|Traceback").`
    case 'lock':
      return name.toLowerCase().startsWith('composer')
        ? 'È il lock di Composer: usa "composer show <vendor/pacchetto>" oppure Grep sul nome del pacchetto.'
        : name.toLowerCase().includes('package') || name.toLowerCase().includes('yarn') || name.toLowerCase().includes('pnpm')
          ? 'È un lock npm: usa "npm ls <pacchetto>" oppure Grep sul nome del pacchetto.'
          : 'È un lock Python: usa "pip show <pacchetto>" (o "uv pip show", "poetry show <pacchetto>") oppure Grep sul nome.'
    case 'generated':
      return 'È un file generato: cerca con Grep il simbolo che ti serve invece di leggerlo tutto.'
    case 'minified':
      return 'È un file compilato: lavora sul sorgente (resources/js, resources/css, src) invece che sul risultato.'
    case 'data':
      return `Sono dati: guarda solo l'inizio con Bash "head -n 20 ${path}"; per un database usa query mirate.`
    case 'notebook':
      return 'È un notebook con gli output dentro: leggilo con limit, oppure cerca le celle con Grep.'
    case 'binary':
      return 'È un file binario (indice vettoriale o pesi di un modello): leggerlo non serve. ' +
        'Se devi ispezionarlo, scrivi uno script Python che stampi solo forma, tipo e numero di elementi.'
  }
}

// ---- CLAUDE.md minimo per tipo di progetto ----

const CLAUDE_MD_PARTS: Readonly<Record<Profile | 'base', string>> = {
  base: [
    '## Regole per il contesto',
    '- Leggi solo i file che servono al compito; cerca prima con Grep.',
    '- File grandi: leggi a pezzi (offset e limit).',
    '- Configurazione: leggi .env.example, mai .env.',
  ].join('\n'),
  laravel: [
    '## Laravel',
    '- Test: php artisan test',
    '- Rotte: php artisan route:list --path=<prefisso> (mai senza filtri)',
    '- Log: tail -n 100 storage/logs/laravel.log, oppure Grep su "local.ERROR"',
    '- Non leggere: vendor/, storage/framework/, bootstrap/cache/, public/build/',
    '- Dipendenze: composer show <vendor/pacchetto>, non composer.lock',
    '- Migrazioni: chiedi conferma prima di eseguirle fuori dall\'ambiente locale',
  ].join('\n'),
  php: [
    '## PHP',
    '- Dipendenze: composer show <vendor/pacchetto>, non composer.lock',
    '- Non leggere: vendor/',
  ].join('\n'),
  langchain: [
    '## LangChain / LangGraph',
    '- Versioni: pip show langchain-core langgraph (non leggere i lock né site-packages)',
    '- Grafo: stampa graph.get_graph().draw_mermaid() invece di leggere tutti i nodi',
    '- Stato: stampa solo le chiavi che servono (es. state["messages"][-1].content)',
    '- Stream: stream_mode="updates", non "values"; niente set_debug(True) su esecuzioni lunghe',
    '- Non leggere: .langgraph_api/, chroma_db/, faiss_index/, file .faiss/.npy/.pkl',
  ].join('\n'),
  python: [
    '## Python',
    '- Test: pytest -q --tb=short',
    '- Ambiente: .venv (non leggerlo)',
    '- Dipendenze: pip show <pacchetto>, non i file di lock',
    '- Non leggere: .venv/, __pycache__/, .pytest_cache/, *.egg-info/',
  ].join('\n'),
}

/** Un CLAUDE.md breve per i profili attivi: poche righe, sempre utili. */
export const claudeMdSnippet = (profiles: readonly Profile[]): string => {
  const parts = profiles.includes('laravel') ? profiles.filter(profile => profile !== 'php') : profiles

  return ['# Progetto', '', CLAUDE_MD_PARTS.base, ...parts.map(profile => `\n${CLAUDE_MD_PARTS[profile]}`)].join('\n')
}

// ---- File con credenziali ----

// .env e varianti, chiavi e certificati, file di credenziali di Composer, npm, pip, git e dei servizi cloud.
const SECRET_NAME =
  /^(\.env(\..+)?|.+\.(pem|key|p12|pfx)|id_(rsa|ed25519|ecdsa)|auth\.json|\.npmrc|\.pypirc|\.netrc|\.git-credentials|credentials(\.json)?|service-account[^\\/]*\.json)$/i
const SECRET_SAFE = /\.(example|sample|dist|template)$/i

/**
 * File che contengono credenziali (.env, chiavi): leggerli le porta nel contesto.
 * I modelli (.env.example) restano leggibili.
 */
export const isSecretFile = (path: string): boolean => {
  const name = fileName(path)

  return SECRET_NAME.test(name) && !SECRET_SAFE.test(name)
}

export const SECRET_REMEDY =
  'Contiene credenziali: non portarlo nel contesto. Per i nomi delle variabili leggi .env.example; ' +
  'se serve un valore preciso, chiedilo all\'utente.'

// ---- Comandi di terminale del mondo PHP, Laravel e Python ----

const isSingleCommand = (command: string): boolean => !/&&|\|\||[;|\n]/.test(command)

const words = (command: string): string[] => command.trim().split(/\s+/).filter(word => word.length > 0)

export type StackHint = { key: string; message: string }

/**
 * Comandi che stampano elenchi enormi: un suggerimento al primo tentativo.
 * Il chiamante lascia passare lo stesso comando se viene ripetuto.
 */
export const stackHintFor = (
  command: string,
  routeAdvice = 'Usa --path=<prefisso>, --name=<nome> oppure --except-vendor.',
): StackHint | undefined => {
  if (!isSingleCommand(command)) {
    return undefined
  }

  const parts = words(command)
  const flags = parts.filter(part => part.startsWith('-'))
  const positional = parts.filter(part => !part.startsWith('-'))
  const text = parts.join(' ')

  if (/(^|\s)artisan\s+route:list(\s|$)/.test(text)) {
    const isFiltered = flags.some(flag => /^--(path|name|method|action|except-vendor|only-vendor|json|compact)/.test(flag))

    return isFiltered
      ? undefined
      : {
          key: text,
          message:
            `route:list senza filtri stampa tutte le rotte, anche quelle dei pacchetti. ${routeAdvice}`,
        }
  }

  if (positional[0] === 'composer' && positional[1] === 'show' && positional.length === 2) {
    return {
      key: text,
      message: 'composer show senza pacchetto elenca tutte le dipendenze. Usa "composer show <vendor/pacchetto>" oppure "composer show --direct".',
    }
  }

  if (positional[0] === 'git' && positional[1] === 'log') {
    const isBounded = flags.some(flag => /^(-n|-\d+$|--max-count|--since|--after|-L)/.test(flag))
      || parts.some(part => /\.\./.test(part))

    return isBounded
      ? undefined
      : { key: text, message: 'git log senza limite stampa tutta la storia. Usa "git log --oneline -20" oppure un intervallo (main..HEAD).' }
  }

  if (
    (positional[0] === 'pip' || positional[0] === 'pip3' || (positional[0] === 'uv' && positional[1] === 'pip') || positional[0] === 'conda') &&
    ['list', 'freeze'].includes(positional[positional[0] === 'uv' ? 2 : 1] ?? '') &&
    positional.length === (positional[0] === 'uv' ? 3 : 2)
  ) {
    return {
      key: text,
      message: 'L\'elenco completo dei pacchetti è lungo. Usa "pip show <pacchetto>" oppure filtra: "pip list | grep -i <nome>" (in PowerShell: Select-String).',
    }
  }

  if (/(^|\s)artisan\s+list$/.test(text)) {
    return {
      key: text,
      message: 'artisan list stampa tutti i comandi. Usa "php artisan list <gruppo>" (es. make, migrate, db).',
    }
  }

  if (positional[0] === 'npm' && (positional[1] === 'ls' || positional[1] === 'list') && positional.length === 2) {
    const hasDepth = flags.some(flag => flag.startsWith('--depth') || flag === '--all')

    return hasDepth
      ? undefined
      : { key: text, message: 'npm ls stampa tutto l\'albero. Usa "npm ls <pacchetto>" oppure "npm ls --depth=0".' }
  }

  return undefined
}

const PYTEST_FLAGS = /(^|\s)(-v+|-q+|--verbose|--quiet|--tb(=|\s)|-r\w*|-s|--capture)/

/** Se il comando lancia pytest senza opzioni di verbosità, la versione con meno output. */
export const quietPytest = (command: string): string | undefined => {
  if (!isSingleCommand(command) || PYTEST_FLAGS.test(command)) {
    return undefined
  }

  const parts = words(command)
  let index = 0

  // Salta VAR=x e gli avviatori comuni: uv run, poetry run, pipenv run, python -m
  while (index < parts.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(parts[index] ?? '')) {
    index += 1
  }
  if (['uv', 'poetry', 'pipenv', 'hatch', 'pdm'].includes(parts[index] ?? '') && parts[index + 1] === 'run') {
    index += 2
  }
  if (/^python(3(\.\d+)?)?$|^py$/.test(parts[index] ?? '') && parts[index + 1] === '-m') {
    index += 2
  }

  const name = (parts[index] ?? '').split(/[\\/]/).pop()

  return name === 'pytest' || name === 'py.test' ? `${command.trim()} -q --tb=short` : undefined
}

/** Percorso assoluto di `path` rispetto a `cwd`; undefined se non si può risolvere (es. `~`). */
export const resolvePath = (cwd: string, path: string): string | undefined => {
  if (path.startsWith('~') || path.includes('$')) {
    return undefined
  }
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\')) {
    return path
  }

  const sep = cwd.includes('\\') && !cwd.includes('/') ? '\\' : '/'

  return `${cwd.replace(/[\\/]+$/, '')}${sep}${path.replace(/^\.[\\/]/, '')}`
}

// Comandi che portano nel contesto il contenuto di un file, anche in parte.
const READERS = new Set([
  'cat', 'type', 'more', 'less', 'head', 'tail', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'sed', 'awk',
  'strings', 'bat', 'nl', 'xxd', 'od', 'get-content', 'gc', 'select-string', 'findstr', 'diff',
])

/** Il primo file con credenziali che un comando legge (cat .env, grep KEY .env, tail .env.local …), anche in una catena. */
export const secretFileInCommand = (command: string): string | undefined => {
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const [first, ...all] = words(segment).map(word => word.replace(/^(["'])(.*)\1$/, '$2'))
    // Quello che segue una redirezione (> .env, >> .env, 2>&1) è un'uscita, non un file letto.
    const cut = all.findIndex(word => /^\d?>/.test(word) || word === '<<' || word.startsWith('<<'))
    const args = cut === -1 ? all : all.slice(0, cut)
    const name = (first ?? '').split(/[\\/]/).pop()?.toLowerCase().replace(/\.exe$/, '') ?? ''

    // Anche git può stampare il contenuto: git diff .env, git show HEAD:.env, git log -p .env.
    const isGitReader = name === 'git' && ['diff', 'show', 'log', 'blame', 'grep'].includes(args[0] ?? '')

    if (isGitReader && args.some(arg => isSecretFile(arg.split(':').pop() ?? arg))) {
      return args.find(arg => isSecretFile(arg.split(':').pop() ?? arg))
    }

    if (READERS.has(name)) {
      const found = args.find(arg => !arg.startsWith('-') && isSecretFile(arg))

      if (found !== undefined) {
        return found
      }
    }
  }

  return undefined
}

/** Un percorso o un glob di ricerca che punta a file con credenziali (Grep su .env, glob ".env*"). */
export const isSecretTarget = (target: string): boolean => {
  const clean = target.trim().replace(/\*+$/, '').replace(/^\*\*[\\/]/, '')

  return clean.length > 0 && isSecretFile(clean)
}

/** I file che un comando stampa per intero (cat, type, more, less), se è un comando solo. */
export const dumpedFiles = (command: string): string[] => {
  if (!isSingleCommand(command)) {
    return []
  }

  const [name, ...args] = words(command)

  return ['cat', 'type', 'more', 'less', 'get-content', 'gc'].includes((name ?? '').toLowerCase())
    ? args.filter(arg => !arg.startsWith('-')).map(arg => arg.replace(/^(["'])(.*)\1$/, '$2'))
    : []
}
