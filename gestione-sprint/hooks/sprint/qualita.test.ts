import { expect, test } from 'claude-code/testing'

import { aggiungiFonte, fileScrittiDaComando, isDatiClaudeMem, sprintDaChiudere, velocita, aggiungiConflitti, applicaImpatto, applicaPatch, confermaIpotesi, impostaStato, pianoVuoto, rispondi, risolviConflitto, segnaDaVerificare, testiNuovi, violazioni } from './logic'
import { comandiVerifica, confrontaImpronte, contieneEstratto, descriviRilevazione, leggiEsitoModifiche } from './memoria'
import { controlliQualita, isVago, prontezza, punteggio } from './qualita'
import { passoClaudeMem, promptBusiness, promptMemoria, promptQualita } from './prompts'
import { memGuide } from '../contesto/mem'

const ORA = '2026-10-16 15:00'

const piano = () =>
  applicaPatch(
    pianoVuoto('demo', ORA),
    {
      memoria: [
        { testo: 'database SQL Server', fonte: 'CLAUDE.md:3', tipo: 'stack', estratto: 'Database: SQL Server 2019' },
        { testo: 'niente funzioni mysql_', fonte: 'CLAUDE.md:7', vietato: '\\bmysql_\\w+\\(', ambito: '.php' },
      ],
      decisioni: [{ testo: 'export in PDF con dompdf' }],
      sprint: [
        {
          id: 'S1',
          titolo: 'base',
          obiettivo: 'schema e accesso',
          task: [
            { titolo: 'schema', criteri: ['lo script crea 3 tabelle'], stima: 3, vincoli: ['M1'] },
            { titolo: 'login', criteri: ['funziona bene'], dipendeDa: ['S1-T9'] },
            { titolo: 'verifica sprint', criteri: ['tutti i test passano'], stima: 1, dipendeDa: ['S1-T1'] },
          ],
        },
      ],
    },
    ORA,
  ).piano

test('controlli di qualita del piano (INVEST, dipendenze, criteri)', () => {
  const pr = controlliQualita(piano())
  const testi = pr.map(p => `${p.id} ${p.testo}`)
  expect(testi.some(t => t.includes('S1-T2') && t.includes('non verificabili'))).toBe(true)
  expect(testi.some(t => t.includes('S1-T9') && t.includes('non esiste'))).toBe(true)
  expect(testi.some(t => t.includes('S1-T2 senza stima'))).toBe(true)
  expect(testi.some(t => t.includes('ipotesi'))).toBe(true)
  expect(punteggio(pr)).toBeLessThan(100)
  expect(isVago('funziona bene')).toBe(true)
  expect(isVago('il comando npm test restituisce 0')).toBe(false)
})

test('definition of ready', () => {
  const p = piano()
  const t1 = p.sprint[0]?.task[0]
  const t2 = p.sprint[0]?.task[1]
  expect(t1 && prontezza(p, t1).isPronto).toBe(true)
  expect(t2 && prontezza(p, t2).isPronto).toBe(false)
})

test('analisi d impatto: memoria superata tocca i task che la usavano', () => {
  let p = impostaStato(piano(), 'S1-T1', 'completato', 'ok', ORA).piano
  p = applicaImpatto(p, ['M1'], 'superata da DEC9', ORA)
  const d = p.domande.at(-1)
  expect(d?.azione?.tipo).toBe('impatto')
  p = rispondi(p, d?.id ?? '', 'si, va adeguato', 'pannello', ORA).piano
  const t = p.sprint[0]?.task[0]
  expect(t?.stato).toBe('da-fare')
  expect(t?.daRivedere).toBeDefined()
  expect(t && prontezza(p, t).isPronto).toBe(false)
  const rivisto = applicaPatch(p, { sprint: [{ id: 'S1', task: [{ id: 'S1-T1', rivisto: true }] }] }, ORA).piano
  expect(rivisto.sprint[0]?.task[0]?.daRivedere).toBeUndefined()
})

test('scegliere la nuova versione in un conflitto rende da rivedere i task collegati', () => {
  const p0 = rispondi(piano(), 'D1', 'x', 'pannello', ORA).piano
  void p0
  const conDom = applicaPatch(piano(), { domande: [{ testo: 'il cliente vuole PostgreSQL', conflittoCon: ['M1'], raccomandata: 'PostgreSQL' }] }, ORA).piano
  const id = conDom.domande.at(-1)?.id ?? ''
  const p = risolviConflitto(conDom, id, 'nuova', ORA).piano
  expect(p.sprint[0]?.task[0]?.daRivedere).toContain('M1')
})

