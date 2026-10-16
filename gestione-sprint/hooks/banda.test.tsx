import type { Engine } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'

// La banda sopra il prompt: tutto il piano si usa con i pulsanti, senza comandi /.

const BAND = {
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 140, scroll: { offset: 0, bodyRows: 10 }, view: {} } as never,
}

function prepara(on: Parameters<Parameters<typeof test>[2] & ((...a: never[]) => unknown)>[1] | any, radice: string, files: Map<string, string>, aperti: string[], inviati: string[]) {
  const v = (value: unknown) => ({ value }) as never
  on('session.root', () => v(radice))
  on('session.cwd', () => v(radice))
  on('session.start', () => ({ cwd: radice }) as never)
  on('fs.exists', ($: unknown, e: { path: string }) => v(files.has(e.path)))
  on('fs.read', ($: unknown, e: { path: string }) => {
    const t = files.get(e.path)
    if (t === undefined) throw new Error('ENOENT')
    return v(t)
  })
  on('fs.write', ($: unknown, e: { path: string; text: string }) => {
    files.set(e.path, e.text)
    return v(undefined)
  })
  on('fs.list', () => v([]))
  for (const op of ['ui.status', 'ui.toast'] as const) on(op, () => v(undefined))
  on('ui.open', ($: unknown, e: { id: string }) => {
    aperti.push(e.id)
    return v({ isPlaced: true })
  })
  on('command.register', () => v({}))
  on('tool.register', ($: unknown, e: { name: string }) => v({ tool: e.name }))
  on('model.complete', () => v({ isAnswered: true, usage: {}, text: '{"conflitti":[]}' }))
  on('prompt.submit', ($: unknown, e: { text: string }) => {
    inviati.push(e.text)
    return { text: e.text } as never
  })
}

test('senza piano la banda offre di crearlo con un clic', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const aperti: string[] = []
  const inviati: string[] = []
  prepara(on, '/progetto', new Map(), aperti, inviati)
  await $.session.start({ cwd: '/progetto' } as never)

  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  expect(JSON.stringify(await ui.drawn())).toContain('nessun piano')
  await ui.press({ key: 'sprint-crea' })
  await ui.unmount()
  expect(inviati.some(t => t.includes('.claude/sprint'))).toBe(true)
})

test('con il piano la banda mostra lo sprint e i pulsanti portano alla scheda giusta', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const aperti: string[] = []
  const inviati: string[] = []
  prepara(on, '/progetto', new Map(), aperti, inviati)
  await $.session.start({ cwd: '/progetto' } as never)
  await $.tool.call({
    tool: 'mcp__gestione-sprint__piano_aggiorna',
    progetto: { nome: 'demo' },
    sprint: [{ titolo: 'base', task: [{ titolo: 'schema', criteri: ['lo script crea le tabelle'], stima: 2 }] }],
    domande: [{ testo: 'quale database?', opzioni: ['SQL Server', 'PostgreSQL'], bloccante: true, sprint: 'S1', task: 'S1-T1' }],
  } as never)

  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  const disegno = JSON.stringify(await ui.drawn())
  expect(disegno).toContain('S1 base')
  expect(disegno).toContain('Domande (1)')
  expect(disegno).toContain('Rispondi alla domanda')

  await ui.press({ key: 'sprint-azione' })
  await ui.press({ key: 'sprint-business' })
  await ui.unmount()
  expect(aperti.filter(id => id === 'sprint').length).toBeGreaterThanOrEqual(2)

  // il pannello si apre sulla scheda business
  const pane = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', component: 'Pane', requestId: 'sprint', props: { bodyColumns: 100, maxRows: 40 } as never } as never)
  expect(JSON.stringify(await pane.drawn())).toContain('incolla')
  await pane.unmount()
})

test('un piano.json rovinato non viene sovrascritto e la banda lo segnala', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const aperti: string[] = []
  const inviati: string[] = []
  const files = new Map<string, string>([['/progetto/.claude/sprint/piano.json', '{ "versione": 2, "sprint": [ rotto']])
  prepara(on, '/progetto', files, aperti, inviati)
  await $.session.start({ cwd: '/progetto' } as never)

  const esito = await $.tool.call({ tool: 'mcp__gestione-sprint__piano_aggiorna', progetto: { nome: 'demo' }, sprint: [{ titolo: 'base' }] } as never)
  expect(files.get('/progetto/.claude/sprint/piano.json')).toContain('rotto')
  // niente errore crudo: un messaggio che dice cosa fare
  expect(JSON.stringify(esito)).toContain('non e stato modificato')
  const comando = await $.command.run({ command: 'sprint-scegli', args: 'D1 memoria' } as never)
  expect(String(comando.text)).toContain('non e stato modificato')

  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  const disegno = JSON.stringify(await ui.drawn())
  expect(disegno).toContain('non leggibile')
  expect(disegno).not.toContain('Crea il piano')
  await ui.unmount()
})

test('mentre Claude lavora il pulsante principale non manda messaggi', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const aperti: string[] = []
  const inviati: string[] = []
  prepara(on, '/progetto', new Map(), aperti, inviati)
  await $.session.start({ cwd: '/progetto' } as never)
  await $.tool.call({
    tool: 'mcp__gestione-sprint__piano_aggiorna',
    progetto: { nome: 'demo' },
    sprint: [{ titolo: 'base', task: [{ titolo: 'schema', criteri: ['lo script crea le tabelle'], stima: 2 }] }],
  } as never)
  const occupato = { ...BAND, props: { ...(BAND.props as object), isWorking: true } as never }
  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...occupato })
  expect(JSON.stringify(await ui.drawn())).toContain('Procedi da S1-T1')
  const prima = inviati.length
  await ui.press({ key: 'sprint-azione' })
  await ui.unmount()
  expect(inviati.length).toBe(prima)

  const libero = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  await libero.press({ key: 'sprint-azione' })
  await libero.unmount()
  expect(inviati.length).toBe(prima + 1)
})

test('un piano senza sprint non si dice completato', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const aperti: string[] = []
  const inviati: string[] = []
  prepara(on, '/progetto', new Map(), aperti, inviati)
  await $.session.start({ cwd: '/progetto' } as never)
  await $.tool.call({ tool: 'mcp__gestione-sprint__piano_aggiorna', progetto: { nome: 'demo' } } as never)
  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  const disegno = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(disegno).toContain('nessuno sprint ancora')
  expect(disegno).toContain('Completa il piano')
  expect(disegno).not.toContain('completati')
})
