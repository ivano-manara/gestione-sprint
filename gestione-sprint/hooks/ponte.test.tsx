import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { voceCitata } from './register'

// Integrazione dei due moduli: memoria della sessione (chat) e memoria di progetto (piano).

const BAND = {
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 140, scroll: { offset: 0, bodyRows: 10 }, view: {} } as never,
}

test('una voce di progetto si riconosce anche citata con parole simili', () => {
  const voci = [{ id: 'M1', testo: 'il database del progetto e SQL Server', tipo: 'memoria' as const }]
  expect(voceCitata(voci, 'il database del progetto e SQL Server')?.id).toBe('M1')
  expect(voceCitata(voci, 'aggiungi un test')).toBeUndefined()
})

test('chat contro memoria di progetto: la contraddizione si propone, la scelta aggiorna il piano', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const radice = '/progetto'
  const files = new Map<string, string>()
  const v = (value: unknown) => ({ value }) as never
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  let promptControllo = ''
  let istruzioni = ''

  on('session.root', () => v(radice))
  on('session.cwd', () => v(radice))
  on('session.start', () => ({ cwd: radice }) as never)
  on('fs.exists', ($, e) => v(files.has(e.path)))
  on('fs.read', ($, e) => {
    const t = files.get(e.path)
    if (t === undefined) throw new Error('ENOENT')
    return v(t)
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return v(undefined)
  })
  for (const op of ['ui.status', 'ui.toast'] as const) on(op, () => v(undefined))
  on('ui.open', () => v({ isPlaced: true }))
  on('command.register', () => v({}))
  on('tool.register', ($, e) => v({ tool: e.name }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  const chiamate: string[] = []
  on('model.complete', ($, e) => {
    chiamate.push(e.prompt.slice(0, 40))
    if (e.prompt.includes('Decisioni già valide')) {
      promptControllo = e.prompt
      return v({
        isAnswered: true,
        usage: {},
        text: JSON.stringify({
          decisioni: [{ tema: 'database', testo: 'usa PostgreSQL al posto di SQL Server' }],
          contraddizioni: [{ tema: 'database', prima: 'il database del progetto e SQL Server', poi: 'usa PostgreSQL al posto di SQL Server' }],
        }),
      })
    }
    return v({ isAnswered: true, usage: {}, text: '{"conflitti":[],"conflitto":false,"con":[]}' })
  })
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }) as never)
  on('turn.complete', () => ({ text: 'ok' }) as never)
  on('session.compact', (_$, e) => {
    istruzioni = e.instructions ?? ''
    return { messages: [{ role: 'user', text: 'Riassunto.', toolUses: [] }] } as never
  })
  await $.session.start({ cwd: radice } as never)

  await $.tool.call({
    tool: 'mcp__gestione-sprint__piano_aggiorna',
    progetto: { nome: 'demo' },
    memoria: [{ testo: 'il database del progetto e SQL Server', fonte: 'CLAUDE.md:3', tipo: 'stack' }],
    sprint: [{ titolo: 'base', task: [{ titolo: 'schema', criteri: ['lo script crea le tabelle'], stima: 2, vincoli: ['M1'] }] }],
  } as never)

  await $.session.measure({ context: { tokens: 40000, window: 200000, percent: 20 }, rateLimits: [], changed: ['context'] } as never)
  await $.prompt.submit({ text: 'usa PostgreSQL al posto di SQL Server' } as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await clock.advance(10)

  // il controllo della chat ha visto la memoria di progetto
  expect(promptControllo).toContain('[progetto M1] il database del progetto e SQL Server')

  // la banda mostra la contraddizione e la riga del piano
  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  expect(JSON.stringify(await ui.drawn())).toContain('Contraddizione su')
  expect(await ui.find({ key: 'apri-sprint' })).toBeDefined()
  await ui.press({ key: 'proposta-keepNew' })
  await ui.unmount()

  // la scelta fatta in chat ha seguito il percorso del pannello: memoria superata, aggiornamento da approvare, task da rivedere
  const piano = JSON.parse(files.get(`${radice}/.claude/sprint/piano.json`) ?? '{}')
  expect(piano.memoria[0].stato).toBe('superata')
  expect(piano.aggiornamentiMemoria[0].stato).toBe('da-applicare')
  expect(piano.sprint[0].task[0].daRivedere).toContain('M1')

  // la compattazione non riassume il piano: lo indica come fonte di verita
  await $.command.run({ command: 'alleggerisci', args: '' } as never)
  await clock.advance(100)
  expect(istruzioni).toContain('Piano sprint: la fonte di verita')
})

