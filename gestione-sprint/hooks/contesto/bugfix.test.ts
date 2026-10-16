import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { EMPTY_LEDGER, addFailure, resolveCommand } from './ledger'

// Regressioni corrette nella 1.1.1: ogni test riproduce un difetto trovato in revisione.

const PASSED = 'eseguito-dal-test'
let count = 0
const call = async ($: Engine, input: object): Promise<string> => {
  count += 1

  return JSON.stringify(await $.tool.call({ tool_use_id: `f${count}`, ...input } as never))
}

test('Grep: cercare la parola "build" non è entrare nella cartella build', async ($, on) => {
  on('tool.call', () => ({ result: PASSED }) as never)

  expect(await call($, { tool: 'Grep', pattern: 'build' })).toContain(PASSED)
  expect(await call($, { tool: 'Grep', pattern: 'vendor_id', path: 'app' })).toContain(PASSED)
  // Restano bloccati percorso e glob dentro una cartella esclusa.
  expect(await call($, { tool: 'Grep', pattern: 'x', path: 'node_modules/react' })).toContain('è esclusa')
  expect(await call($, { tool: 'Grep', pattern: 'x', glob: 'build/**/*.js' })).toContain('è esclusa')
  expect(await call($, { tool: 'Glob', pattern: 'node_modules/**/*.js' })).toContain('è esclusa')
})

test('un test completo che passa chiude anche i fallimenti dei test filtrati', () => {
  const ledger = addFailure(addFailure(EMPTY_LEDGER, 'php artisan test --filter Iban', 'FAILED Iban'), 'composer install', 'error')

  expect(resolveCommand(ledger, 'php artisan test').errors.map(item => item.command)).toEqual(['composer install'])
  // Il contrario no: un test filtrato che passa non dice nulla sugli altri.
  const wide = addFailure(EMPTY_LEDGER, 'php artisan test', 'FAILED X')
  expect(resolveCommand(wide, 'php artisan test --filter Iban').errors.length).toBe(1)
})

test('Bash: un fallimento senza riga d\'errore riconoscibile entra comunque nel registro', async ($, on) => {
  let instructions = ''
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('tool.call', () => ({ result: 'x', isError: true, text: 'Exit code 2\n' }) as never)
  on('session.compact', (_$, e) => {
    instructions = e.instructions ?? ''

    return { messages: [{ role: 'user', text: 'ok', toolUses: [] }] } as never
  })
  on('ui.toast', () => ({ value: undefined }) as never)

  await call($, { tool: 'Bash', command: 'make deploy' })
  await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)

  expect(instructions).toContain('"Exit code 2" (make deploy)')
})

test('dopo la compattazione la banda non resta sulla vecchia percentuale', async ($, on) => {
  let percent = 95
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: { context: { tokens: percent * 2000, window: 200000, percent }, rateLimits: [] } }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('session.compact', () => {
    percent = 12

    return { messages: [{ role: 'user', text: 'riassunto', toolUses: [] }] } as never
  })

  await $.session.measure({ context: { tokens: 190000, window: 200000, percent: 95 }, rateLimits: [], changed: ['context'] } as never)

  const band = {
    component: 'AbovePrompt' as const,
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} } as never,
  }
  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...band })
  expect(JSON.stringify(await ui.drawn())).toContain('vuoi compattare adesso?')

  await ui.press({ key: 'proposta-compact' })
  await clock.advance(100)

  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).not.toContain('vuoi compattare adesso?')
  expect(drawn).toContain('12%')
  await ui.unmount()
})

// ---- Seconda passata (1.1.2) ----

import { compressOutput } from './compress'
import { versionFromRequirements } from './langchain'
import { heavyKindOf, isSecretFile, isSecretTarget, secretFileInCommand } from './stack'

