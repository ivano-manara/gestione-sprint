import { expect, test } from 'claude-code/testing'

import {
  cleanTerminal,
  collapseDuplicates,
  collapseLibraryFrames,
  collapseSimilar,
  compressOutput,
  isImportant,
  levelFor,
  shapeOf,
} from './compress'
import {
  laravelGuide,
  layoutOf,
  routeListAdvice,
  versionFromComposerJson,
  versionFromLock,
} from './laravel'

// ---- Output realistici ----

const vendorFrame = (n: number) =>
  `#${n} /var/www/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(183): Illuminate\\Pipeline\\Pipeline->Illuminate\\Pipeline\\{closure}(Object(Illuminate\\Http\\Request))`

const LARAVEL_LOG = [
  "[2026-10-15 11:00:00] local.ERROR: SQLSTATE[42S02]: Base table or view not found: 1146 Table 'demo.clienti' doesn't exist",
  '[stacktrace]',
  ...Array.from({ length: 14 }, (_, n) => vendorFrame(n)),
  '#14 /var/www/app/Http/Controllers/ClienteController.php(42): Illuminate\\Database\\Eloquent\\Builder->get()',
  ...Array.from({ length: 45 }, (_, n) => vendorFrame(n + 15)),
  '#60 {main}',
].join('\n')

const ARTISAN_TEST = [
  '',
  ...Array.from({ length: 120 }, (_, n) => `  ✓ it handles case number ${n}                                    0.0${n % 9}s`),
  '',
  '  FAILED  Tests\\Feature\\ClienteTest > it lists clienti',
  '  Expected response status code [200] but received 500.',
  '  at tests/Feature/ClienteTest.php:15',
  ...Array.from({ length: 30 }, (_, n) => `  ${n + 1}   vendor/laravel/framework/src/Illuminate/Testing/TestResponse.php:${100 + n}`),
  '',
  '  Tests:    1 failed, 120 passed (240 assertions)',
  '  Duration: 3.21s',
].join('\n')

const COMPOSER_INSTALL = [
  'Installing dependencies from lock file (including require-dev)',
  'Package operations: 90 installs, 0 updates, 0 removals',
  ...Array.from({ length: 90 }, (_, n) => `  - Downloading vendor${n}/package${n} (v${n}.2.1)`),
  ...Array.from({ length: 90 }, (_, n) => `  - Installing vendor${n}/package${n} (v${n}.2.1): Extracting archive`),
  'Generating optimized autoload files',
  '> Illuminate\\Foundation\\ComposerScripts::postAutoloadDump',
  'Warning: The lock file is not up to date with the latest changes in composer.json.',
].join('\n')

const PYTHON_TRACEBACK = [
  'Traceback (most recent call last):',
  '  File "/p/src/demo/api.py", line 12, in carica',
  '    risposta = requests.get(url, timeout=5)',
  ...Array.from({ length: 12 }, (_, n) => [
    `  File "/p/.venv/lib/python3.12/site-packages/requests/adapters.py", line ${500 + n}, in send`,
    '    raise ConnectionError(e, request=request)',
  ]).flat(),
  'requests.exceptions.ConnectionError: HTTPSConnectionPool(host=\'api.esempio.it\', port=443)',
  ...Array.from({ length: 60 }, (_, n) => `INFO richiesta numero ${n} completata in ${n}ms`),
].join('\n')

// ---- Livelli ----

test('sceglie il livello giusto per il comando', () => {
  expect(levelFor('php artisan test')).toBe('full')
  expect(levelFor('vendor/bin/phpunit --filter Cliente')).toBe('full')
  expect(levelFor('composer install')).toBe('full')
  expect(levelFor('python -m pytest -v')).toBe('full')
  expect(levelFor('npm run build')).toBe('full')
  expect(levelFor('php artisan tinker --execute="dump(1)"')).toBe('light')
  expect(levelFor('tail -n 200 storage/logs/laravel.log')).toBe('light')
  expect(levelFor('php artisan test 2>&1 | tail -50')).toBe('light')
})

test('non comprime mai dove ogni riga conta', () => {
  expect(levelFor('git diff')).toBe('none')
  expect(levelFor('git show HEAD')).toBe('none')
  expect(levelFor('grep -rn TODO app')).toBe('none')
  expect(levelFor('rg Cliente app')).toBe('none')
  expect(levelFor('cat routes/web.php')).toBe('none')
  expect(levelFor('CC_RAW=1 php artisan test')).toBe('none')
})

// ---- Qualità: niente di importante si perde ----

test('Laravel: conserva errore e frame del codice, riduce i frame di vendor', () => {
  const result = compressOutput(LARAVEL_LOG, 'light', 1000)

  expect(result.isChanged).toBe(true)
  expect(result.text).toContain("SQLSTATE[42S02]: Base table or view not found")
  expect(result.text).toContain('app/Http/Controllers/ClienteController.php(42)')
  expect(result.text).toContain('frame di librerie omessi')
  expect(result.text).toContain('#60 {main}')
  expect(result.linesAfter).toBeLessThan(10)
})

