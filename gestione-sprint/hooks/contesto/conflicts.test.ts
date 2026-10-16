import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import {
  EMPTY_MEMORY,
  addToHistory,
  checkPrompt,
  checkSummary,
  looksLikeChange,
  memoryChecklist,
  memoryRecoveryNote,
  mergeReply,
  openConflicts,
  overlap,
  parseReply,
  resolveConflict,
  shouldCheck,
  takePending,
  type SessionMemory,
} from './conflicts'

const REPLY = JSON.stringify({
  decisioni: [{ tema: 'database', testo: 'usa MySQL per i dati dei clienti' }],
  contraddizioni: [{ tema: 'database', prima: 'usa MySQL per i dati dei clienti', poi: 'passa a SQL Server, non più MySQL' }],
})

const withHistory = (...requests: string[]): SessionMemory => requests.reduce(addToHistory, EMPTY_MEMORY)

// ---- Innesco ----

test('innesco: subito se cambi idea, altrimenti ogni 3 richieste', () => {
  expect(looksLikeChange('anzi, usa SQL Server')).toBe(true)
  expect(looksLikeChange('non più MySQL')).toBe(true)
  expect(looksLikeChange('NON PIÙ il vecchio schema')).toBe(true)
  expect(looksLikeChange('aggiungi un test')).toBe(false)
  expect(looksLikeChange('il cambiamento è pronto')).toBe(false)
  expect(looksLikeChange('usa Redis al posto di Memcached')).toBe(true)

  expect(shouldCheck(withHistory('usa MySQL'))).toBe(false)
  expect(shouldCheck(withHistory('usa MySQL', 'invece usa SQL Server'))).toBe(true)
  expect(shouldCheck(withHistory('a uno', 'b due'))).toBe(false)
  expect(shouldCheck(withHistory('a uno', 'b due', 'c tre'))).toBe(true)
  expect(shouldCheck(withHistory('a uno', 'b due'), true)).toBe(true)
  expect(addToHistory(EMPTY_MEMORY, '/peso').history).toEqual([])
})

test('richiesta al modello: decisioni valide, richieste numerate, formato JSON', () => {
  const prompt = checkPrompt(withHistory('usa MySQL', 'passa a SQL Server'))

  expect(prompt).toContain('1. usa MySQL')
  expect(prompt).toContain('2. passa a SQL Server')
  expect(prompt).toContain('NON è una contraddizione')
})

// ---- Lettura tollerante ----

test('risposta del modello: JSON anche con testo intorno; risposte rotte ignorate', () => {
  expect(parseReply(`Ecco: ${REPLY} fine`)?.conflicts.length).toBe(1)
  expect(parseReply('nessun json')).toBeUndefined()
  expect(parseReply('{rotto')).toBeUndefined()
  // una "contraddizione" con lo stesso testo prima e poi non è tale
  expect(parseReply('{"contraddizioni":[{"tema":"x","prima":"A b","poi":"a B"}]}')?.conflicts).toEqual([])
})

test('una contraddizione già vista non torna, nemmeno dopo averla risolta', () => {
  const memory = mergeReply(withHistory('usa MySQL', 'passa a SQL Server'), parseReply(REPLY)!)
  const id = openConflicts(memory)[0]!.id
  const resolved = resolveConflict(memory, id, 'nuova')

  expect(openConflicts(mergeReply(resolved, parseReply(REPLY)!))).toEqual([])
})

// ---- Le quattro scelte ----

test('vale la più recente: la vecchia diventa superata, il modello riceve la nota', () => {
  const memory = mergeReply(withHistory('usa MySQL', 'passa a SQL Server'), parseReply(REPLY)!)
  const resolved = resolveConflict(memory, openConflicts(memory)[0]!.id, 'nuova')
  const old = resolved.decisions.find(decision => decision.text === 'usa MySQL per i dati dei clienti')

  expect(old?.status).toBe('superata')
  expect(old?.replacedBy).toBe('passa a SQL Server, non più MySQL')
  const [notes, rest] = takePending(resolved)
  expect(notes[0]).toContain('vale «passa a SQL Server, non più MySQL»')
  expect(rest.pending).toEqual([])
})

