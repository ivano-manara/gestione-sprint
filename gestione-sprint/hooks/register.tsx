// gestione-sprint: unico file dei hook. Va modificato qui (non e piu generato).
// Tutto cio che usa $ sta qui, perche il validatore di Claude Code non segue $ attraverso gli import;
// la logica pura resta in hooks/sprint/*.ts e hooks/contesto/*.ts.

import { atom, read, update } from 'claude-code'
import type { BoxProps, ButtonProps, ElementConstructor, EngineInterface, EngineInterface as Engine, EventName, Hook, InputProps, PromptComposeResult, Register, RenderElement, TextProps } from 'claude-code'
import type { Domanda, FonteBusiness, LedgerState, MemoryState, MeterState, Piano, ProposalState, SavedState, StatoLavoro, Task, Vista } from '../types'
import { ACTION_LABELS, activeProposals, clearAfterCompaction, isNewer, severityColor, severityMark, snooze } from './contesto/advisor'
import type { ActionId, Proposal, Snoozes } from './contesto/advisor'
import { RAW_MARKER, budgetFor, compressOutput, compressionHeader, levelFor } from './contesto/compress'
import type { CompressLevel } from './contesto/compress'
import { CHECK_SYSTEM, EMPTY_MEMORY, addToHistory, checkPrompt, checkSummary, memoryChecklist, memoryRecoveryNote, mergeReply, openConflicts, overlap, parseReply, resolveConflict, shouldCheck, similar, takePending } from './contesto/conflicts'
import type { Conflict, Resolution, SessionMemory } from './contesto/conflicts'
import { langVersions, langchainGuide } from './contesto/langchain'
import type { LangVersions } from './contesto/langchain'
import { laravelGuide, layoutOf, routeListAdvice, versionFromComposerJson, versionFromLock } from './contesto/laravel'
import type { LaravelLayout, LaravelVersion } from './contesto/laravel'
import { COMPACT_MARK, EMPTY_LEDGER, addFailure, addFile, addRequest, commandKey, compactInstructions, coverage, firstErrorLine, isEmpty, ledgerChecklist, missingFromSummary, recoveryNote, resolveCommand, summaryText } from './contesto/ledger'
import type { Ledger } from './contesto/ledger'
import { HANDOFF_PROMPT, REMEDY_HINT, adviceFor, asNumber, blockedDirIn, blockedDirInCommand, compactSummary, formatRows, formatTokens, isSizeChecked, levelOf, parseList, shouldAutoCompact, topRows } from './contesto/logic'
import type { Level } from './contesto/logic'
import { MEM_COMPACT_NOTE, NO_MEM, findMemTools, memGuide, memHandoffPrompt, memTool, memWeightLines, observationsHint, outlineRemedy, parseMemSettings } from './contesto/mem'
import type { MemInfo } from './contesto/mem'
import { asBarStyle, asMeterMode, busiestLimit, categoryLine, levelWord, limitLabel, meterBar, meterColor, statusMeter, tokenDetail } from './contesto/meter'
import type { BarStyle } from './contesto/meter'
import { PROFILES, PROFILE_MARKERS, PYTHON_DEPENDENCY_FILES, SECRET_REMEDY, claudeMdSnippet, detectProfiles, dirsFor, dumpedFiles, heavyKindOf, heavyRemedy, isSecretFile, isSecretTarget, mentionsLangChain, quietPytest, resolvePath, secretFileInCommand, stackHintFor } from './contesto/stack'
import type { Profile } from './contesto/stack'
import { DELEGATA, ETICHETTA_STATO, STATI_LAVORO, aggiungiConflitti, aggiungiDecisioneUtente, aggiungiFonte, applicaPatch, barra, bloccantiPer, codaDomande, comeMarkdown, conImpronte, confermaIpotesi, copertura, domandeAperte, fileScrittiDaComando, impostaStato, impronta, isDaClaudeMem, isDatiClaudeMem, ipotesiDaConfermare, isAggiornamentoApprovato, isFileMemoria, nomeCartella, normalizza, normalizzaPercorso, nuovaDomandaUtente, nuovoIdFonte, percentuale, pianoVuoto, pl, riapri, riconosciFonte, riepilogo, risolviConflitto, rispondi, segnaAggiornamento, segnaDaVerificare, sezionePrompt, sprintDaChiudere, statoBreve, testiNuovi, testoStato, unisci, velocita, violazioni, vistaBusiness, vistaMemoria, vistaRiepilogo, vistaSprint, voce, vociVincolanti } from './sprint/logic'
import type { Patch, Voce } from './sprint/logic'
import { CANDIDATI, MANIFESTI, SISTEMA_CONFLITTO, comandiVerifica, confrontaImpronte, contieneEstratto, descriviRilevazione, leggiEsitoConflitto, leggiEsitoModifiche, promptConflitto, promptModifiche, strumentiDiMemoria, vociPertinenti } from './sprint/memoria'
import type { Rilevazione } from './sprint/memoria'
import { INSTALLA_CLAUDE_MEM, INSTALLA_SUPERPOWERS, promptAnalisi, promptBusiness, promptChiusura, promptDomandeTask, promptMemoria, promptProcedi, promptQualita, promptRisposte } from './sprint/prompts'
import type { UsoMemoria } from './sprint/prompts'
import { controlliQualita, isVago, prontezza, punteggio, vistaQualita } from './sprint/qualita'


// ==================== archivio: lettura e scrittura del piano ====================

// Lettura e scrittura del piano, fonti di business, rilevazione della memoria, verifica conflitti.
// Tutte le funzioni che usano $ stanno qui, dichiarate a livello di file.






export const cfg = {
  cartella: '.claude/sprint',
  skill: 'superpowers:brainstorming',
  modo: 'blocca' as 'blocca' | 'avvisa',
  perGiro: 3,
  isApriAvvio: true,
  isVerifica: true,
  modelloVerifica: 'haiku',
  isProteggiMemoria: true,
}

const pianoA = atom({ plugin: 'gestione-sprint', key: 'piano' } as const, null as Piano | null)
const vistaA = atom({ plugin: 'gestione-sprint', key: 'vista' } as const, 'piano' as Vista)
const erroreA = atom({ plugin: 'gestione-sprint', key: 'errore' } as const, '')
const attesaA = atom({ plugin: 'gestione-sprint', key: 'inAttesa' } as const, [] as string[])
const taskSelA = atom({ plugin: 'gestione-sprint', key: 'taskSel' } as const, '')
const sprintSelA = atom({ plugin: 'gestione-sprint', key: 'sprintSel' } as const, '')
const domandaSelA = atom({ plugin: 'gestione-sprint', key: 'domandaSel' } as const, '')
const verificaA = atom({ plugin: 'gestione-sprint', key: 'verifica' } as const, '')

export const ora = (): string => new Date().toISOString().slice(0, 16).replace('T', ' ')

export async function percorsi($: EngineInterface) {
  const radice = await $.session.root()
  return {
    radice,
    json: unisci(radice, cfg.cartella, 'piano.json'),
    md: unisci(radice, cfg.cartella, 'SPRINT.md'),
    fonti: unisci(radice, cfg.cartella, 'fonti'),
  }
}

export async function carica($: EngineInterface): Promise<Piano | null> {
  const { json, radice } = await percorsi($)
  if (!(await $.fs.exists(json).catch(() => false))) {
    await update($, pianoA, () => null)
    return null
  }
  try {
    const piano = normalizza(JSON.parse(await $.fs.read(json)), nomeCartella(radice), ora())
    await update($, pianoA, () => piano)
    await update($, erroreA, () => '')
    return piano
  } catch (err) {
    await update($, erroreA, () => `piano.json non leggibile: ${String(err).slice(0, 160)}`)
    return null
  }
}

export async function salva($: EngineInterface, piano: Piano): Promise<void> {
  const { json, md } = await percorsi($)
  await $.fs.write(json, JSON.stringify(piano, null, 1) + '\n')
  await $.fs.write(md, comeMarkdown(piano))
  await update($, pianoA, () => piano)
}

// Le modifiche al piano passano una alla volta: Claude chiama spesso piu strumenti in parallelo,
// e due letture-modifiche-scritture sovrapposte perderebbero una delle due modifiche.
let codaPiano: Promise<unknown> = Promise.resolve()
function inCoda<T>(lavoro: () => Promise<T>): Promise<T> {
  const giro = codaPiano.then(lavoro, lavoro)
  codaPiano = giro.catch(() => undefined)
  return giro
}

/** Rilegge sempre il file prima di cambiare: il file e la fonte di verita. */
export async function muta<R>($: EngineInterface, fn: (p: Piano) => { piano: Piano } & R): Promise<R & { piano: Piano }> {
  return inCoda(() => mutaOra($, fn))
}

/** Come muta, ma da usare solo dentro un lavoro gia in coda. */
async function mutaOra<R>($: EngineInterface, fn: (p: Piano) => { piano: Piano } & R): Promise<R & { piano: Piano }> {
  const { radice, json } = await percorsi($)
  const letto = await carica($)
  // Un piano.json rovinato non si sovrascrive mai con un piano vuoto: si ferma tutto finche non viene corretto.
  if (!letto && (await $.fs.exists(json))) {
    throw new Error(`${cfg.cartella}/piano.json non leggibile: correggilo (o rinominalo per ripartire) e ricarica con r nel pannello`)
  }
  const attuale = letto ?? pianoVuoto(nomeCartella(radice), ora())
  const esito = fn(attuale)
  if (esito.piano !== attuale) {
    await salva($, esito.piano)
  }
  return esito
}

// ---------- fonti di business ----------

export async function salvaFonte($: EngineInterface, raw: string, titoloForzato?: string): Promise<{ id: string; isNuova: boolean }> {
  const pulito = raw.trim()
  if (pulito.length < 10) {
    return { id: '', isNuova: false }
  }
  return inCoda(() => salvaFonteOra($, pulito, titoloForzato))
}

async function salvaFonteOra($: EngineInterface, pulito: string, titoloForzato?: string): Promise<{ id: string; isNuova: boolean }> {
  const { fonti, radice, json } = await percorsi($)
  const riconosciuta = riconosciFonte(pulito)
  const firma = impronta(pulito)
  const letto = await carica($)
  // Con un piano illeggibile l'id della fonte sarebbe sbagliato e sovrascriverebbe il testo di una fonte esistente.
  if (!letto && (await $.fs.exists(json))) {
    throw new Error(`${cfg.cartella}/piano.json non leggibile: correggilo e ricarica, poi incolla di nuovo la fonte`)
  }
  const attuale = letto ?? pianoVuoto(nomeCartella(radice), ora())
  // La stessa fonte incollata due volte non si duplica.
  const gia = attuale.business.find(f => f.impronta === firma)
  if (gia) {
    return { id: gia.id, isNuova: false }
  }
  // Prima il file, poi il piano: una fonte nel piano ha sempre il suo testo.
  const id = nuovoIdFonte(attuale)
  await $.fs.write(unisci(fonti, `${id}.md`), `<!-- fonte ${id} incollata il ${ora()} -->\n${pulito}\n`)
  await mutaOra($, p => ({
    piano: p.business.some(f => f.id === id)
      ? p
      : aggiungiFonte(p, { id, titolo: titoloForzato || riconosciuta.titolo, tipo: riconosciuta.tipo, file: `${cfg.cartella}/fonti/${id}.md`, impronta: firma }, ora()),
  }))
  return { id, isNuova: true }
}

export async function leggiFonte($: EngineInterface, id: string): Promise<string> {
  const { fonti } = await percorsi($)
  const file = unisci(fonti, `${id}.md`)
  return (await $.fs.exists(file)) ? $.fs.read(file) : ''
}

// ---------- rilevazione della memoria e del metodo ----------

let superpowers: boolean | undefined

/** claude-mem installato come plugin (dall'elenco dei plugin); undefined se l'elenco non si e potuto leggere. */
let claudeMemPlugin: boolean | undefined

/**
 * Legge `claude plugin list` una volta per analisi: dice se ci sono superpowers e claude-mem.
 * Solo il "si" resta valido per la sessione: dopo un'installazione il mod se ne accorge alla prossima analisi.
 */
async function cercaSuperpowers($: EngineInterface): Promise<boolean | undefined> {
  if (superpowers === true && claudeMemPlugin === true) {
    return superpowers
  }
  for (const exe of ['claude', 'claude.exe', 'claude.cmd']) {
    const r = await $.process.run([exe, 'plugin', 'list'], { timeoutMs: 10000 }).catch(() => undefined)
    if (r && r.exitCode === 0) {
      superpowers = superpowers === true || /superpowers/i.test(r.stdout)
      claudeMemPlugin = claudeMemPlugin === true || /claude-mem/i.test(r.stdout)
      // Una sola verita su claude-mem: se il plugin c'e, guida di sistema, compattazione e passaggio lo usano.
      if (claudeMemPlugin && state.memMode !== 'spento' && !state.mem.isActive) {
        state.mem = { ...state.mem, isActive: true }
        if (!state.dirs.includes('.claude-mem')) state.dirs = [...state.dirs, '.claude-mem']
      }
      return superpowers
    }
  }
  return superpowers
}

/** Stato di claude-mem per i testi e il pannello: attivo, assente (da proporre) o spento (opzione o rifiuto). */
export const usoMemoria = (piano?: Piano | null, progetto = ''): UsoMemoria => {
  const isRifiutato = piano?.decisioni.some(d => !d.superata && /claude-mem/i.test(d.testo) && /non\s+(installar|usar)/i.test(d.testo)) === true
  const isAttivo = state.mem.isActive || claudeMemPlugin === true
  const stato = state.memMode === 'spento' ? 'spento' : isAttivo ? 'attivo' : isRifiutato ? 'spento' : 'assente'
  return {
    stato,
    progetto: progetto || (piano ? piano.progetto.nome : ''),
    search: memTool(state.mem, 'search'),
    timeline: memTool(state.mem, 'timeline'),
    get: memTool(state.mem, 'get_observations'),
    save: memTool(state.mem, 'save_memory'),
    outline: memTool(state.mem, 'smart_outline'),
    unfold: memTool(state.mem, 'smart_unfold'),
  }
}

/** Messaggio a Claude per installare claude-mem, dopo la conferma dell'utente. */
export const testoInstallaMem = (): string =>
  `Chiedimi conferma e poi installa claude-mem (memoria tra le sessioni, serve Node 20 o superiore: controlla con node --version) con: ${INSTALLA_CLAUDE_MEM.join(' && ')}. ` +
  `Poi ricordami di aprire una sessione nuova. Se rifiuto, registra in decisioni "claude-mem: non installare".`

/** Per il pannello: false solo quando claude-mem manca davvero e non e stato rifiutato. */
export const statoClaudeMem = (piano?: Piano | null): boolean | undefined => {
  const u = usoMemoria(piano)
  return u.stato === 'attivo' ? true : u.stato === 'assente' && claudeMemPlugin === false ? false : undefined
}

export async function rileva($: EngineInterface): Promise<Rilevazione> {
  const { radice } = await percorsi($)
  const memoria: string[] = []
  const logica: string[] = []
  const metodi = new Set<string>()
  for (const c of CANDIDATI) {
    if (await $.fs.exists(unisci(radice, c.percorso)).catch(() => false)) {
      ;(c.tipo === 'memoria' ? memoria : logica).push(c.percorso)
      if (c.metodo) {
        metodi.add(c.metodo)
      }
    }
  }
  const nomi = (await $.tool.list().catch(() => [])).map(t => t.name)
  const isSkillLocale = cfg.skill.startsWith('superpowers') ? await cercaSuperpowers($) : undefined

  // Dimensioni e impronte dei file trovati: si leggono a pezzi quelli grandi, si rileggono solo quelli cambiati.
  const dimensioni: Record<string, number> = {}
  const impronte: Record<string, string> = {}
  for (const f of [...memoria, ...logica]) {
    const percorso = unisci(radice, f)
    const st = await $.fs.stat(percorso).catch(() => undefined)
    if (st && st.kind !== 'file') continue
    if (st) dimensioni[f] = Math.max(1, Math.round(st.size / 1024))
    if (!st || st.size <= 1_000_000) {
      const t = await $.fs.read(percorso).catch(() => undefined)
      if (t !== undefined) impronte[f] = impronta(t)
    }
  }
  // Comandi di test, lint e build dai manifesti del progetto.
  const manifesti: Partial<Record<(typeof MANIFESTI)[number], string>> = {}
  for (const m of MANIFESTI) {
    const percorso = unisci(radice, m)
    if (!(await $.fs.exists(percorso).catch(() => false))) continue
    const st = await $.fs.stat(percorso).catch(() => undefined)
    if (st && (st.kind !== 'file' || st.size > 500_000)) continue
    const t = await $.fs.read(percorso).catch(() => undefined)
    if (t !== undefined) manifesti[m] = t
  }
  const piano = await read($, pianoA)
  impronteAnalisi = impronte
  return {
    memoria,
    logica,
    metodi: [...metodi],
    strumentiMemoria: strumentiDiMemoria(nomi),
    isSuperpowers: isSkillLocale,
    comandi: comandiVerifica(manifesti),
    dimensioni,
    modifiche: piano ? confrontaImpronte(piano.progetto.impronte, impronte) : undefined,
    pianoEsistente: piano && (piano.sprint.length || piano.memoria.length) ? riassuntoPiano(piano) : undefined,
  }
}

/** Impronte dei file letti dall'ultima analisi avviata: entrano nel piano alla prima modifica che Claude fa. */
let impronteAnalisi: Record<string, string> | undefined

const riassuntoPiano = (piano: Piano): string => {
  const r = riepilogo(piano)
  return [
    `${pl(r.sprintTotali, 'sprint', 'sprint')} (${r.sprintFatti} completati)`,
    `${pl(r.taskTotali, 'task', 'task')} (${r.taskFatti} fatti)`,
    `${pl(piano.memoria.filter(m => m.stato === 'valida').length, 'voce', 'voci')} di memoria valide`,
    `${pl(piano.decisioni.filter(d => !d.superata).length, 'decisione', 'decisioni')}`,
    `${pl(piano.business.length, 'fonte', 'fonti')} di business`,
    `${pl(r.aperte, 'domanda aperta', 'domande aperte')}`,
  ].join(', ')
}

export const statoSuperpowers = (): boolean | undefined => superpowers

// ---------- risposta con verifica di coerenza ----------

/**
 * Registra una risposta dell'utente. Prima chiede a un modello piccolo se contraddice
 * memoria, decisioni o esigenze: se si, la domanda va in conflitto e l'utente deve scegliere.
 */
export async function rispondiVerificato(
  $: EngineInterface,
  id: string,
  risposta: string,
  fonte: 'pannello' | 'chat',
): Promise<{ esito: 'ok' | 'conflitto' | 'errore'; testo: string; piano?: Piano }> {
  const piano = (await carica($)) ?? undefined
  const d = piano?.domande.find(x => x.id === id)
  if (!piano || !d) {
    return { esito: 'errore', testo: `${id}: domanda non trovata` }
  }
  let conflitto: { con: string[]; spiegazione: string } | undefined
  let avviso = ''
  const voci = vociVincolanti(piano, id)
  // "decidi tu" vale la scelta consigliata: e quella che va confrontata con la memoria.
  const effettiva = risposta.trim() === DELEGATA ? (d.raccomandata ?? '') : risposta
  // Le domande che il mod genera sulla memoria stessa (verifica, impatto, ipotesi) non si confrontano con la memoria.
  if (cfg.isVerifica && voci.length && effettiva.trim() && !d.azione) {
    await update($, verificaA, () => id)
    try {
      const scelte = vociPertinenti(voci, `${d.testo} ${effettiva}`)
      const r = await $.model.complete({
        model: cfg.modelloVerifica,
        system: SISTEMA_CONFLITTO,
        prompt: promptConflitto(d, effettiva, scelte),
        maxTokens: 200,
        timeoutMs: 30000,
      })
      if (r.isAnswered) {
        conflitto = leggiEsitoConflitto(r.text, scelte.map(v => v.id)) ?? undefined
      } else {
        avviso = ' (verifica di coerenza non eseguita)'
      }
    } catch {
      avviso = ' (verifica di coerenza non eseguita: modello non disponibile)'
    } finally {
      await update($, verificaA, () => '')
    }
  }
  const esito = await muta($, p => rispondi(p, id, risposta, fonte, ora(), conflitto))
  if (esito.errore) {
    return { esito: 'errore', testo: esito.errore }
  }
  if (conflitto) {
    return {
      esito: 'conflitto',
      testo: `${id}: la risposta contraddice ${conflitto.con.join(', ')}. ${conflitto.spiegazione} L'utente deve scegliere con il pulsante ▶ Risolvi il conflitto sopra il prompt (o /sprint-scegli ${id} memoria|nuova).`,
      piano: esito.piano,
    }
  }
  return { esito: 'ok', testo: `${id} registrata${avviso}.`, piano: esito.piano }
}

export async function selezioneDomanda($: EngineInterface): Promise<string> {
  return read($, domandaSelA)
}

// ---------- rotture della memoria ----------

/**
 * Confronta cio che il modello ha appena aggiunto al piano con memoria, decisioni ed esigenze
 * gia registrate. Ogni contrasto diventa una domanda di conflitto: decide l'utente.
 */
