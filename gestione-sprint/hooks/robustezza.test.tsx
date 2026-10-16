import type { Engine } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'
import { applicaPatch, impostaStato, normalizza, pianoVuoto, rispondi, risolviConflitto, riapri, confermaIpotesi, comeMarkdown, riepilogo, vistaSprint, vistaMemoria, vistaRiepilogo, vistaBusiness, codaDomande, aggiungiConflitti } from './sprint/logic'
import { controlliQualita, prontezza } from './sprint/qualita'
import type { Piano } from '../types'

let seme = 7
const caso = () => ((seme = (seme * 1103515245 + 12345) % 2147483648) / 2147483648)
const uno = <T,>(a: readonly T[]): T => a[Math.floor(caso() * a.length)] as T
const ids = (p: Piano) => ({ s: p.sprint.map(s => s.id), t: p.sprint.flatMap(s => s.task.map(t => t.id)), d: p.domande.map(d => d.id), m: p.memoria.map(m => m.id) })
const TESTI = ['login', 'report', 'export pdf', '', '  ', 'funziona bene', 'test verde', 'àèìòù €', 'a'.repeat(300), 'S1', 'null', '{"x":1}']

// Robustezza: migliaia di modifiche casuali (anche sbagliate) non devono rompere il piano.

/** Un piano costruito con passi casuali; errori raccolti invece di fermarsi. */
const costruisci = (giri: number, passi: number): { piani: Piano[]; errori: string[] } => {
  const piani: Piano[] = []
  const errori: string[] = []
  for (let giro = 0; giro < giri; giro++) {
    let p = pianoVuoto('demo', '2026-10-16 10:00')
    for (let passo = 0; passo < passi; passo++) {
      const k = ids(p)
      const tid = uno([...k.t, 'S9-T9', '', 's1-t1'])
      const did = uno([...k.d, 'D99', ''])
      const azione = Math.floor(caso() * 9)
      try {
        if (azione <= 2) {
          const patch: Record<string, unknown> = {}
          if (caso() < 0.6) patch.sprint = [{ id: caso() < 0.5 ? uno([...k.s, 'S7', '']) : undefined, titolo: uno(TESTI), obiettivo: uno(TESTI), task: [{ id: caso() < 0.4 ? tid : undefined, titolo: uno(TESTI), criteri: caso() < 0.5 ? [uno(TESTI)] : [], stima: uno([1, 2, 3, 5, 8, 13, -1, undefined]), dipendeDa: caso() < 0.4 ? [uno([...k.t, 'S5-T5'])] : [], vincoli: caso() < 0.3 ? [uno([...k.m, 'M77'])] : [] }] }]
          if (caso() < 0.4) patch.domande = [{ id: caso() < 0.3 ? did : undefined, testo: uno(TESTI), opzioni: caso() < 0.5 ? ['a', 'b'] : [], bloccante: caso() < 0.5, task: caso() < 0.5 ? tid : undefined, conflittoCon: caso() < 0.3 ? [uno([...k.m, 'DEC1'])] : undefined }]
          if (caso() < 0.3) patch.memoria = [{ testo: uno(TESTI), fonte: uno(['CLAUDE.md:3', 'claude-mem #4', '']), vietato: uno(['', '\\bfoo\\(', '(', undefined]) }]
          if (caso() < 0.2) patch.annulla = [tid]
          if (caso() < 0.2) patch.rimuovi = [tid]
          if (caso() < 0.2) patch.decisioni = [{ testo: uno(TESTI), fonte: 'analisi' }]
          if (caso() < 0.1) patch.rischi = [{ testo: uno(TESTI), probabilita: 'alta', impatto: 'alto', task: tid }]
          p = applicaPatch(p, patch as never, '2026-10-16 10:00').piano
        } else if (azione === 3) {
          p = impostaStato(p, tid, uno(['da-fare', 'in-corso', 'completato', 'bloccato', 'annullato'] as const), uno(['', 'ok test']), '2026-10-16 10:00', caso() < 0.5).piano
        } else if (azione === 4) {
          p = rispondi(p, did, uno(['a', '', 'decidi tu', 'x']), 'pannello', '2026-10-16 10:00', caso() < 0.3 ? { con: [uno([...k.m, 'M1'])], spiegazione: 'x' } : undefined).piano
        } else if (azione === 5) {
          p = risolviConflitto(p, did, uno(['memoria', 'nuova'] as const), '2026-10-16 10:00').piano
        } else if (azione === 6) {
          p = riapri(p, did, '2026-10-16 10:00')
        } else if (azione === 7) {
          p = confermaIpotesi(p, uno(p.decisioni.map(d => d.id).concat('DEC9')), caso() < 0.5, '2026-10-16 10:00')
        } else {
          p = aggiungiConflitti(p, [{ nuovo: { id: 'chat', testo: uno(TESTI) }, con: [uno([...k.m, 'M1'])], spiegazione: 'x' }], '2026-10-16 10:00')
        }
        // invarianti
        const n = ids(p)
        for (const [nome, lista] of Object.entries(n)) {
          const dup = lista.filter((x, i) => lista.indexOf(x) !== i)
          if (dup.length) throw new Error(`id doppi ${nome}: ${dup.join(',')}`)
          if (lista.some(x => !x)) throw new Error(`id vuoto ${nome}`)
        }
        const ricaricato = normalizza(JSON.parse(JSON.stringify(p)), 'demo', 'x')
        const ord = (x: unknown): unknown => Array.isArray(x) ? x.map(ord) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x as object).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ord(v)])) : x
        if (JSON.stringify(ord(ricaricato)) !== JSON.stringify(ord(p))) {
          const a = JSON.stringify(ord(p)), b = JSON.stringify(ord(ricaricato))
          let i = 0; while (a[i] === b[i]) i++
          throw new Error(`salva/ricarica cambia il piano: ...${a.slice(Math.max(0, i - 80), i + 60)} || ${b.slice(Math.max(0, i - 80), i + 60)}`)
        }
        controlliQualita(p); riepilogo(p); comeMarkdown(p); vistaSprint(p); vistaMemoria(p); vistaRiepilogo(p); vistaBusiness(p); codaDomande(p)
        for (const t of p.sprint.flatMap(s => s.task)) prontezza(p, t)
      } catch (err) {
        errori.push(`giro ${giro} passo ${passo} azione ${azione}: ${String(err).slice(0, 400)}`)
        break
      }
    }
    piani.push(p)
  }
  return { piani, errori }
}

