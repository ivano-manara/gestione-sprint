import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { anchorsOf, budgetFor, collapseInterleaved, compressOutput, keepHeadTail, missingAnchors } from './compress'
import {
  EMPTY_LEDGER,
  addFailure,
  addFile,
  addRequest,
  compactInstructions,
  coverage,
  firstErrorLine,
  missingFromSummary,
  recoveryNote,
  resolveCommand,
} from './ledger'

// ---- Garanzia sulla compressione ----

test('le ancore: errori, riepiloghi e riferimenti al codice del progetto, non alle librerie', () => {
  const { keys, exact } = anchorsOf([
    'PHP Fatal error:  Uncaught Error: Call to undefined method in app/Models/Cliente.php:42',
    '#0 /app/vendor/laravel/framework/src/Builder.php(10): x()',
    'Tests:    1 failed, 20 passed (40 assertions)',
  ])

  // l'errore e il riepilogo con "failed"
  expect(keys.size).toBe(2)
  expect(exact.has('app/Models/Cliente.php:42')).toBe(true)
  expect([...exact].some(ref => ref.includes('vendor'))).toBe(false)
  expect(exact.has('Tests:    1 failed, 20 passed (40 assertions)')).toBe(true)
})

test('una passata che perde un errore viene scartata: si ripiega sul livello leggero', () => {
  // 900 righe di rumore con 300 errori diversi sparsi: il taglio inizio/fine del livello completo ne perderebbe.
  const lines = Array.from({ length: 900 }, (_, n) =>
    n % 3 === 0 ? `ERROR ordine ${n} rifiutato: saldo insufficiente sul conto ${n * 7}` : `elaborazione passo ${n} completata`,
  )
  const result = compressOutput(lines.join('\n'), 'full', 100, 120)

  expect(result.fallbacks).toBeGreaterThan(0)
  for (let n = 0; n < 900; n += 3) {
    expect(result.text).toContain(`ERROR ordine ${n} rifiutato`)
  }
})

test('nessun riferimento file:riga del progetto si perde, anche in output enormi', () => {
  const lint = Array.from({ length: 700 }, (_, n) => `src/servizi/modulo${n}.py:${n + 1}:1: F401 import inutilizzato`)
  const result = compressOutput(lint.join('\n'), 'full', 100, 100)

  expect(missingAnchors(lint, result.text.split('\n'))).toEqual([])
  expect(result.text).toContain('src/servizi/modulo699.py:700')
})

test('il taglio inizio/fine tiene il contesto intorno agli errori', () => {
  const lines = Array.from({ length: 300 }, (_, n) => `riga ${n}`)
  lines[150] = 'Connessione al database: host=db porta=5432'
  lines[151] = 'SQLSTATE[HY000] [2002] Connection refused'
  const out = keepHeadTail(lines, 100)

  expect(out).toContain('Connessione al database: host=db porta=5432')
  expect(out).toContain('SQLSTATE[HY000] [2002] Connection refused')
  expect(out.some(line => line.includes('righe omesse'))).toBe(true)
})

test('log intrecciati: le forme frequenti restano due volte con il conteggio', () => {
  const lines = Array.from({ length: 40 }, (_, n) =>
    n % 2 === 0 ? `[10:00:${n}] richiesta GET /api/clienti/${n} servita` : `[10:00:${n}] cache aggiornata per chiave k${n}`,
  )
  const out = collapseInterleaved(lines)

  expect(out.length).toBeLessThan(10)
  expect(out.join('\n')).toContain('altre 18 righe come questa')
  expect(collapseInterleaved(['ERROR uno', 'ERROR uno', 'ERROR uno'], 2)).toEqual(['ERROR uno', 'ERROR uno', 'ERROR uno'])
})

test('budget adattivo al riempimento del contesto', () => {
  expect(budgetFor(20, 3000)).toEqual({ maxLines: 600, minChars: 3000 })
  expect(budgetFor(55, 3000).maxLines).toBe(400)
  expect(budgetFor(85, 3000)).toEqual({ maxLines: 250, minChars: 1800 })
})

// ---- Registro del lavoro e verifica della compattazione ----

const LEDGER = addRequest(
  addFailure(addFile(addFile(EMPTY_LEDGER, 'app/Models/Cliente.php'), 'routes/api.php'), 'php artisan test', 'FAILED Tests\\Feature\\ClienteTest > it lists clienti'),
  'sistema il test dei clienti senza toccare le migrazioni',
)