export async function verificaModifiche($: EngineInterface, prima: Piano, dopo: Piano): Promise<number> {
  if (!cfg.isVerifica) return 0
  const nuovi = testiNuovi(prima, dopo)
  const voci = vociVincolanti(prima)
  if (!nuovi.length || !voci.length) return 0
  const scelte = vociPertinenti(voci, nuovi.map(n => n.testo).join(' '))
  try {
    const r = await $.model.complete({
      model: cfg.modelloVerifica,
      system: SISTEMA_CONFLITTO,
      prompt: promptModifiche(nuovi, scelte),
      maxTokens: 500,
      timeoutMs: 40000,
    })
    if (!r.isAnswered) return 0
    const trovati = leggiEsitoModifiche(r.text, nuovi.map(n => n.id), scelte.map(v => v.id))
      .map(t => ({ ...t, nuovo: nuovi.find(n => n.id === t.nuovo) }))
      .filter((t): t is { nuovo: (typeof nuovi)[number]; con: string[]; spiegazione: string } => t.nuovo !== undefined)
    if (!trovati.length) return 0
    const esito = await muta($, p => ({ piano: aggiungiConflitti(p, trovati, ora()) }))
    return esito.piano.domande.length - dopo.domande.length
  } catch {
    return 0
  }
}

/**
 * Deriva della memoria: ogni voce con un estratto deve ancora comparire nel suo file.
 * Se e sparita (il file e stato cambiato fuori dal piano) la voce va verificata dall'utente.
 */
export async function verificaFonti($: EngineInterface): Promise<string[]> {
  const piano = await carica($)
  if (!piano) return []
  const { radice } = await percorsi($)
  const perFile = new Map<string, string[]>()
  for (const m of piano.memoria) {
    if (m.stato !== 'valida' || !m.estratto) continue
    const file = m.fonte.replace(/:\d+(-\d+)?$/, '').trim()
    if (!file || /claude-mem|non indicata/i.test(file)) continue
    perFile.set(file, [...(perFile.get(file) ?? []), m.id])
  }
  const cambiate: string[] = []
  for (const [file, ids] of [...perFile].slice(0, 25)) {
    const percorso = /^([a-z]:|[\\/])/i.test(file) ? file : unisci(radice, file)
    const testo = await $.fs.read(percorso).catch(() => undefined)
    for (const id of ids) {
      const m = piano.memoria.find(x => x.id === id)
      if (m?.estratto && (testo === undefined || !contieneEstratto(testo, m.estratto))) cambiate.push(id)
    }
  }
  if (cambiate.length) {
    await muta($, p => ({ piano: segnaDaVerificare(p, cambiate, ora()) }))
  }
  return cambiate
}

// ==================== ponte: collegamenti tra modulo sprint e modulo contesto ====================

// Ponte tra i due moduli: memoria della sessione (contesto) e memoria di progetto (sprint).
// - le scelte fatte in chat sulle contraddizioni entrano nel piano;
// - la memoria di progetto entra nel controllo delle contraddizioni della chat;
// - compattazione e passaggio di sessione rispettano il piano invece di riassumerlo;
// - la banda sopra il prompt mostra anche lo stato del piano.








const ledgerA = atom({ plugin: 'gestione-sprint', key: 'ledger' } as const, { files: [], errors: [], requests: [] } as LedgerState)

const TEMA = 'progetto'

/** La voce di progetto che un testo della chat cita (lo stesso fatto, scritto quasi uguale). */
export const voceCitata = (voci: readonly Voce[], testo: string): Voce | undefined =>
  voci.find(v => similar(v.testo, testo) || overlap(testo, v.testo) >= 0.7 || overlap(v.testo, testo) >= 0.7)

/** Il controllo delle contraddizioni della chat vede anche la memoria valida del progetto. */
export async function memoriaConProgetto($: EngineInterface, memory: SessionMemory): Promise<SessionMemory> {
  const piano = await read($, pianoA)
  if (!piano) return memory
  const voci = vociVincolanti(piano).filter(v => v.tipo !== 'esigenza').slice(-25)
  const extra = voci
    .filter(v => !memory.decisions.some(d => similar(d.text, v.testo)))
    .map(v => ({ topic: `${TEMA} ${v.id}`, text: v.testo, status: 'valida' as const }))
  return extra.length ? { ...memory, decisions: [...extra, ...memory.decisions] } : memory
}

/** Dopo il controllo: le voci di progetto non diventano decisioni della sessione (stanno gia nel piano). */
export async function soloSessione($: EngineInterface, memory: SessionMemory): Promise<SessionMemory> {
  const piano = await read($, pianoA)
  if (!piano) return memory
  const voci = vociVincolanti(piano)
  const decisions = memory.decisions.filter(d => !d.topic.startsWith(`${TEMA} `) && !voceCitata(voci, d.text))
  return decisions.length === memory.decisions.length ? memory : { ...memory, decisions }
}

/**
 * La scelta fatta in chat su una contraddizione entra nel piano.
 * Se la parte superata e una voce di memoria di progetto, segue lo stesso percorso del pannello:
 * voce superata, aggiornamento della memoria da approvare, analisi d'impatto sui task.
 */
export async function sceltaNelPiano($: EngineInterface, c: Conflict, resolution: Resolution): Promise<string | undefined> {
  const piano = await carica($)
  if (!piano || resolution === 'nessuna') return undefined
  const voci = vociVincolanti(piano)
  const vecchia = voceCitata(voci, c.older)
  const nuova = voceCitata(voci, c.newer)
  const t = ora()
  // Chi perde la scelta: se e una voce del progetto (anche due voci del progetto in contrasto tra loro) viene superata
  // con lo stesso percorso del pannello; chi vince puo essere una voce o un testo della chat.
  if (resolution === 'nuova' || resolution === 'vecchia') {
    const perdente = resolution === 'nuova' ? vecchia : nuova
    const vincente = resolution === 'nuova' ? nuova : vecchia
    const testoVincente = resolution === 'nuova' ? c.newer : c.older
    if (perdente && perdente.id !== vincente?.id) {
      await muta($, p => {
        const conDomanda = aggiungiConflitti(
          p,
          [{ nuovo: { id: vincente?.id ?? 'chat', testo: vincente?.testo ?? testoVincente }, con: [perdente.id], spiegazione: `scelta fatta in chat su "${c.topic}"` }],
          t,
        )
        const d = conDomanda.domande.at(-1)
        return d && d !== p.domande.at(-1) ? risolviConflitto(conDomanda, d.id, 'nuova', t) : { piano: conDomanda }
      })
      return `Memoria di progetto ${perdente.id} sostituita dalla tua scelta: aggiornamento da applicare e task collegati da rivedere (pulsante Piano sopra il prompt).`
    }
    if (resolution === 'vecchia') {
      return undefined
    }
  }
  const testo = resolution === 'nuova' ? `[${c.topic}] vale "${c.newer}" (non "${c.older}")` : `[${c.topic}] valgono "${c.older}" e "${c.newer}" in contesti diversi`
  await muta($, p => ({ piano: aggiungiDecisioneUtente(p, testo, t) }))
  return undefined
}

/** Righe per le istruzioni di compattazione e per il passaggio: il piano e nel file, non va riassunto. */
export async function notaPiano($: EngineInterface): Promise<string> {
  const piano = await read($, pianoA)
  if (!piano) return ''
  const r = riepilogo(piano)
  const coda = codaDomande(piano)
  const inCorso = piano.sprint.flatMap(s => s.task).filter(t => t.stato === 'in-corso').map(t => t.id)
  return [
    `Piano sprint: la fonte di verita e ${cfg.cartella}/piano.json, NON riassumerne il contenuto.`,
    `Riporta solo: sprint corrente ${r.corrente?.id ?? '-'}; task in corso ${inCorso.join(', ') || 'nessuno'}; ` +
      `domande aperte ${coda.map(d => d.id).join(', ') || 'nessuna'}${r.conflitti ? ` (conflitti con la memoria: ${coda.filter(d => d.stato === 'in-conflitto').map(d => d.id).join(', ')}: non deciderli)` : ''}.`,
    `Dopo: rileggi con piano_leggi formato sprint.`,
  ].join(' ')
}

/** La parte sprint della banda sopra il prompt: stato in una riga, pulsanti nella seconda. */
export function BandaSprint($: EngineInterface, el: Tavola, piano: Piano | null, inAttesa: readonly string[], colonne: number, errore = '', isOccupato = false): RenderElement {
  const { Box, Text, Button } = el
  if (!piano && errore) {
    return (
      <Box flexDirection="row" columnGap={1} flexWrap="wrap">
        <Text dimColor>{'Sprint  '}</Text>
        <Text color="error" wrap="truncate-end">{`⚠ ${errore}`}</Text>
        <Button key="sprint-ricarica" variant="primary" hotkey="r" onPress={() => void ricarica($)}>
          Ricarica
        </Button>
      </Box>
    )
  }
  if (!piano) {
    return (
      <Box flexDirection="row" columnGap={1} flexWrap="wrap">
        <Text dimColor>{'Sprint  '}</Text>
        <Text>nessun piano per questo progetto</Text>
        <Button key="sprint-crea" variant="primary" hotkey="x" dimColor={isOccupato} onPress={() => (isOccupato ? $.ui.toast('Claude sta lavorando: premi di nuovo a fine turno') : void avviaAnalisi($, ''))}>
          ▶ Crea il piano
        </Button>
        <Button key="apri-sprint" plain dimColor onPress={() => void apriScheda($, 'piano')}>
          come funziona
        </Button>
      </Box>
    )
  }
  const r = riepilogo(piano)
  const pr = controlliQualita(piano)
  const q = punteggio(pr)
  const s = r.corrente
  const fatti = s ? s.task.filter(t => t.stato === 'completato').length : r.taskFatti
  const totali = s ? s.task.filter(t => t.stato !== 'annullato').length : r.taskTotali
  // stessa larghezza della barra del contesto: le due righe restano allineate
  const w = Math.max(10, Math.min(30, colonne - 60))
  const pieni = Math.round((totali ? fatti / totali : 1) * w)
  const mossa = prossimaMossa(piano, inAttesa)
  const aperte = r.aperte
  const nuove = r.fontiNuove
  const isLargo = colonne >= 100
  const da = r.bloccanti - r.conflitti
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Text dimColor>{'Sprint  '}</Text>
        <Text>
          {pieni ? <Text color="success">{'█'.repeat(pieni)}</Text> : null}
          {w - pieni ? <Text dimColor>{'░'.repeat(w - pieni)}</Text> : null}
        </Text>
        <Text bold>{`${fatti}/${totali}`}</Text>
        <Text color="claude" bold wrap="truncate-end">{s ? `${s.id} ${s.titolo}` : r.taskTotali ? 'tutti gli sprint completati' : 'nessuno sprint ancora'}</Text>
        {r.conflitti ? <Text color="error">{isLargo ? `⚠ ${pl(r.conflitti, 'conflitto', 'conflitti')}` : `⚠ ${r.conflitti}`}</Text> : null}
        {da ? <Text color="warning">{isLargo ? `? ${da} da decidere` : `? ${da}`}</Text> : null}
        {r.memoriaDaAggiornare ? <Text color="permission">{isLargo ? `✎ ${r.memoriaDaAggiornare} memoria` : `✎ ${r.memoriaDaAggiornare}`}</Text> : null}
        <Text color={q >= 90 ? 'success' : pr.some(x => x.livello === 'critico') ? 'error' : 'warning'}>{isLargo ? `◎ qualità ${q}` : `◎ ${q}`}</Text>
      </Box>
      <Box flexDirection="row" columnGap={2} flexWrap="wrap">
        <Button key="sprint-azione" label={mossa.breve} variant="primary" hotkey="x" dimColor={isOccupato} onPress={() => void eseguiMossa($, mossa, true, isOccupato)}>
          <Text bold color={isOccupato ? undefined : mossa.colore}>{`▶ ${mossa.breve}`}</Text>
        </Button>
        <Button key="sprint-domande" plain hotkey="d" dimColor={!aperte} onPress={() => void apriScheda($, 'domande')}>
          {aperte ? `Domande (${aperte})` : 'Domande'}
        </Button>
        <Button key="sprint-business" plain hotkey="b" dimColor={!nuove} onPress={() => void apriScheda($, 'business')}>
          {`${isLargo ? 'Incolla business' : 'Business'}${nuove ? ` (${pl(nuove, 'nuova', 'nuove')})` : ''}`}
        </Button>
        <Button key="apri-sprint" plain hotkey="p" onPress={() => void apriScheda($, 'piano')}>
          Piano
        </Button>
      </Box>
    </Box>
  )
}

/** Errori ancora aperti nel registro del lavoro: la definition of done li deve considerare. */
export async function erroriAperti($: EngineInterface): Promise<string[]> {
  const ledger = await read($, ledgerA)
  return ledger.errors.map(e => `${e.command}: ${e.line}`).slice(-3)
}

// ==================== pannello e banda sprint ====================

// Il pannello: testata con avanzamento, quattro schede, una sola azione principale.









// stessi valori di archivio.ts: ogni file dichiara i propri riferimenti


export type Tavola = {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
  Input?: ElementConstructor<InputProps>
}

const SIMBOLO: Record<StatoLavoro, string> = {
  'da-fare': '○',
  'in-corso': '◐',
  completato: '●',
  bloccato: '■',
  annullato: '·',
}
const COLORE: Record<StatoLavoro, string> = {
  'da-fare': 'text',
  'in-corso': 'warning',
  completato: 'success',
  bloccato: 'error',
  annullato: 'subtle',
}
const ICONA_FONTE: Record<FonteBusiness['tipo'], string> = {
  email: '✉',
  verbale: '☰',
  documento: '▤',
  ticket: '◈',
  altro: '◇',
}

// ---------- azioni (tutte prendono $: dichiarate a livello di file) ----------

export async function avviaAnalisi($: EngineInterface, note: string): Promise<void> {
  const cambiate = await verificaFonti($).catch(() => [] as string[])
  if (cambiate.length) {
    $.ui.toast(`⚠ memoria cambiata fuori dal piano: ${cambiate.join(', ')}`)
  }
  const r = await rileva($).catch(err => {
    $.ui.toast(`analisi non avviata: ${String(err).slice(0, 120)}`)
    return undefined
  })
  if (!r) {
    return
  }
  void $.prompt.submit({
    text: promptAnalisi({
      cartella: cfg.cartella,
      skill: cfg.skill,
      isSkill: r.isSuperpowers,
      rilevazione: descriviRilevazione(r),
      note,
      mem: usoMemoria(await read($, pianoA).catch(() => null), nomeCartella((await percorsi($)).radice)),
    }),
  }).catch(() => undefined)
}

async function ipotesi($: EngineInterface, id: string, ok: boolean): Promise<void> {
  try {
    await muta($, p => ({ piano: confermaIpotesi(p, id, ok, ora()) }))
    $.ui.toast(ok ? `${id} confermata` : `${id} respinta: nuova domanda creata`)
  } catch (err) {
    $.ui.toast(`non riuscito: ${String(err).slice(0, 120)}`)
  }
}

async function vaiA($: EngineInterface, vista: Vista): Promise<void> {
  await update($, vistaA, () => vista)
}

async function segnaRisposta($: EngineInterface, id: string, risposta: string): Promise<void> {
  try {
    const r = await rispondiVerificato($, id, risposta, 'pannello')
    if (r.esito === 'errore') {
      $.ui.toast(r.testo)
      return
    }
    if (r.esito === 'conflitto') {
      $.ui.toast(`⚠ ${id} contraddice la memoria: scegli quale vale`)
      await update($, domandaSelA, () => id)
      return
    }
    await update($, attesaA, ids => [...new Set([...(ids ?? []), id])])
    const coda = r.piano ? codaDomande(r.piano) : []
    await update($, domandaSelA, () => coda[0]?.id ?? '')
    $.ui.toast(`${id} salvata`)
  } catch (err) {
    $.ui.toast(`non riuscito: ${String(err).slice(0, 120)}`)
  }
}

async function sceltaConflitto($: EngineInterface, id: string, scelta: 'memoria' | 'nuova'): Promise<void> {
  try {
    const esito = await muta($, p => risolviConflitto(p, id, scelta, ora()))
    if (esito.errore) {
      $.ui.toast(esito.errore)
      return
    }
    await update($, attesaA, ids => [...new Set([...(ids ?? []), id])])
    await update($, domandaSelA, () => codaDomande(esito.piano)[0]?.id ?? '')
    $.ui.toast(scelta === 'memoria' ? `${id}: resta valida la memoria` : `${id}: nuova scelta, memoria da aggiornare`)
  } catch (err) {
    $.ui.toast(`non riuscito: ${String(err).slice(0, 120)}`)
  }
}

async function aggiungiDomanda($: EngineInterface, task: Task, sprintId: string, testo: string): Promise<void> {
  try {
    if (!testo.trim()) {
      return
    }
    await muta($, p => ({ piano: nuovaDomandaUtente(p, { testo: testo.trim(), task: task.id, sprint: sprintId, bloccante: true }, ora()) }))
    $.ui.toast('domanda aggiunta al task')
  } catch (err) {
    $.ui.toast(`non riuscito: ${String(err).slice(0, 120)}`)
  }
}

async function incolla($: EngineInterface, testo: string): Promise<void> {
  try {
    const { id, isNuova } = await salvaFonte($, testo)
    $.ui.toast(!id ? 'testo troppo corto' : isNuova ? `fonte ${id} salvata: premi x per analizzarla` : `questo testo c'è già: è la fonte ${id}`)
  } catch (err) {
    $.ui.toast(`non riuscito: ${String(err).slice(0, 120)}`)
  }
}

async function inviaRisposte($: EngineInterface, ids: readonly string[]): Promise<void> {
  await update($, attesaA, () => [])
  void $.prompt.submit({ text: promptRisposte(ids) }).catch(err => $.ui.toast(`messaggio non inviato: ${String(err).slice(0, 120)}`))
}

async function invia($: EngineInterface, text: string): Promise<void> {
  void $.prompt.submit({ text }).catch(err => $.ui.toast(`messaggio non inviato: ${String(err).slice(0, 120)}`))
}

// ---------- parti del disegno ----------

type Ctx = {
  el: Tavola
  piano: Piano
  larghezza: number
}

function Testata($: EngineInterface, c: Ctx): RenderElement {
  const { Box, Text } = c.el
  const r = riepilogo(c.piano)
  const w = Math.max(10, Math.min(28, c.larghezza - 34))
  const pct = percentuale(r.taskFatti, r.taskTotali)
  const sp = statoSuperpowers()
  return (
    <Box borderStyle="round" borderColor="claude" paddingX={1} flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold color="claude" wrap="truncate-end">
          ◆ {c.piano.progetto.nome}
        </Text>
        <Text dimColor wrap="truncate-end">
          {c.piano.progetto.metodo ?? 'piano sprint'}
        </Text>
      </Box>
      <Text>
        {(() => {
          const pieni = Math.round((r.taskTotali ? r.taskFatti / r.taskTotali : 0) * w)
          return [<Text key="bp" color="success">{'█'.repeat(pieni)}</Text>, <Text key="bv" dimColor>{'░'.repeat(w - pieni)}</Text>]
        })()}
        {` ${pct}% · ${r.taskFatti}/${r.taskTotali} task`}
      </Text>
      {(() => {
        const v = velocita(c.piano)
        const corrente = `sprint ${r.corrente?.id ?? '-'}`
        return (
          <Text dimColor wrap="truncate-end">
            {v.media ? `${corrente} · ${v.media} pt/sprint${v.sprintStimati ? ` · ~${v.sprintStimati} alla fine` : ''}` : corrente}
          </Text>
        )
      })()}
      <Box flexDirection="row" columnGap={2} flexWrap="wrap">
        {r.conflitti ? <Text color="error">{`⚠ ${pl(r.conflitti, 'conflitto', 'conflitti')}`}</Text> : null}
        {r.bloccanti - r.conflitti ? <Text color="warning">{`? ${pl(r.bloccanti - r.conflitti, 'bloccante', 'bloccanti')}`}</Text> : null}
        {r.aperte - r.bloccanti ? <Text dimColor>{`? ${pl(r.aperte - r.bloccanti, 'da chiarire', 'da chiarire')}`}</Text> : null}
        {r.esigenze ? (
          <Text color={r.esigenzeCoperte === r.esigenze ? 'success' : 'suggestion'}>
            ✉ business {percentuale(r.esigenzeCoperte, r.esigenze)}%
          </Text>
        ) : null}
        {r.memoriaDaAggiornare ? <Text color="permission">{`✎ ${pl(r.memoriaDaAggiornare, 'aggiornamento di memoria', 'aggiornamenti di memoria')}`}</Text> : null}
        {(() => {
          const pr = controlliQualita(c.piano)
          const crit = pr.filter(x => x.livello === 'critico').length
          return <Text color={crit ? 'error' : pr.length ? 'warning' : 'success'}>{`◎ qualità ${punteggio(pr)}`}</Text>
        })()}
        {sp === false ? <Text color="warning">superpowers assente</Text> : null}
        {statoClaudeMem(c.piano) === false ? <Text color="warning">claude-mem assente</Text> : null}
      </Box>
    </Box>
  )
}

function Schede($: EngineInterface, c: Ctx, vista: Vista): RenderElement {
  const { Box, Text, Button } = c.el
  const aperte = domandeAperte(c.piano).length
  const nuove = c.piano.business.filter(f => f.stato === 'da-analizzare').length
  const scheda = (v: Vista, tasto: string, nome: string, extra: string) => (
    <Button key={`tab-${v}`} plain hotkey={tasto} onPress={() => void vaiA($, v)}>
      {vista === v ? (
        <Text bold color="claude" underline>
          {nome}
        </Text>
      ) : (
        <Text dimColor>{nome}</Text>
      )}
      {extra ? <Text color={vista === v ? 'claude' : 'subtle'}>{` ${extra}`}</Text> : ''}
    </Button>
  )
  return (
    <Box flexDirection="row" columnGap={1} flexWrap="wrap" marginTop={1}>
      {scheda('piano', 'p', 'piano', '')}
      {scheda('domande', 'd', 'domande', aperte ? String(aperte) : '')}
      {scheda('business', 'b', 'business', nuove ? `+${nuove}` : '')}
      {scheda('memoria', 'm', 'memoria', '')}
    </Box>
  )
}

