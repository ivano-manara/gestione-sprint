import type { Engine, TestBody } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'

// Sotto il mod, uno strumento finto che risponde "eseguito": se il mod lascia passare, arriva qui.
const PASSED = 'eseguito-dal-test'

let count = 0

const call = async ($: Engine, input: object): Promise<string> => {
  count += 1
  const result = await $.tool.call({ tool_use_id: `t${count}`, ...input } as never)

  return JSON.stringify(result)
}

test('Read in node_modules viene rifiutata', async ($, on) => {
  on('tool.call', () => ({ result: PASSED }) as never)

  const out = await call($, { tool: 'Read', file_path: '/app/node_modules/react/index.js' })

  expect(out).toContain('è esclusa')
  expect(out).not.toContain(PASSED)
})

test('Bash che cerca in build viene rifiutato', async ($, on) => {
  on('tool.call', () => ({ result: PASSED }) as never)

  const out = await call($, { tool: 'Bash', command: 'grep -r foo build/' })

  expect(out).toContain('è esclusa')
})

test('Bash con un messaggio di commit che cita build passa', async ($, on) => {
  on('tool.call', () => ({ result: PASSED }) as never)

  const out = await call($, { tool: 'Bash', command: 'git commit -m "more fixes in build"' })

  expect(out).toContain(PASSED)
})

test('Grep con esclusione di node_modules passa', async ($, on) => {
  on('tool.call', () => ({ result: PASSED }) as never)

  const out = await call($, { tool: 'Grep', pattern: 'TODO', glob: '!**/node_modules/**' })

  expect(out).toContain(PASSED)
})

test('/passaggio scrive la richiesta di riepilogo nella casella del prompt', async ($, on) => {
  let filled = ''

  on('prompt.fill', async (_$, e) => {
    filled = e.text

    return { isFilled: true } as never
  })

  const result = await $.command.run({ command: 'passaggio', args: '' } as never)

  expect(filled).toContain('Obiettivo')
  expect(JSON.stringify(result)).toContain('Invio')
})

// ---- Indicatore grafico ----

const BAND = {
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} } as never,
}

type On = Parameters<TestBody>[1]

// Sotto il mod: la misura passa, stato e avvisi si ignorano.
const measure = ($: Engine, on: On, percent: number) => {
  on('session.measure', (_$, e) => ({ changed: e.changed }))

  return $.session.measure({
    context: { tokens: percent * 2000, window: 200000, percent },
    rateLimits: [{ kind: 'five_hour', percentUsed: 35 }],
    changed: ['context'],
  } as never)
}

test('la barra sopra il prompt mostra percentuale e token, su terminale e desktop', async ($, on) => {
  await measure($, on, 62)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface, ...BAND })
    const drawn = JSON.stringify(await ui.drawn())

    expect(drawn).toContain('62%')
    expect(drawn).toContain('124k/200k')
    expect(drawn).toContain('█')
    expect(drawn).toContain('piano 5h 35%')
    // sopra la soglia di avviso compare il pulsante per alleggerire
    expect(await ui.find({ key: 'proposta-compact' })).toBeDefined()
    await ui.unmount()
  }
})

test('/barra nasconde e rimostra la banda', async ($, on) => {
  await measure($, on, 20)
  await $.command.run({ command: 'barra', args: '' } as never)

  // Nascosta, il mod lascia disegnare chi sta sotto: qui nessuno, quindi niente banda.
  const hidden = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND }).catch(() => undefined)
  expect(JSON.stringify((await hidden?.drawn().catch(() => null)) ?? null)).not.toContain('20%')
  await hidden?.unmount()

  await $.command.run({ command: 'barra', args: '' } as never)
  const shown = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  expect(JSON.stringify(await shown.drawn())).toContain('20%')
  expect(await shown.find({ key: 'proposta-compact' })).toBeUndefined()
  await shown.unmount()
})

test('il pannello /contesto disegna la barra', async ($, on) => {
  await measure($, on, 45)

  const ui = await $.ui.mount({
    plugin: 'gestione-sprint',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'controllo-contesto',
    props: { title: 'Contesto', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} } as never,
  })

  expect(JSON.stringify(await ui.drawn())).toContain('45%')
  await ui.unmount()
})