test('il registro: file senza doppioni, errori chiusi quando il comando riesce, niente comandi slash', () => {
  const again = addFile(LEDGER, 'app/Models/Cliente.php')

  expect(again.files).toEqual(['routes/api.php', 'app/Models/Cliente.php'])
  expect(resolveCommand(LEDGER, 'php artisan test').errors).toEqual([])
  expect(resolveCommand(LEDGER, 'CC_RAW=1 php artisan test').errors).toEqual([])
  expect(addRequest(LEDGER, '/peso').requests.length).toBe(1)
  expect(firstErrorLine('ok\n  FAILED  Tests\\X > y\naltro')).toBe('FAILED  Tests\\X > y')
})

test('le istruzioni di compattazione hanno struttura fissa e punti obbligatori', () => {
  const text = compactInstructions(LEDGER, ['nota utente'])

  expect(text).toContain('[gestione-sprint]')
  expect(text).toContain('Copia alla lettera')
  expect(text).toContain('app/Models/Cliente.php, routes/api.php')
  expect(text).toContain('FAILED Tests\\Feature\\ClienteTest')
  expect(text).toContain('nota utente')
})

test('verifica del riassunto: torna solo ciò che manca', () => {
  const summary = 'Obiettivo: test clienti. File: Cliente.php modificato. Errore aperto: FAILED Tests\\Feature\\ClienteTest > it lists clienti.'
  const missing = missingFromSummary(LEDGER, summary)

  expect(missing.files).toEqual(['routes/api.php'])
  expect(missing.errors).toEqual([])
  expect(coverage(LEDGER, missing)).toEqual({ kept: 2, total: 4 })
  expect(recoveryNote(missing)).toContain('routes/api.php')
  expect(recoveryNote(missingFromSummary(LEDGER, `${summary} routes/api.php sistema il test dei clienti senza toccare`))).toBeUndefined()
})

// ---- Dal vivo: compattazione verificata e nota di continuità ----

test('compattazione: istruzioni arricchite, riassunto verificato, mancanti al messaggio dopo', async ($: Engine, on) => {
  let instructions = ''
  let context: readonly string[] = []

  let toast = ''
  on('ui.toast', (_$, e) => {
    toast = String((e as unknown as { text?: string }).text ?? JSON.stringify(e))

    return { value: undefined } as never
  })
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('session.compact', (_$, e) => {
    instructions = e.instructions ?? ''

    return { messages: [{ role: 'user', text: 'Riassunto: lavorato sui clienti.', toolUses: [] }], tokensBefore: 90000, tokensAfter: 9000 } as never
  })
  on('prompt.submit', (_$, e) => {
    context = e.context ?? []

    return { text: e.text, context: e.context } as never
  })

  await $.tool.call({ tool_use_id: 'w1', tool: 'Write', file_path: 'app/Services/Fatture.php', content: 'x' } as never)
  const result = await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)

  expect(JSON.stringify(result)).toContain('Compattazione avviata')
  expect(instructions).toContain('app/Services/Fatture.php')
  expect(toast).toContain('Riassunto verificato')

  await $.prompt.submit({ text: 'continua' } as never)
  expect(context.join('\n')).toContain('app/Services/Fatture.php')

  // La nota arriva una volta sola.
  await $.prompt.submit({ text: 'ancora' } as never)
  expect(context.join('\n')).not.toContain('Promemoria di continuità')
})

test('Bash: un fallimento entra nel registro e si chiude quando il comando riesce', async ($: Engine, on) => {
  let isFailing = true
  let instructions = ''
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('tool.call', () =>
    (isFailing
      ? { result: 'x', isError: true, text: 'Running tests...\n  FAILED  Tests\\Unit\\IbanTest > valida iban italiano\n' }
      : { result: { stdout: 'Tests: 12 passed', stderr: '' } }) as never,
  )
  on('session.compact', (_$, e) => {
    instructions = e.instructions ?? ''

    return { messages: [{ role: 'user', text: 'ok', toolUses: [] }] } as never
  })
  on('ui.toast', () => ({ value: undefined }) as never)

  await $.tool.call({ tool_use_id: 'b1', tool: 'Bash', command: 'php artisan test --filter Iban' } as never)
  await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)
  expect(instructions).toContain('FAILED Tests\\Unit\\IbanTest > valida iban italiano')

  isFailing = false
  await $.tool.call({ tool_use_id: 'b2', tool: 'Bash', command: 'php artisan test --filter Iban' } as never)
  await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)
  expect(instructions).not.toContain('IbanTest')
})
