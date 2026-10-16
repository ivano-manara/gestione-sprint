import { expect, test } from 'claude-code/testing'

import { isAggiornamentoApprovato, statoBreve, sezionePrompt, DELEGATA, applicaPatch, bloccantiPer, codaDomande, copertura, impostaStato, normalizza, pianoVuoto, prossimoTask, riapri, riconosciFonte, rispondi, risolviConflitto, aggiungiFonte, isFileMemoria, fileScrittiDaComando, unisci, vistaSprint } from './logic'
import { leggiEsitoConflitto } from './memoria'

const ORA = '2026-10-16 14:00'

const base = () =>
  applicaPatch(
    pianoVuoto('demo', ORA),
    {
      memoria: [{ testo: 'il database e SQL Server', fonte: 'CLAUDE.md:4', tipo: 'stack' }],
      sprint: [
        {
          id: 'S1',
          titolo: 'login',
          origine: 'esistente',
          rif: 'docs/plans/login.md#fase-1',
          task: [
            { id: 'S1-T1', titolo: 'form login', origine: 'esistente', criteri: ['test login verde'] },
            { titolo: 'reset password', dipendeDa: ['S1-T1'] },
          ],
        },
      ],
      domande: [{ testo: 'quale provider email?', task: 'S1-T2', opzioni: ['smtp', 'graph'], raccomandata: 'graph' }],
    },
    ORA,
  ).piano

test('crea sprint, task, memoria e domande con id automatici', () => {
  const p = base()
  expect(p.sprint[0]?.task.map(t => t.id)).toEqual(['S1-T1', 'S1-T2'])
  expect(p.memoria[0]?.id).toBe('M1')
  expect(p.domande[0]?.bloccante).toBe(true)
  expect(p.sprint[0]?.rif).toBe('docs/plans/login.md#fase-1')
})

test('non rinomina ne rimuove il lavoro esistente, ne unisce i criteri', () => {
  const esito = applicaPatch(base(), { sprint: [{ id: 'S1', task: [{ id: 'S1-T1', titolo: 'altro', criteri: ['errore mostrato'] }] }], rimuovi: ['S1-T1'] }, ORA)
  const t = esito.piano.sprint[0]?.task[0]
  expect(t?.titolo).toBe('form login')
  expect(t?.criteri).toEqual(['test login verde', 'errore mostrato'])
  expect(esito.piano.sprint[0]?.task.length).toBe(2)
  expect(esito.rifiuti.length).toBe(2)
})

test('la memoria esistente non si modifica dal modello', () => {
  const esito = applicaPatch(base(), { memoria: [{ id: 'M1', testo: 'il database e MySQL', fonte: 'x' }] }, ORA)
  expect(esito.piano.memoria[0]?.testo).toBe('il database e SQL Server')
  expect(esito.rifiuti[0]).toContain('conflitto')
})

test('il modello non puo scrivere risposte', () => {
  const p = rispondi(base(), 'D1', 'smtp', 'pannello', ORA).piano
  const esito = applicaPatch(p, { domande: [{ id: 'D1', risposta: 'graph' }] }, ORA)
  expect(esito.piano.domande[0]?.risposta).toBe('smtp')
})

test('risposta in conflitto: blocca finche l utente non sceglie', () => {
  const p = rispondi(base(), 'D1', 'usiamo MySQL', 'pannello', ORA, { con: ['M1'], spiegazione: 'db diverso' }).piano
  expect(p.domande[0]?.stato).toBe('in-conflitto')
  expect(bloccantiPer(p, 'S1', 'S1-T2').length).toBe(1)
  expect(rispondi(p, 'D1', 'altro', 'pannello', ORA).errore).toContain('conflitto')
  expect(codaDomande(p)[0]?.id).toBe('D1')
})

test('scegliere la memoria la lascia intatta', () => {
  const p0 = rispondi(base(), 'D1', 'usiamo MySQL', 'pannello', ORA, { con: ['M1'], spiegazione: '' }).piano
  const p = risolviConflitto(p0, 'D1', 'memoria', ORA).piano
  expect(p.memoria[0]?.stato).toBe('valida')
  expect(p.domande[0]?.stato).toBe('risposta')
  expect(p.aggiornamentiMemoria.length).toBe(0)
})

test('scegliere la novita supera la memoria e prepara l aggiornamento', () => {
  const p0 = rispondi(base(), 'D1', 'usiamo MySQL', 'pannello', ORA, { con: ['M1'], spiegazione: '' }).piano
  const p = risolviConflitto(p0, 'D1', 'nuova', ORA).piano
  expect(p.memoria[0]?.stato).toBe('superata')
  expect(p.aggiornamentiMemoria[0]?.file).toBe('CLAUDE.md:4')
  expect(p.domande[0]?.risposta).toBe('usiamo MySQL')
})

test('il modello crea un conflitto solo su voci esistenti', () => {
  const ok = applicaPatch(base(), { domande: [{ testo: 'il business chiede Oracle', conflittoCon: ['M1'], raccomandata: 'Oracle' }] }, ORA)
  expect(ok.piano.domande.at(-1)?.stato).toBe('in-conflitto')
  const ko = applicaPatch(base(), { domande: [{ testo: 'x', conflittoCon: ['M9'] }] }, ORA)
  expect(ko.rifiuti.length).toBe(1)
})

