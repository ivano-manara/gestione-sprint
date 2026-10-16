import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

// Qualita dell'analisi: comandi di verifica reali, analisi incrementale, superpowers installato dopo.

test('l analisi cita i comandi del progetto e alla seconda volta rilegge solo i file cambiati', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const radice = '/progetto'
  const files = new Map<string, string>([
    [`${radice}/CLAUDE.md`, '# Progetto\nDatabase: SQL Server 2019\n'],
    [`${radice}/README.md`, '# Portale\n'],
    [`${radice}/composer.json`, JSON.stringify({ require: { 'laravel/framework': '^11.0' } })],
  ])
  const inviati: string[] = []
  let isSuperpowers = false
  const v = (value: unknown) => ({ value }) as never
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  on('session.root', () => v(radice))
  on('session.cwd', () => v(radice))
  on('session.start', () => ({ cwd: radice }) as never)
  on('fs.exists', ($, e) => v(files.has(e.path)))
  on('fs.stat', ($, e) => v(files.has(e.path) ? { kind: 'file', size: (files.get(e.path) ?? '').length } : undefined))
  on('fs.read', ($, e) => {
    const t = files.get(e.path)
    if (t === undefined) throw new Error('ENOENT')
    return v(t)
  })
  on('fs.write', ($, e) => {
    files.set(e.path, e.text)
    return v(undefined)
  })
  on('ui.status', () => v(undefined))
  on('ui.toast', () => v(undefined))
  on('ui.open', () => v({ isPlaced: true }))
  on('command.register', () => v({}))
  on('tool.register', ($, e) => v({ tool: e.name }))
  on('tool.list', () => v([]))
  on('process.run', () => v({ exitCode: 0, stdout: isSuperpowers ? 'superpowers@superpowers-marketplace\nclaude-mem@thedotmack' : 'gestione-sprint@mod-progetti', stderr: '' }))
  on('model.complete', () => v({ isAnswered: true, usage: {}, text: '{"conflitti":[]}' }))
  on('prompt.submit', ($, e) => {
    inviati.push(e.text)
    return { text: e.text } as never
  })
  await $.session.start({ cwd: radice } as never)

  // l'analisi parte dal pulsante del pannello, come la avvia l'utente
  const PANE = { plugin: 'gestione-sprint', surface: 'terminal', component: 'Pane', requestId: 'sprint', props: { bodyColumns: 80, maxRows: 40 } } as never
  const analizza = async (tasto: string): Promise<string> => {
    const n = inviati.length
    const ui = await $.ui.mount(PANE)
    await ui.press({ key: tasto })
    for (let i = 0; i < 40 && inviati.length === n; i++) await clock.advance(100)
    await ui.unmount()
    return inviati.at(-1) ?? ''
  }

  // prima analisi: comandi del progetto, superpowers da installare, nessun confronto
  const prima = await analizza('principale')
  expect(prima).toContain('Comandi di verifica del progetto: php artisan test')
  expect(prima).toContain('non risulta da "claude plugin list"')
  expect(prima).toContain('spesso lasciati aperti')
  expect(prima).not.toContain('Uguali all')
  // claude-mem manca: Claude deve proporne l'installazione
  expect(prima).toContain('claude plugin install claude-mem@thedotmack')
  // il pannello offre il pulsante per installarlo
  const pannello = await $.ui.mount(PANE)
  expect(await pannello.find({ key: 'installa-mem' })).toBeDefined()
  await pannello.unmount()

  // Claude registra il piano: le impronte dei file letti entrano nel piano
  await $.tool.call({
    tool: 'mcp__gestione-sprint__piano_aggiorna',
    progetto: { nome: 'portale' },
    memoria: [{ testo: 'il database e SQL Server 2019', fonte: 'CLAUDE.md:2', estratto: 'Database: SQL Server 2019' }],
    sprint: [{ titolo: 'base', task: [{ titolo: 'schema', criteri: ['php artisan test verde'], stima: 2 }] }],
  } as never)
  const piano = JSON.parse(files.get(`${radice}/.claude/sprint/piano.json`) ?? '{}')
  expect(Object.keys(piano.progetto.impronte ?? {})).toContain('CLAUDE.md')

  // cambia solo il README; superpowers e claude-mem ora ci sono
  files.set(`${radice}/README.md`, '# Portale\nNuova sezione\n')
  isSuperpowers = true
  const seconda = await analizza('analizza')
  expect(seconda).toContain('Piano gia presente: 1 sprint')
  expect(seconda).toContain("Cambiati dall'ultima analisi: README.md")
  expect(seconda).toContain("Uguali all'ultima analisi: CLAUDE.md")
  expect(seconda).toContain('Usa la skill superpowers:brainstorming')
  // claude-mem installato: va interrogato prima dei file, a strati, sul progetto giusto
  expect(seconda).toContain('Interrogalo PRIMA dei file')
  expect(seconda).toContain('project="progetto"')
  expect(seconda).not.toContain('claude plugin install claude-mem')
})