test('vale la prima, valgono entrambe, non è una contraddizione', () => {
  const memory = mergeReply(withHistory('a', 'b'), parseReply(REPLY)!)
  const id = openConflicts(memory)[0]!.id

  expect(resolveConflict(memory, id, 'vecchia').decisions.find(d => d.text.startsWith('passa'))?.status).toBe('superata')
  expect(resolveConflict(memory, id, 'entrambe').decisions.every(d => d.status === 'valida')).toBe(true)
  const dismissed = resolveConflict(memory, id, 'nessuna')
  expect(openConflicts(dismissed)).toEqual([])
  expect(dismissed.pending).toEqual([])
})

// ---- Compattazione pulita ----

test('istruzioni: valide da riportare, superate da non riportare, aperte come domanda', () => {
  const memory = mergeReply(withHistory('a', 'b'), parseReply(REPLY)!)
  const open = memoryChecklist(memory)
  expect(open).toContain('NON ancora chiarite')

  const resolved = memoryChecklist(resolveConflict(memory, openConflicts(memory)[0]!.id, 'nuova'))
  expect(resolved).toContain('SUPERATE')
  expect(resolved).toContain('«usa MySQL per i dati dei clienti» → «passa a SQL Server, non più MySQL»')
})

test('verifica del riassunto: trova la decisione superata riportata come valida', () => {
  const memory = mergeReply(withHistory('a', 'b'), parseReply(REPLY)!)
  const resolved = resolveConflict(memory, openConflicts(memory)[0]!.id, 'nuova')

  const bad = checkSummary(resolved, 'Decisioni: usa MySQL per i dati dei clienti. Prossimo passo: migrazione.')
  expect(bad.stale.length).toBe(1)
  expect(memoryRecoveryNote(bad, resolved)).toContain('ATTENZIONE: «usa MySQL per i dati dei clienti» è superata')

  const good = checkSummary(resolved, 'MySQL per i dati dei clienti è stato sostituito. Decisione: passa a SQL Server, non più MySQL.')
  expect(good.stale).toEqual([])
  expect(good.missing).toEqual([])
  expect(memoryRecoveryNote(good, resolved)).toBeUndefined()
})

test('somiglianza tra testi: parole significative in comune', () => {
  expect(overlap('usa SQL Server per i clienti', 'useremo SQL Server per tutti i clienti')).toBeGreaterThan(0.5)
  expect(overlap('usa SQL Server per i clienti', 'aggiorna la documentazione')).toBe(0)
})

// ---- Dal vivo: dalla richiesta alla scelta, fino al riassunto ----

const BAND = {
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 140, scroll: { offset: 0, bodyRows: 10 }, view: {} } as never,
}

test('cambi idea: la banda chiede quale vale, la scelta arriva al modello e al riassunto', async ($: Engine, on) => {
  let modelCalls = 0
  let lastContext: readonly string[] = []
  let instructions = ''
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', () => ({ value: undefined }) as never)
  on('model.complete', () => {
    modelCalls += 1

    return { value: { isAnswered: true, text: REPLY, usage: {} } } as never
  })
  on('prompt.submit', (_$, e) => {
    lastContext = e.context ?? []

    return { text: e.text, context: e.context } as never
  })
  on('turn.complete', () => ({ text: 'ok' }) as never)
  on('session.compact', (_$, e) => {
    instructions = e.instructions ?? ''

    return { messages: [{ role: 'user', text: 'Riassunto: usa MySQL per i dati dei clienti.', toolUses: [] }] } as never
  })

  await $.session.measure({ context: { tokens: 40000, window: 200000, percent: 20 }, rateLimits: [], changed: ['context'] } as never)
  const turn = () => $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)

  await $.prompt.submit({ text: 'usa MySQL per i dati dei clienti' } as never)
  await turn()
  await clock.advance(10)
  expect(modelCalls).toBe(0)

  await $.prompt.submit({ text: 'anzi passa a SQL Server, non più MySQL' } as never)
  await turn()
  await clock.advance(10)
  expect(modelCalls).toBe(1)

  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  expect(JSON.stringify(await ui.drawn())).toContain('Contraddizione su «database»')
  await ui.press({ key: 'proposta-keepNew' })
  expect(JSON.stringify(await ui.drawn())).not.toContain('Contraddizione su')
  await ui.unmount()

  // La scelta arriva al modello con il tuo messaggio successivo.
  await $.prompt.submit({ text: 'procedi con la migrazione' } as never)
  expect(lastContext.join('\n')).toContain('vale «passa a SQL Server, non più MySQL»')

  // Il riassunto riceve la regola e, se sbaglia, la nota di correzione arriva dopo.
  await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)
  expect(instructions).toContain('SUPERATE')

  await $.prompt.submit({ text: 'continua' } as never)
  expect(lastContext.join('\n')).toContain('ATTENZIONE: «usa MySQL per i dati dei clienti» è superata')
})