function VistaPiano($: EngineInterface, c: Ctx, sprintSel: string): RenderElement {
  const { Box, Text, Button } = c.el
  const r = riepilogo(c.piano)
  const aperte = domandeAperte(c.piano)
  const aperto = sprintSel || r.corrente?.id
  if (!c.piano.sprint.length) {
    return <Text dimColor>nessuno sprint: premi a per analizzare il progetto</Text>
  }
  return (
    <Box flexDirection="column">
      {c.piano.sprint.map(s => {
        const vivi = s.task.filter(t => t.stato !== 'annullato')
        const fatti = vivi.filter(t => t.stato === 'completato').length
        const nDom = aperte.filter(d => d.sprint === s.id || s.task.some(t => t.id === d.task)).length
        const isAperto = s.id === aperto
        return (
          <Box key={`sp-${s.id}`} flexDirection="column" marginTop={1}>
            <Button key={`s-${s.id}`} plain onPress={() => void update($, sprintSelA, () => (isAperto ? '-' : s.id))}>
              <Text color={COLORE[s.stato]} bold={isAperto}>{`${isAperto ? '▾' : '▸'} ${SIMBOLO[s.stato]} ${s.id} ${s.titolo}`}</Text>
              <Text dimColor>{c.larghezza < 56 ? `  ${fatti}/${vivi.length}` : `  ${barra(vivi.length ? fatti / vivi.length : 0, 8)} ${fatti}/${vivi.length}`}</Text>
              {nDom ? <Text color="warning">{`  ?${nDom}`}</Text> : ''}
              {s.stato === 'completato' ? <Text color={s.chiusura ? 'success' : 'warning'}>{s.chiusura ? '  ✓ chiuso' : '  da chiudere'}</Text> : ''}
            </Button>
            {isAperto && s.obiettivo ? (
              <Text dimColor wrap="wrap">
                {`    ${s.obiettivo}`}
              </Text>
            ) : null}
            {isAperto
              ? s.task.map(t => {
                  const n = aperte.filter(d => d.task === t.id)
                  const isConf = n.some(d => d.stato === 'in-conflitto')
                  return (
                    <Button key={`t-${t.id}`} plain onPress={() => void update($, taskSelA, () => t.id)}>
                      <Text color={COLORE[t.stato]}>{`    ${SIMBOLO[t.stato]} ${t.id} `}</Text>
                      <Text strikethrough={t.stato === 'annullato'}>{t.titolo}</Text>
                      {n.length ? <Text color={isConf ? 'error' : 'warning'}>{`  ${isConf ? '⚠' : '?'}${n.length}`}</Text> : ''}
                      {t.requisiti.length ? <Text color="suggestion">{`  ✉${t.requisiti.length}`}</Text> : ''}
                      {t.stima ? <Text dimColor>{`  ${t.stima}pt`}</Text> : ''}
                      {t.daRivedere ? <Text color="error">{'  ↺'}</Text> : ''}
                      {t.stato === 'da-fare' && !t.daRivedere && !prontezza(c.piano, t).isPronto ? <Text color="warning">{'  ◌'}</Text> : ''}
                    </Button>
                  )
                })
              : null}
          </Box>
        )
      })}
      {Qualita($, c)}
      <Text dimColor>{'\n'}◌ non pronto  ↺ rivedere  ⚠ conflitto  ? domande  ✉ esigenze</Text>
      <Text dimColor>seleziona un task per dettagli e domande</Text>
    </Box>
  )
}

function Qualita($: EngineInterface, c: Ctx): RenderElement {
  const { Box, Text, Button } = c.el
  const pr = controlliQualita(c.piano)
  if (!pr.length) {
    return <Text color="success">{'\n'}◎ qualità del piano 100: nessun problema</Text>
  }
  const crit = pr.filter(x => x.livello === 'critico').length
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={crit ? 'error' : 'warning'} paddingX={1}>
      <Text color={crit ? 'error' : 'warning'}>{`◎ qualità ${punteggio(pr)}/100${crit ? ` · ${pl(crit, 'critico', 'critici')}` : ''}${pr.length - crit ? ` · ${pl(pr.length - crit, 'avviso', 'avvisi')}` : ''}`}</Text>
      {pr.slice(0, 3).map((x, i) => (
        <Text key={`q-${i}`} color={x.livello === 'critico' ? 'error' : 'subtle'} wrap="truncate-end">{`  ${x.livello === 'critico' ? '✗' : '·'} ${x.id} ${x.testo}`}</Text>
      ))}
      {pr.length > 3 ? <Text dimColor>{pr.length - 3 === 1 ? '  e un altro' : `  e altri ${pr.length - 3}`}</Text> : null}
      <Button key="migliora" plain hotkey="g" onPress={() => void invia($, promptQualita(usoMemoria(c.piano)))}>
        <Text color="claude">chiedi a claude di correggerli</Text>
      </Button>
    </Box>
  )
}

function DettaglioTask($: EngineInterface, c: Ctx, taskId: string): RenderElement {
  const { Box, Text, Button, Input } = c.el
  const s = c.piano.sprint.find(x => x.task.some(t => t.id === taskId))
  const t = s?.task.find(x => x.id === taskId)
  if (!s || !t) {
    return <Text dimColor>task non trovato</Text>
  }
  const domande = c.piano.domande.filter(d => d.task === t.id && d.stato !== 'superata')
  const esigenze = c.piano.business.flatMap(f => f.esigenze).filter(e => t.requisiti.includes(e.id))
  const dor = prontezza(c.piano, t)
  const vincoli = t.vincoli.map(id => ({ id, v: voce(c.piano, id) }))
  const rischi = c.piano.rischi.filter(r => r.task === t.id && r.stato !== 'chiuso')
  return (
    <Box flexDirection="column" marginTop={1}>
      <Button key="indietro" plain dimColor onPress={() => void update($, taskSelA, () => '')}>
        ‹ torna al piano
      </Button>
      <Box borderStyle="round" borderColor={COLORE[t.stato]} paddingX={1} flexDirection="column" marginTop={1}>
        <Text bold wrap="wrap">
          {`${SIMBOLO[t.stato]} ${t.id} ${t.titolo}`}
        </Text>
        <Text dimColor>{`${s.id} · ${ETICHETTA_STATO[t.stato]}${t.origine === 'nuovo' ? '' : ` · ${t.origine}`}${t.stima ? ` · ${t.stima} pt` : ''}${t.rif ? ` · ${t.rif}` : ''}`}</Text>
        {t.daRivedere ? <Text color="error" wrap="wrap">{`↺ da rivedere: ${t.daRivedere}`}</Text> : null}
        {t.descrizione ? <Text wrap="wrap">{t.descrizione}</Text> : null}
        <Box flexDirection="column" marginTop={1}>
          <Text color={dor.isPronto ? 'success' : 'warning'}>{dor.isPronto ? '● pronto per l\'esecuzione autonoma' : '◌ non ancora pronto per l\'esecuzione autonoma'}</Text>
          {/* solo cio che manca: il resto e un conteggio */}
          {dor.voci.filter(v => !v.ok).map((v, i) => (
            <Text key={`dor-${i}`} color={v.isCritica ? 'error' : 'warning'} wrap="wrap">
              {`  ✗ ${v.testo}`}
            </Text>
          ))}
          <Text dimColor>{`  ${dor.voci.filter(v => v.ok).length} di ${dor.voci.length} requisiti a posto`}</Text>
        </Box>
        {t.criteri.length ? (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>criteri di accettazione</Text>
            {t.criteri.map((k, i) => (
              <Text key={`c-${i}`} color={isVago(k) ? 'warning' : undefined} wrap="wrap">{`  ${isVago(k) ? '⚠' : '✓'} ${k}${isVago(k) ? '  (non verificabile)' : ''}`}</Text>
            ))}
          </Box>
        ) : (
          <Text color="warning">nessun criterio di accettazione</Text>
        )}
        {esigenze.length ? (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>copre le esigenze</Text>
            {esigenze.map(e => (
              <Text key={`e-${e.id}`} color="suggestion" wrap="wrap">{`  ✉ ${e.id} ${e.testo}`}</Text>
            ))}
          </Box>
        ) : null}
        {vincoli.length ? (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>si basa sulla memoria</Text>
            {vincoli.map(x => (
              <Text key={`vi-${x.id}`} color={x.v ? 'claude' : 'error'} wrap="wrap">{`  ${x.v ? '●' : '✗'} ${x.id} ${x.v?.testo ?? 'superata: il task va rivisto'}`}</Text>
            ))}
          </Box>
        ) : null}
        {rischi.map(r => (
          <Text key={`ri-${r.id}`} color={r.probabilita === 'alta' || r.impatto === 'alto' ? 'error' : 'warning'} wrap="wrap">
            {`  ▲ ${r.id} ${r.testo} → ${r.mitigazione || 'senza mitigazione'}`}
          </Text>
        ))}
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>{domande.length ? 'domande sul task' : 'nessuna domanda sul task'}</Text>
          {domande.map(d => (
            <Button key={`dt-${d.id}`} plain onPress={() => void apriDomanda($, d.id)}>
              <Text color={d.stato === 'in-conflitto' ? 'error' : d.stato === 'aperta' ? 'warning' : 'success'}>
                {`  ${d.stato === 'in-conflitto' ? '⚠' : d.stato === 'aperta' ? '?' : '●'} ${d.id} `}
              </Text>
              {d.testo.slice(0, 90)}
            </Button>
          ))}
        </Box>
      </Box>
      {Input ? (
        <Input
          key={`nuova-domanda-${domande.length}`}
          label="+ "
          placeholder="scrivi un dubbio su questo task, invio per aggiungerlo"
          submitLabel="aggiungi"
          onSubmit={v => void aggiungiDomanda($, t, s.id, v)}
        />
      ) : null}
      <Button key="chiedi-task" plain hotkey="q" dimColor onPress={() => void invia($, promptDomandeTask(t.id, usoMemoria(c.piano)))}>
        chiedi a claude i punti aperti di questo task
      </Button>
    </Box>
  )
}

async function apriDomanda($: EngineInterface, id: string): Promise<void> {
  await update($, domandaSelA, () => id)
  await update($, vistaA, () => 'domande')
}