test('claude-mem trovato come plugin: tutto il mod lo usa e i suoi dati sono protetti', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const radice = '/progetto'
  const files = new Map<string, string>([[`${radice}/CLAUDE.md`, '# Progetto\n']])
  const v = (value: unknown) => ({ value }) as never
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  on('session.root', () => v(radice))
  on('session.cwd', () => v(radice))
  on('session.start', () => ({ cwd: radice }) as never)
  on('fs.exists', ($, e) => v(files.has(e.path)))
  on('fs.stat', ($, e) => v(e.path.endsWith('Grande.php') ? { kind: 'file', size: 3_000_000 } : files.has(e.path) ? { kind: 'file', size: 10 } : undefined))
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
  on('tool.list', () => v([]))
  on('session.usage', () => v({ context: { tokens: 40000, window: 200000, percent: 20 }, rateLimits: [] }))
  on('session.turns', () => v([]))
  on('process.run', () => v({ exitCode: 0, stdout: 'claude-mem@thedotmack\nsuperpowers@superpowers-marketplace', stderr: '' }))
  on('model.complete', () => v({ isAnswered: true, usage: {}, text: '{"conflitti":[]}' }))
  on('tool.call', () => ({ result: 'eseguito' }) as never)
  await $.session.start({ cwd: radice } as never)
  await clock.advance(100)

  // il modulo contesto lo sa: un file di codice troppo grande va letto con gli strumenti di claude-mem
  const grande = await $.tool.call({ tool: 'Read', file_path: `${radice}/app/Grande.php` } as never)
  expect(JSON.stringify(grande)).toContain('smart_outline')

  // dati di claude-mem: no a Edit/Write e ai comandi che li scrivono; settings.json si
  const db = await $.tool.call({ tool: 'Write', file_path: '/home/me/.claude-mem/claude-mem.db', content: 'x' } as never)
  expect(JSON.stringify(db)).toContain('dati di claude-mem')
  const bash = await $.tool.call({ tool: 'Bash', command: 'rm -rf ~/.claude-mem/chroma' } as never)
  expect(JSON.stringify(bash)).toContain('dati di claude-mem')
  const impostazioni = await $.tool.call({ tool: 'Edit', file_path: '/home/me/.claude-mem/settings.json', old_string: '50', new_string: '20' } as never)
  expect(JSON.stringify(impostazioni)).not.toContain('dati di claude-mem')
})

test('le opzioni di claude-mem si leggono, il database no', { timeoutMs: 20000 }, async ($: Engine, on) => {
  const v = (value: unknown) => ({ value }) as never
  on('session.root', () => v('/p'))
  on('session.cwd', () => v('/p'))
  on('session.start', () => ({ cwd: '/p' }) as never)
  on('fs.exists', () => v(false))
  on('fs.read', () => {
    throw new Error('ENOENT')
  })
  on('fs.stat', () => v({ kind: 'file', size: 300 }))
  for (const op of ['ui.status', 'ui.toast'] as const) on(op, () => v(undefined))
  on('command.register', () => v({}))
  on('tool.register', ($, e) => v({ tool: e.name }))
  on('tool.list', () => v([]))
  on('process.run', () => v({ exitCode: 0, stdout: 'claude-mem@thedotmack', stderr: '' }))
  on('tool.call', () => ({ result: 'eseguito' }) as never)
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  await $.session.start({ cwd: '/p' } as never)
  await clock.advance(100)
  const opzioni = await $.tool.call({ tool: 'Read', file_path: 'C:\\Users\\me\\.claude-mem\\settings.json' } as never)
  expect(JSON.stringify(opzioni)).toContain('eseguito')
  const db = await $.tool.call({ tool: 'Read', file_path: 'C:\\Users\\me\\.claude-mem\\claude-mem.db' } as never)
  expect(JSON.stringify(db)).toContain('deny')
})
