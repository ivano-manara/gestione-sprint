import { expect, test } from 'claude-code/testing'

const PANE = { component: 'Pane', requestId: 'sprint', props: { title: 'Sprint', isFocused: true, bodyColumns: 80, placement: 'dock' } as never } as const

test('flusso: memoria, risposta in conflitto, scelta obbligata, fonte business', { timeoutMs: 20000 }, async ($, on) => {
  const radice = '/progetto'
  const files = new Map<string, string>()
  const v = (value: unknown) => ({ value }) as never
  let verifiche = 0
  on('session.root', () => v(radice))
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
  on('model.complete', ($, e) => {
    verifiche++
    const text = e.prompt.includes('NUOVI:')
      ? e.prompt.includes('MongoDB')
        ? '{"conflitti":[{"nuovo":"S1-T2","con":["M1"],"spiegazione":"altro database"}]}'
        : '{"conflitti":[]}'
      : '{"conflitto":true,"con":["M1"],"spiegazione":"il progetto usa SQL Server"}'
    return v({ isAnswered: true, text, usage: {} })
  })
  for (const op of ['ui.status', 'ui.toast'] as const) on(op, () => v(undefined))
  on('ui.open', () => v({ isPlaced: true }))
  on('command.register', () => v({}))
  on('tool.register', ($, e) => v({ tool: e.name }))
  const contesti: number[] = []
  on('prompt.submit', ($, e) => {
    contesti.push((e.context ?? []).length)
    return { text: e.text } as never
  })
  await $.session.start({ cwd: radice } as never)

  const out = await $.tool.call({
    tool: 'mcp__gestione-sprint__piano_aggiorna',
    progetto: { nome: 'demo' },
    memoria: [
      { testo: 'il database e SQL Server', fonte: 'CLAUDE.md:4', tipo: 'stack' },
      { testo: 'niente funzioni mysql_', fonte: 'CLAUDE.md:9', vietato: '\\bmysql_\\w+\\(', ambito: '.php' },
    ],
    sprint: [{ titolo: 'base', task: [{ titolo: 'schema dati', criteri: ['lo script crea le tabelle'], stima: 2 }] }],
    domande: [{ testo: 'quale database?', task: 'S1-T1', opzioni: ['SQL Server', 'MySQL'] }],
  } as never)
  expect(String(out.result)).toContain('M1 in memoria')

  // una modifica che contraddice la memoria diventa un conflitto
  const mod = await $.tool.call({ tool: 'mcp__gestione-sprint__piano_aggiorna', sprint: [{ id: 'S1', task: [{ titolo: 'salvataggio su MongoDB', criteri: ['i dati finiscono in MongoDB'] }] }] } as never)
  expect(String(mod.result)).toContain('contraddicono la memoria')
  const vietato = await $.tool.call({ tool: 'Write', file_path: `${radice}/src/db.php`, content: '<?php mysql_query($q);' } as never)
  expect(String(vietato.deny ?? '')).toContain('M2')

  const negato = await $.tool.call({ tool: 'Write', file_path: `${radice}/CLAUDE.md`, content: 'x' } as never)
  expect(String(negato.deny ?? '')).toContain('memoria')

  const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', ...PANE })
  await ui.press({ key: 'tab-domande' })
  // prima in coda c'e il conflitto D2 (MongoDB): passo alla domanda D1
  expect(await ui.find({ key: 'cm-D2' })).toBeDefined()
  await ui.press({ key: 'succ' })
  await ui.input({ key: 'r-D1', text: 'usiamo MySQL' })
  expect(verifiche).toBe(2)
  expect(await ui.find({ key: 'cm-D1' })).toBeDefined()
  const bloccato = await $.tool.call({ tool: 'mcp__gestione-sprint__task_stato', id: 'S1-T1', stato: 'in-corso' } as never)
  expect(String(bloccato.result)).toContain('conflitto')

  await ui.press({ key: 'cn-D1' })
  const piano = JSON.parse(files.get(`${radice}/.claude/sprint/piano.json`) ?? '{}')
  expect(piano.memoria[0].stato).toBe('superata')
  expect(piano.aggiornamentiMemoria[0].stato).toBe('da-applicare')
  expect((await ui.find({ key: 'principale' }))?.text).toContain('invia 1 risposta')

  await ui.press({ key: 'tab-business' })
  await ui.input({ key: 'incolla-0', text: 'Da: anna\nOggetto: report mensile clienti\n\nServe un report mensile per i consulenti.' })
  expect(files.has(`${radice}/.claude/sprint/fonti/F1.md`)).toBe(true)
  const p2 = JSON.parse(files.get(`${radice}/.claude/sprint/piano.json`) ?? '{}')
  expect(p2.business[0].tipo).toBe('email')
  expect(p2.business[0].titolo).toBe('report mensile clienti')
  await ui.unmount()

  for (const surface of ['desktop', 'terminal'] as const) {
    const u = await $.ui.mount({ plugin: 'gestione-sprint', surface, ...PANE })
    for (const tab of ['tab-piano', 'tab-memoria', 'tab-business', 'tab-domande']) {
      await u.press({ key: tab })
      expect(await u.find({ key: 'principale' })).toBeDefined()
    }
    await u.unmount()
  }

  const ok = await $.tool.call({ tool: 'mcp__gestione-sprint__task_stato', id: 'S1-T1', stato: 'in-corso' } as never)
  expect(String(ok.result)).toContain('in-corso')
  const senzaProva = await $.tool.call({ tool: 'mcp__gestione-sprint__task_stato', id: 'S1-T1', stato: 'completato' } as never)
  expect(String(senzaProva.result)).toContain('prova')
  // lo stato viaggia col messaggio una sola volta finche non cambia
  await $.prompt.submit({ text: 'ciao' } as never).catch(() => undefined)
  await $.prompt.submit({ text: 'ancora' } as never).catch(() => undefined)
  expect(contesti).toEqual([1, 0])

  const vista = await $.tool.call({ tool: 'mcp__gestione-sprint__piano_leggi', formato: 'sprint' } as never)
  expect(String(vista.result)).toContain('S1-T1')
})