function CartaConflitto($: EngineInterface, c: Ctx, d: Domanda): RenderElement {
  const { Box, Text, Button } = c.el
  const conf = d.conflitto
  const voci = (conf?.con ?? []).map(id => ({ id, v: voce(c.piano, id), m: c.piano.memoria.find(m => m.id === id) }))
  return (
    <Box borderStyle="double" borderColor="error" paddingX={1} flexDirection="column">
      <Text bold color="error">
        ⚠ conflitto con la memoria · scelta obbligatoria
      </Text>
      <Text dimColor>{`${d.id}${d.task ? ` · ${d.task}` : d.sprint ? ` · ${d.sprint}` : ''}`}</Text>
      <Text bold wrap="wrap">
        {d.testo}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>nuova scelta</Text>
        <Text color="warning" wrap="wrap">{`  ${conf?.rispostaProposta ?? ''}`}</Text>
        <Text dimColor>contraddice</Text>
        {voci.map(x => (
          <Text key={`cv-${x.id}`} wrap="wrap">
            {`  ${x.id} `}
            <Text dimColor>{x.m ? `(${x.m.fonte}) ` : `(${x.v?.tipo ?? '?'}) `}</Text>
            {x.v?.testo ?? 'voce non più valida'}
          </Text>
        ))}
        {conf?.spiegazione ? (
          <Text dimColor wrap="wrap">
            {conf.spiegazione}
          </Text>
        ) : null}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Button key={`cm-${d.id}`} plain hotkey="1" onPress={() => void sceltaConflitto($, d.id, 'memoria')}>
          <Text color="success">mantieni la memoria</Text>
          <Text dimColor> (la nuova scelta si scarta)</Text>
        </Button>
        <Button key={`cn-${d.id}`} plain hotkey="2" onPress={() => void sceltaConflitto($, d.id, 'nuova')}>
          <Text color="warning">applica la nuova scelta</Text>
          <Text dimColor> (poi approvi l'aggiornamento)</Text>
        </Button>
      </Box>
    </Box>
  )
}

function CartaDomanda($: EngineInterface, c: Ctx, d: Domanda, isVerifica: boolean): RenderElement {
  const { Box, Text, Button, Input } = c.el
  const t = c.piano.sprint.flatMap(s => s.task).find(x => x.id === d.task)
  return (
    <Box borderStyle="round" borderColor={d.bloccante ? 'warning' : 'subtle'} paddingX={1} flexDirection="column">
      <Text dimColor wrap="truncate-end">
        {`${d.id} · ${d.bloccante ? 'bloccante' : 'non bloccante'} · ${t ? `${t.id} ${t.titolo}` : d.sprint ?? 'generale'}${d.autore === 'utente' ? ' · tua' : ''}`}
      </Text>
      <Text bold wrap="wrap">
        {d.testo}
      </Text>
      {d.perche ? (
        <Text dimColor wrap="wrap">
          {`perché conta: ${d.perche}`}
        </Text>
      ) : null}
      {isVerifica ? (
        <Text color="claude">⟳ verifico la coerenza con la memoria…</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {d.opzioni.slice(0, 9).map((o, i) => (
            <Button key={`o-${d.id}-${i}`} plain hotkey={String(i + 1)} onPress={() => void segnaRisposta($, d.id, o)}>
              <Text wrap="wrap">{o}</Text>
              {o === d.raccomandata ? <Text color="success"> ★ consigliata</Text> : ''}
            </Button>
          ))}
          {d.raccomandata ? (
            <Button key={`del-${d.id}`} plain hotkey="0" dimColor onPress={() => void segnaRisposta($, d.id, DELEGATA)}>
              {`decidi tu (${d.raccomandata.slice(0, 50)})`}
            </Button>
          ) : null}
          {Input ? (
            <Input
              key={`r-${d.id}`}
              label="› "
              placeholder="oppure scrivi la tua risposta, invio per salvare"
              submitLabel="salva"
              onSubmit={v => void segnaRisposta($, d.id, v)}
            />
          ) : (
            <Text dimColor>risposta libera dal terminale o dal desktop</Text>
          )}
        </Box>
      )}
    </Box>
  )
}

function VistaDomande($: EngineInterface, c: Ctx, sel: string, verifica: string): RenderElement {
  const { Box, Text, Button } = c.el
  const coda = codaDomande(c.piano)
  const recenti = c.piano.domande.filter(d => d.stato === 'risposta' || d.stato === 'delegata').slice(-4).reverse()
  const i = Math.max(0, coda.findIndex(d => d.id === sel))
  const d = coda[i]
  return (
    <Box flexDirection="column" marginTop={1}>
      {d ? (
        <Box flexDirection="column">
          <Box justifyContent="space-between">
            <Text dimColor>{`domanda ${i + 1} di ${coda.length}`}</Text>
            <Box columnGap={2}>
              <Button key="prec" plain dimColor onPress={() => void update($, domandaSelA, () => coda[(i - 1 + coda.length) % coda.length]?.id ?? '')}>
                ‹ prec
              </Button>
              <Button key="succ" plain hotkey="s" dimColor onPress={() => void update($, domandaSelA, () => coda[(i + 1) % coda.length]?.id ?? '')}>
                salta ›
              </Button>
            </Box>
          </Box>
          {d.stato === 'in-conflitto' ? CartaConflitto($, c, d) : CartaDomanda($, c, d, verifica === d.id)}
        </Box>
      ) : (
        <Box borderStyle="round" borderColor="success" paddingX={1}>
          <Text color="success">✓ nessun punto aperto: claude puo procedere in autonomia</Text>
        </Box>
      )}
      {recenti.length ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>risposte recenti</Text>
          {recenti.map(x => (
            <Box key={`ok-${x.id}`} flexDirection="row" columnGap={1}>
              <Text color="success" wrap="truncate-end">
                {`● ${x.id} ${x.risposta ?? ''}`.slice(0, Math.max(20, c.larghezza - 12))}
              </Text>
              <Button key={`riapri-${x.id}`} plain dimColor onPress={() => void riapriDomanda($, x.id)}>
                riapri
              </Button>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  )
}

function VistaBusiness($: EngineInterface, c: Ctx): RenderElement {
  const { Box, Text, Input } = c.el
  const cop = new Map(copertura(c.piano).map(x => [x.esigenza.id, x.task]))
  return (
    <Box flexDirection="column" marginTop={1}>
      {Input ? (
        <Box borderStyle="round" borderColor="suggestion" paddingX={1} flexDirection="column">
          <Text color="suggestion">incolla email, verbali, documenti o ticket del business</Text>
          <Input
            key={`incolla-${c.piano.business.length}`}
            rows={4}
            placeholder="incolla qui il testo, invio per salvarlo come fonte"
            submitLabel="salva fonte"
            onSubmit={v => void incolla($, v)}
          />
        </Box>
      ) : (
        <Text dimColor>per incollare usa il terminale o il desktop, oppure /sprint-fonte</Text>
      )}
      {c.piano.business.length === 0 ? <Text dimColor>{'\n'}nessuna fonte di business ancora</Text> : null}
      {c.piano.business.map(f => {
        const valide = f.esigenze.filter(e => e.stato === 'valida')
        const coperte = valide.filter(e => (cop.get(e.id) ?? []).length > 0)
        const scoperte = valide.filter(e => (cop.get(e.id) ?? []).length === 0)
        return (
          <Box key={`f-${f.id}`} flexDirection="column" marginTop={1}>
            <Text wrap="truncate-end">
              <Text color="suggestion">{`${ICONA_FONTE[f.tipo]} ${f.id} `}</Text>
              <Text bold>{f.titolo}</Text>
            </Text>
            {f.stato === 'da-analizzare' ? (
              <Text color="warning">{'   da analizzare: premi x'}</Text>
            ) : (
              <Text dimColor>{`   ${barra(valide.length ? coperte.length / valide.length : 1, 10)} ${coperte.length}/${valide.length} esigenze coperte`}</Text>
            )}
            {f.sintesi ? <Text dimColor wrap="wrap">{`   ${f.sintesi}`}</Text> : null}
            {scoperte.slice(0, 4).map(e => (
              <Text key={`sc-${e.id}`} color="warning" wrap="wrap">{`   ○ ${e.id} ${e.testo}`}</Text>
            ))}
          </Box>
        )
      })}
    </Box>
  )
}

function VistaMemoria($: EngineInterface, c: Ctx): RenderElement {
  const { Box, Text, Button } = c.el
  const da = c.piano.aggiornamentiMemoria.filter(u => u.stato === 'da-applicare')
  const valide = c.piano.memoria.filter(m => m.stato === 'valida')
  const daVerificare = c.piano.memoria.filter(m => m.stato === 'da-verificare')
  const ip = ipotesiDaConfermare(c.piano)
  const rischi = c.piano.rischi.filter(r => r.stato === 'aperto')
  const superate = c.piano.memoria.filter(m => m.stato === 'superata')
  const dec = c.piano.decisioni.slice(-8).reverse()
  return (
    <Box flexDirection="column" marginTop={1}>
      {da.length ? (
        <Box borderStyle="round" borderColor="permission" paddingX={1} flexDirection="column">
          <Text color="permission">✎ aggiornamenti di memoria approvati da te</Text>
          {da.map(u => (
            <Text key={`u-${u.id}`} wrap="wrap">{`  ${u.id} ${u.file ?? ''}: ${u.testo}`}</Text>
          ))}
        </Box>
      ) : null}
      {daVerificare.length ? (
        <Box borderStyle="round" borderColor="error" paddingX={1} flexDirection="column">
          <Text color="error">⚠ memoria cambiata fuori dal piano: rispondi nella scheda domande</Text>
          {daVerificare.map(m => (
            <Text key={`mv-${m.id}`} wrap="wrap">{`  ${m.id} ${m.testo} · ${m.fonte}`}</Text>
          ))}
        </Box>
      ) : null}
      {ip.length ? (
        <Box borderStyle="round" borderColor="warning" paddingX={1} flexDirection="column" marginTop={daVerificare.length ? 1 : 0}>
          <Text color="warning">{`? ${pl(ip.length, 'ipotesi di claude da confermare', 'ipotesi di claude da confermare')}`}</Text>
          {ip.slice(0, 5).map(d => (
            <Box key={`ip-${d.id}`} flexDirection="column">
              <Text wrap="wrap">{`  ${d.id} ${d.testo}`}</Text>
              <Box flexDirection="row" columnGap={2}>
                <Button key={`ipok-${d.id}`} plain onPress={() => void ipotesi($, d.id, true)}>
                  <Text color="success">{'    ✓ confermo'}</Text>
                </Button>
                <Button key={`ipno-${d.id}`} plain onPress={() => void ipotesi($, d.id, false)}>
                  <Text color="error">✗ non è così</Text>
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      ) : null}
      {rischi.length ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>{`rischi aperti · ${rischi.length}`}</Text>
          {rischi.slice(0, 6).map(r => (
            <Text key={`r-${r.id}`} color={r.probabilita === 'alta' || r.impatto === 'alto' ? 'error' : 'warning'} wrap="wrap">
              {`  ▲ ${r.id} ${r.testo}`}
              <Text dimColor>{`  ${r.probabilita}/${r.impatto} → ${r.mitigazione || 'senza mitigazione'}${r.task ? ` (${r.task})` : ''}`}</Text>
            </Text>
          ))}
        </Box>
      ) : null}
      <Text dimColor>{`\nmemoria del progetto · ${valide.length} voci valide${valide.some(m => isDaClaudeMem(m.fonte)) ? ` (${valide.filter(m => isDaClaudeMem(m.fonte)).length} da claude-mem)` : ''}`}</Text>
      {(() => {
        const mem = statoClaudeMem(c.piano)
        return mem === true ? (
          <Text dimColor>{'  ◇ claude-mem attivo: la storia delle sessioni; le regole valide sono queste'}</Text>
        ) : mem === false ? (
          <Text color="warning">{'  claude-mem assente: ogni sessione riparte dai soli file (pulsante installa claude-mem)'}</Text>
        ) : null
      })()}
      {valide.length === 0 ? <Text dimColor>  vuota: l'analisi la popola da claude-mem, CLAUDE.md e docs</Text> : null}
      {valide.slice(-14).map(m => (
        <Text key={`m-${m.id}`} wrap="wrap">
          <Text color={isDaClaudeMem(m.fonte) ? 'suggestion' : 'claude'}>{`  ${isDaClaudeMem(m.fonte) ? '◇' : '●'} ${m.id} `}</Text>
          {m.testo}
          <Text dimColor>{`  ${m.tipo} · ${m.fonte}${m.vietato ? ' · nel codice' : ''}`}</Text>
        </Text>
      ))}
      {superate.slice(-4).map(m => (
        <Text key={`ms-${m.id}`} dimColor strikethrough wrap="truncate-end">{`  ${m.id} ${m.testo}`}</Text>
      ))}
      <Text dimColor>{'\n'}decisioni recenti</Text>
      {dec.map(d => (
        <Text key={`k-${d.id}`} dimColor={d.superata === true} strikethrough={d.superata === true} wrap="wrap">
          {`  ${d.id} `}
          {d.testo}
        </Text>
      ))}
    </Box>
  )
}

/** Una sola azione principale, la piu urgente: e il tasto x. */
/** La prossima cosa da fare sul piano: la stessa per il pannello e per la banda. */
export type Mossa = {
  tipo: 'conflitto' | 'chiudi' | 'invia' | 'ipotesi' | 'fonti' | 'memoria' | 'bloccanti' | 'qualita' | 'procedi' | 'analizza'
  /** frase intera, per il pannello */
  etichetta: string
  /** pulsante della banda: due o tre parole */
  breve: string
  colore: string
  arg: string
  ids: string[]
}

export function prossimaMossa(piano: Piano, inAttesa: readonly string[]): Mossa {
  const r = riepilogo(piano)
  const nuove = piano.business.filter(f => f.stato === 'da-analizzare').map(f => f.id)
  const primoConflitto = codaDomande(piano).find(d => d.stato === 'in-conflitto')
  const m = (tipo: Mossa['tipo'], etichetta: string, breve: string, colore: string, arg = '', ids: string[] = []): Mossa => ({ tipo, etichetta, breve, colore, arg, ids })
  const daChiudere = sprintDaChiudere(piano)[0]
  if (primoConflitto) {
    return m('conflitto', r.conflitti === 1 ? 'risolvi il conflitto con la memoria' : `risolvi ${r.conflitti} conflitti con la memoria`, r.conflitti === 1 ? 'Risolvi il conflitto' : `Risolvi ${r.conflitti} conflitti`, 'error', primoConflitto.id)
  }
  if (daChiudere && !inAttesa.length) {
    return m('chiudi', `chiudi lo sprint ${daChiudere.id}: revisione e retrospettiva`, `Chiudi lo sprint ${daChiudere.id}`, 'success', daChiudere.id)
  }
  if (inAttesa.length) {
    return m('invia', `invia ${pl(inAttesa.length, 'risposta', 'risposte')} a claude`, `Invia ${pl(inAttesa.length, 'risposta', 'risposte')}`, 'claude', '', [...inAttesa])
  }
  const ip = ipotesiDaConfermare(piano).length
  if (ip >= 3) {
    return m('ipotesi', `conferma ${ip} ipotesi di claude`, `Conferma ${ip} ipotesi`, 'warning')
  }
  if (nuove.length) {
    return m('fonti', `analizza ${pl(nuove.length, 'fonte', 'fonti')} di business`, `Analizza ${pl(nuove.length, 'fonte', 'fonti')}`, 'claude', '', nuove)
  }
  if (r.memoriaDaAggiornare) {
    return m('memoria', `applica ${pl(r.memoriaDaAggiornare, 'aggiornamento', 'aggiornamenti')} di memoria`, 'Aggiorna la memoria', 'permission')
  }
  if (r.bloccantiProssimo.length) {
    const n = r.bloccantiProssimo.length
    return m('bloccanti', n === 1 ? `rispondi alla domanda che blocca ${r.prossimo?.id}` : `rispondi alle ${n} domande che bloccano ${r.prossimo?.id}`, n === 1 ? 'Rispondi alla domanda' : `Rispondi a ${n} domande`, 'warning', r.bloccantiProssimo[0]?.id ?? '')
  }
  if (r.prossimo && !prontezza(piano, r.prossimo).isPronto) {
    return m('qualita', `${r.prossimo.id} non è pronto: fai correggere il piano`, `Prepara ${r.prossimo.id}`, 'warning', r.prossimo.id)
  }
  if (r.prossimo) {
    return m('procedi', `procedi in autonomia da ${r.prossimo.id}`, `Procedi da ${r.prossimo.id}`, 'success', r.prossimo.id)
  }
  if (!r.taskTotali) {
    return m('analizza', 'il piano non ha ancora task: completa l\'analisi', 'Completa il piano', 'claude')
  }
  return m('analizza', "piano completato · migliora l'analisi", "Migliora l'analisi", 'claude')
}

/** Esegue la mossa. Dalla banda, le mosse che portano a una scheda aprono anche il pannello. */
export async function eseguiMossa($: EngineInterface, mossa: Mossa, isDaBanda: boolean, isOccupato = false): Promise<void> {
  // Le mosse che mandano un messaggio a Claude aspettano la fine del turno: non si interrompe il lavoro in corso.
  const isNavigazione = mossa.tipo === 'conflitto' || mossa.tipo === 'bloccanti' || mossa.tipo === 'ipotesi'
  if (isOccupato && !isNavigazione) {
    $.ui.toast('Claude sta lavorando: premi di nuovo a fine turno')
    return
  }
  try {
    if (mossa.tipo === 'conflitto' || mossa.tipo === 'bloccanti') {
      await apriDomanda($, mossa.arg)
    } else if (mossa.tipo === 'ipotesi') {
      await vaiA($, 'memoria')
    } else if (mossa.tipo === 'chiudi') {
      await invia($, promptChiusura(mossa.arg, usoMemoria()))
      return
    } else if (mossa.tipo === 'invia') {
      await inviaRisposte($, mossa.ids)
      return
    } else if (mossa.tipo === 'fonti') {
      await invia($, promptBusiness(mossa.ids, usoMemoria()))
      return
    } else if (mossa.tipo === 'memoria') {
      await invia($, promptMemoria(usoMemoria()))
      return
    } else if (mossa.tipo === 'qualita') {
      await invia($, promptQualita(usoMemoria()))
      return
    } else if (mossa.tipo === 'procedi') {
      await invia($, promptProcedi(cfg.perGiro, usoMemoria()))
      return
    } else {
      await avviaAnalisi($, '')
      return
    }
    if (isDaBanda) {
      await $.ui.open({ id: 'sprint', title: 'Sprint', focus: true })
    }
  } catch (err) {
    $.ui.toast(`non riuscito: ${String(err).slice(0, 120)}`)
  }
}

/** Apre il pannello su una scheda. */
export async function apriScheda($: EngineInterface, vista: Vista): Promise<void> {
  try {
    await update($, vistaA, () => vista)
    if (vista === 'domande') {
      await update($, domandaSelA, () => '')
    }
    await $.ui.open({ id: 'sprint', title: 'Sprint', focus: true })
  } catch (err) {
    $.ui.toast(`non riuscito: ${String(err).slice(0, 120)}`)
  }
}

/** Ricarica il piano dal file e dice com'e andata. */
async function ricarica($: EngineInterface): Promise<void> {
  const piano = await carica($).catch(() => null)
  const errore = await read($, erroreA).catch(() => '')
  $.ui.toast(errore ? `⚠ ${errore}` : piano ? 'piano ricaricato' : 'nessun piano in questo progetto')
}

/** Riapre una domanda gia risposta. */
async function riapriDomanda($: EngineInterface, id: string): Promise<void> {
  try {
    await muta($, p => ({ piano: riapri(p, id, ora()) }))
    $.ui.toast(`${id} riaperta`)
  } catch (err) {
    $.ui.toast(`non riuscito: ${String(err).slice(0, 120)}`)
  }
}

function AzionePrincipale($: EngineInterface, c: Ctx, inAttesa: readonly string[], vista: Vista): RenderElement {
  const { Box, Text, Button } = c.el
  const mossa = prossimaMossa(c.piano, inAttesa)
  const etichetta = mossa.etichetta
  const colore = mossa.colore
  const azione = () => void eseguiMossa($, mossa, false)
  return (
    <Box flexDirection="column" marginTop={1}>
      <Button key="principale" plain hotkey="x" onPress={azione}>
        <Text bold color={colore}>{`▶ ${etichetta}`}</Text>
      </Button>
      <Box flexDirection="row" columnGap={2} flexWrap="wrap">
        <Button key="analizza" plain hotkey="a" dimColor onPress={() => void avviaAnalisi($, '')}>
          analizza progetto
        </Button>
        <Button key="ricarica" plain hotkey="r" dimColor onPress={() => void ricarica($)}>
          ricarica
        </Button>
        {statoClaudeMem(c.piano) === false ? (
          <Button
            key="installa-mem"
            plain
            dimColor
            onPress={() => void invia($, testoInstallaMem())}
          >
            installa claude-mem
          </Button>
        ) : null}
        {statoSuperpowers() === false ? (
          <Button
            key="installa-sp"
            plain
            dimColor
            onPress={() =>
              void invia($, `Chiedimi conferma e poi installa la skill superpowers con: ${INSTALLA_SUPERPOWERS.join(' && ')}. Poi ricordami /reload-plugins.`)
            }
          >
            installa superpowers
          </Button>
        ) : null}
      </Box>
      <Text dimColor>{vista === 'domande' ? '1-9 sceglie una risposta · s salta · esc torna al prompt' : 'esc torna al prompt'}</Text>
    </Box>
  )
}

function Vuoto(el: Tavola, $: EngineInterface, errore: string): RenderElement {
  const { Box, Text, Button } = el
  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="claude" paddingX={1} flexDirection="column">
        <Text bold color="claude">
          ◆ nessun piano sprint in questo progetto
        </Text>
        <Text wrap="wrap">claude legge la memoria del progetto, rispetta la logica già presente e propone sprint e domande.</Text>
        <Text dimColor>{'  1  memoria: CLAUDE.md, docs, piani esistenti, claude-mem, git'}</Text>
        <Text dimColor>{'  2  brainstorming con superpowers'}</Text>
        <Text dimColor>{'  3  sprint, task, criteri e domande da chiarire'}</Text>
      </Box>
      {errore ? <Text color="error">{`⚠ ${errore}`}</Text> : null}
      {errore ? <Text dimColor wrap="wrap">{'il file non viene toccato finché non lo correggi: poi ricarica'}</Text> : null}
      {errore ? (
        <Button key="principale" plain hotkey="x" onPress={() => void ricarica($)}>
          <Text bold color="error">
            ▶ ricarica il piano
          </Text>
        </Button>
      ) : (
        <Button key="principale" plain hotkey="x" onPress={() => void avviaAnalisi($, '')}>
          <Text bold color="claude">
            ▶ analizza il progetto
          </Text>
        </Button>
      )}
      <Box flexDirection="row" columnGap={2} flexWrap="wrap">
        {statoClaudeMem() === false ? (
          <Button key="installa-mem" plain dimColor onPress={() => void invia($, testoInstallaMem())}>
            installa claude-mem (memoria tra le sessioni)
          </Button>
        ) : null}
        {statoSuperpowers() === false ? (
          <Button key="installa-sp" plain dimColor onPress={() => void invia($, `Chiedimi conferma e poi installa la skill superpowers con: ${INSTALLA_SUPERPOWERS.join(' && ')}. Poi ricordami /reload-plugins.`)}>
            installa superpowers (brainstorming)
          </Button>
        ) : null}
      </Box>
    </Box>
  )
}

export async function disegna($: EngineInterface, el: Tavola, larghezza: number): Promise<RenderElement> {
  const { Box, Text } = el
  const piano = await read($, pianoA)
  const errore = await read($, erroreA)
  if (!piano) {
    return Vuoto(el, $, errore)
  }
  const vista = await read($, vistaA)
  const inAttesa = await read($, attesaA)
  const taskSel = await read($, taskSelA)
  const sprintSel = await read($, sprintSelA)
  const domandaSel = await read($, domandaSelA)
  const verifica = await read($, verificaA)
  const c: Ctx = { el, piano, larghezza }
  const corpo =
    vista === 'domande'
      ? VistaDomande($, c, domandaSel, verifica)
      : vista === 'business'
        ? VistaBusiness($, c)
        : vista === 'memoria'
          ? VistaMemoria($, c)
          : taskSel
            ? DettaglioTask($, c, taskSel)
            : VistaPiano($, c, sprintSel)
  return (
    <Box flexDirection="column">
      {Testata($, c)}
      {Schede($, c, vista)}
      {errore ? <Text color="error">{errore}</Text> : null}
      {corpo}
      {AzionePrincipale($, c, inAttesa, vista)}
    </Box>
  )
}

// ==================== modulo sprint: comandi, strumenti, guardie ====================

/** Messaggio quando un comando o uno strumento del piano fallisce: mai un errore crudo. */
async function motivoErrore($: EngineInterface): Promise<string> {
  const errore = await read($, erroreA).catch(() => '')
  return errore
    ? `${NOME}: ${errore}. Il piano non e stato modificato: l'utente deve correggere il file e premere Ricarica nella banda.`
    : `${NOME}: operazione non riuscita. Il piano non e stato modificato: riprova; se si ripete, l'utente controlli ${cfg.cartella}/piano.json.`
}


type Par<N extends EventName> = Parameters<Hook<N>>








// stessi valori di archivio.ts: ogni file dichiara i propri riferimenti


const NOME = 'gestione-sprint'
const PANNELLO = 'sprint'

const str = { type: 'string' } as const

/** L'id come sta nel piano, anche se il modello lo scrive in minuscolo o con spazi. */
const idDelPiano = (piano: Piano, id: string): string => {
  const cercato = id.trim().toLowerCase()
  const tutti = [...piano.sprint.map(s => s.id), ...piano.sprint.flatMap(s => s.task.map(t => t.id))]
  return tutti.find(x => x.toLowerCase() === cercato) ?? id.trim()
}
const strs = { type: 'array', items: { type: 'string' } } as const

// ---------- hook condivisi con il modulo contesto ----------
// Questi eventi li registra una volta sola il modulo contesto, che chiama queste funzioni nella sua catena.

// Lo stato del piano viaggia col messaggio, e solo quando e cambiato dall'ultima volta.
// Si ripete comunque ogni 15 messaggi, dopo /clear e dopo una compattazione.
let ultimoStato = ''
let daUltimo = 0

export const azzeraStatoSprint = (): void => {
  ultimoStato = ''
  daUltimo = 0
}

export async function avvioSprint($: Par<'session.start'>[0], e: Par<'session.start'>[1], next: Par<'session.start'>[2]) {
  const comandi: [string, string, string?][] = [
    ['sprint', 'Apre il pannello sprint, domande, business e memoria'],
    ['sprint-analizza', 'Analizza memoria e logica del progetto, poi brainstorming e sprint', '[indicazioni]'],
    ['sprint-procedi', 'Esegue in autonomia i prossimi task senza domande aperte', '[numero task]'],
    ['sprint-domande', 'Elenca le domande ancora aperte'],
    ['sprint-fonte', 'Aggiunge una fonte di business: testo incollato o percorso di un file', '<testo o file>'],
    ['sprint-scegli', 'Risolve un conflitto con la memoria', '<D..> memoria|nuova'],
    ['sprint-chiudi', 'Chiude uno sprint completato: revisione e retrospettiva', '[S..]'],
  ]
  for (const [name, description, argumentHint] of comandi) {
    await $.command.register({ name, description, ...(argumentHint ? { argumentHint } : {}) })
  }

  // Strumenti: solo i due d'uso continuo stanno sempre nel prompt; gli altri si caricano quando servono.
  await $.tool.register({
    name: 'piano_leggi',
    isDeferred: false,
    description: 'Legge il piano sprint. formato: riepilogo (default, breve), sprint (sprint corrente o id, con domande, esigenze, memoria), memoria, business, qualita (problemi da correggere), completo (JSON).',
    inputSchema: { type: 'object', properties: { formato: { type: 'string', enum: ['riepilogo', 'sprint', 'memoria', 'business', 'qualita', 'completo'] }, sprint: str } },
  })
  await $.tool.register({
    name: 'task_stato',
    isDeferred: false,
    description: 'Stato di un task: in-corso solo se pronto (definition of ready), completato solo con la prova della verifica nella nota (definition of done), bloccato con motivo.',
    inputSchema: { type: 'object', properties: { id: str, stato: { type: 'string', enum: [...STATI_LAVORO] }, nota: str }, required: ['id', 'stato'] },
  })
  await $.tool.register({
    name: 'piano_aggiorna',
    isDeferred: true,
    description:
      'Aggiunge o migliora il piano, unendo per id: cio che non nomini resta. Sprint/task esistenti non si rinominano ne rimuovono (solo annulla). ' +
      'memoria: solo nuove voci. domande: con conflittoCon:[id] diventa un conflitto che decide l\'utente. Le risposte le da solo l\'utente.',
    inputSchema: {
      type: 'object',
      properties: {
        progetto: { type: 'object', properties: { nome: str, obiettivo: str, stack: str, metodo: str, fileLogica: strs, fonti: strs, dod: strs } },
        memoria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              testo: str,
              fonte: { type: 'string', description: 'file:riga o claude-mem' },
              tipo: { type: 'string', enum: ['vincolo', 'convenzione', 'architettura', 'business', 'stack'] },
              estratto: { type: 'string', description: 'la riga esatta copiata dal file: serve a capire se la memoria cambia' },
              vietato: { type: 'string', description: 'regex di cio che la regola vieta nel codice (es. mysql_query|SELECT \\*)' },
              ambito: { type: 'string', description: 'file a cui si applica il divieto: .php,.py o parti di percorso' },
            },
            required: ['testo', 'fonte'],
          },
        },
        business: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: str,
              sintesi: str,
              stato: { type: 'string', enum: ['analizzata'] },
              esigenze: { type: 'array', items: { type: 'object', properties: { testo: str, priorita: { type: 'string', enum: ['alta', 'media', 'bassa'] } }, required: ['testo'] } },
            },
            required: ['id'],
          },
        },
        sprint: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: str,
              titolo: str,
              obiettivo: str,
              origine: { type: 'string', enum: ['esistente', 'nuovo'] },
              rif: str,
              chiusura: { type: 'object', properties: { esito: str }, description: 'solo a sprint completato, dopo revisione e retrospettiva' },
              task: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { id: str, titolo: str, descrizione: str, origine: { type: 'string', enum: ['esistente', 'nuovo'] }, rif: str, criteri: strs, dipendeDa: strs, requisiti: strs, vincoli: { type: 'array', items: { type: 'string' }, description: 'id di memoria/decisioni su cui si basa' }, stima: { type: 'number', enum: [1, 2, 3, 5, 8] }, rivisto: { type: 'boolean', description: 'true dopo aver rivisto un task da rivedere' }, note: str },
                },
              },
            },
          },
        },
        domande: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: str, testo: str, perche: str, sprint: str, task: str, opzioni: strs, raccomandata: str, bloccante: { type: 'boolean' }, stato: { type: 'string', enum: ['aperta', 'superata'] }, conflittoCon: strs },
          },
        },
        decisioni: { type: 'array', items: { type: 'object', properties: { testo: str, fonte: { type: 'string', enum: ['memoria', 'analisi'] } }, required: ['testo'] } },
        rischi: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: str,
              testo: str,
              probabilita: { type: 'string', enum: ['alta', 'media', 'bassa'] },
              impatto: { type: 'string', enum: ['alto', 'medio', 'basso'] },
              mitigazione: str,
              task: str,
              stato: { type: 'string', enum: ['aperto', 'mitigato', 'chiuso'] },
            },
          },
        },
        annulla: strs,
        rimuovi: strs,
        nota: str,
      },
    },
  })
  await $.tool.register({
    name: 'fonte_leggi',
    isDeferred: true,
    description: 'Testo di una fonte di business (F1...), a pezzi di 12000 caratteri: da = carattere da cui ripartire.',
    inputSchema: { type: 'object', properties: { id: str, da: { type: 'number' } }, required: ['id'] },
  })
  await $.tool.register({
    name: 'domanda_rispondi',
    isDeferred: true,
    description: 'Registra una risposta data dall\'utente in chat, con le sue parole. Mai risposte decise da te. Se contraddice la memoria, l\'utente dovra scegliere.',
    inputSchema: { type: 'object', properties: { id: str, risposta: str }, required: ['id', 'risposta'] },
  })
  await $.tool.register({
    name: 'memoria_applicata',
    isDeferred: true,
    description: 'Segna come applicato un aggiornamento di memoria approvato (U1...), dopo aver modificato il file indicato.',
    inputSchema: { type: 'object', properties: { id: str, nota: str }, required: ['id'] },
  })

  // Da qui in poi nulla deve impedire l'avvio: un piano illeggibile si vede nella banda.
  // In sottofondo: superpowers e claude-mem ci sono? Il pannello puo proporne subito l'installazione.
  if (cfg.skill.startsWith('superpowers') || state.memMode !== 'spento') {
    void cercaSuperpowers($).catch(() => undefined)
  }
  const piano = await carica($).catch(() => null)
  if (piano) {
    void verificaFonti($)
      .then(ids => {
        if (ids.length) $.ui.toast(`⚠ memoria cambiata fuori dal piano: ${ids.join(', ')} da verificare`)
      })
      .catch(() => undefined)
  }
  if (piano && cfg.isApriAvvio) {
    void $.ui.open({ id: PANNELLO, title: 'Sprint' }).catch(() => undefined)
  }
  return next(e)
}