test('php artisan test: conserva il fallimento e il riepilogo, raggruppa i test superati', () => {
  const result = compressOutput(ARTISAN_TEST, 'full', 1000)

  expect(result.text).toContain('FAILED  Tests\\Feature\\ClienteTest > it lists clienti')
  expect(result.text).toContain('Expected response status code [200] but received 500.')
  expect(result.text).toContain('at tests/Feature/ClienteTest.php:15')
  expect(result.text).toContain('Tests:    1 failed, 120 passed')
  expect(result.text).toContain('test superati omessi')
  expect(result.linesAfter).toBeLessThan(20)
})

test('composer install: raggruppa download e installazioni, conserva gli avvisi', () => {
  const result = compressOutput(COMPOSER_INSTALL, 'full', 1000)

  expect(result.text).toContain('Package operations: 90 installs')
  expect(result.text).toContain('righe simili omesse')
  expect(result.text).toContain('Warning: The lock file is not up to date')
  expect(result.linesAfter).toBeLessThan(20)
})

test('Python: conserva il frame del codice e l\'eccezione, riduce i frame di site-packages', () => {
  const result = compressOutput(PYTHON_TRACEBACK, 'full', 1000)

  expect(result.text).toContain('File "/p/src/demo/api.py", line 12, in carica')
  expect(result.text).toContain('risposta = requests.get(url, timeout=5)')
  expect(result.text).toContain('requests.exceptions.ConnectionError')
  expect(result.text).toContain('frame di librerie omessi')
  expect(result.text).toContain('righe simili omesse')
})

test('livello leggero: raggruppa solo i log INFO, non le altre righe', () => {
  const info = Array.from({ length: 30 }, (_, n) => `[2026-10-15 10:${n}:00] local.INFO: richiesta ok id=${n}`)
  const other = Array.from({ length: 30 }, (_, n) => `riga di output numero ${n} con dettagli diversi ${'x'.repeat(60)}`)
  const result = compressOutput([...info, ...other, "[2026-10-15 11:00:00] local.ERROR: boom"].join('\n'), 'light', 500)

  expect(result.text).toContain('righe simili omesse')
  expect(result.text).toContain('local.ERROR: boom')
  expect(result.text).toContain('riga di output numero 17')
})

test('lascia intatti output brevi, JSON e livello none', () => {
  expect(compressOutput('ok', 'full', 1000).isChanged).toBe(false)
  expect(compressOutput(JSON.stringify({ righe: Array(500).fill('x') }), 'full', 100).isChanged).toBe(false)
  expect(compressOutput(LARAVEL_LOG, 'none', 100).isChanged).toBe(false)
})

// ---- Passaggi singoli ----

test('toglie colori e barre di avanzamento', () => {
  expect(cleanTerminal('\x1b[32mOK\x1b[0m')).toBe('OK')
  expect(cleanTerminal(' 10%\r 50%\r100% fatto')).toBe('100% fatto')
})

test('righe identiche diventano una con il conteggio', () => {
  expect(collapseDuplicates(['a', 'a', 'a', 'b'])).toEqual(['a (×3)', 'b'])
})

test('le righe importanti non si raggruppano mai', () => {
  const errors = Array.from({ length: 8 }, (_, n) => `ERROR riga ${n}`)

  expect(collapseSimilar(errors)).toEqual(errors)
  expect(isImportant('PHP Deprecated: funzione obsoleta')).toBe(true)
})

test('un solo frame di libreria resta com\'è', () => {
  const lines = ['#0 /app/vendor/x/Y.php(1): f()', '#1 /app/app/Z.php(2): g()']

  expect(collapseLibraryFrames(lines)).toEqual(lines)
})

test('la forma di una riga ignora numeri e percorsi', () => {
  expect(shapeOf('  - Installing a/b (v1.2.3): Extracting archive')).toBe(shapeOf('  - Installing c/d (v9.0.1): Extracting archive'))
})

// ---- Versioni di Laravel ----

test('legge la versione da composer.lock e da composer.json', () => {
  const lock = JSON.stringify({ packages: [{ name: 'laravel/framework', version: 'v11.31.0' }] })

  expect(versionFromLock(lock)).toEqual({ major: 11, minor: 31 })
  expect(versionFromComposerJson('{"require":{"laravel/framework":"^10.10"}}')).toEqual({ major: 10, minor: 10 })
  expect(versionFromLock('non json')).toBe(undefined)
})

test('struttura dai file: un progetto aggiornato può restare classico', () => {
  expect(layoutOf(true, true)).toBe('classic')
  expect(layoutOf(false, true)).toBe('slim')
  expect(layoutOf(false, false)).toBe('unknown')
})

test('guida adatta alla versione', () => {
  const v11 = laravelGuide({ major: 11, minor: 5 }, 'slim')
  const v10 = laravelGuide({ major: 10, minor: 48 }, 'classic')
  const v8 = laravelGuide({ major: 8, minor: 83 }, 'classic')

  expect(v11).toContain('bootstrap/app.php')
  expect(v11).toContain('config:show')
  expect(v11).toContain('model:show')
  expect(v10).toContain('app/Http/Kernel.php')
  expect(v10).not.toContain('config:show')
  expect(v10).toContain('db:table')
  expect(v8).not.toContain('model:show')
  expect(v8).toContain('--compact')
  expect(v11.length).toBeLessThan(900)
})

test('consiglio su route:list per versione', () => {
  expect(routeListAdvice({ major: 8, minor: 0 })).toContain('--compact')
  expect(routeListAdvice({ major: 12, minor: 0 })).toContain('--except-vendor')
})