test('credenziali: protette anche con head, tail, grep, sed e nelle catene', () => {
  expect(secretFileInCommand('head -n 5 .env')).toBe('.env')
  expect(secretFileInCommand('grep DB_PASSWORD .env.local')).toBe('.env.local')
  expect(secretFileInCommand('cd app && tail .env')).toBe('.env')
  expect(secretFileInCommand('Get-Content .env.production')).toBe('.env.production')
  expect(secretFileInCommand('type C:\\app\\.env')).toBe('C:\\app\\.env')
  // Lecito: i modelli, e comandi che non stampano il contenuto.
  expect(secretFileInCommand('cat .env.example')).toBeUndefined()
  expect(secretFileInCommand('cp .env.example .env')).toBeUndefined()
  expect(secretFileInCommand('php artisan key:generate')).toBeUndefined()
})

test('credenziali: file di Composer, npm, pip e git riconosciuti', () => {
  expect(isSecretFile('auth.json')).toBe(true)
  expect(isSecretFile('C:\\Users\\i\\.git-credentials')).toBe(true)
  expect(isSecretFile('.pypirc')).toBe(true)
  expect(isSecretFile('composer.json')).toBe(false)
  expect(isSecretTarget('.env*')).toBe(true)
  expect(isSecretTarget('**/.env')).toBe(true)
  expect(isSecretTarget('*.php')).toBe(false)
})

test('Grep dentro .env viene rifiutato', async ($, on) => {
  on('tool.call', () => ({ result: PASSED }) as never)

  expect(await call($, { tool: 'Grep', pattern: 'PASSWORD', path: '.env' })).toContain('credenziali')
  expect(await call($, { tool: 'Grep', pattern: 'APP_', glob: '.env*' })).toContain('credenziali')
  expect(await call($, { tool: 'Grep', pattern: 'APP_', path: '.env.example' })).toContain(PASSED)
  expect(await call($, { tool: 'Bash', command: 'grep DB_ .env' })).toContain('credenziali')
})

test('.sql è codice (procedure T-SQL), non dati: solo dump e backup sono pesanti', () => {
  expect(heavyKindOf('database/procedures/sp_Aml_Controlli.sql')).toBeUndefined()
  expect(heavyKindOf('db/views/vw_Mifid.sql')).toBeUndefined()
  expect(heavyKindOf('backup/dump_2026-10-01.sql')).toBe('data')
  expect(heavyKindOf('database/seed_clienti.sql')).toBe('data')
})

test('versioni Poetry riconosciute', () => {
  expect(versionFromRequirements('[tool.poetry.dependencies]\nlangchain = "^0.3.7"\n', 'langchain')).toEqual({ major: 0, minor: 3 })
  expect(versionFromRequirements('langgraph = { version = ">=1.0.1", extras = ["x"] }', 'langgraph')).toEqual({ major: 1, minor: 0 })
  expect(versionFromRequirements('langchain-core = "^0.3"', 'langchain')).toBeUndefined()
})

test('output di Windows (CRLF): compresso e verificato come gli altri', () => {
  const text = [...Array.from({ length: 200 }, (_, n) => `  ✓ caso ${n}   0.01s`), '  FAILED  Tests\\Unit\\X > y', '  Tests:    1 failed, 200 passed'].join('\r\n')
  const result = compressOutput(text, 'full', 500)

  expect(result.isChanged).toBe(true)
  expect(result.text).toContain('FAILED  Tests\\Unit\\X > y')
  expect(result.text).toContain('Tests:    1 failed, 200 passed')
  expect(result.text).not.toContain('\r')
})

import { truncateLongLine } from './compress'

test('righe enormi: inizio e fine, ma mai a costo di un errore nascosto nel mezzo', () => {
  const payload = `{"dati":"${'x'.repeat(20000)}"}`

  expect(truncateLongLine(payload).length).toBeLessThan(1700)
  expect(compressOutput(`risposta: ${payload}\nfine`, 'light', 500).text.length).toBeLessThan(2000)

  const hidden = `inizio ${'a'.repeat(5000)} SQLSTATE[23000] violazione del vincolo ${'b'.repeat(5000)}`
  expect(compressOutput(hidden, 'light', 500).text).toContain('SQLSTATE[23000] violazione del vincolo')
})

