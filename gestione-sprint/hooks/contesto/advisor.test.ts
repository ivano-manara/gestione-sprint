import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

import { activeProposals, clearAfterCompaction, isNewer, proposalsFor, snooze, type Signals } from './advisor'

const BASE: Signals = {
  percent: 30,
  warn: 60,
  strong: 80,
  critical: 90,
  turns: 5,
  maxTurns: 40,
  profiles: ['laravel'],
  hasClaudeMd: true,
  openErrors: 0,
  isCompacting: false,
}

test('nessuna proposta quando va tutto bene', () => {
  expect(proposalsFor(BASE)).toEqual([])
})

test('contesto: tre gradi, la domanda diretta sopra la soglia critica', () => {
  expect(proposalsFor({ ...BASE, percent: 65 })[0]?.severity).toBe('info')
  expect(proposalsFor({ ...BASE, percent: 85 })[0]?.severity).toBe('warn')

  const critical = proposalsFor({ ...BASE, percent: 95 })[0]
  expect(critical?.severity).toBe('critical')
  expect(critical?.text).toBe('Contesto al 95%: vuoi compattare adesso? Il lavoro resta nel registro verificato.')
  expect(critical?.actions).toEqual(['compact', 'handoff', 'snooze'])
})

test('la più urgente viene prima', () => {
  const list = proposalsFor({ ...BASE, percent: 92, turns: 50, hasClaudeMd: false })

  expect(list.map(item => item.id)).toEqual(['context', 'turns', 'claudemd'])
})

test('"Più tardi" rimanda finché la situazione non peggiora di 10 punti o diventa più grave', () => {
  const first = proposalsFor({ ...BASE, percent: 65 })[0]!
  const snoozes = snooze({}, first)

  expect(activeProposals({ ...BASE, percent: 70 }, snoozes, new Set())).toEqual([])
  expect(activeProposals({ ...BASE, percent: 76 }, snoozes, new Set())[0]?.id).toBe('context')
  // da info a warn: torna subito
  expect(activeProposals({ ...BASE, percent: 81 }, snoozes, new Set())[0]?.severity).toBe('warn')
  // dopo una compattazione si riparte da zero
  expect(clearAfterCompaction(snoozes)).toEqual({})
})

test('"Non chiedere più" vale per la sessione', () => {
  expect(activeProposals({ ...BASE, hasClaudeMd: false }, {}, new Set(['claudemd']))).toEqual([])
})

test('piano, errori aperti e MCP', () => {
  expect(proposalsFor({ ...BASE, limitPercent: 96 })[0]?.severity).toBe('critical')
  expect(proposalsFor({ ...BASE, openErrors: 3 })[0]?.id).toBe('errors')
  expect(proposalsFor({ ...BASE, mcpTokens: 20000 })[0]?.text).toContain('20k')
  expect(proposalsFor({ ...BASE, hasClaudeMd: false, profiles: [] })).toEqual([])
})

test('si annuncia solo ciò che è nuovo o più grave', () => {
  const warn = proposalsFor({ ...BASE, percent: 85 })[0]
  const critical = proposalsFor({ ...BASE, percent: 95 })[0]

  expect(isNewer(warn, undefined)).toBe(true)
  expect(isNewer(warn, { id: 'context', severity: 'warn' })).toBe(false)
  expect(isNewer(critical, { id: 'context', severity: 'warn' })).toBe(true)
})

// ---- Dal vivo: la domanda compare da sola, un clic compatta ----

const BAND = {
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} } as never,
}

test('al 95% la banda chiede se compattare; "Compatta ora" compatta, "Più tardi" la nasconde', async ($: Engine, on) => {
  let compacted = 0
  const toasts: string[] = []
  const clock = mock.clock(on, { now: 1_800_000_000_000 })

  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('ui.toast', (_$, e) => {
    toasts.push(JSON.stringify(e))

    return { value: undefined } as never
  })
  on('session.compact', () => {
    compacted += 1

    return { messages: [{ role: 'user', text: 'riassunto', toolUses: [] }] } as never
  })

  await $.session.measure({ context: { tokens: 190000, window: 200000, percent: 95 }, rateLimits: [], changed: ['context'] } as never)

  // Annunciata anche con un avviso, senza che tu chieda nulla.
  expect(toasts.join(' ')).toContain('vuoi compattare adesso?')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface, ...BAND })
    expect(JSON.stringify(await ui.drawn())).toContain('Contesto al 95%: vuoi compattare adesso?')
    expect(await ui.find({ key: 'proposta-compact' })).toBeDefined()
    expect(await ui.find({ key: 'proposta-handoff' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...BAND })
  await ui.press({ key: 'proposta-compact' })
  await clock.advance(100)
  expect(compacted).toBe(1)

  await ui.press({ key: 'proposta-snooze' })
  expect(JSON.stringify(await ui.drawn())).not.toContain('vuoi compattare adesso?')
  await ui.unmount()
})