test('modifiche casuali: id unici, salva e ricarica senza perdite, nessuna eccezione', { timeoutMs: 120000 }, () => {
  const { errori } = costruisci(150, 25)
  expect(errori.slice(0, 3)).toEqual([])
})

test('un id gia usato in un altro sprint non crea un doppione; le maiuscole non contano', () => {
  let p = applicaPatch(pianoVuoto('d', 'x'), { sprint: [{ titolo: 'uno', task: [{ titolo: 'login', criteri: ['test verde'] }] }] } as never, 'x').piano
  const esito = applicaPatch(p, { sprint: [{ titolo: 'due', task: [{ id: 'S1-T1', titolo: 'copia' }] }] } as never, 'x')
  expect(esito.piano.sprint.flatMap(s => s.task).filter(t => t.id === 'S1-T1').length).toBe(1)
  expect(esito.rifiuti.join(' ')).toContain('i task non si spostano tra sprint')
  p = applicaPatch(p, { sprint: [{ id: 's1', task: [{ id: 's1-t1', criteri: ['demo al cliente'] }] }] } as never, 'x').piano
  expect(p.sprint.length).toBe(1)
  expect(p.sprint[0]?.task[0]?.criteri).toContain('demo al cliente')
})

test('voce nata da claude-mem superata: si annota in claude-mem, non in un file inesistente', () => {
  let p = applicaPatch(pianoVuoto('d', 'x'), { memoria: [{ testo: 'export in csv', fonte: 'claude-mem #42' }] } as never, 'x').piano
  p = aggiungiConflitti(p, [{ nuovo: { id: 'chat', testo: 'export in xlsx' }, con: ['M1'], spiegazione: 'formato diverso' }], 'x')
  const d = p.domande.at(-1)
  p = risolviConflitto(p, d?.id ?? '', 'nuova', 'x').piano
  const u = p.aggiornamentiMemoria.at(-1)
  expect(u?.file).toBeUndefined()
  expect(u?.testo).toContain('annotare in claude-mem')
  // un contenuto vuoto non diventa un conflitto
  const vuoto = aggiungiConflitti(p, [{ nuovo: { id: 'chat', testo: '   ' }, con: ['M1'], spiegazione: 'x' }], 'x')
  expect(vuoto.domande.length).toBe(p.domande.length)
})

test('banda e pannello si disegnano con piani casuali', { timeoutMs: 120000 }, async ($: Engine, on) => {
  const { piani } = costruisci(12, 20)
  const files = new Map<string, string>()
  const v = (value: unknown) => ({ value }) as never
  on('session.root', () => v('/p'))
  on('session.cwd', () => v('/p'))
  on('session.start', () => ({ cwd: '/p' }) as never)
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
  await $.session.start({ cwd: '/p' } as never)
  const BAND = { plugin: 'gestione-sprint', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 60, scroll: { offset: 0, bodyRows: 10 }, view: {} } } as never
  const PANE = { plugin: 'gestione-sprint', surface: 'terminal', component: 'Pane', requestId: 'sprint', props: { bodyColumns: 40, maxRows: 40 } } as never
  for (const p of piani) {
    files.set('/p/.claude/sprint/piano.json', JSON.stringify(p))
    await $.tool.call({ tool: 'mcp__gestione-sprint__piano_leggi', formato: 'qualita' } as never)
    const banda = await $.ui.mount(BAND)
    expect(JSON.stringify(await banda.drawn())).toContain('Sprint')
    await banda.unmount()
    const pane = await $.ui.mount(PANE)
    for (const tab of ['tab-piano', 'tab-domande', 'tab-business', 'tab-memoria']) {
      if (await pane.find({ key: tab })) await pane.press({ key: tab })
      expect(await pane.drawn()).toBeDefined()
    }
    await pane.unmount()
  }
})