test('mantenere la memoria scarta la voce nuova contraddittoria', () => {
  let p = applicaPatch(piano(), { memoria: [{ testo: 'database MySQL', fonte: 'docs/x.md:1' }] }, ORA).piano
  const nuovi = testiNuovi(piano(), p)
  expect(nuovi.some(n => n.id === 'M3')).toBe(true)
  p = aggiungiConflitti(p, [{ nuovo: { id: 'M3', testo: 'database MySQL' }, con: ['M1'], spiegazione: 'db diverso' }], ORA)
  const d = p.domande.at(-1)
  expect(d?.stato).toBe('in-conflitto')
  p = risolviConflitto(p, d?.id ?? '', 'memoria', ORA).piano
  expect(p.memoria.find(m => m.id === 'M3')?.stato).toBe('superata')
  expect(p.memoria.find(m => m.id === 'M1')?.stato).toBe('valida')
})

test('memoria cambiata fuori dal piano', () => {
  expect(contieneEstratto('# Note\n- **Database**: SQL Server 2019\n', 'Database: SQL Server 2019')).toBe(true)
  expect(contieneEstratto('Database: PostgreSQL', 'Database: SQL Server 2019')).toBe(false)
  let p = segnaDaVerificare(piano(), ['M1'], ORA)
  expect(p.memoria[0]?.stato).toBe('da-verificare')
  const d = p.domande.at(-1)
  expect(d?.azione?.tipo).toBe('voce-memoria')
  p = rispondi(p, d?.id ?? '', 'no, e superata', 'pannello', ORA).piano
  expect(p.memoria[0]?.stato).toBe('superata')
  expect(p.sprint[0]?.task[0]?.daRivedere).toBeDefined()
})

test('regole verificabili nel codice', () => {
  const p = piano()
  expect(violazioni(p, 'src/db.php', '$r = mysql_query($q);').map(m => m.id)).toEqual(['M2'])
  expect(violazioni(p, 'src/db.py', 'mysql_query(q)').length).toBe(0)
  expect(violazioni(p, 'src/db.php', '$st = $pdo->prepare($q);').length).toBe(0)
})

test('ipotesi di claude: confermare o respingere', () => {
  const p = piano()
  expect(confermaIpotesi(p, 'DEC1', true, ORA).decisioni[0]?.confermata).toBe(true)
  const no = confermaIpotesi(p, 'DEC1', false, ORA)
  expect(no.decisioni[0]?.superata).toBe(true)
  expect(no.domande.at(-1)?.testo).toContain('Ipotesi respinta')
})

test('lettura esito della verifica sulle modifiche', () => {
  const r = leggiEsitoModifiche('{"conflitti":[{"nuovo":"S1-T4","con":["M1","X"],"spiegazione":"s"},{"nuovo":"Z","con":["M1"]}]}', ['S1-T4'], ['M1'])
  expect(r).toEqual([{ nuovo: 'S1-T4', con: ['M1'], spiegazione: 's' }])
})

test('sprint con tutti i task annullati non blocca il piano', () => {
  let p = applicaPatch(pianoVuoto('demo', ORA), { sprint: [{ titolo: 'a', task: [{ titolo: 'x', criteri: ['c 1'] }] }, { titolo: 'b', task: [{ titolo: 'y', criteri: ['c 2'] }] }] }, ORA).piano
  p = impostaStato(p, 'S1-T1', 'annullato', '', ORA).piano
  expect(p.sprint[0]?.stato).toBe('annullato')
  expect(prontezza(p, p.sprint[1]!.task[0]!).isPronto).toBe(true)
})

test('velocita, previsione e chiusura dello sprint con revisione e retrospettiva', () => {
  let p = applicaPatch(
    pianoVuoto('demo', ORA),
    { sprint: [{ titolo: 'a', task: [{ titolo: 'x', stima: 3 }, { titolo: 'verifica', stima: 2 }] }, { titolo: 'b', task: [{ titolo: 'y', stima: 5 }, { titolo: 'z', stima: 5 }] }] },
    ORA,
  ).piano
  const presto = applicaPatch(p, { sprint: [{ id: 'S1', chiusura: { esito: 'ok' } }] }, ORA)
  expect(presto.rifiuti[0]).toContain('completati')
  p = impostaStato(p, 'S1-T1', 'completato', 'ok', ORA).piano
  p = impostaStato(p, 'S1-T2', 'completato', 'ok', ORA).piano
  expect(sprintDaChiudere(p).map(s => s.id)).toEqual(['S1'])
  expect(velocita(p)).toEqual({ media: 5, restanti: 10, fatti: 5, sprintStimati: 2 })
  expect(controlliQualita(p).some(x => x.testo.includes('retrospettiva'))).toBe(true)
  p = applicaPatch(p, { sprint: [{ id: 'S1', chiusura: { esito: 'obiettivo raggiunto' } }] }, ORA).piano
  expect(sprintDaChiudere(p)).toEqual([])
  expect(p.sprint[0]?.chiusura?.esito).toBe('obiettivo raggiunto')
})