test('righe patologiche non bloccano più Claude Code (prima: minuti o ore di calcolo)', () => {
  const inputs = [
    '[' + '1234567890'.repeat(20000),
    'a/'.repeat(50000) + 'x.php',
    'at ' + 'y'.repeat(100000) + ':',
    'File "' + 'z'.repeat(100000),
    '='.repeat(100000) + ' passed',
    "AIMessage(content='" + 'w'.repeat(200000),
  ]

  for (const text of inputs) {
    for (const level of ['light', 'full'] as const) {
      expect(compressOutput(text, level, 1000).text.length).toBeLessThan(2000)
    }
  }
})

test('credenziali: anche git diff, git show e git log -p', () => {
  expect(secretFileInCommand('git diff .env')).toBe('.env')
  expect(secretFileInCommand('git show HEAD:.env')).toBe('HEAD:.env')
  expect(secretFileInCommand('git log -p -- auth.json')).toBe('auth.json')
  expect(secretFileInCommand('git diff app/Models/Cliente.php')).toBeUndefined()
  expect(secretFileInCommand('git add .env.example')).toBeUndefined()
})

// ---- Terza passata (1.1.3) ----

import { blockedDirIn } from './logic'

test('cartelle escluse: i namespace PHP in PascalCase non sono cartelle generate', () => {
  const dirs = ['vendor', 'build', 'target', 'coverage', 'node_modules']

  expect(blockedDirIn('app/Models/Target/Obiettivo.php', dirs)).toBeUndefined()
  expect(blockedDirIn('app\\Services\\Build\\Pipeline.php', dirs)).toBeUndefined()
  expect(blockedDirIn('src/Coverage/Report.php', dirs)).toBeUndefined()
  // Le cartelle vere restano bloccate, anche scritte in maiuscolo su Windows.
  expect(blockedDirIn('C:\\progetto\\vendor\\autoload.php', dirs)).toBe('vendor')
  expect(blockedDirIn('C:\\PROGETTO\\NODE_MODULES\\x.js', dirs)).toBe('node_modules')
  expect(blockedDirIn('public/build/assets/app.js', dirs)).toBe('build')
})

test('credenziali: scrivere in .env con una redirezione non è leggerlo', () => {
  expect(secretFileInCommand('cat >> .env << EOF')).toBeUndefined()
  expect(secretFileInCommand('cat .env.example > .env')).toBeUndefined()
  expect(secretFileInCommand('type nul > .env')).toBeUndefined()
  expect(secretFileInCommand('cat .env > /tmp/copia')).toBe('.env')
})

test('compattazione chiesta durante un turno: parte a fine turno, non fallisce', async ($: Engine, on) => {
  let compacted = 0
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', () => ({ value: undefined }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }) as never)
  on('turn.complete', () => ({ text: 'fatto' }) as never)
  on('session.compact', () => {
    compacted += 1

    return { messages: [{ role: 'user', text: 'riassunto', toolUses: [] }] } as never
  })

  await $.session.measure({ context: { tokens: 190000, window: 200000, percent: 95 }, rateLimits: [], changed: ['context'] } as never)
  await $.prompt.submit({ text: 'continua il lavoro' } as never)

  // Il pannello non sa se il modello lavora: il mod sì.
  const pane = await $.ui.mount({
    plugin: 'gestione-sprint',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'controllo-contesto',
    props: { title: 'Contesto', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as never,
  })
  await pane.press({ key: 'p-context-compact' })
  await clock.advance(100)
  expect(compacted).toBe(0)

  await $.turn.complete({ answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await clock.advance(100)
  expect(compacted).toBe(1)
  await pane.unmount()
})