test('senza misura del contesto la banda mostra la riga del piano; le fonti lunghe si leggono a pezzi', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const radice = '/progetto'
  const files = new Map<string, string>()
  const v = (value: unknown) => ({ value }) as never
  on('session.root', () => v(radice))
  on('session.cwd', () => v(radice))
  on('session.start', () => ({ cwd: radice }) as never)
  on('fs.exists', ($, e) => v(files.has(e.path)))
  on('fs.read', ($, e) => {
    const t = files.get(e.path)
    if (t === undefined) throw new Error('ENOENT')
    return v(t)
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return v(undefined)
  })
  for (const op of ['ui.status', 'ui.toast'] as const) on(op, () => v(undefined))
  on('ui.open', () => v({ isPlaced: true }))
  on('command.register', () => v({}))
  on('tool.register', ($, e) => v({ tool: e.name }))
  on('model.complete', () => v({ isAnswered: true, usage: {}, text: '{"conflitti":[]}' }))
  await $.session.start({ cwd: radice } as never)

  await $.tool.call({ tool: 'mcp__gestione-sprint__piano_aggiorna', progetto: { nome: 'demo' }, sprint: [{ titolo: 'base' }] } as never)
  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'apri-sprint' })).toBeDefined()
  await ui.unmount()

  const lungo = `Oggetto: requisiti\n${'riga di requisiti del business. '.repeat(1000)}`
  await $.command.run({ command: 'sprint-fonte', args: lungo } as never)
  const doppia = await $.command.run({ command: 'sprint-fonte', args: lungo } as never)
  expect(String(doppia.text)).toContain("c'e gia: F1")
  const primo = await $.tool.call({ tool: 'mcp__gestione-sprint__fonte_leggi', id: 'f1' } as never)
  expect(String(primo.result)).toContain('[continua: fonte_leggi id=F1 da=12000')
  const secondo = await $.tool.call({ tool: 'mcp__gestione-sprint__fonte_leggi', id: 'F1', da: 24000 } as never)
  expect(String(secondo.result)).not.toContain('[continua')
})

test('due regole di progetto in contrasto: la chat le scopre e quella scartata viene superata', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const radice = '/progetto'
  const files = new Map<string, string>()
  const v = (value: unknown) => ({ value }) as never
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  on('session.root', () => v(radice))
  on('session.cwd', () => v(radice))
  on('session.start', () => ({ cwd: radice }) as never)
  on('fs.exists', ($, e) => v(files.has(e.path)))
  on('fs.read', ($, e) => {
    const t = files.get(e.path)
    if (t === undefined) throw new Error('ENOENT')
    return v(t)
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return v(undefined)
  })
  for (const op of ['ui.status', 'ui.toast'] as const) on(op, () => v(undefined))
  on('ui.open', () => v({ isPlaced: true }))
  on('command.register', () => v({}))
  on('tool.register', ($, e) => v({ tool: e.name }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('model.complete', ($, e) =>
    v({
      isAnswered: true,
      usage: {},
      text: e.prompt.includes('Decisioni già valide')
        ? JSON.stringify({
            decisioni: [],
            contraddizioni: [{ tema: 'database', prima: 'il database del progetto e SQL Server', poi: 'il database del progetto e PostgreSQL' }],
          })
        : '{"conflitti":[]}',
    }),
  )
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }) as never)
  on('turn.complete', () => ({ text: 'ok' }) as never)
  await $.session.start({ cwd: radice } as never)

  await $.tool.call({
    tool: 'mcp__gestione-sprint__piano_aggiorna',
    progetto: { nome: 'demo' },
    memoria: [
      { testo: 'il database del progetto e SQL Server', fonte: 'CLAUDE.md:3' },
      { testo: 'il database del progetto e PostgreSQL', fonte: 'docs/db.md:1' },
    ],
  } as never)
  await $.session.measure({ context: { tokens: 40000, window: 200000, percent: 20 }, rateLimits: [], changed: ['context'] } as never)
  await $.prompt.submit({ text: 'invece controlla quale database usiamo' } as never)
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' } as never)
  await clock.advance(10)

  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  await ui.press({ key: 'proposta-keepOld' })
  await ui.unmount()

  const piano = JSON.parse(files.get(`${radice}/.claude/sprint/piano.json`) ?? '{}')
  expect(piano.memoria.find((m: { id: string }) => m.id === 'M1').stato).toBe('valida')
  expect(piano.memoria.find((m: { id: string }) => m.id === 'M2').stato).toBe('superata')
  expect(piano.aggiornamentiMemoria[0].file).toBe('docs/db.md:1')
})