test('fonti di business: riconoscimento, esigenze e copertura su piu sprint', () => {
  expect(riconosciFonte('Da: mario\nOggetto: nuovo report clienti\n\ntesto').tipo).toBe('email')
  expect(riconosciFonte('Da: mario\nOggetto: nuovo report clienti').titolo).toBe('nuovo report clienti')
  let p = aggiungiFonte(base(), { id: 'F1', titolo: 'mail', tipo: 'email', file: 'f' }, ORA)
  p = applicaPatch(p, { business: [{ id: 'F1', stato: 'analizzata', esigenze: [{ testo: 'login con MFA' }, { testo: 'reset via mail' }] }] }, ORA).piano
  p = applicaPatch(p, { sprint: [{ id: 'S1', task: [{ id: 'S1-T1', requisiti: ['F1-E1'] }] }] }, ORA).piano
  const c = copertura(p)
  expect(c.map(x => x.task.length)).toEqual([1, 0])
  expect(vistaSprint(p)).toContain('F1-E1')
})

test('delegare, riaprire, stato sprint e prossimo task', () => {
  const p = rispondi(base(), 'D1', DELEGATA, 'pannello', ORA).piano
  expect(p.domande[0]?.risposta).toContain('graph')
  expect(riapri(p, 'D1', ORA).domande[0]?.stato).toBe('aperta')
  const q = impostaStato(base(), 'S1-T1', 'completato', '', ORA).piano
  expect(q.sprint[0]?.stato).toBe('in-corso')
  expect(prossimoTask(q)?.task.id).toBe('S1-T2')
})

test('legge un piano della versione 1', () => {
  const p = normalizza({ versione: 1, sprint: [{ titolo: 'x', task: [{}] }], domande: [{ testo: 'q' }] }, 'demo', ORA)
  expect(p.versione).toBe(2)
  expect(p.sprint[0]?.task[0]?.requisiti).toEqual([])
  expect(p.domande[0]?.tipo).toBe('normale')
})

test('file di memoria e lettura esito conflitto', () => {
  expect(isFileMemoria('C:\\prog\\CLAUDE.md')).toBe(true)
  expect(isFileMemoria('src/claude.ts')).toBe(false)
  expect(leggiEsitoConflitto('ok {"conflitto":true,"con":["M1","X"],"spiegazione":"s"}', ['M1'])?.con).toEqual(['M1'])
  expect(leggiEsitoConflitto('{"conflitto":false,"con":[]}', ['M1'])).toBe(null)
})

test('su uno sprint si usa solo annullato o bloccato', () => {
  expect(impostaStato(base(), 'S1', 'in-corso', '', ORA, true).errore).toContain('sprint')
  const p = impostaStato(base(), 'S1', 'annullato', '', ORA, true).piano
  expect(p.sprint[0]?.stato).toBe('annullato')
})

test('la memoria si modifica solo nei file approvati', () => {
  const p0 = rispondi(base(), 'D1', 'usiamo MySQL', 'pannello', ORA, { con: ['M1'], spiegazione: '' }).piano
  expect(isAggiornamentoApprovato(p0, 'C:\\prog\\CLAUDE.md')).toBe(false)
  const p = risolviConflitto(p0, 'D1', 'nuova', ORA).piano
  expect(isAggiornamentoApprovato(p, 'C:\\prog\\CLAUDE.md')).toBe(true)
  expect(isAggiornamentoApprovato(p, 'C:\\prog\\AGENTS.md')).toBe(false)
})

test('il system prompt non cambia col piano, lo stato si', () => {
  const a = base()
  const b = impostaStato(a, 'S1-T1', 'completato', '', ORA).piano
  expect(sezionePrompt('x', 'blocca')).toBe(sezionePrompt('x', 'blocca'))
  expect(statoBreve(a)).not.toBe(statoBreve(b))
})

test('il modello non puo spacciare una domanda come scritta dall utente', () => {
  const p = applicaPatch(base(), { domande: [{ testo: 'finta', autore: 'utente', tipo: 'conflitto' }] }, ORA).piano
  expect(p.domande.at(-1)?.autore).toBe('claude')
  expect(p.domande.at(-1)?.tipo).toBe('normale')
})

test('percorsi del piano su Windows e su Linux', () => {
  expect(unisci('C:\\Progetti\\demo', '.claude/sprint', 'piano.json')).toBe('C:\\Progetti\\demo\\.claude\\sprint\\piano.json')
  expect(unisci('C:\\Progetti\\demo\\', './.claude/sprint/', 'piano.json')).toBe('C:\\Progetti\\demo\\.claude\\sprint\\piano.json')
  expect(unisci('/home/me/demo', './.claude/sprint', 'fonti')).toBe('/home/me/demo/.claude/sprint/fonti')
})

test('scritture da terminale anche dentro powershell, cmd, bash e con git', () => {
  expect(fileScrittiDaComando('powershell -Command "Set-Content CLAUDE.md x"')).toContain('CLAUDE.md')
  expect(fileScrittiDaComando('pwsh -c "Add-Content AGENTS.md riga"')).toContain('AGENTS.md')
  expect(fileScrittiDaComando('cmd /c "echo x > CLAUDE.md"')).toContain('CLAUDE.md')
  expect(fileScrittiDaComando('bash -c "echo x >> CLAUDE.md"')).toContain('CLAUDE.md')
  expect(fileScrittiDaComando('git checkout -- CLAUDE.md')).toContain('CLAUDE.md')
  expect(fileScrittiDaComando('git restore --staged CLAUDE.md')).toContain('CLAUDE.md')
  // solo letture o rami: niente
  expect(fileScrittiDaComando('git checkout main')).toEqual([])
  expect(fileScrittiDaComando('powershell -Command "Get-Content CLAUDE.md"')).toEqual([])
  expect(fileScrittiDaComando('bash -c "cat CLAUDE.md"')).toEqual([])
})