// ---- Prima chiarisco, poi compatto ----


test('compattazione con una contraddizione aperta: si ferma, chiede, e compatta appena chiarita', async ($: Engine, on) => {
  let compacted = 0
  let instructions = ''
  const toasts: string[] = []
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', (_$, e) => {
    toasts.push(JSON.stringify(e))

    return { value: undefined } as never
  })
  on('model.complete', () => ({ value: { isAnswered: true, text: REPLY, usage: {} } }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }) as never)
  on('turn.complete', () => ({ text: 'ok' }) as never)
  on('session.compact', (_$, e) => {
    compacted += 1
    instructions = e.instructions ?? ''

    return { messages: [{ role: 'user', text: 'Riassunto: passa a SQL Server, non più MySQL.', toolUses: [] }] } as never
  })

  await $.session.measure({ context: { tokens: 170000, window: 200000, percent: 85 }, rateLimits: [], changed: ['context'] } as never)
  await $.prompt.submit({ text: 'usa MySQL per i dati dei clienti' } as never)
  await $.prompt.submit({ text: 'passa a SQL Server, non più MySQL' } as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await clock.advance(10)

  // 1. Chiedi di compattare: prima il controllo, poi la domanda. Niente compattazione.
  await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)
  expect(compacted).toBe(0)
  expect(toasts.join(' ')).toContain('Prima di compattare chiarisci una contraddizione')

  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'desktop', ...BAND })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('Prima di compattare (1 di 1)')
  expect(await ui.find({ key: 'proposta-compactAnyway' })).toBeDefined()
  // la proposta "Compatta ora" sparisce mentre si chiarisce
  expect(await ui.find({ key: 'proposta-compact' })).toBeUndefined()

  // 2. Chiarisci: la compattazione parte da sola, con la scelta dentro le istruzioni.
  await ui.press({ key: 'proposta-keepNew' })
  await clock.advance(100)
  expect(compacted).toBe(1)
  expect(instructions).toContain('SUPERATE')
  expect(instructions).not.toContain('NON ancora chiarite')
  await ui.unmount()
})

test('"Compatta lo stesso" compatta con la domanda aperta; "Annulla" non compatta', async ($: Engine, on) => {
  let compacted = 0
  let instructions = ''
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', () => ({ value: undefined }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: REPLY, usage: {} } }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }) as never)
  on('turn.complete', () => ({ text: 'ok' }) as never)
  on('session.compact', (_$, e) => {
    compacted += 1
    instructions = e.instructions ?? ''

    return { messages: [{ role: 'user', text: 'Riassunto.', toolUses: [] }] } as never
  })

  await $.session.measure({ context: { tokens: 170000, window: 200000, percent: 85 }, rateLimits: [], changed: ['context'] } as never)
  await $.prompt.submit({ text: 'usa MySQL per i dati dei clienti' } as never)
  await $.prompt.submit({ text: 'passa a SQL Server, non più MySQL' } as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)

  await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)
  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  await ui.press({ key: 'proposta-cancelCompact' })
  await clock.advance(100)
  expect(compacted).toBe(0)
  expect(JSON.stringify(await ui.drawn())).not.toContain('Prima di compattare')

  await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)
  await ui.press({ key: 'proposta-compactAnyway' })
  await clock.advance(100)
  expect(compacted).toBe(1)
  expect(instructions).toContain('NON ancora chiarite')
  await ui.unmount()
})

// ---- Correzioni ----

test('una richiesta arrivata durante il controllo resta da controllare', () => {
  const before = withHistory('usa MySQL', 'passa a SQL Server')
  const seen = before.total
  const during = addToHistory(before, 'invece torna a MySQL')
  const merged = mergeReply(during, parseReply(REPLY)!, seen)

  expect(shouldCheck(merged)).toBe(true)
  expect(mergeReply(during, parseReply(REPLY)!).checked).toBe(during.total)
})