export async function scritturaSprint($: Par<'tool.call'>[0], e: Par<'tool.call'>[1], next: Par<'tool.call'>[2]) {
  const a = e as unknown as { file_path?: string; notebook_path?: string }
  const file = normalizzaPercorso(String(a.file_path ?? a.notebook_path ?? ''))
  const cartella = normalizzaPercorso(cfg.cartella).replace(/^\.\//, '').replace(/\/+$/, '')
  if (file.includes(`${cartella}/`)) {
    return { deny: `${NOME}: il piano e le fonti si modificano solo con gli strumenti mcp__gestione-sprint__*.` }
  }
  if (cfg.isProteggiMemoria && isDatiClaudeMem(file)) {
    return { deny: `${NOME}: i dati di claude-mem si modificano solo con i suoi strumenti (save_memory). Per le sue opzioni c'e ~/.claude-mem/settings.json.` }
  }
  const piano = await read($, pianoA)
  if (cfg.isProteggiMemoria && piano && isFileMemoria(file)) {
    if (!isAggiornamentoApprovato(piano, file)) {
      return {
        deny:
          `${NOME}: la memoria del progetto non si modifica direttamente (nessun aggiornamento approvato per questo file). ` +
          `Se un fatto cambia, crea una domanda con conflittoCon: decide l'utente, poi applichi l'aggiornamento approvato.`,
      }
    }
  }
  if (piano && cfg.isProteggiMemoria && !isFileMemoria(file) && !/\.md$/.test(file)) {
    const x = e as unknown as { content?: string; new_string?: string; new_source?: string; edits?: { new_string?: string }[] }
    const contenuto = [x.content, x.new_string, x.new_source, ...(x.edits ?? []).map(y => y.new_string)].filter(Boolean).join('\n')
    const rotte = contenuto ? violazioni(piano, file, contenuto) : []
    if (rotte.length) {
      return {
        deny:
          `${NOME}: questa modifica viola la memoria del progetto: ${rotte.map(m => `${m.id} "${m.testo}"`).join('; ')}. ` +
          `Rispetta la regola; se pensi che vada cambiata crea una domanda con conflittoCon:[${rotte.map(m => m.id).join(',')}].`,
      }
    }
  }
  if (!piano || cfg.modo !== 'blocca' || /\.md$/.test(file)) {
    return next(e)
  }
  for (const s of piano.sprint) {
    for (const t of s.task.filter(x => x.stato === 'in-corso')) {
      const blocchi = bloccantiPer(piano, s.id, t.id)
      if (blocchi.length) {
        return { deny: `${NOME}: ${t.id} ha domande aperte (${blocchi.map(d => d.id).join(', ')}). Niente modifiche al codice: l'utente risponde con il pulsante Domande sopra il prompt.` }
      }
    }
  }
  return next(e)
}

/**
 * Le stesse regole di scritturaSprint per i comandi di terminale: piano e fonti solo con gli strumenti del mod,
 * memoria del progetto solo per aggiornamenti approvati. Restituisce il motivo del rifiuto, o undefined.
 */
export async function bloccoBashSprint($: Par<'tool.call'>[0], comando: string): Promise<string | undefined> {
  const scritti = fileScrittiDaComando(comando)
  if (!scritti.length) {
    return undefined
  }
  const cartella = normalizzaPercorso(cfg.cartella).replace(/^\.\//, '').replace(/\/$/, '')
  const nelPiano = scritti.find(f => {
    const n = normalizzaPercorso(f)
    return n.includes(`${cartella}/`) || n.endsWith(cartella)
  })
  if (nelPiano) {
    return `${NOME}: "${nelPiano}" fa parte del piano: si modifica solo con gli strumenti mcp__gestione-sprint__*.`
  }
  const datiMem = cfg.isProteggiMemoria ? scritti.find(isDatiClaudeMem) : undefined
  if (datiMem) {
    return `${NOME}: "${datiMem}" sono dati di claude-mem: si modificano solo con i suoi strumenti (save_memory).`
  }
  const piano = await read($, pianoA)
  if (!cfg.isProteggiMemoria || !piano) {
    return undefined
  }
  const memoria = scritti.find(f => isFileMemoria(f) && !isAggiornamentoApprovato(piano, f))
  return memoria
    ? `${NOME}: "${memoria}" e memoria del progetto: non si modifica da terminale. Se un fatto cambia, crea una domanda con conflittoCon: decide l'utente.`
    : undefined
}

export async function componiSprint($: Par<'prompt.compose'>[0], e: Par<'prompt.compose'>[1], next: Par<'prompt.compose'>[2]): Promise<PromptComposeResult> {
  const out = await next(e)
  const piano = await read($, pianoA)
  if (!piano) {
    return out
  }
  return { sections: [...out.sections, { id: `${NOME}:piano`, text: sezionePrompt(`${cfg.cartella}/piano.json`, cfg.modo), scope: 'session' }] }
}

export async function inviaSprint($: Par<'prompt.submit'>[0], e: Par<'prompt.submit'>[1], next: Par<'prompt.submit'>[2]) {
  if (e.command !== undefined || e.isMeta === true) {
    return next(e)
  }
  const piano = await read($, pianoA)
  const pr = piano ? controlliQualita(piano) : []
  const critici = pr.filter(x => x.livello === 'critico').length
  const stato = piano ? `${statoBreve(piano)}\nqualita del piano ${punteggio(pr)}/100${critici ? `, ${critici} problemi critici` : ''}` : ''
  daUltimo++
  if (!stato || (stato === ultimoStato && daUltimo < 15)) {
    return next(e)
  }
  ultimoStato = stato
  daUltimo = 0
  return next({ ...e, context: [...(e.context ?? []), stato] })
}

export async function fineTurnoSprint($: Par<'turn.complete'>[0], e: Par<'turn.complete'>[1], next: Par<'turn.complete'>[2]) {
  await carica($).catch(() => undefined)
  return next(e)
}

// ==================== modulo contesto: barra, compressione, compattazione, contraddizioni ====================

const NAME = 'gestione-sprint'
const DEFAULT_BLOCKED_DIRS = 'node_modules,dist,build,.git,.next,.nuxt,target,coverage,.cache,.venv,venv,__pycache__'
const PANE = 'controllo-contesto'

// Valori letti dai disegni (banda e pannello): una scrittura li ridisegna.
const meterAtom = atom({ plugin: 'gestione-sprint', key: 'meter' } as const, null as MeterState | null)
const savedAtom = atom({ plugin: 'gestione-sprint', key: 'saved' } as const, { compressions: 0, charsSaved: 0 } as SavedState)
const bandHiddenAtom = atom({ plugin: 'gestione-sprint', key: 'isBandHidden' } as const, false)
// Registro del lavoro: dura per tutta la sessione, anche dopo una ricarica del mod.
const ledgerAtom = atom({ plugin: 'gestione-sprint', key: 'ledger' } as const, EMPTY_LEDGER as LedgerState)
// Proposte del consigliere: la banda mostra la prima, il pannello tutte.
const proposalsAtom = atom({ plugin: 'gestione-sprint', key: 'proposals' } as const, [] as ProposalState[])
// Memoria della sessione: tue richieste, decisioni valide e superate, contraddizioni. Sopravvive alle compattazioni.
const memoryAtom = atom({ plugin: 'gestione-sprint', key: 'memory' } as const, EMPTY_MEMORY as MemoryState)

const blockedMessage = (dir: string): string =>
  `${NAME}: la cartella "${dir}" è esclusa per risparmiare token. ` +
  `Se serve davvero, chiedi all'utente di toglierla da "Cartelle escluse" nelle opzioni del mod.`

// Stato condiviso tra gli hook. Si azzera a ogni ricarica del modulo.
const state = {
  isCompacting: false,
  shownLevel: 0 as Level,
  hasAutoCompacted: false,
  hasWarnedTurns: false,
  turnsAtReset: 0,
  cwd: '',
  profiles: [] as Profile[],
  dirs: [] as string[],
  hintsShown: new Set<string>(),
  laravel: undefined as LaravelVersion | undefined,
  layout: 'unknown' as LaravelLayout,
  lang: {} as LangVersions,
  mem: NO_MEM as MemInfo,
  memMode: 'auto' as 'auto' | 'attivo' | 'spento',
  isMemChecked: false,
  isMemComposeChecked: false,
  /** Nota di continuità da aggiungere al prossimo messaggio, dopo una compattazione. */
  recovery: undefined as string | undefined,
  /** Istruzioni di compattazione dell'utente (opzione), per le compattazioni del motore. */
  baseInstructions: '',
  /** Comandi già compressi: alla ripetizione si comprime meno (il modello voleva vedere di più). */
  compressedCommands: new Map<string, number>(),
  /** Cartella per gli output originali e contatore dell'anello di file. */
  rawDir: undefined as string | undefined,
  rawIndex: 0,
  // Consigliere proattivo
  snoozes: {} as Snoozes,
  muted: new Set<string>(),
  lastShown: undefined as { id: string; severity: Proposal['severity'] } | undefined,
  mcpTokens: undefined as number | undefined,
  hasClaudeMd: undefined as boolean | undefined,
  /** Compattazione chiesta mentre il modello lavorava: parte a fine turno. */
  isCompactPending: false,
  /** Un turno del modello è in corso: compattare va rimandato a fine turno. */
  isTurnRunning: false,
  /** Il controllo delle contraddizioni in corso: chi arriva dopo lo aspetta invece di saltarlo. */
  checking: undefined as Promise<number> | undefined,
  /** Compattazione chiesta e in attesa dei tuoi chiarimenti: prima si chiarisce, poi si compatta. */
  pendingCompaction: undefined as { extra: string } | undefined,
  isStartingCompaction: false,
  isGuideInSystem: false,
  isGuideSent: false,
}

// Percorso relativo alla cartella del progetto, se ci sta dentro: più corto nel registro e nei riassunti.
const relativeTo = (cwd: string, path: string): string => {
  const base = cwd.replace(/[\\/]+$/, '')

  return base.length > 0 && path.toLowerCase().startsWith(`${base.toLowerCase()}`) && /[\\/]/.test(path.charAt(base.length))
    ? path.slice(base.length + 1)
    : path
}

// Legge un file di testo del progetto, o undefined.
async function readText($: Engine, name: string): Promise<string | undefined> {
  const path = resolvePath(state.cwd, name)

  if (path === undefined) {
    return undefined
  }

  const content = await $.fs.read(path).catch(() => undefined)

  return typeof content === 'string' ? content : undefined
}

// Versione e struttura di Laravel: composer.lock è esatto, composer.json indicativo.
async function detectLaravel($: Engine): Promise<void> {
  const lock = await readText($, 'composer.lock')
  const fromLock = lock === undefined ? undefined : versionFromLock(lock)
  const json = fromLock === undefined ? await readText($, 'composer.json') : undefined

  state.laravel = fromLock ?? (json === undefined ? undefined : versionFromComposerJson(json))

  const exists = async (name: string) => {
    const path = resolvePath(state.cwd, name)

    return path !== undefined && (await $.fs.exists(path).catch(() => false))
  }

  state.layout = layoutOf(await exists('app/Http/Kernel.php'), await exists('bootstrap/app.php'))
}

// LangChain/LangGraph: dalle dipendenze Python; versioni dal lock (uv o poetry) o dalle dipendenze.
async function detectLangChain($: Engine, isKnown: boolean): Promise<boolean> {
  const texts: string[] = []

  for (const name of PYTHON_DEPENDENCY_FILES) {
    const text = await readText($, name)

    if (text !== undefined) {
      texts.push(text)
    }
  }

  const requirements = texts.join('\n')

  if (!isKnown && !mentionsLangChain(requirements)) {
    return false
  }

  const lock = (await readText($, 'uv.lock')) ?? (await readText($, 'poetry.lock'))
  state.lang = langVersions(lock, requirements)

  return true
}

// claude-mem: dagli strumenti MCP del modello (nomi esatti) o dalla sua cartella nella home.
async function detectMem($: Engine): Promise<void> {
  if (state.memMode === 'spento') {
    state.mem = NO_MEM
    state.isMemChecked = true

    return
  }

  const names = (await $.tool.list().catch(() => [])).map(tool => tool.name)
  const tools = findMemTools(names)
  const home = (await $.env.get('USERPROFILE').catch(() => undefined)) ?? (await $.env.get('HOME').catch(() => undefined))
  const settingsPath = home === undefined ? undefined : `${home.replace(/[\\/]+$/, '')}/.claude-mem/settings.json`
  const settingsText = settingsPath === undefined ? undefined : await $.fs.read(settingsPath).catch(() => undefined)
  const hasSettings = typeof settingsText === 'string'

  state.mem = {
    isActive: state.memMode === 'attivo' || Object.keys(tools).length > 0 || hasSettings,
    tools,
    settings: hasSettings ? parseMemSettings(settingsText) : {},
  }
  // Gli strumenti MCP possono collegarsi dopo l'avvio: se non visti, si riprova al primo messaggio.
  state.isMemChecked = Object.keys(tools).length > 0 || state.memMode === 'attivo'

  if (state.mem.isActive && !state.dirs.includes('.claude-mem')) {
    state.dirs = [...state.dirs, '.claude-mem']
  }
}

/** Le guide brevi per i profili attivi (Laravel, LangChain), già pronte per il prompt. */
const projectGuides = (): { id: string; text: string }[] => [
  ...(state.profiles.includes('laravel') ? [{ id: `${NAME}:laravel`, text: laravelGuide(state.laravel, state.layout) }] : []),
  ...(state.profiles.includes('langchain') ? [{ id: `${NAME}:langchain`, text: langchainGuide(state.lang) }] : []),
  ...(state.mem.isActive ? [{ id: `${NAME}:claude-mem`, text: memGuide(state.mem) }] : []),
]

// Riconosce il tipo di progetto dai file nella cartella di lavoro.
async function detectProject($: Engine, cwd: string, forced: string, base: readonly string[]): Promise<void> {
  const markers = [...new Set(PROFILES.flatMap(profile => PROFILE_MARKERS[profile]))]
  const present = new Set<string>()

  for (const marker of markers) {
    const path = resolvePath(cwd, marker)

    if (path !== undefined && (await $.fs.exists(path).catch(() => false))) {
      present.add(marker)
    }
  }

  state.cwd = cwd
  state.profiles = detectProfiles(present, forced)
  // La cartella di claude-mem resta esclusa anche quando il progetto si riconosce di nuovo.
  state.dirs = dirsFor(state.mem.isActive ? [...base, '.claude-mem'] : base, state.profiles)

  if (state.profiles.includes('laravel')) {
    await detectLaravel($).catch(() => undefined)
  }

  // Un progetto Python con langchain o langgraph tra le dipendenze diventa anche LangChain.
  if (state.profiles.includes('python') && (forced === 'auto' || state.profiles.includes('langchain'))) {
    const isLangChain = await detectLangChain($, state.profiles.includes('langchain')).catch(() => false)

    if (isLangChain && !state.profiles.includes('langchain')) {
      state.profiles = [...state.profiles, 'langchain']
      state.dirs = dirsFor(state.mem.isActive ? [...base, '.claude-mem'] : base, state.profiles)
    }
  }
}

// Dimensione di un file in byte, o undefined se non si legge.
async function sizeOf($: Engine, path: string): Promise<number | undefined> {
  const stat = await $.fs.stat(path).catch(() => undefined)

  return stat !== undefined && stat.kind === 'file' ? stat.size : undefined
}

// Dopo una compattazione si riparte da zero con avvisi e conteggio dei turni.
async function resetAfterCompaction($: Engine): Promise<void> {
  state.shownLevel = 0
  state.hasAutoCompacted = false
  state.hasWarnedTurns = false
  state.turnsAtReset = await $.session.turns().catch(() => state.turnsAtReset)
  // La nota con la guida finisce nel riassunto: si rimanda al prossimo messaggio.
  state.isGuideSent = false
  state.snoozes = clearAfterCompaction(state.snoozes)
  state.isCompactPending = false
  // Dopo il riassunto il modello non ha più gli output: la prossima volta si comprime di nuovo normalmente.
  state.compressedCommands.clear()
  state.pendingCompaction = undefined
}

// Dopo una compattazione: controlla che il riassunto abbia i punti del registro; ciò che manca torna al prossimo messaggio.
async function verifyCompaction($: Engine, messages?: readonly { text: string }[]): Promise<string | undefined> {
  const ledger = (await read($, ledgerAtom)) as Ledger
  const memory = (await read($, memoryAtom)) as SessionMemory
  const hasMemory = memory.decisions.length > 0 || openConflicts(memory).length > 0

  if (isEmpty(ledger) && !hasMemory) {
    return undefined
  }

  const after = messages ?? (await $.session.messages().catch(() => []))
  const summary = summaryText(after)
  const missing = missingFromSummary(ledger, summary)
  const { kept, total } = coverage(ledger, missing)
  // Memoria pulita: decisioni valide mancanti e decisioni superate riportate come valide.
  const memoryCheck = checkSummary(memory, summary)
  const notes = [recoveryNote(missing), memoryRecoveryNote(memoryCheck, memory)].filter((note): note is string => note !== undefined)
  state.recovery = notes.length === 0 ? undefined : notes.join('\n\n')

  const stale = memoryCheck.stale.length > 0 ? ` ${memoryCheck.stale.length} decisioni superate corrette.` : ''

  return state.recovery === undefined
    ? `Riassunto verificato: ${kept}/${total} punti di lavoro conservati, memoria coerente.`
    : `Riassunto verificato: ${kept}/${total} punti conservati;${stale} le correzioni tornano al prossimo messaggio.`
}

// Istruzioni di compattazione: struttura fissa, punti obbligatori dal registro, note di claude-mem e dell'utente.
async function buildInstructions($: Engine, extra: readonly (string | undefined)[]): Promise<string> {
  const ledger = (await read($, ledgerAtom)) as Ledger
  const memNote = state.mem.isActive ? MEM_COMPACT_NOTE : ''
  const memory = memoryChecklist((await read($, memoryAtom)) as SessionMemory)

  const piano = await notaPiano($).catch(() => '')

  return compactInstructions(ledger, [memory, piano, state.baseInstructions, memNote, ...extra.map(note => note ?? '')])
}

// Salva l'output originale in un anello di 20 file: il modello lo ritrova senza rieseguire il comando.
async function saveRaw($: Engine, text: string): Promise<string | undefined> {
  if (state.rawDir === undefined) {
    const temp =
      (await $.env.get('TEMP').catch(() => undefined)) ??
      (await $.env.get('TMPDIR').catch(() => undefined)) ??
      (await $.env.get('TMP').catch(() => undefined))
    const stamp = Math.floor((await $.clock.now().catch(() => 0)) / 1000).toString(36)
    // Su Linux spesso non c'è TEMP né TMPDIR: si usa /tmp, che c'è sempre.
    const root = temp ?? (state.cwd.startsWith('/') ? '/tmp' : undefined)
    state.rawDir = root === undefined ? '' : `${root.replace(/[\\/]+$/, '')}/gestione-sprint/${stamp}`
  }
  if (state.rawDir === '') {
    return undefined
  }

  const path = `${state.rawDir}/output-${String(state.rawIndex % 20).padStart(2, '0')}.txt`
  state.rawIndex += 1

  try {
    await $.fs.write(path, text)

    return path
  } catch {
    return undefined
  }
}

// Compatta la sessione e ritorna il testo per l'utente.
async function compact($: Engine, base: string, extra: string): Promise<string> {
  if (state.isCompacting) {
    return 'Compattazione già in corso.'
  }

  state.isCompacting = true
  // La proposta di compattare sparisce subito dalla banda, mentre si compatta.
  await refreshAdvice($).catch(() => undefined)

  try {
    // Prima di riassumere: le richieste nuove si controllano, così il riassunto non fonde due idee opposte.
    await checkConflicts($, true).catch(() => 0)
    const instructions = await buildInstructions($, [base === state.baseInstructions ? '' : base, extra])
    const result = await $.session.compact({ instructions })

    if (result.skip !== undefined) {
      return `Compattazione non eseguita: ${result.skip}`
    }

    // Anche qui, perché l'hook su session.compact non gira dove l'organizzazione gestisce Claude Code.
    await resetAfterCompaction($)
    const check = await verifyCompaction($, result.messages).catch(() => undefined)

    return [compactSummary(result.tokensBefore, result.tokensAfter), check].filter(Boolean).join(' ')
  } finally {
    state.isCompacting = false
    // Nuova misura e nuove proposte: la banda non deve restare sul "95%" di prima.
    await measureNow($).catch(() => undefined)
    await refreshAdvice($).catch(() => undefined)
  }
}

// Impostazioni dell'indicatore, fissate da register.
const view = {
  warn: 60,
  strong: 80,
  critical: 90,
  maxTurns: 40,
  hasStatus: true,
  isProactive: true,
  barStyle: 'blocchi' as BarStyle,
  instructions: '',
  isConflictCheck: true,
  conflictModel: 'haiku',
}

// ---- Contraddizioni nella memoria ----

// Chiede a un modello piccolo se le tue richieste si contraddicono. Non tocca il contesto della sessione.
async function checkConflicts($: Engine, isForced: boolean): Promise<number> {
  // Un controllo già in corso si aspetta: chi compatta deve avere il risultato, non un "saltato".
  if (state.checking !== undefined) {
    const found = await state.checking.catch(() => 0)

    if (!isForced) {
      return found
    }
  }

  const memory = (await read($, memoryAtom)) as SessionMemory

  // Con la memoria di progetto basta una richiesta che la cambia per controllare.
  if (!view.isConflictCheck || !shouldCheck(await memoriaConProgetto($, memory), isForced)) {
    return 0
  }

  const run = runCheck($, memory)
  state.checking = run

  try {
    return await run
  } finally {
    if (state.checking === run) {
      state.checking = undefined
    }
  }
}

// Una chiamata al modello piccolo sulle richieste fin qui.
async function runCheck($: Engine, memory: SessionMemory): Promise<number> {
  const seenTotal = memory.total ?? memory.history.length

  {
    const before = openConflicts(memory).length
    // Il controllo vede anche la memoria valida del progetto: una richiesta in chat che la contraddice viene proposta.
    const reply = await $.model.complete({ model: view.conflictModel, system: CHECK_SYSTEM, prompt: checkPrompt(await memoriaConProgetto($, memory)), maxTokens: 900 })

    if (!reply.isAnswered) {
      return 0
    }

    const parsed = parseReply(reply.text)

    if (parsed === undefined) {
      return 0
    }

    // Si rilegge la memoria: nel frattempo può essere arrivata un'altra richiesta (resta da controllare).
    const latest = (await read($, memoryAtom)) as SessionMemory
    const merged = await soloSessione($, mergeReply(latest, parsed, seenTotal))
    await update($, memoryAtom, () => merged)

    return openConflicts(merged).length - before
  }
}

// ---- Prima chiarisco, poi compatto ----

/**
 * Il percorso di ogni compattazione chiesta da te (pulsante, /alleggerisci, fine turno, automatica del mod):
 * 1. controlla le richieste nuove; 2. se ci sono contraddizioni aperte, si ferma e te le propone;
 * 3. quando le hai chiarite tutte (o scegli "Compatta lo stesso"), compatta.
 */
async function startCompaction($: Engine, extra: string): Promise<string> {
  // Il segnale è messo subito, prima di ogni attesa: due richieste insieme (fine turno + automatica) non fanno due compattazioni.
  if (state.isCompacting || state.isStartingCompaction) {
    return 'Compattazione già in corso.'
  }

  state.isStartingCompaction = true

  try {
    return await startCompactionNow($, extra)
  } finally {
    state.isStartingCompaction = false
  }
}

async function startCompactionNow($: Engine, extra: string): Promise<string> {
  await checkConflicts($, true).catch(() => 0)
  const open = openConflicts((await read($, memoryAtom)) as SessionMemory)

  if (view.isConflictCheck && open.length > 0) {
    state.pendingCompaction = { extra }
    await refreshAdvice($).catch(() => undefined)

    return `Prima di compattare chiarisci ${open.length === 1 ? 'una contraddizione' : `${open.length} contraddizioni`}: scegli con i pulsanti sopra il prompt (o nel pannello /contesto). Poi compatto io.`
  }

  state.pendingCompaction = undefined

  return compact($, view.instructions, extra)
}

// Avvia la compattazione fuori dall'hook che la chiede (il motore non compatta dentro un comando o un clic).
function startCompactionLater($: Engine, extra: string): void {
  void $.clock
    .sleep(50)
    .then(() => startCompaction($, extra))
    .then(text => $.ui.toast(text))
    .catch(error => $.ui.toast(`Compattazione non riuscita: ${String(error)}`))
}

// Dopo un chiarimento: se una compattazione aspettava e non resta nulla da chiarire, parte.
async function continueCompaction($: Engine, isWorking: boolean): Promise<void> {
  const pending = state.pendingCompaction

  if (pending === undefined || openConflicts((await read($, memoryAtom)) as SessionMemory).length > 0) {
    return
  }

  state.pendingCompaction = undefined

  if (isWorking) {
    state.isCompactPending = true
    $.ui.toast('Tutto chiarito: compatto appena il modello finisce il turno.')

    return
  }

  $.ui.toast('Tutto chiarito: compatto ora.')
  void $.clock
    .sleep(50)
    .then(() => compact($, view.instructions, pending.extra))
    .then(text => $.ui.toast(text))
    .catch(error => $.ui.toast(`Compattazione non riuscita: ${String(error)}`))
}

// Controllo in background dopo un turno: se trova contraddizioni nuove, la banda le propone.
function checkConflictsLater($: Engine): void {
  void checkConflicts($, false)
    .then(async found => {
      if (found > 0) {
        await refreshAdvice($)
      }
    })
    .catch(() => undefined)
}

// ---- Consigliere proattivo ----

// Ricalcola le proposte dai segnali della sessione; una proposta nuova o più grave si annuncia con un avviso.
async function refreshAdvice($: Engine): Promise<void> {
  // Senza suggerimenti proattivi resta solo ciò che fa parte della compattazione: i chiarimenti richiesti.
  if (!view.isProactive && state.pendingCompaction === undefined) {
    await update($, proposalsAtom, () => [])
    state.lastShown = undefined

    return
  }

  const meter = await read($, meterAtom)
  const ledger = (await read($, ledgerAtom)) as Ledger
  const turns = (await $.session.turns().catch(() => state.turnsAtReset)) - state.turnsAtReset
  const proposals = activeProposals(
    {
      percent: meter?.percent,
      warn: view.warn,
      strong: view.strong,
      critical: view.critical,
      turns,
      maxTurns: view.maxTurns,
      mcpTokens: state.mcpTokens,
      limitPercent: meter?.limit?.percentUsed,
      hasClaudeMd: state.hasClaudeMd,
      profiles: state.profiles,
      openErrors: ledger.errors.length,
      isCompacting: state.isCompacting,
      conflicts: openConflicts((await read($, memoryAtom)) as SessionMemory),
      isClarifying: state.pendingCompaction !== undefined,
    },
    state.snoozes,
    state.muted,
  ).filter(proposal => view.isProactive || proposal.id === 'conflict')
  const top = proposals[0]

  if (isNewer(top, state.lastShown) && top !== undefined && top.severity !== 'info') {
    $.ui.toast(`${top.text} (scelte pronte sopra il prompt)`)
  }

  state.lastShown = top === undefined ? undefined : { id: top.id, severity: top.severity }
  await update($, proposalsAtom, () => proposals)
}

// Compatta subito, oppure a fine turno se il modello sta lavorando.
function requestCompact($: Engine, isWorking: boolean): void {
  if (isWorking) {
    state.isCompactPending = true
    $.ui.toast('Compatto appena il modello finisce il turno.')

    return
  }

  startCompactionLater($, '')
}

// Le richieste che il mod stesso scrive nella casella (/passaggio): non sono richieste di lavoro.
const isModPrompt = (text: string): boolean =>
  text.startsWith(HANDOFF_PROMPT.slice(0, 40)) || text.startsWith('Salva con ')

// Prepara nella casella del prompt la richiesta di riepilogo per ripartire.
async function handoff($: Engine): Promise<string> {
  // Con claude-mem il riepilogo va in memoria: la sessione nuova lo ritrova da sola.
  const isMem = state.mem.isActive && state.mem.tools.save_memory !== undefined
  const checklist = ledgerChecklist((await read($, ledgerAtom)) as Ledger)
  const request = isMem ? memHandoffPrompt(state.mem) : HANDOFF_PROMPT
  const piano = await notaPiano($).catch(() => '')
  const punti = [checklist, piano].filter(text => text.length > 0).join('\n')
  const filled = await $.prompt.fill({ text: punti.length > 0 ? `${request} Includi questi punti:\n${punti}` : request })

  return !filled.isFilled
    ? 'Non riesco a scrivere nella casella. Chiedi: "scrivi il riepilogo per ripartire".'
    : isMem
      ? 'Richiesta pronta: premi Invio. Il riepilogo finisce in claude-mem; poi apri una sessione nuova, lo ritrova da sola (niente da incollare).'
      : 'Richiesta pronta nella casella: premi Invio per generare il riepilogo, poi apri una sessione nuova e incollalo.'
}

// Crea un CLAUDE.md breve, solo se non esiste: non sovrascrive mai.
async function createClaudeMd($: Engine): Promise<string> {
  const path = resolvePath(state.cwd, 'CLAUDE.md')

  if (path === undefined) {
    return 'Cartella del progetto non riconosciuta: usa /claudemd e copia il testo.'
  }
  if (await $.fs.exists(path).catch(() => false)) {
    state.hasClaudeMd = true

    return 'Esiste già un CLAUDE.md: non l\'ho toccato. /claudemd mostra le righe consigliate.'
  }

  await $.fs.write(path, `${claudeMdSnippet(state.profiles)}\n`)
  state.hasClaudeMd = true

  return `Creato ${path}: poche righe, lette a ogni sessione. Modificalo pure.`
}

// Esegue la scelta fatta su una proposta.
async function runAction($: Engine, action: ActionId, proposal: Proposal, isWorkingNow?: boolean): Promise<void> {
  // La banda sa se il modello lavora (dato del motore); il pannello no: lì vale quello che il mod ha seguito.
  const isWorking = isWorkingNow ?? state.isTurnRunning

  switch (action) {
    case 'compact':
      requestCompact($, isWorking)
      break
    case 'handoff':
      $.ui.toast(await handoff($))
      break
    case 'details':
      await $.ui.open({ id: PANE, title: 'Contesto' })
      break
    case 'claudemd':
      $.ui.toast(await createClaudeMd($).catch(error => `CLAUDE.md non creato: ${String(error)}`))
      break
    case 'snooze':
      state.snoozes = snooze(state.snoozes, proposal)
      break
    case 'mute':
      state.muted = new Set([...state.muted, proposal.id])
      break
    case 'keepNew':
    case 'keepOld':
    case 'keepBoth':
    case 'dismiss': {
      const resolution: Resolution =
        action === 'keepNew' ? 'nuova' : action === 'keepOld' ? 'vecchia' : action === 'keepBoth' ? 'entrambe' : 'nessuna'
      const ref = proposal.ref ?? ''
      const conflitto = ((await read($, memoryAtom)) as SessionMemory).conflicts.find(item => item.id === ref)
      await update($, memoryAtom, memory => resolveConflict(memory as SessionMemory, ref, resolution))
      // La scelta entra anche nel piano: se supera una voce di memoria di progetto parte l'analisi d'impatto.
      const notaScelta = conflitto ? await sceltaNelPiano($, conflitto, resolution).catch(() => undefined) : undefined
      if (notaScelta !== undefined) {
        $.ui.toast(notaScelta)
      }
      $.ui.toast(
        resolution === 'nessuna'
          ? 'Segnata come non contraddizione.'
          : 'Scelta registrata: il modello la riceve con il prossimo messaggio e il riassunto la rispetterà.',
      )
      await continueCompaction($, isWorking)
      break
    }
    case 'compactAnyway': {
      // Le contraddizioni restano aperte: il riassunto le riporta come domande, senza scegliere.
      const extra = state.pendingCompaction?.extra ?? ''
      state.pendingCompaction = undefined

      if (isWorking) {
        state.isCompactPending = true
        $.ui.toast('Compatto a fine turno; le contraddizioni restano come domande aperte nel riassunto.')
      } else {
        void $.clock
          .sleep(50)
          .then(() => compact($, view.instructions, extra))
          .then(text => $.ui.toast(text))
          .catch(error => $.ui.toast(`Compattazione non riuscita: ${String(error)}`))
      }
      break
    }
    case 'cancelCompact':
      state.pendingCompaction = undefined
      $.ui.toast('Compattazione annullata. Le contraddizioni restano nel pannello /contesto.')
      break
  }

  if (action !== 'compact' && action !== 'handoff' && action !== 'details') {
    await refreshAdvice($)
  }
}

// Registra una misura: banda, pannello e riga di stato si aggiornano insieme.
async function showMeter($: Engine, meter: MeterState): Promise<void> {
  await update($, meterAtom, () => meter)

  if (view.hasStatus) {
    const level = levelOf(meter.percent, view.warn, view.strong)
    const profile = state.profiles.length > 0 ? ` · ${state.profiles.join('+')}` : ''
    $.ui.status(`${statusMeter(meter.percent, meter.tokens, meter.window, level, view.barStyle)}${profile}`)
  }
}

// Misura subito, senza aspettare la prima risposta del modello.
async function measureNow($: Engine): Promise<void> {
  const usage = await $.session.usage()
  const { window } = usage.context
  let { tokens, percent } = usage.context

  // Prima della prima risposta il motore non ha ancora una misura: si usa la stima di /context
  // (prompt di sistema, strumenti, memoria), invece di mostrare un falso 0%.
  if (percent === undefined) {
    const breakdown = (await $.session.usage({ breakdown: 'summary' }).catch(() => undefined))?.context.breakdown
    tokens = tokens ?? breakdown?.totalTokens
    percent = breakdown?.percentage ?? (tokens !== undefined && window > 0 ? (tokens / window) * 100 : 0)
  }

  await showMeter($, { percent, tokens, window, limit: busiestLimit(usage.rateLimits ?? []) })
}

// Somma un risparmio della compressione.
async function addSaved($: Engine, chars: number): Promise<void> {
  await update($, savedAtom, saved => ({ compressions: saved.compressions + 1, charsSaved: saved.charsSaved + chars }))
}


// ==================== punto d'ingresso ====================
// Prima il modulo sprint (comandi, strumenti, piano), poi il modulo contesto, che registra gli eventi comuni
// e chiama le funzioni del modulo sprint dentro la stessa catena.

export const register: Register = (on, options) => {
  // ---- modulo sprint ----
  {
  cfg.cartella = String(options.cartellaPiano ?? '') || '.claude/sprint'
  cfg.skill = String(options.skillBrainstorming ?? '') || 'superpowers:brainstorming'
  cfg.modo = options.sicurezza === 'avvisa' ? 'avvisa' : 'blocca'
  cfg.perGiro = typeof options.taskPerGiro === 'number' && options.taskPerGiro > 0 ? options.taskPerGiro : 3
  cfg.isApriAvvio = options.apriAllAvvio !== false
  cfg.isVerifica = options.conflictCheck !== false
  cfg.modelloVerifica = (typeof options.conflictModel === 'string' && options.conflictModel.trim()) || 'haiku'
  cfg.isProteggiMemoria = options.proteggiMemoria !== false

  // ---------- avvio ----------


  // ---------- comandi ----------

  on('command.run', { command: 'sprint' }, async $ => {
    const piano = await carica($)
    await $.ui.open({ id: PANNELLO, title: 'Sprint', focus: true })
    return { text: piano ? testoStato(piano) : 'Nessun piano: premi x nel pannello o usa /sprint-analizza.' }
  }).catch(async $ => ({ text: await motivoErrore($) }))

  on('command.run', { command: 'sprint-analizza' }, async ($, e) => {
    await avviaAnalisi($, e.args.trim())
    void $.ui.open({ id: PANNELLO, title: 'Sprint' }).catch(() => undefined)
    return { text: 'Analisi avviata: memoria e logica del progetto, poi brainstorming e sprint.' }
  }).catch(async $ => ({ text: await motivoErrore($) }))

  on('command.run', { command: 'sprint-procedi' }, async ($, e) => {
    const piano = await carica($)
    const r = piano ? riepilogo(piano) : undefined
    if (!piano || !r) {
      return { text: 'Nessun piano: prima /sprint-analizza.' }
    }
    if (!r.prossimo) {
      return { text: 'Nessun task pronto.' }
    }
    if (r.bloccantiProssimo.length) {
      await update($, vistaA, () => 'domande')
      await update($, domandaSelA, () => r.bloccantiProssimo[0]?.id ?? '')
      void $.ui.open({ id: PANNELLO, title: 'Sprint', focus: true }).catch(() => undefined)
      return { text: `${r.prossimo.id} attende ${r.bloccantiProssimo.map(d => d.id).join(', ')}: rispondi nel pannello.` }
    }
    const dor = prontezza(piano, r.prossimo)
    if (!dor.isPronto) {
      await update($, vistaA, () => 'piano')
      await update($, taskSelA, () => '')
      void $.ui.open({ id: PANNELLO, title: 'Sprint', focus: true }).catch(() => undefined)
      return { text: `${r.prossimo.id} non e pronto: ${dor.voci.filter(v => !v.ok && v.isCritica).map(v => v.testo).join('; ')}. Premi g nel pannello per farlo correggere.` }
    }
    const n = Number.parseInt(e.args, 10)
    void $.prompt.submit({ text: promptProcedi(Number.isFinite(n) && n > 0 ? n : cfg.perGiro, usoMemoria(piano)) }).catch(() => undefined)
    return { text: `Esecuzione autonoma da ${r.prossimo.id}.` }
  }).catch(async $ => ({ text: await motivoErrore($) }))

  on('command.run', { command: 'sprint-domande' }, async $ => {
    const piano = await carica($)
    const coda = piano ? codaDomande(piano) : []
    if (!coda.length) {
      return { text: 'Nessuna domanda aperta.' }
    }
    return {
      text: coda
        .map(d => `${d.id}${d.stato === 'in-conflitto' ? ' ⚠ conflitto' : d.bloccante ? ' bloccante' : ''}${d.task ? ` [${d.task}]` : ''}: ${d.testo}`)
        .join('\n'),
    }
  }).catch(async $ => ({ text: await motivoErrore($) }))

  on('command.run', { command: 'sprint-fonte' }, async ($, e) => {
    const arg = e.args.trim()
    if (!arg) {
      void $.ui.open({ id: PANNELLO, title: 'Sprint', focus: true }).catch(() => undefined)
      await update($, vistaA, () => 'business')
      return { text: 'Incolla la fonte nella scheda business del pannello.' }
    }
    const percorso = arg.replace(/^["']|["']$/g, '')
    const isFile = percorso.length < 400 && !percorso.includes('\n') && (await $.fs.exists(percorso).catch(() => false))
    const testo = isFile ? await $.fs.read(percorso).catch(() => undefined) : arg
    if (testo === undefined) {
      return { text: `Non riesco a leggere ${percorso} (file oltre 4 MB o non leggibile): incolla il testo nella scheda business.` }
    }
    const { id, isNuova } = await salvaFonte($, testo, isFile ? percorso.split(/[\\/]/).at(-1) : undefined)
    return { text: !id ? 'Testo troppo corto.' : isNuova ? `Fonte ${id} salvata. Premi x nel pannello per analizzarla.` : `Questa fonte c'e gia: ${id}.` }
  }).catch(async $ => ({ text: await motivoErrore($) }))

  on('command.run', { command: 'sprint-chiudi' }, async ($, e) => {
    const piano = await carica($)
    const da = piano ? sprintDaChiudere(piano) : []
    const id = e.args.trim().toUpperCase() || da[0]?.id || ''
    if (!piano || !id) {
      return { text: 'Nessuno sprint completato da chiudere.' }
    }
    const s = piano.sprint.find(x => x.id === id)
    if (!s || s.stato !== 'completato') {
      return { text: `${id}: si chiude solo uno sprint con tutti i task completati.` }
    }
    void $.prompt.submit({ text: promptChiusura(id, usoMemoria(piano)) }).catch(() => undefined)
    return { text: `Revisione e retrospettiva di ${id} avviate.` }
  }).catch(async $ => ({ text: await motivoErrore($) }))

  on('command.run', { command: 'sprint-scegli' }, async ($, e) => {
    const [id = '', scelta = ''] = e.args.trim().split(/\s+/)
    if (scelta !== 'memoria' && scelta !== 'nuova') {
      return { text: 'Uso: /sprint-scegli D3 memoria  oppure  /sprint-scegli D3 nuova' }
    }
    const esito = await muta($, p => risolviConflitto(p, id.toUpperCase(), scelta, ora()))
    if (esito.errore) {
      return { text: esito.errore }
    }
    await update($, attesaA, ids => [...new Set([...(ids ?? []), id.toUpperCase()])])
    return { text: `${id.toUpperCase()}: ${scelta === 'memoria' ? 'resta valida la memoria' : 'vale la nuova scelta, memoria da aggiornare'}.` }
  }).catch(async $ => ({ text: await motivoErrore($) }))

  // ---------- strumenti per il modello: risposte corte ----------

  on('tool.call', { tool: 'mcp__gestione-sprint__piano_leggi' }, async ($, e) => {
    const piano = await carica($)
    if (!piano) {
      return { result: `Nessun piano in ${cfg.cartella}/piano.json: crealo con piano_aggiorna.` }
    }
    const a = e as unknown as { formato?: string; sprint?: string }
    switch (a.formato) {
      case 'sprint':
        return { result: vistaSprint(piano, a.sprint) }
      case 'memoria':
        return { result: vistaMemoria(piano) }
      case 'business':
        return { result: vistaBusiness(piano) }
      case 'qualita':
        return { result: vistaQualita(piano) }
      case 'completo': {
        const { registro, ...resto } = piano
        return { result: JSON.stringify({ ...resto, registro: registro.slice(-10) }) }
      }
      default:
        return { result: vistaRiepilogo(piano) }
    }
  }).catch(async $ => ({ result: await motivoErrore($) }))

  on('tool.call', { tool: 'mcp__gestione-sprint__piano_aggiorna' }, async ($, e) => {
    const prima = await carica($)
    const impronte = impronteAnalisi
    const esito = await muta($, p => applicaPatch(impronte ? conImpronte(p, impronte) : p, e as unknown as Patch, ora()))
    if (impronte === impronteAnalisi) {
      impronteAnalisi = undefined
    }
    const trovati = prima && esito.cambi.length ? await verificaModifiche($, prima, esito.piano) : 0
    const finale = (await carica($)) ?? esito.piano
    const r = riepilogo(finale)
    const pr = controlliQualita(finale)
    const critici = pr.filter(x => x.livello === 'critico').length
    if (trovati || esito.cambi.some(c => c.includes('conflitto'))) {
      $.ui.toast(`⚠ ${r.conflitti} conflitti con la memoria da decidere`)
    }
    return {
      result: [
        esito.cambi.length ? `ok: ${esito.cambi.join('; ')}` : 'nessun cambiamento',
        esito.rifiuti.length ? `rifiutato: ${esito.rifiuti.join('; ')}` : '',
        trovati ? `ATTENZIONE: ${trovati} contenuti nuovi contraddicono la memoria. Sono diventati conflitti: non procedere su quei task, decide l'utente nel pannello.` : '',
        `${testoStato(finale)} · qualita ${punteggio(pr)}/100${critici ? `, ${critici} critici (piano_leggi formato qualita)` : ''}`,
      ]
        .filter(Boolean)
        .join('\n'),
    }
  }).catch(async $ => ({ result: await motivoErrore($) }))

  on('tool.call', { tool: 'mcp__gestione-sprint__task_stato' }, async ($, e) => {
    const a = e as unknown as { id?: string; stato?: string; nota?: string }
    const stato = STATI_LAVORO.find(s => s === a.stato)
    if (!stato) {
      return { result: `stato non valido: ${STATI_LAVORO.join(', ')}` }
    }
    const piano = await carica($)
    const id = piano ? idDelPiano(piano, String(a.id ?? '')) : String(a.id ?? '')
    if (piano && stato === 'completato' && cfg.modo === 'blocca' && !String(a.nota ?? '').trim()) {
      return { result: `${id}: per completarlo serve la prova della verifica nella nota (definition of done: ${piano.progetto.dod.join('; ')}).` }
    }
    if (piano && stato === 'completato' && cfg.modo === 'blocca') {
      const s = piano.sprint.find(x => x.task.some(t => t.id === id))
      const conflitti = bloccantiPer(piano, s?.id, id).filter(d => d.stato === 'in-conflitto')
      if (conflitti.length) {
        return { result: `${id} non puo dirsi completato: conflitti aperti ${conflitti.map(d => d.id).join(', ')}. Decide l'utente con il pulsante ▶ Risolvi il conflitto sopra il prompt.` }
      }
    }
    if (piano && stato === 'in-corso') {
      const t = piano.sprint.flatMap(x => x.task).find(x => x.id === id)
      const dor = t ? prontezza(piano, t) : undefined
      if (dor && !dor.isPronto && cfg.modo === 'blocca') {
        const manca = dor.voci.filter(v => !v.ok && v.isCritica).map(v => v.testo)
        return { result: `${id} non e pronto (definition of ready): ${manca.join('; ')}. Sistema il piano o chiedi all'utente (pulsante Domande sopra il prompt).` }
      }
    }
    const esito = await muta($, p => impostaStato(p, id, stato, String(a.nota ?? ''), ora(), true))
    // Definition of done: gli errori ancora aperti nel registro del lavoro vanno guardati prima di dire "fatto".
    const errori = stato === 'completato' && !esito.errore ? await erroriAperti($).catch(() => [] as string[]) : []
    const avviso = errori.length ? ` Attenzione: nel registro ci sono errori aperti (${errori.join(' | ')}): verifica che non riguardino ${id}.` : ''
    // Sprint appena completato: va chiuso con revisione e retrospettiva prima di passare al successivo.
    const appena = stato === 'completato' && !esito.errore
      ? sprintDaChiudere(esito.piano).find(s => s.task.some(t => t.id === id))
      : undefined
    const chiudi = appena ? ` Sprint ${appena.id} completato: chiudilo con revisione e retrospettiva (pulsante ▶ Chiudi lo sprint sopra il prompt, o /sprint-chiudi ${appena.id}) prima di andare avanti.` : ''
    if (appena) {
      $.ui.toast(`✓ sprint ${appena.id} completato: x nel pannello per revisione e retrospettiva`)
    }
    return { result: esito.errore ?? `${id}: ${stato}. ${testoStato(esito.piano)}${avviso}${chiudi}` }
  }).catch(async $ => ({ result: await motivoErrore($) }))

  on('tool.call', { tool: 'mcp__gestione-sprint__domanda_rispondi' }, async ($, e) => {
    const a = e as unknown as { id?: string; risposta?: string }
    const r = await rispondiVerificato($, String(a.id ?? '').trim().toUpperCase(), String(a.risposta ?? ''), 'chat')
    if (r.esito === 'conflitto') {
      void $.ui.open({ id: PANNELLO, title: 'Sprint', focus: true }).catch(() => undefined)
      await update($, vistaA, () => 'domande')
    }
    return { result: r.testo }
  }).catch(async $ => ({ result: await motivoErrore($) }))

  on('tool.call', { tool: 'mcp__gestione-sprint__fonte_leggi' }, async ($, e) => {
    const a = e as unknown as { id?: string; da?: number }
    const id = String(a.id ?? '').trim().toUpperCase()
    const testo = await leggiFonte($, id).catch(() => '')
    if (!testo) {
      return { result: `${id}: fonte non trovata` }
    }
    // A pezzi: una fonte lunga non entra tutta nel contesto in una volta.
    const PEZZO = 12000
    const da = Math.max(0, Math.floor(Number(a.da) || 0))
    const pezzo = testo.slice(da, da + PEZZO)
    const resto = testo.length - (da + pezzo.length)
    return { result: resto > 0 ? `${pezzo}\n[continua: fonte_leggi id=${id} da=${da + pezzo.length}, restano ${resto} caratteri]` : pezzo }
  }).catch(async $ => ({ result: await motivoErrore($) }))

  on('tool.call', { tool: 'mcp__gestione-sprint__memoria_applicata' }, async ($, e) => {
    const a = e as unknown as { id?: string; nota?: string }
    const esito = await muta($, p => segnaAggiornamento(p, String(a.id ?? ''), String(a.nota ?? ''), ora()))
    return { result: esito.errore ?? `${a.id} applicato` }
  }).catch(async $ => ({ result: await motivoErrore($) }))

  // ---------- sicurezza ----------


  // ---------- system prompt: poche righe, sempre aggiornate ----------



  on('session.end', ($, e, next) => {
    azzeraStatoSprint()
    return next(e)
  })


  // ---------- pannello ----------

  on('ui.render', { component: 'Pane', requestId: PANNELLO }, async ($, e) => {
    const t = $.ui.resolve(e)
    const el: Tavola = { Box: t.Box, Text: t.Text, Button: t.Button, Input: 'Input' in t ? t.Input : undefined }
    const larghezza = Math.max(36, (e.props as { bodyColumns?: number }).bodyColumns ?? e.viewport?.columns ?? 80)
    return disegna($, el, larghezza)
  })


  }
  // ---- modulo contesto ----
  {
  const warn = asNumber(options.warnPercent, 60)
  const strong = Math.max(asNumber(options.strongPercent, 80), warn)
  const maxTurns = asNumber(options.maxTurns, 40)
  const maxBytes = asNumber(options.maxFileKb, 200) * 1024
  const isBlocking = options.largeFileAction !== 'warn'
  // Se l'opzione non arriva (installazione senza configurazione), valgono le cartelle predefinite del manifest.
  const baseDirs = parseList(typeof options.blockedDirs === 'string' ? options.blockedDirs : DEFAULT_BLOCKED_DIRS)
  const forcedProfile = String(options.profile ?? 'auto')
  const heavyBytes = asNumber(options.heavyFileKb, 20) * 1024
  const hasStackHints = options.stackHints !== false
  const hasQuietTests = options.quietTests !== false
  const isProtectingSecrets = options.protectSecrets !== false
  const isCompressing = options.compressOutput !== false
  const compressMinChars = asNumber(options.compressMinChars, 3000)
  const hasProjectGuide = options.projectGuide !== false
  const autoPercent = typeof options.autoCompactPercent === 'number' ? options.autoCompactPercent : 0
  const instructions = String(options.compactInstructions ?? '')
  state.baseInstructions = instructions
  const hint = options.suggestRemedies === false ? '' : REMEDY_HINT
  const meterMode = asMeterMode(options.showMeter)
  const barStyle = asBarStyle(options.barStyle)
  const hasBand = meterMode === 'entrambi' || meterMode === 'banda'
  const hasStatus = meterMode === 'entrambi' || meterMode === 'stato'
  state.memMode = options.claudeMem === 'attivo' || options.claudeMem === 'spento' ? options.claudeMem : 'auto'

  view.warn = warn
  view.strong = strong
  view.hasStatus = hasStatus
  view.barStyle = barStyle
  view.critical = Math.max(asNumber(options.criticalPercent, 90), strong)
  view.maxTurns = maxTurns
  view.isProactive = options.proactive !== false
  view.instructions = instructions
  view.isConflictCheck = options.conflictCheck !== false
  view.conflictModel = typeof options.conflictModel === 'string' && options.conflictModel.trim().length > 0 ? options.conflictModel.trim() : 'haiku'

  // ---- Comandi di alleggerimento ----

  state.dirs = dirsFor(baseDirs, [])

  on('session.start', async ($, e, next) => {
    // Sessione nuova o ripresa: nessun turno in corso, nessuna compattazione in attesa.
    state.isTurnRunning = false
    state.pendingCompaction = undefined
    await detectProject($, e.cwd, forcedProfile, baseDirs)
    await $.command.register({
      name: 'alleggerisci',
      description: 'Compatta la sessione per liberare contesto (testo opzionale: cosa conservare)',
      argumentHint: '[cosa conservare]',
    })
    await $.command.register({
      name: 'peso',
      description: 'Mostra cosa occupa il contesto e come alleggerirlo (gratis, senza token)',
    })
    await $.command.register({
      name: 'passaggio',
      description: 'Prepara un riepilogo breve per ripartire in una sessione nuova',
    })
    await $.command.register({
      name: 'claudemd',
      description: 'Propone un CLAUDE.md breve per questo progetto (Laravel, PHP, Python, LangChain), gratis',
    })
    await $.command.register({
      name: 'contesto',
      description: 'Apre il pannello con la barra del contesto e le voci che lo occupano (gratis)',
    })
    await $.command.register({
      name: 'contraddizioni',
      description: 'Controlla se le tue richieste si contraddicono e ti fa scegliere quale vale (un controllo breve con un modello piccolo)',
    })
    await $.command.register({
      name: 'barra',
      description: 'Mostra o nasconde la barra del contesto sopra il prompt',
    })
    await detectMem($).catch(() => undefined)
    await measureNow($).catch(() => undefined)
    // Qualsiasi file di istruzioni del progetto basta: CLAUDE.md, .claude/CLAUDE.md, CLAUDE.local.md, AGENTS.md.
    const instructionFiles = ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md']
      .map(name => resolvePath(state.cwd, name))
      .filter((path): path is string => path !== undefined)
    let hasInstructions = false
    for (const path of instructionFiles) {
      hasInstructions = hasInstructions || (await $.fs.exists(path).catch(() => true))
    }
    state.hasClaudeMd = instructionFiles.length === 0 ? undefined : hasInstructions
    await refreshAdvice($).catch(() => undefined)

    // Poi il modulo sprint (comandi, strumenti, piano, memoria di progetto).
    return avvioSprint($, e, next)
  }).catch(($, e, next) => (next.called ? next(e) : avvioSprint($, e, next)))

  on('command.run', { command: 'contesto' }, async $ => {
    await measureNow($).catch(() => undefined)
    const opened = await $.ui.open({ id: PANE, title: 'Contesto' })

    if (opened.isPlaced) {
      return { text: 'Pannello del contesto aperto.' }
    }

    // Dove il pannello non si può mostrare, la stessa vista come testo.
    const meter = await read($, meterAtom)

    return {
      text:
        meter === null
          ? 'Contesto non ancora misurato: riprova dopo la prima risposta.'
          : `${statusMeter(meter.percent, meter.tokens, meter.window, levelOf(meter.percent, warn, strong), barStyle)}\nPer il dettaglio usa /peso.`,
    }
  })

  on('command.run', { command: 'contraddizioni' }, async $ => {
    await checkConflicts($, true).catch(() => 0)
    await refreshAdvice($).catch(() => undefined)
    const memory = (await read($, memoryAtom)) as SessionMemory
    const open = openConflicts(memory)
    const valid = memory.decisions.filter(decision => decision.status === 'valida')
    const superseded = memory.decisions.filter(decision => decision.status === 'superata')
    await $.ui.open({ id: PANE, title: 'Contesto' }).catch(() => undefined)

    return {
      text: [
        open.length === 0 ? 'Nessuna contraddizione aperta.' : `${open.length} contraddizioni da chiarire: scegli con i pulsanti sopra il prompt o nel pannello.`,
        ...open.map(conflict => `  ? [${conflict.topic}] «${conflict.older}» oppure «${conflict.newer}»`),
        valid.length > 0 ? `Decisioni valide (${valid.length}):` : '',
        ...valid.map(decision => `  ✓ [${decision.topic}] ${decision.text}`),
        superseded.length > 0 ? `Superate (${superseded.length}):` : '',
        ...superseded.map(decision => `  ✗ ${decision.text}${decision.replacedBy === undefined ? '' : ` → ${decision.replacedBy}`}`),
      ]
        .filter(line => line.length > 0)
        .join('\n'),
    }
  })

  on('command.run', { command: 'barra' }, async $ => {
    const isHidden = !(await read($, bandHiddenAtom))
    await update($, bandHiddenAtom, () => isHidden)

    return { text: isHidden ? 'Barra del contesto nascosta. /barra per mostrarla di nuovo.' : 'Barra del contesto visibile.' }
  })

  // Il motore non compatta dentro l'hook di un comando: si avvia subito dopo, e l'esito arriva come avviso.
  on('command.run', { command: 'alleggerisci' }, ($, e) => {
    startCompactionLater($, e.args.trim())

    return {
      text: view.isConflictCheck
        ? 'Compattazione avviata: prima controllo le contraddizioni (se ce ne sono te le chiedo), poi riassumo e verifico il riassunto.'
        : 'Compattazione avviata: il riassunto userà la struttura fissa e verrà verificato contro il registro del lavoro.',
    }
  })

  on('command.run', { command: 'claudemd' }, async $ => {
    const path = resolvePath(state.cwd, 'CLAUDE.md')
    const exists = path !== undefined && (await $.fs.exists(path).catch(() => false))
    const profile = state.profiles.length > 0 ? state.profiles.join(' + ') : 'generico'

    return {
      text: [
        `Profilo: ${profile}. CLAUDE.md breve consigliato (resta piccolo: viene letto a ogni sessione):`,
        '',
        claudeMdSnippet(state.profiles),
        '',
        exists
          ? 'Esiste già un CLAUDE.md: confrontalo e aggiungi solo le righe che mancano.'
          : 'Non c\'è un CLAUDE.md: copia il testo in un file CLAUDE.md alla radice del progetto.',
      ].join('\n'),
    }
  })

  on('command.run', { command: 'passaggio' }, async $ => ({ text: await handoff($) }))

  on('command.run', { command: 'peso' }, async $ => {
    const usage = await $.session.usage({ breakdown: 'summary' })
    const breakdown = usage.context.breakdown

    if (breakdown === undefined) {
      return { text: 'Misura non disponibile in questa sessione.' }
    }

    const used = breakdown.categories.filter(category => category.kind === 'used')
    const rows = topRows(used, 5)
    const memory = topRows(
      breakdown.memoryFiles.map(file => ({ name: file.path, tokens: file.tokens })),
      3,
    )
    const mcpTokens = breakdown.mcpTools.reduce((sum, tool) => sum + tool.tokens, 0)
    const tips = new Set(
      rows.map(row => adviceFor(row.name)).filter((tip): tip is string => tip !== undefined),
    )

    if (mcpTokens >= 5000) {
      tips.add('Strumenti MCP: disattiva i server che non usi in questo progetto.')
    }

    const laravelText =
      state.laravel === undefined ? '' : ` (Laravel ${state.laravel.major}.${state.laravel.minor}, struttura ${state.layout})`
    const profileText = (state.profiles.length > 0 ? state.profiles.join(' + ') : 'generico') + laravelText
    const langText =
      state.profiles.includes('langchain')
        ? ` (langchain ${state.lang.langchain === undefined ? '?' : `${state.lang.langchain.major}.${state.lang.langchain.minor}`}, langgraph ${state.lang.langgraph === undefined ? '?' : `${state.lang.langgraph.major}.${state.lang.langgraph.minor}`})`
        : ''
    const saved = await read($, savedAtom)
    const lines = [
      `Contesto ${meterBar(breakdown.percentage, 20, barStyle)} ${Math.round(breakdown.percentage)}% (${formatTokens(breakdown.totalTokens)}/${formatTokens(breakdown.rawMaxTokens)})`,
      `Profilo progetto: ${profileText}${langText}. Cartelle escluse: ${state.dirs.join(', ')}`,
      'Le voci più pesanti:',
      formatRows(rows),
    ]

    if (memory.length > 0) {
      lines.push('File di memoria più pesanti:', formatRows(memory))
    }
    if (mcpTokens > 0) {
      lines.push(`Strumenti MCP: ${formatTokens(mcpTokens)} in totale.`)
    }
    const memTokens = breakdown.mcpTools
      .filter(tool => /claude[-_]?mem/i.test(`${tool.serverName ?? ''} ${tool.name}`))
      .reduce((sum, tool) => sum + tool.tokens, 0)
    lines.push(...memWeightLines(state.mem, memTokens, formatTokens))
    const ledger = (await read($, ledgerAtom)) as Ledger
    if (!isEmpty(ledger)) {
      lines.push(
        `Registro del lavoro (protetto nelle compattazioni): ${ledger.files.length} file modificati, ${ledger.errors.length} errori aperti.`,
      )
    }
    if (tips.size > 0) {
      lines.push('Cosa fare:', ...[...tips].map(tip => `  - ${tip}`))
    }
    if (saved.compressions > 0) {
      lines.push(
        `Compressione output: ${saved.compressions} comandi, circa ${formatTokens(Math.round(saved.charsSaved / 4))} token risparmiati in questa sessione.`,
      )
    }
    lines.push('Altri rimedi: /alleggerisci (compatta), /passaggio (riepilogo per una sessione nuova), /contesto (pannello grafico).')

    return { text: lines.join('\n') }
  })

  // Dopo ogni compattazione riuscita della conversazione principale si azzerano gli avvisi.
  // Ogni compattazione della conversazione principale (anche /compact e quella automatica del motore)
  // riceve le istruzioni strutturate; a cose fatte il riassunto si verifica contro il registro.
  on('session.compact', async ($, e, next) => {
    const isMain = e.agentId === undefined
    const isOurs = (e.instructions ?? '').includes(COMPACT_MARK)

    // /compact scritto da te: anche qui prima si chiarisce. La compattazione automatica del motore
    // (contesto pieno) non si ferma mai: lì le contraddizioni aperte vanno nel riassunto come domande.
    if (isMain && !isOurs && e.trigger === 'manual' && view.isConflictCheck) {
      await checkConflicts($, true).catch(() => 0)
      const open = openConflicts((await read($, memoryAtom)) as SessionMemory)

      if (open.length > 0) {
        state.pendingCompaction = { extra: e.instructions ?? '' }
        await refreshAdvice($).catch(() => undefined)

        return {
          skip: `prima chiarisci ${open.length === 1 ? 'una contraddizione' : `${open.length} contraddizioni`} con i pulsanti sopra il prompt; poi compatto io.`,
        }
      }
    }

    // Il riassunto calcolato in anticipo non deve fissare domande che stai per chiarire: si rinuncia all'anticipo.
    if (isMain && e.trigger === 'precompute' && openConflicts((await read($, memoryAtom)) as SessionMemory).length > 0) {
      return { skip: 'contraddizioni da chiarire prima di riassumere' }
    }

    const input = isMain && !isOurs ? { ...e, instructions: await buildInstructions($, [e.instructions]) } : e
    const result = await next(input)

    if (result.skip === undefined && e.trigger !== 'precompute' && isMain) {
      azzeraStatoSprint()
      await resetAfterCompaction($)
      await measureNow($).catch(() => undefined)
      await refreshAdvice($).catch(() => undefined)

      // Le compattazioni del mod verificano da sé (anche dove questo hook non gira).
      if (!isOurs) {
        const check = await verifyCompaction($, result.messages).catch(() => undefined)

        if (check !== undefined) {
          $.ui.toast(check)
        }
      }
    }

    return result
  }).catch(($, e, next) => next(e))

  // ---- Barra di stato e avvisi ----

  on('session.measure', async ($, e, next) => {
    const { percent, tokens, window } = e.context

    if (percent !== undefined) {
      const level = levelOf(percent, warn, strong)
      await showMeter($, { percent, tokens, window, limit: busiestLimit(e.rateLimits) })

      // Con il consigliere attivo l'avviso è la proposta stessa, con i pulsanti; senza, il vecchio avviso.
      if (view.isProactive) {
        await refreshAdvice($).catch(() => undefined)
      } else if (level > state.shownLevel) {
        $.ui.toast(
          level === 2
            ? `Contesto al ${Math.round(percent)}%: conviene aprire una nuova sessione.${hint}`
            : `Contesto al ${Math.round(percent)}%: la sessione si sta allungando.${hint}`,
        )
      }

      // Riserva: se il contesto torna sotto la soglia (compattazione, /clear), gli avvisi ripartono.
      if (level === 0) {
        state.hasAutoCompacted = false
      }

      state.shownLevel = level
    }

    return next(e)
  })

  // A fine turno, a sessione ferma: avviso sui turni e compattazione automatica.
  on('turn.complete', async ($, e, next) => {
    const result = await fineTurnoSprint($, e, next)

    // I turni dei subagenti non sono "fine turno" della conversazione: lì non si compatta né si avvisa.
    if (e.agentId !== undefined) {
      return result
    }

    state.isTurnRunning = false

    const turns = (await $.session.turns().catch(() => state.turnsAtReset)) - state.turnsAtReset

    if (!view.isProactive && turns >= maxTurns && !state.hasWarnedTurns) {
      state.hasWarnedTurns = true
      $.ui.toast(`Sessione lunga: ${turns} turni. Se cambi argomento, apri una nuova sessione.${hint}`)
    }

    // Compattazione chiesta con un pulsante mentre il modello lavorava.
    if (state.isCompactPending && !state.isCompacting) {
      state.isCompactPending = false
      void startCompaction($, '')
        .then(text => $.ui.toast(text))
        .catch(error => $.ui.toast(`Compattazione non riuscita: ${String(error)}`))
    }

    // Peso degli strumenti MCP: misurato ogni 5 turni (la misura non costa token).
    if (view.isProactive && (state.mcpTokens === undefined || turns % 5 === 0)) {
      const usage = await $.session.usage({ breakdown: 'summary' }).catch(() => undefined)
      state.mcpTokens = usage?.context.breakdown?.mcpTools.reduce((sum, tool) => sum + tool.tokens, 0)
    }

    await refreshAdvice($).catch(() => undefined)

    // Contraddizioni: controllo in background, senza rallentare la sessione.
    if (!state.isCompacting) {
      checkConflictsLater($)
    }

    if (autoPercent > 0 && !state.isCompacting) {
      const percent = (await $.session.usage().catch(() => undefined))?.context.percent ?? 0

      if (shouldAutoCompact(percent, autoPercent, state.hasAutoCompacted)) {
        state.hasAutoCompacted = true
        $.ui.toast(`Contesto al ${Math.round(percent)}%: compatto la sessione.`)
        void startCompaction($, '')
          .then(text => $.ui.toast(text))
          .catch(error => $.ui.toast(`Compattazione automatica non riuscita: ${String(error)}`))
      }
    }

    return result
  }).catch(($, e, next) => (next.called ? next(e) : fineTurnoSprint($, e, next)))

  // ---- File grandi e cartelle escluse ----

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const args = e as unknown as Record<string, unknown>
    const path = String(args.file_path ?? '')
    const dir = blockedDirIn(path, state.dirs)
    // Le opzioni di claude-mem si possono leggere (e quindi modificare): il resto della cartella no.
    const isImpostazioniMem = dir === '.claude-mem' && /\.claude-mem[\\/]settings\.json$/i.test(path)

    if (dir !== undefined && !isImpostazioniMem) {
      return { deny: blockedMessage(dir) }
    }

    if (isProtectingSecrets && isSecretFile(path)) {
      return { deny: `${NAME}: ${SECRET_REMEDY}` }
    }

    // Conta solo limit: offset da solo legge comunque tutto il resto del file.
    if (typeof args.limit === 'number' || !isSizeChecked(path)) {
      return next(e)
    }

    const size = await sizeOf($, path)

    if (size === undefined) {
      return next(e)
    }

    // File pesanti per tipo (log, lock, generati, dati): soglia bassa e rimedio preciso.
    const kind = heavyKindOf(path)

    if (kind !== undefined && size > heavyBytes) {
      return {
        deny: `${NAME}: ${Math.round(size / 1024)} KB da non leggere per intero. ${heavyRemedy(kind, path)}`,
      }
    }

    if (size <= maxBytes) {
      return next(e)
    }

    const kb = Math.round(size / 1024)

    if (isBlocking) {
      return {
        deny:
          `${NAME}: il file pesa ${kb} KB (limite ${Math.round(maxBytes / 1024)} KB). ` +
          (outlineRemedy(state.mem, path) ?? `Cerca prima con Grep la parte che serve, poi leggila con offset e limit.`),
      }
    }

    $.ui.toast(`File grande (${kb} KB): consuma molto contesto.`)

    return next(e)
  }).catch(($, e, next) => next(e))

  // Un'espressione regolare: funziona anche dove uno dei due strumenti non esiste.
  on('tool.call', { tool: /^(Glob|Grep)$/ }, ($, e, next) => {
    const args = e as unknown as Record<string, unknown>
    // Per Grep "pattern" è il testo cercato, non un percorso: cercare la parola "build" non è entrare in build/.
    const isGlob = String((e as unknown as { tool?: string }).tool ?? '') === 'Glob'
    const targets = (isGlob ? [args.path, args.pattern] : [args.path, args.glob]).map(value => String(value ?? ''))
    const dir = targets.map(target => blockedDirIn(target, state.dirs)).find(found => found !== undefined)

    if (dir !== undefined) {
      return { deny: blockedMessage(dir) }
    }

    // Grep dentro .env o con glob ".env*" stampa i valori: stessa protezione di Read.
    if (!isGlob && isProtectingSecrets && [args.path, args.glob].some(value => isSecretTarget(String(value ?? '')))) {
      return { deny: `${NAME}: ${SECRET_REMEDY}` }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Registro del lavoro: i file modificati con successo.
  on('tool.call', { tool: /^(Edit|Write|MultiEdit|NotebookEdit)$/ }, async ($, e, next) => {
    // Prima le regole del piano e della memoria di progetto (possono rifiutare), poi il registro.
    const ran = await scritturaSprint($, e, next)
    const args = e as unknown as Record<string, unknown>
    const path = String(args.file_path ?? args.notebook_path ?? '')

    if (ran.deny === undefined && ran.isError !== true && path.length > 0) {
      await update($, ledgerAtom, ledger => addFile(ledger as Ledger, relativeTo(state.cwd, path))).catch(() => undefined)
    }

    return ran
  }).catch(($, e, next) => (next.called ? next(e) : scritturaSprint($, e, next)))

  // claude-mem: troppe osservazioni intere in una volta. Suggerimento al primo tentativo, poi passa.
  on('tool.call', { tool: /get_observations$/ }, ($, e, next) => {
    const args = e as unknown as Record<string, unknown>
    const hint = state.mem.isActive && hasStackHints ? observationsHint(args) : undefined
    const key = `mem:${JSON.stringify(args.ids ?? '')}`

    if (hint === undefined || state.hintsShown.has(key)) {
      return next(e)
    }

    state.hintsShown.add(key)

    return { deny: `${NAME}: ${hint} Ripeti la stessa richiesta solo se servono davvero tutte.` }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const args = e as unknown as Record<string, unknown>
    const command = String(args.command ?? '')
    // Prima le regole del piano: niente scritture da terminale su piano, fonti e memoria del progetto.
    const bloccoPiano = await bloccoBashSprint($, command).catch(() => undefined)

    if (bloccoPiano !== undefined) {
      return { deny: bloccoPiano }
    }

    const dir = blockedDirInCommand(command, state.dirs)

    if (dir !== undefined) {
      return { deny: blockedMessage(dir) }
    }

    // Credenziali lette da terminale (cat, head, tail, grep, sed, Get-Content …), anche dentro una catena.
    const secret = isProtectingSecrets ? secretFileInCommand(command) : undefined

    if (secret !== undefined) {
      return { deny: `${NAME}: "${secret}" ${SECRET_REMEDY.charAt(0).toLowerCase()}${SECRET_REMEDY.slice(1)}` }
    }

    // cat di un log o di un lock: stessa regola dei file pesanti.
    for (const file of dumpedFiles(command)) {
      if (isProtectingSecrets && isSecretFile(file)) {
        return { deny: `${NAME}: ${SECRET_REMEDY}` }
      }

      const kind = heavyKindOf(file)
      const path = kind === undefined ? undefined : resolvePath(state.cwd, file)
      const size = path === undefined ? undefined : await sizeOf($, path)

      if (kind !== undefined && size !== undefined && size > heavyBytes) {
        return {
          deny: `${NAME}: "${file}" pesa ${Math.round(size / 1024)} KB, non stamparlo per intero. ${heavyRemedy(kind, file)}`,
        }
      }
    }

    // Elenchi enormi (route:list, composer show, npm ls): suggerimento al primo tentativo.
    const stackHint = hasStackHints ? stackHintFor(command, routeListAdvice(state.laravel)) : undefined

    if (stackHint !== undefined && !state.hintsShown.has(stackHint.key)) {
      state.hintsShown.add(stackHint.key)

      return {
        deny:
          `${NAME}: ${stackHint.message} Usa la versione filtrata. ` +
          `Ripeti il comando identico solo se l'utente ha chiesto esplicitamente l'elenco completo: in quel caso passerà.`,
      }
    }

    // pytest senza opzioni di verbosità: meno output sui test che passano.
    // CC_RAW=1 chiede l'output originale: niente opzioni aggiunte a pytest.
    const quiet = hasQuietTests && !RAW_MARKER.test(command) ? quietPytest(command) : undefined

    const ran = await next(quiet === undefined ? e : ({ ...e, command: quiet } as typeof e))

    if (ran.deny !== undefined) {
      return ran
    }

    // Registro del lavoro: un fallimento resta aperto finché lo stesso comando non riesce.
    const record = ran.result as unknown as Record<string, unknown> | undefined
    const fullText = ran.isError === true ? (ran.text ?? '') : `${String(record?.stdout ?? '')}\n${String(record?.stderr ?? '')}`
    // Un fallimento senza una riga d'errore riconoscibile resta comunque un fallimento.
    const errorLine =
      ran.isError === true
        ? (firstErrorLine(fullText) ?? fullText.split('\n').map(line => line.trim()).find(line => line.length > 0) ?? 'comando fallito')
        : undefined
    await update($, ledgerAtom, ledger =>
      errorLine !== undefined ? addFailure(ledger as Ledger, command, errorLine) : resolveCommand(ledger as Ledger, command),
    ).catch(() => undefined)

    // Livello: dal comando; più leggero se lo stesso comando era già stato compresso.
    const key = commandKey(command)
    const repeats = state.compressedCommands.get(key) ?? 0
    const wanted: CompressLevel = isCompressing ? levelFor(command) : 'none'
    const level: CompressLevel = repeats >= 2 ? 'none' : repeats === 1 && wanted === 'full' ? 'light' : wanted

    if (level === 'none') {
      return ran
    }

    // Budget adattivo: con il contesto pieno si concedono meno righe.
    const meter = await read($, meterAtom)
    const budget = budgetFor(meter?.percent, compressMinChars)

    // Comando fallito: il testo d'errore compresso arriva al modello come risultato trattenuto.
    if (ran.isError === true) {
      const failed = compressOutput(ran.text ?? '', level, budget.minChars, budget.maxLines)

      if (!failed.isChanged) {
        return ran
      }

      state.compressedCommands.set(key, repeats + 1)
      await addSaved($, failed.charsSaved)
      const rawPath = await saveRaw($, ran.text ?? '')

      return { deny: `${compressionHeader(failed, rawPath)}\n${failed.text}` }
    }

    // Output speciali (immagini, comandi in background, output già salvato su file): non si toccano.
    if (
      record === undefined ||
      record.isImage === true ||
      record.backgroundTaskId !== undefined ||
      record.persistedOutputPath !== undefined ||
      typeof record.stdout !== 'string'
    ) {
      return ran
    }

    const out = compressOutput(record.stdout, level, budget.minChars, budget.maxLines)
    const err = compressOutput(String(record.stderr ?? ''), level, budget.minChars, budget.maxLines)

    if (!out.isChanged && !err.isChanged) {
      return ran
    }

    state.compressedCommands.set(key, repeats + 1)
    await addSaved($, out.charsSaved + err.charsSaved)

    const rawPath = await saveRaw($, `${record.stdout}${record.stderr ? `\n--- stderr ---\n${String(record.stderr)}` : ''}`)
    const header = compressionHeader(out.isChanged ? out : err, rawPath)

    return {
      result: {
        ...record,
        stdout: out.isChanged ? `${header}\n${out.text}` : record.stdout,
        stderr: err.isChanged ? (out.isChanged ? err.text : `${header}\n${err.text}`) : record.stderr,
      },
    } as unknown as typeof ran
  }).catch(($, e, next) => next(e))

  // Guida breve per Laravel nel prompt di sistema: pochi token, nella cache, al posto di tante esplorazioni.
  on('prompt.compose', async ($, e, next) => {
    const composed = await componiSprint($, e, next)

    // Il prompt può essere composto prima di session.start: in quel caso si riconosce il progetto qui.
    if (hasProjectGuide && state.cwd === '') {
      const cwd = await $.session.cwd().catch(() => '')
      await detectProject($, cwd, forcedProfile, baseDirs).catch(() => undefined)
    }

    if (hasProjectGuide && !state.mem.isActive && !state.isMemComposeChecked) {
      state.isMemComposeChecked = true
      await detectMem($).catch(() => undefined)
    }

    const guides = hasProjectGuide ? projectGuides() : []

    if (guides.length === 0) {
      return composed
    }

    state.isGuideInSystem = true

    return {
      sections: [...composed.sections, ...guides.map(guide => ({ ...guide, scope: 'session' as const }))],
    }
  }).catch(($, e, next) => (next.called ? next(e) : componiSprint($, e, next)))

  // Riserva: dove il prompt di sistema non si può modificare (ambienti gestiti),
  // la guida arriva una volta sola come nota al primo messaggio della sessione.
  // Ogni messaggio: registro delle richieste, nota di continuità dopo una compattazione, guida di riserva.
  on('prompt.submit', async ($, e, next) => {
    // I messaggi che il mod stesso invia (analisi, esecuzione, risposte dal pannello) non sono richieste tue:
    // non entrano nel registro ne nel controllo delle contraddizioni.
    const origin = e.origin as { kind?: string; asUser?: boolean } | undefined
    const isFromPlugin = origin?.kind === 'plugin' && origin.asUser !== true
    const isPerson = e.isMeta !== true && e.command === undefined && !isFromPlugin

    if (e.command === undefined) {
      state.isTurnRunning = true
    }

    // Il registro tiene solo le richieste scritte da te, non i comandi né i messaggi del sistema o del mod.
    if (isPerson && !isModPrompt(e.text)) {
      await update($, ledgerAtom, ledger => addRequest(ledger as Ledger, e.text)).catch(() => undefined)
      await update($, memoryAtom, memory => addToHistory(memory as SessionMemory, e.text)).catch(() => undefined)
    }

    const extra: string[] = []

    // Le scelte che hai fatto sulle contraddizioni arrivano al modello con il tuo messaggio.
    if (isPerson) {
      const [notes, rest] = takePending((await read($, memoryAtom)) as SessionMemory)

      if (notes.length > 0) {
        extra.push(...notes)
        await update($, memoryAtom, () => rest).catch(() => undefined)
      }
    }

    // La nota di continuità va con un tuo messaggio, non con uno del sistema.
    if (state.recovery !== undefined && isPerson) {
      extra.push(state.recovery)
      state.recovery = undefined
    }

    const withExtra = (input: typeof e): typeof e =>
      extra.length === 0 ? input : { ...input, context: [...(input.context ?? []), ...extra] }

    // Gli strumenti MCP di claude-mem possono collegarsi dopo l'avvio: si ricontrolla una volta.
    if (!state.isMemChecked) {
      state.isMemChecked = true
      await detectMem($).catch(() => undefined)
      state.isMemChecked = true
    }

    if (!hasProjectGuide || state.isGuideInSystem || state.isGuideSent) {
      return inviaSprint($, withExtra(e), next)
    }
    if (state.cwd === '') {
      // Protetto: un errore qui non deve far perdere la nota di continuità.
      const cwd = await $.session.cwd().catch(() => '')
      await detectProject($, cwd, forcedProfile, baseDirs).catch(() => undefined)
    }
    const guides = projectGuides()

    if (guides.length === 0) {
      return inviaSprint($, withExtra(e), next)
    }

    state.isGuideSent = true

    return inviaSprint($, withExtra({ ...e, context: [...(e.context ?? []), ...guides.map(guide => guide.text)] }), next)
  }).catch(($, e, next) => (next.called ? next(e) : inviaSprint($, e, next)))

  // ---- Indicatore grafico: banda sopra il prompt ----

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const meter = await read($, meterAtom)
    const isHidden = e.props.hasSurvey || (await read($, bandHiddenAtom))
    const pianoBanda = isHidden ? undefined : await read($, pianoA).catch(() => undefined)
    const attesaBanda = pianoBanda === undefined ? [] : await read($, attesaA)
    const erroreBanda = pianoBanda === null ? await read($, erroreA) : ''
    const colonne = e.props.bodyColumns ?? 80

    // Barra spenta o non ancora misurata: resta la sola parte del piano.
    if (!hasBand || isHidden || meter === null) {
      if (pianoBanda === undefined) {
        return next(e)
      }
      return BandaSprint($, $.ui.resolve(e), pianoBanda, attesaBanda, colonne, erroreBanda, e.props.isWorking === true)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const level = levelOf(meter.percent, warn, strong)
    const saved = await read($, savedAtom)
    const width = Math.max(10, Math.min(30, (e.props.bodyColumns ?? 80) - 60))
    const savedText = saved.charsSaved >= 4000 ? ` · risparmiati ~${formatTokens(Math.round(saved.charsSaved / 4))}` : ''
    const limitText = meter.limit === undefined ? '' : ` · ${limitLabel(meter.limit.kind)} ${Math.round(meter.limit.percentUsed)}%`
    const memText = state.mem.isActive ? ' · claude-mem' : ''
    const proposal = (await read($, proposalsAtom))[0] as Proposal | undefined
    const isWorking = e.props.isWorking

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text dimColor>Contesto</Text>
          <Text color={meterColor(level)} mono>{meterBar(meter.percent, width, barStyle)}</Text>
          <Text color={meterColor(level)} bold>{`${Math.round(meter.percent)}%`}</Text>
          <Text dimColor>{`${tokenDetail(meter.tokens, meter.window)}${savedText}${limitText}${memText}`}</Text>
          <Button key="dettagli" label="Dettagli" onPress={async () => { await $.ui.open({ id: PANE, title: 'Contesto' }) }} />
        </Box>
        {pianoBanda !== undefined && BandaSprint($, { Box, Button, Text }, pianoBanda, attesaBanda, colonne, erroreBanda, e.props.isWorking === true)}
        {proposal !== undefined && (
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            <Text color={severityColor(proposal.severity)} bold>{`${severityMark(proposal.severity)} ${proposal.text}`}</Text>
            {proposal.actions.map((action, index) => (
              <Button
                key={`proposta-${action}`}
                label={action === 'compact' && isWorking ? 'Compatta a fine turno' : ACTION_LABELS[action]}
                hotkey={String(index + 1)}
                variant={index === 0 ? 'primary' : 'secondary'}
                onPress={() => runAction($, action, proposal, isWorking)}
              />
            ))}
          </Box>
        )}
      </Box>
    )
  })

  // ---- Indicatore grafico: pannello /contesto con le voci ----

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const meter = await read($, meterAtom)
    const saved = await read($, savedAtom)
    const ledger = (await read($, ledgerAtom)) as Ledger
    const proposals = (await read($, proposalsAtom)) as Proposal[]
    const memory = (await read($, memoryAtom)) as SessionMemory

    if (meter === null) {
      return <Text dimColor>Contesto non ancora misurato.</Text>
    }

    const level = levelOf(meter.percent, warn, strong)
    const usage = await $.session.usage({ breakdown: 'summary' }).catch(() => undefined)
    const breakdown = usage?.context.breakdown
    const rows = breakdown === undefined
      ? []
      : topRows(breakdown.categories.filter(category => category.kind === 'used'), 8)
    const nameWidth = Math.max(12, Math.min(28, (e.props.bodyColumns ?? 60) - 32))

    return (
      <Box flexDirection="column">
        <Text color={meterColor(level)} bold mono>
          {`${meterBar(meter.percent, 24, barStyle)} ${Math.round(meter.percent)}% · ${levelWord(level)}`}
        </Text>
        <Text dimColor>{tokenDetail(meter.tokens, meter.window)}</Text>
        {meter.limit !== undefined && (
          <Text dimColor mono>
            {`${limitLabel(meter.limit.kind)}: ${meterBar(meter.limit.percentUsed, 12, barStyle)} ${Math.round(meter.limit.percentUsed)}%`}
          </Text>
        )}
        {rows.length > 0 && <Text bold>Cosa occupa il contesto</Text>}
        {rows.map(row => (
          <Text key={row.name} mono>{categoryLine(row.name, row.tokens, meter.window, nameWidth, barStyle)}</Text>
        ))}
        {ledger.files.length + ledger.errors.length > 0 && (
          <Text dimColor>{`Registro protetto: ${ledger.files.length} file modificati, ${ledger.errors.length} errori aperti`}</Text>
        )}
        {ledger.errors.map(item => (
          <Text key={`err-${item.command}`} color="error">{`✗ ${item.command}: ${item.line}`}</Text>
        ))}
        {memory.decisions.length > 0 && <Text bold>Memoria della sessione</Text>}
        {memory.decisions.map(decision => (
          <Text
            key={`d-${decision.text}`}
            color={decision.status === 'valida' ? 'success' : undefined}
            dimColor={decision.status === 'superata'}
            strikethrough={decision.status === 'superata'}
          >
            {`${decision.status === 'valida' ? '✓' : '✗'} [${decision.topic}] ${decision.text}`}
          </Text>
        ))}
        {proposals.length > 0 && <Text bold>Suggerimenti</Text>}
        {proposals.map(proposal => (
          <Box key={`s-${proposal.ref ?? proposal.id}`} flexDirection="row" gap={1} flexWrap="wrap">
            <Text color={severityColor(proposal.severity)}>{`${severityMark(proposal.severity)} ${proposal.text}`}</Text>
            {proposal.actions
              .filter(action => action !== 'details')
              .map(action => (
                <Button
                  key={`p-${proposal.ref ?? proposal.id}-${action}`}
                  label={ACTION_LABELS[action]}
                  onPress={() => runAction($, action, proposal)}
                />
              ))}
          </Box>
        ))}
        {saved.compressions > 0 && (
          <Text dimColor>
            {`Compressione: ${saved.compressions} comandi, ~${formatTokens(Math.round(saved.charsSaved / 4))} token risparmiati`}
          </Text>
        )}
        <Text dimColor>{`Profilo: ${state.profiles.length > 0 ? state.profiles.join(' + ') : 'generico'}${state.mem.isActive ? ' · claude-mem attivo' : ''} · /peso per i consigli`}</Text>
      </Box>
    )
  })

  }
}
