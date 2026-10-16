import type { Engine } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'

// Claude chiama spesso piu strumenti insieme: nessuna modifica al piano deve andare persa.

/** Cede il turno qualche volta: fa sovrapporre le letture e le scritture come nella realta. */
const pausa = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

test('due task chiusi in parallelo restano entrambi completati', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const files = new Map<string, string>()
  const v = (value: unknown) => ({ value }) as never
  on('session.root', () => v('/p'))
  on('session.cwd', () => v('/p'))
  on('session.start', () => ({ cwd: '/p' }) as never)
  on('fs.exists', ($, e) => v(files.has(e.path)))
  on('fs.read', async ($, e) => { await pausa(); const t = files.get(e.path); if (t === undefined) throw new Error('ENOENT'); return v(t) })
  on('fs.write', async ($, e) => { await pausa(); files.set(e.path, e.text); return v(undefined) })
  for (const op of ['ui.status', 'ui.toast'] as const) on(op, () => v(undefined))
  on('ui.open', () => v({ isPlaced: true }))
  on('command.register', () => v({}))
  on('tool.register', ($, e) => v({ tool: e.name }))
  on('model.complete', () => v({ isAnswered: true, usage: {}, text: '{"conflitti":[]}' }))
  await $.session.start({ cwd: '/p' } as never)
  await $.tool.call({ tool: 'mcp__gestione-sprint__piano_aggiorna', progetto: { nome: 'd' }, sprint: [{ titolo: 'a', task: [{ titolo: 'x', criteri: ['test verde'], stima: 1 }, { titolo: 'y', criteri: ['test verde'], stima: 1 }, { titolo: 'verifica sprint', criteri: ['test verde'], stima: 1 }] }] } as never)
  await Promise.all([
    $.tool.call({ tool: 'mcp__gestione-sprint__task_stato', id: 'S1-T1', stato: 'completato', nota: 'ok test' } as never),
    $.tool.call({ tool: 'mcp__gestione-sprint__task_stato', id: 'S1-T2', stato: 'completato', nota: 'ok test' } as never),
  ])
  const p = JSON.parse(files.get('/p/.claude/sprint/piano.json') ?? '{}')
  expect(p.sprint[0].task[0].stato).toBe('completato')
  expect(p.sprint[0].task[1].stato).toBe('completato')

  // due fonti incollate insieme: id diversi, entrambi i testi salvati
  const [a, b] = await Promise.all([
    $.command.run({ command: 'sprint-fonte', args: 'Da: anna\nOggetto: report mensile\n\nServe il report.' } as never),
    $.command.run({ command: 'sprint-fonte', args: 'Da: luca\nOggetto: export pdf\n\nServe il PDF.' } as never),
  ])
  expect(String(a.text)).toContain('F1')
  expect(String(b.text)).toContain('F2')
  const q = JSON.parse(files.get('/p/.claude/sprint/piano.json') ?? '{}')
  expect(q.business.length).toBe(2)
  expect(files.get('/p/.claude/sprint/fonti/F1.md')).toContain('anna')
  expect(files.get('/p/.claude/sprint/fonti/F2.md')).toContain('luca')
})

test('con un piano illeggibile una fonte nuova non sovrascrive quelle esistenti', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const files = new Map<string, string>([
    ['/p/.claude/sprint/piano.json', '{ rotto'],
    ['/p/.claude/sprint/fonti/F1.md', 'testo originale di F1'],
  ])
  const v = (value: unknown) => ({ value }) as never
  on('session.root', () => v('/p'))
  on('session.cwd', () => v('/p'))
  on('session.start', () => ({ cwd: '/p' }) as never)
  on('fs.exists', ($, e) => v(files.has(e.path)))
  on('fs.read', ($, e) => { const t = files.get(e.path); if (t === undefined) throw new Error('ENOENT'); return v(t) })
  on('fs.write', ($, e) => { files.set(e.path, e.text); return v(undefined) })
  for (const op of ['ui.status', 'ui.toast'] as const) on(op, () => v(undefined))
  on('ui.open', () => v({ isPlaced: true }))
  on('command.register', () => v({}))
  on('tool.register', ($, e) => v({ tool: e.name }))
  await $.session.start({ cwd: '/p' } as never)
  await $.command.run({ command: 'sprint-fonte', args: 'Da: anna\nOggetto: nuova richiesta\n\nTesto nuovo.' } as never)
  expect(files.get('/p/.claude/sprint/fonti/F1.md')).toBe('testo originale di F1')
  expect(files.get('/p/.claude/sprint/piano.json')).toBe('{ rotto')
})
