// Versione di Laravel e guida breve per il modello. Solo funzioni pure.
//
// Fonti verificate:
// - db:show e db:table: Laravel 9.24 (blog ufficiale, agosto 2022); model:show: luglio 2022.
// - route:list: in Laravel 9 tolte --compact e --columns; --except-vendor presente nel ramo 9.x.
// - Laravel 11: struttura snella, configurazione in bootstrap/app.php, config:show e config:publish.
// - Laravel 12 (febbraio 2025) e 13 (marzo 2026) mantengono la struttura di Laravel 11.

export type LaravelVersion = { major: number; minor: number }

const parse = (text: string): LaravelVersion | undefined => {
  const match = text.match(/(\d+)(?:\.(\d+))?/)

  return match === null ? undefined : { major: Number(match[1]), minor: Number(match[2] ?? 0) }
}

/** Versione esatta da composer.lock (pacchetto laravel/framework). */
export const versionFromLock = (lockText: string): LaravelVersion | undefined => {
  try {
    const lock = JSON.parse(lockText) as { packages?: { name?: string; version?: string }[] }
    const framework = (lock.packages ?? []).find(item => item.name === 'laravel/framework')

    return framework?.version === undefined ? undefined : parse(framework.version)
  } catch {
    return undefined
  }
}

/** Versione indicativa dal vincolo in composer.json (es. "^11.0" → 11.0). */
export const versionFromComposerJson = (jsonText: string): LaravelVersion | undefined => {
  try {
    const json = JSON.parse(jsonText) as { require?: Record<string, string> }
    const constraint = json.require?.['laravel/framework']

    return constraint === undefined ? undefined : parse(constraint)
  } catch {
    return undefined
  }
}

/** Struttura reale dai file: un progetto aggiornato può avere ancora i Kernel. */
export type LaravelLayout = 'slim' | 'classic' | 'unknown'

export const layoutOf = (hasHttpKernel: boolean, hasBootstrapApp: boolean): LaravelLayout =>
  hasHttpKernel ? 'classic' : hasBootstrapApp ? 'slim' : 'unknown'

const atLeast = (version: LaravelVersion | undefined, major: number, minor = 0): boolean =>
  version !== undefined && (version.major > major || (version.major === major && version.minor >= minor))

/**
 * Poche righe per il prompt di sistema: dove sono le cose e quali comandi
 * danno le informazioni in forma compatta, per questa versione.
 */
export const laravelGuide = (version: LaravelVersion | undefined, layout: LaravelLayout): string => {
  const label = version === undefined ? 'versione non rilevata' : `${version.major}.${version.minor}`
  const lines = [`Progetto Laravel (${label}). Indicazioni per usare meno contesto:`]

  if (layout === 'slim') {
    lines.push('- Middleware, eccezioni e rotte si configurano in bootstrap/app.php (non esistono app/Http/Kernel.php né app/Exceptions/Handler.php).')
  } else if (layout === 'classic') {
    lines.push('- Middleware in app/Http/Kernel.php; eccezioni in app/Exceptions/Handler.php; pianificazione in app/Console/Kernel.php.')
  }

  if (atLeast(version, 11)) {
    lines.push('- Configurazione: molti file non sono pubblicati in config/; usa "php artisan config:show <file>" invece di cercarli.')
  }

  if (atLeast(version, 9, 24)) {
    lines.push('- Schema del database: "php artisan model:show <Modello>" o "php artisan db:table <tabella>" invece di leggere tutte le migrazioni.')
    lines.push('- Panoramica del progetto (versioni, driver, cache): "php artisan about".')
  }

  if (version !== undefined && version.major <= 8) {
    lines.push('- Rotte: "php artisan route:list --compact --path=<prefisso>".')
  } else {
    lines.push('- Rotte: "php artisan route:list --path=<prefisso> --except-vendor".')
  }

  lines.push('- Log: "tail -n 100 storage/logs/laravel.log" oppure Grep su "local.ERROR"; mai il file intero.')
  lines.push('- Dipendenze: "composer show <vendor/pacchetto>", non composer.lock.')

  return lines.join('\n')
}

/** Regole di route:list per versione: le opzioni giuste da suggerire. */
export const routeListAdvice = (version: LaravelVersion | undefined): string =>
  version !== undefined && version.major <= 8
    ? 'Usa --path=<prefisso>, --name=<nome> oppure --compact.'
    : 'Usa --path=<prefisso>, --name=<nome> oppure --except-vendor.'