test('senza suggerimenti proattivi i chiarimenti prima di compattare compaiono lo stesso', { options: { proactive: false } }, async ($: Engine, on) => {
  let compacted = 0
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', () => ({ value: undefined }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: REPLY, usage: {} } }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }) as never)
  on('turn.complete', () => ({ text: 'ok' }) as never)
  on('session.compact', () => {
    compacted += 1

    return { messages: [{ role: 'user', text: 'Riassunto.', toolUses: [] }] } as never
  })

  await $.session.measure({ context: { tokens: 190000, window: 200000, percent: 95 }, rateLimits: [], changed: ['context'] } as never)
  await $.prompt.submit({ text: 'usa MySQL per i dati dei clienti' } as never)
  await $.prompt.submit({ text: 'passa a SQL Server, non più MySQL' } as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)

  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  // nessuna proposta proattiva (né "Compatta ora" né la contraddizione in background)
  expect(JSON.stringify(await ui.drawn())).not.toContain('Contraddizione su')

  await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)
  expect(JSON.stringify(await ui.drawn())).toContain('Prima di compattare (1 di 1)')
  await ui.press({ key: 'proposta-keepOld' })
  await clock.advance(100)
  expect(compacted).toBe(1)
  await ui.unmount()
})

// ---- Correzioni 1.3.1 ----

test('la stessa contraddizione riformulata dal modello non torna dopo averla chiarita', () => {
  const memory = mergeReply(withHistory('a', 'b'), parseReply(REPLY)!)
  const resolved = resolveConflict(memory, openConflicts(memory)[0]!.id, 'nuova')
  const reworded = JSON.stringify({
    decisioni: [{ tema: 'db', testo: 'usa MySQL per i dati dei clienti!' }],
    contraddizioni: [{ tema: 'database clienti', prima: 'Usa MySQL per i dati dei clienti.', poi: 'passa a SQL Server non più MySQL' }],
  })
  const again = mergeReply(resolved, parseReply(reworded)!)

  expect(openConflicts(again)).toEqual([])
  // la decisione superata non torna valida, e non si duplica
  expect(again.decisions.filter(d => d.text.toLowerCase().includes('usa mysql')).map(d => d.status)).toEqual(['superata'])
})

test('molte contraddizioni chiarite non fanno sparire quelle ancora aperte', () => {
  let memory = withHistory('a', 'b')
  for (let n = 0; n < 15; n++) {
    memory = mergeReply(memory, parseReply(JSON.stringify({ contraddizioni: [{ tema: `t${n}`, prima: `scelta vecchia numero ${n} alfa`, poi: `scelta nuova numero ${n} beta` }] }))!)
    if (n > 0) {
      memory = resolveConflict(memory, openConflicts(memory).find(c => c.topic === `t${n}`)!.id, 'nessuna')
    }
  }

  expect(openConflicts(memory).map(c => c.topic)).toEqual(['t0'])
  expect(memory.conflicts.length).toBeLessThanOrEqual(10)
})

test('compattazione a fine turno e automatica insieme: una sola compattazione', { options: { autoCompactPercent: 50, conflictCheck: false } }, async ($: Engine, on) => {
  let compacted = 0
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: { context: { tokens: 170000, window: 200000, percent: 85 }, rateLimits: [] } }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }) as never)
  on('turn.complete', () => ({ text: 'ok' }) as never)
  on('session.compact', async () => {
    compacted += 1

    return { messages: [{ role: 'user', text: 'Riassunto.', toolUses: [] }] } as never
  })

  await $.session.measure({ context: { tokens: 170000, window: 200000, percent: 85 }, rateLimits: [], changed: ['context'] } as never)
  await $.prompt.submit({ text: 'lavora' } as never)

  const working = { ...BAND, props: { ...(BAND.props as object), isWorking: true } as never }
  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...working })
  await ui.press({ key: 'proposta-compact' })
  await ui.unmount()

  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await clock.advance(200)
  expect(compacted).toBe(1)
})

import { similar } from './conflicts'

test('somiglianza: riformulazioni sì, numeri diversi no', () => {
  expect(similar('Usa MySQL per i dati dei clienti.', 'usa mysql per i dati dei clienti')).toBe(true)
  expect(similar('usa MySQL 5.7 per i clienti', 'usa MySQL 8.0 per i clienti')).toBe(false)
  expect(similar('usa SQL Server', 'usa MySQL')).toBe(false)
})