test('scritture da terminale: si riconoscono i file scritti, non quelli solo letti', () => {
  expect(fileScrittiDaComando('echo "x" >> CLAUDE.md')).toEqual(['CLAUDE.md'])
  expect(fileScrittiDaComando('cat CLAUDE.md | grep db')).toEqual([])
  expect(fileScrittiDaComando("sed -i 's/a/b/' AGENTS.md && git status")).toEqual(['s/a/b/', 'AGENTS.md'])
  expect(fileScrittiDaComando('cp CLAUDE.md /tmp/copia.md')).toEqual(['/tmp/copia.md'])
  expect(fileScrittiDaComando('npm test 2>&1 | tee out.log')).toEqual(['out.log'])
  expect(fileScrittiDaComando('ls > /dev/null')).toEqual([])
  expect(fileScrittiDaComando('Set-Content -Path .claude/sprint/piano.json -Value x')).toContain('.claude/sprint/piano.json')
})

test('dipendenze circolari: veloce anche con molti task collegati', () => {
  const task = Array.from({ length: 60 }, (_, i) => ({ id: `S1-T${i + 1}`, titolo: `passo ${i + 1}`, criteri: ['test verde'], stima: 1, dipendeDa: Array.from({ length: i }, (_, k) => `S1-T${k + 1}`) }))
  const p = applicaPatch(pianoVuoto('d', ORA), { sprint: [{ titolo: 'a', task }] } as never, ORA).piano
  const t0 = Date.now()
  const pr = controlliQualita(p)
  expect(Date.now() - t0).toBeLessThan(500)
  expect(pr.some(x => x.testo === 'dipendenze circolari')).toBe(false)
  const conCiclo = applicaPatch(p, { sprint: [{ id: 'S1', task: [{ id: 'S1-T1', dipendeDa: ['S1-T60'] }] }] } as never, ORA).piano
  expect(controlliQualita(conCiclo).filter(x => x.testo === 'dipendenze circolari').length).toBeGreaterThan(1)
})

test('incoerenze di stato, regole rotte e domande doppie', () => {
  let p = applicaPatch(
    pianoVuoto('d', ORA),
    {
      memoria: [{ testo: 'niente mysql_', fonte: 'CLAUDE.md:3', vietato: '\\bmysql_(', ambito: '.php' }],
      sprint: [
        { titolo: 'base', obiettivo: 'tutto funziona bene', task: [{ titolo: 'a', criteri: ['test verde'], stima: 1 }, { titolo: 'b', criteri: ['test verde'], stima: 1, dipendeDa: ['S1-T1'] }, { titolo: 'verifica sprint', criteri: ['demo'], stima: 1 }] },
      ],
      domande: [
        { testo: 'Quale database?', sprint: 'S1', opzioni: ['a', 'b'] },
        { testo: 'quale database', sprint: 'S1', opzioni: ['a', 'b'] },
        { testo: 'Serve il login?', bloccante: true, opzioni: ['si', 'no'] },
      ],
      rischi: [{ testo: 'dati persi', probabilita: 'alta', impatto: 'alto', mitigazione: 'backup', task: 'S9-T9' }],
    } as never,
    ORA,
  ).piano
  // un divieto scritto male non passa in silenzio: chi aggiorna il piano lo sa subito
  const conRegola = applicaPatch(pianoVuoto('d', ORA), { memoria: [{ testo: 'niente mysql_', fonte: 'CLAUDE.md:3', vietato: '\\bmysql_(' }] } as never, ORA)
  expect(conRegola.rifiuti.join(' ')).toContain('SENZA controllo sul codice')
  p = applicaPatch(p, { annulla: ['S1-T1'], nota: 'non serve' } as never, ORA).piano
  const testi = controlliQualita(p).map(x => `${x.id} ${x.testo}`)
  expect(testi.some(t => t.startsWith('S1-T2 dipende da S1-T1, che e stato annullato'))).toBe(true)
  expect(testi.some(t => t.includes('senza estratto'))).toBe(true)
  expect(testi.some(t => t.includes('uguale a D1'))).toBe(true)
  expect(testi.some(t => t.startsWith('D3 domanda bloccante senza sprint o task'))).toBe(true)
  expect(testi.some(t => t.includes('mitigazione affidata a S9-T9'))).toBe(true)
  expect(testi.some(t => t.includes('obiettivo non verificabile'))).toBe(true)
})

