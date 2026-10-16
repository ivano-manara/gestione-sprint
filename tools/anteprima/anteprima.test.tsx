import type { Engine } from 'claude-code/testing'
import { mock, test } from 'claude-code/testing'

const PANE = { component: 'Pane', requestId: 'sprint', props: { title: 'Sprint', isFocused: true, bodyColumns: 72, placement: 'dock' } as never } as const
const BAND = { component: 'AbovePrompt' as const, props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} } as never }

test('anteprima', { timeoutMs: 30000 }, async ($: Engine, on) => {
  const radice = '/progetto'
  const files = new Map<string, string>()
  const v = (value: unknown) => ({ value }) as never
  mock.clock(on, { now: 1_800_000_000_000 })
  on('session.root', () => v(radice))
  on('session.cwd', () => v(radice))
  on('session.start', () => ({ cwd: radice }) as never)
  on('fs.exists', ($, e) => v(files.has(e.path)))
  on('fs.read', ($, e) => { const t = files.get(e.path); if (t === undefined) throw new Error('ENOENT'); return v(t) })
  on('fs.write', ($, e) => { files.set(e.path, e.text); return v(undefined) })
  for (const op of ['ui.status', 'ui.toast'] as const) on(op, () => v(undefined))
  on('ui.open', () => v({ isPlaced: true }))
  on('command.register', () => v({}))
  on('tool.register', ($, e) => v({ tool: e.name }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('model.complete', () => v({ isAnswered: true, usage: {}, text: '{"conflitti":[]}' }))
  await $.session.start({ cwd: radice } as never)
  await $.tool.call({
    tool: 'mcp__gestione-sprint__piano_aggiorna',
    progetto: { nome: 'portale-consulenti', obiettivo: 'portale per i consulenti', metodo: 'superpowers (spec + plan)' },
    memoria: [
      { testo: 'il database e SQL Server 2019', fonte: 'CLAUDE.md:3', tipo: 'stack', estratto: 'Database: SQL Server 2019' },
      { testo: 'niente funzioni mysql_', fonte: 'CLAUDE.md:7', vietato: '\\bmysql_\\w+\\(', ambito: '.php' },
    ],
    decisioni: [{ testo: 'export PDF con dompdf' }],
    rischi: [{ testo: 'dati clienti in chiaro nei log', probabilita: 'alta', impatto: 'alto', mitigazione: 'mascherare i campi' }],
    sprint: [
      { titolo: 'accesso e profili', obiettivo: 'login MFA e profili', task: [{ titolo: 'login', criteri: ['test login verde'], stima: 3 }, { titolo: 'verifica sprint', criteri: ['tutti i test passano'], stima: 1 }] },
      { titolo: 'report mensile', obiettivo: 'report mensile per consulente in PDF', task: [
        { titolo: 'modello dati report', criteri: ['migrazione crea la tabella report'], stima: 3, vincoli: ['M1'] },
        { titolo: 'estrazione SQL', criteri: ['funziona bene'], stima: 5 },
        { titolo: 'export PDF', criteri: ['il comando genera un PDF di 2 pagine'], stima: 8 },
        { titolo: 'verifica sprint', criteri: ['demo al responsabile'], stima: 1 },
      ] },
    ],
    domande: [
      { testo: 'Il report va inviato per mail o solo scaricato?', perche: 'cambia il task di export', task: 'S2-T3', opzioni: ['solo download', 'mail automatica', 'entrambi'], raccomandata: 'solo download' },
      { testo: 'Serve lo storico degli ultimi 12 mesi?', sprint: 'S2', opzioni: ['si', 'no'], raccomandata: 'si', bloccante: false },
      { testo: 'Il cliente chiede MySQL per i report', task: 'S2-T2', conflittoCon: ['M1'], raccomandata: 'usare MySQL per i report', perche: 'il progetto usa SQL Server' },
    ],
  } as never)
  await $.tool.call({ tool: 'mcp__gestione-sprint__task_stato', id: 'S1-T1', stato: 'completato', nota: 'ok' } as never)
  await $.tool.call({ tool: 'mcp__gestione-sprint__task_stato', id: 'S1-T2', stato: 'completato', nota: 'ok' } as never)
  await $.command.run({ command: 'sprint-fonte', args: 'Da: anna\nOggetto: report mensile clienti\n\nServe un report mensile.' } as never)
  await $.session.measure({ context: { tokens: 124000, window: 200000, percent: 62 }, rateLimits: [], changed: ['context'] } as never)

  for (const surface of ['terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface, ...PANE })
    for (const tab of ['tab-piano', 'tab-domande', 'tab-business', 'tab-memoria']) {
      await ui.press({ key: tab })
      console.log(`@@${tab}@@` + JSON.stringify(await ui.drawn()))
    }
    await ui.press({ key: 'tab-piano' })
    await ui.press({ key: 't-S2-T2' })
    console.log('@@dettaglio@@' + JSON.stringify(await ui.drawn()))
    await ui.unmount()
    const stretto = await $.ui.mount({ plugin: 'gestione-sprint', surface, component: 'Pane', requestId: 'sprint', props: { title: 'Sprint', isFocused: true, bodyColumns: 46, placement: 'dock' } as never })
    await stretto.press({ key: 'tab-piano' })
    await stretto.press({ key: 'indietro' }).catch(() => undefined)
    console.log('@@stretto@@' + JSON.stringify(await stretto.drawn()))
    await stretto.unmount()
    const band = await $.ui.mount({ plugin: 'gestione-sprint', surface, ...BAND })
    console.log('@@banda@@' + JSON.stringify(await band.drawn()))
    await band.unmount()
    const b80 = await $.ui.mount({ plugin: 'gestione-sprint', surface, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} } as never })
    console.log('@@banda80@@' + JSON.stringify(await b80.drawn()))
    await b80.unmount()
  }
})