test('esigenza must lasciata all ultimo sprint e task completato senza prova', () => {
  let p = applicaPatch(
    pianoVuoto('d', ORA),
    {
      sprint: [
        { titolo: 'uno', obiettivo: 'login con test verde', task: [{ titolo: 'verifica uno', criteri: ['test verde'], stima: 1 }] },
        { titolo: 'due', obiettivo: 'profili con test verde', task: [{ titolo: 'verifica due', criteri: ['test verde'], stima: 1 }] },
        { titolo: 'tre', obiettivo: 'report con test verde', task: [{ titolo: 'report', criteri: ['test verde'], stima: 1, requisiti: ['F1-E1'] }, { titolo: 'verifica tre', criteri: ['test verde'], stima: 1 }] },
      ],
    } as never,
    ORA,
  ).piano
  p = aggiungiFonte(p, { id: 'F1', titolo: 'mail', tipo: 'email', file: 'f', impronta: 'x' }, ORA)
  p = applicaPatch(p, { business: [{ id: 'F1', stato: 'analizzata', esigenze: [{ testo: 'report mensile', priorita: 'alta' }] }] } as never, ORA).piano
  p = { ...p, sprint: p.sprint.map((s, i) => (i === 0 ? { ...s, task: s.task.map(t => ({ ...t, stato: 'completato' as const, note: '' })) } : s)) }
  const testi = controlliQualita(p).map(x => `${x.id} ${x.testo}`)
  expect(testi.some(t => t.startsWith("F1-E1 esigenza alta coperta solo nell'ultimo sprint"))).toBe(true)
  expect(testi.some(t => t.startsWith('S1-T1 completato senza la prova'))).toBe(true)
})

test('comandi di verifica letti dai manifesti del progetto', () => {
  expect(comandiVerifica({ 'composer.json': JSON.stringify({ require: { 'laravel/framework': '^11.0' }, 'require-dev': { 'larastan/larastan': '^2', 'laravel/pint': '^1' } }) })).toEqual(['php artisan test', 'vendor/bin/phpstan analyse', 'vendor/bin/pint --test'])
  expect(comandiVerifica({ 'package.json': JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1', lint: 'eslint .', build: 'vite build' } }) })).toEqual(['npm run lint', 'npm run build'])
  expect(comandiVerifica({ 'pyproject.toml': '[tool.pytest.ini_options]\n[tool.ruff]' })).toEqual(['pytest -q', 'ruff check .'])
  expect(comandiVerifica({ 'composer.json': '{ rotto' })).toEqual([])
  expect(comandiVerifica({})).toEqual([])
})

test('analisi incrementale: file nuovi, cambiati, uguali', () => {
  const m = confrontaImpronte({ 'CLAUDE.md': 'a', 'README.md': 'b' }, { 'CLAUDE.md': 'a', 'README.md': 'c', 'AGENTS.md': 'd' })
  expect(m).toEqual({ nuovi: ['AGENTS.md'], cambiati: ['README.md'], invariati: ['CLAUDE.md'] })
  const testo = descriviRilevazione({ memoria: ['CLAUDE.md', 'README.md', 'AGENTS.md'], logica: [], metodi: [], strumentiMemoria: [], isSuperpowers: true, comandi: [], dimensioni: { 'README.md': 40 }, modifiche: m, pianoEsistente: '2 sprint' })
  expect(testo).toContain('Piano gia presente: 2 sprint')
  expect(testo).toContain('Cambiati dall\'ultima analisi: README.md')
  expect(testo).toContain('Uguali all\'ultima analisi: CLAUDE.md')
  expect(testo).toContain('README.md (40 KB: leggilo a pezzi)')
  expect(testo).toContain('Chiedi come si prova il progetto')
})

test('claude-mem nei testi per Claude: chi vale, regole cambiate, business', () => {
  const mem = { stato: 'attivo' as const, progetto: 'demo', search: 'mcp__claude-mem__search', timeline: 'timeline', get: 'get_observations', save: 'mcp__claude-mem__save_memory', outline: 'smart_outline', unfold: 'smart_unfold' }
  expect(promptMemoria(mem)).toContain('mcp__claude-mem__save_memory')
  expect(promptMemoria()).not.toContain('claude-mem')
  expect(promptBusiness(['F1'], mem)).toContain('mcp__claude-mem__search')
  expect(promptQualita(mem)).toContain('lavori simili')
  expect(passoClaudeMem({ ...mem, stato: 'spento' })).toEqual([])
  expect(passoClaudeMem({ ...mem, stato: 'assente' }).join(' ')).toContain('claude-mem@thedotmack')
  expect(memGuide({ isActive: true, tools: {}, settings: {} })).toContain('Chi vale: piano.json')
  expect(isDatiClaudeMem('C:\\Users\\me\\.claude-mem\\claude-mem.db')).toBe(true)
  expect(isDatiClaudeMem('/home/me/.claude-mem/settings.json')).toBe(false)
  expect(isDatiClaudeMem('src/claude-mem.ts')).toBe(false)
})
