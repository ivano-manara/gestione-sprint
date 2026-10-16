// Controlli di qualita del piano, con pratiche di project management:
// definition of ready / done, INVEST, dipendenze, tracciabilita, rischi, ipotesi.

import type { Piano, Task } from '../../types'
import { bloccantiPer, copertura, ipotesiDaConfermare, velocita, voce } from './logic'

const velocitaMedia = (piano: Piano): number => velocita(piano).media

export type Problema = { livello: 'critico' | 'avviso'; id: string; testo: string }

const VAGO = /\b(funzion\w*|corrett\w*|bene|ottimizzat\w*|veloce|intuitiv\w*|robust\w*|adeguat\w*|user.?friendly|ok|semplice|pulit\w*)\b/i
const MISURABILE = /\d|test|comando|restituisce|risponde|mostra|visualizz|errore|log|esporta|salva|crea|status|query|campo|pulsante|messaggio|tabella|file|entro|almeno|massimo/i
const VERIFICA = /verific|collaud|test|review|revisione|demo|rilascio|chiusura|accettazione/i

/** Un criterio e vago se usa parole di giudizio senza nulla di misurabile. */
export const isVago = (criterio: string): boolean => VAGO.test(criterio) && !MISURABILE.test(criterio)

/**
 * Task che stanno in un ciclo di dipendenze. Visita in profondita con i tre colori:
 * ogni task si visita una volta sola (prima il tempo cresceva in modo esponenziale con le dipendenze).
 */
export const cicli = (piano: Piano): string[] => {
  const dip = new Map(piano.sprint.flatMap(s => s.task).map(t => [t.id, t.dipendeDa]))
  const colore = new Map<string, 'grigio' | 'nero'>()
  const inCiclo = new Set<string>()
  const pila: string[] = []
  const visita = (id: string): void => {
    const c = colore.get(id)
    if (c === 'nero') return
    if (c === 'grigio') {
      pila.slice(pila.indexOf(id)).forEach(x => inCiclo.add(x))
      return
    }
    colore.set(id, 'grigio')
    pila.push(id)
    for (const d of dip.get(id) ?? []) if (dip.has(d)) visita(d)
    pila.pop()
    colore.set(id, 'nero')
  }
  for (const id of dip.keys()) visita(id)
  return [...inCiclo]
}

const normale = (t: string): string => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export const controlliQualita = (piano: Piano): Problema[] => {
  const out: Problema[] = []
  const tutti = piano.sprint.flatMap((s, i) => s.task.map(t => ({ t, s, i })))
  const posizione = new Map(tutti.map(x => [x.t.id, x.i]))
  const esigenze = new Set(piano.business.flatMap(f => f.esigenze).map(e => e.id))
  const superate = new Set(piano.business.flatMap(f => f.esigenze).filter(e => e.stato === 'superata').map(e => e.id))
  const statoDi = new Map(tutti.map(x => [x.t.id, x.t.stato]))

  for (const { t, s, i } of tutti) {
    if (t.stato === 'annullato') continue
    if (!t.criteri.length) out.push({ livello: 'critico', id: t.id, testo: 'nessun criterio di accettazione (definition of ready)' })
    const vaghi = t.criteri.filter(isVago)
    if (vaghi.length) out.push({ livello: 'avviso', id: t.id, testo: `criteri non verificabili: "${vaghi[0]}"` })
    if (t.stima === undefined) out.push({ livello: 'avviso', id: t.id, testo: 'senza stima' })
    else if (t.stima >= 8) out.push({ livello: 'avviso', id: t.id, testo: `stima ${t.stima}: troppo grande, spezzalo (INVEST)` })
    for (const d of t.dipendeDa) {
      const pd = posizione.get(d)
      if (pd === undefined) out.push({ livello: 'critico', id: t.id, testo: `dipende da ${d} che non esiste` })
      else if (pd > i) out.push({ livello: 'critico', id: t.id, testo: `dipende da ${d} di uno sprint successivo: ordine sbagliato` })
      else if (statoDi.get(d) === 'annullato' && t.stato !== 'completato') out.push({ livello: 'critico', id: t.id, testo: `dipende da ${d}, che e stato annullato: togli la dipendenza o ripianifica` })
    }
    if (t.stato === 'completato') {
      const prima = t.dipendeDa.filter(d => statoDi.get(d) !== 'completato' && statoDi.get(d) !== 'annullato')
      if (prima.length) out.push({ livello: 'avviso', id: t.id, testo: `completato prima delle sue dipendenze (${prima.join(', ')}): verifica che regga` })
      if (!t.note?.trim()) out.push({ livello: 'avviso', id: t.id, testo: 'completato senza la prova della verifica nella nota' })
    }
    if (t.daRivedere) out.push({ livello: 'critico', id: t.id, testo: `da rivedere: ${t.daRivedere}` })
    for (const v of t.vincoli) {
      if (!voce(piano, v)) out.push({ livello: 'critico', id: t.id, testo: `si basa su ${v}, superata o inesistente` })
    }
    for (const r of t.requisiti) {
      if (!esigenze.has(r)) out.push({ livello: 'avviso', id: t.id, testo: `requisito ${r} inesistente` })
      else if (superate.has(r) && t.stato !== 'completato') out.push({ livello: 'avviso', id: t.id, testo: `copre ${r}, esigenza superata: serve ancora?` })
    }
    void s
  }
  for (const id of cicli(piano)) out.push({ livello: 'critico', id, testo: 'dipendenze circolari' })

  const vel = velocitaMedia(piano)
  let apertoPrima: string | undefined
  for (const s of piano.sprint) {
    if (s.stato === 'annullato') continue
    const vivi = s.task.filter(t => t.stato !== 'annullato')
    if (!s.obiettivo) out.push({ livello: 'avviso', id: s.id, testo: 'sprint senza obiettivo' })
    else if (isVago(s.obiettivo)) out.push({ livello: 'avviso', id: s.id, testo: `obiettivo non verificabile: "${s.obiettivo}"` })
    // Lavoro in corso: troppi task aperti insieme fanno perdere il filo e mescolano le modifiche.
    const inCorso = vivi.filter(t => t.stato === 'in-corso').length
    if (inCorso > 2) out.push({ livello: 'avviso', id: s.id, testo: `${inCorso} task in corso insieme: chiudine qualcuno prima di aprirne altri` })
    // Ordine degli sprint: uno nuovo non parte con quello prima ancora aperto.
    const isAvviato = vivi.some(t => t.stato === 'in-corso' || t.stato === 'completato')
    if (isAvviato && apertoPrima) out.push({ livello: 'avviso', id: s.id, testo: `avviato con ${apertoPrima} non ancora completato` })
    if (s.stato !== 'completato' && !apertoPrima) apertoPrima = s.id
    // Carico: punti dello sprint rispetto alla velocita misurata sugli sprint chiusi.
    const punti = vivi.filter(t => t.stato !== 'completato').reduce((n, t) => n + (t.stima ?? 1), 0)
    if (vel > 0 && s.stato !== 'completato' && punti > vel * 1.5) {
      out.push({ livello: 'avviso', id: s.id, testo: `${punti} punti da fare contro una velocita di ${vel}: sprint sovraccarico, sposta qualcosa` })
    }
    if (vivi.length > 8) out.push({ livello: 'avviso', id: s.id, testo: `${vivi.length} task: sprint troppo grande` })
    const ultimo = vivi.at(-1)
    if (ultimo && !VERIFICA.test(ultimo.titolo)) out.push({ livello: 'avviso', id: s.id, testo: 'manca il task finale di verifica dello sprint' })
  }

  for (const s of piano.sprint.filter(x => x.stato === 'completato' && !x.chiusura)) {
    out.push({ livello: 'avviso', id: s.id, testo: 'sprint completato senza revisione e retrospettiva' })
  }

  const vivi = piano.sprint.filter(s => s.stato !== 'annullato')
  const ultimo = vivi.at(-1)
  for (const c of copertura(piano)) {
    if (!c.task.length) {
      out.push({ livello: c.esigenza.priorita === 'alta' ? 'critico' : 'avviso', id: c.esigenza.id, testo: `esigenza ${c.esigenza.priorita} non coperta da nessun task` })
    } else if (c.esigenza.priorita === 'alta' && vivi.length >= 3 && ultimo && c.task.every(id => ultimo.task.some(t => t.id === id))) {
      // Le must vanno presto: lasciate all'ultimo sprint diventano il rischio piu grande.
      out.push({ livello: 'avviso', id: c.esigenza.id, testo: `esigenza alta coperta solo nell'ultimo sprint (${ultimo.id}): anticiparla riduce il rischio` })
    }
  }
  for (const f of piano.business.filter(x => x.stato === 'da-analizzare')) {
    out.push({ livello: 'avviso', id: f.id, testo: 'fonte di business non ancora analizzata' })
  }
  for (const m of piano.memoria.filter(x => x.stato === 'da-verificare')) {
    out.push({ livello: 'critico', id: m.id, testo: 'memoria cambiata fuori dal piano: da verificare' })
  }
  // Senza la riga originale il mod non si accorge se il file di memoria cambia.
  const senzaEstratto = piano.memoria.filter(x => x.stato === 'valida' && !x.estratto && /:\d+/.test(x.fonte) && !/claude-mem/i.test(x.fonte)).map(x => x.id)
  if (senzaEstratto.length) {
    out.push({ livello: 'avviso', id: senzaEstratto.slice(0, 4).join(','), testo: `${senzaEstratto.length} voci di memoria senza estratto: non si vede se il file cambia` })
  }
  for (const r of piano.rischi.filter(x => x.stato === 'aperto')) {
    const grave = r.probabilita === 'alta' || r.impatto === 'alto'
    if (grave && !r.mitigazione) out.push({ livello: 'critico', id: r.id, testo: 'rischio grave senza mitigazione' })
    else if (grave && !r.task) out.push({ livello: 'avviso', id: r.id, testo: 'rischio grave senza task di mitigazione' })
    if (r.task && !statoDi.has(r.task)) out.push({ livello: 'avviso', id: r.id, testo: `mitigazione affidata a ${r.task}, che non esiste` })
  }
  const aperte = piano.domande.filter(x => x.stato === 'aperta' || x.stato === 'in-conflitto')
  for (const d of aperte.filter(x => x.stato === 'aperta' && x.bloccante && x.opzioni.length < 2 && x.autore === 'claude')) {
    out.push({ livello: 'avviso', id: d.id, testo: 'domanda bloccante senza opzioni: piu lenta da decidere' })
  }
  for (const d of aperte.filter(x => x.bloccante && !x.task && !x.sprint && x.autore === 'claude')) {
    out.push({ livello: 'avviso', id: d.id, testo: 'domanda bloccante senza sprint o task: non si sa cosa blocca' })
  }
  const viste = new Map<string, string>()
  for (const d of aperte) {
    const k = normale(d.testo)
    const gia = viste.get(k)
    if (gia) out.push({ livello: 'avviso', id: d.id, testo: `uguale a ${gia}: una delle due va chiusa come superata` })
    else viste.set(k, d.id)
  }
  const ip = ipotesiDaConfermare(piano)
  if (ip.length) out.push({ livello: 'avviso', id: ip.map(x => x.id).slice(0, 3).join(','), testo: `${ip.length} ipotesi di Claude da confermare` })
  if (!piano.memoria.length && piano.progetto.fonti.length) {
    out.push({ livello: 'avviso', id: 'memoria', testo: 'file letti ma nessuna voce di memoria registrata' })
  }
  return out.sort((a, b) => (a.livello === b.livello ? 0 : a.livello === 'critico' ? -1 : 1))
}

export const punteggio = (problemi: readonly Problema[]): number =>
  Math.max(0, 100 - problemi.reduce((n, p) => n + (p.livello === 'critico' ? 10 : 3), 0))

export type VoceDor = { ok: boolean; testo: string; isCritica: boolean }

/** Definition of ready di un task: cosa serve per poterlo iniziare in autonomia. */
export const prontezza = (piano: Piano, t: Task): { isPronto: boolean; voci: VoceDor[] } => {
  const s = piano.sprint.find(x => x.task.some(y => y.id === t.id))
  const fatti = new Set(piano.sprint.flatMap(x => x.task).filter(x => x.stato === 'completato').map(x => x.id))
  const blocchi = bloccantiPer(piano, s?.id, t.id)
  const vincoliRotti = t.vincoli.filter(v => !voce(piano, v))
  const voci: VoceDor[] = [
    { ok: t.criteri.length > 0, testo: 'criteri di accettazione', isCritica: true },
    { ok: !t.criteri.some(isVago), testo: 'criteri verificabili', isCritica: false },
    { ok: blocchi.length === 0, testo: blocchi.length ? `domande aperte: ${blocchi.map(d => `${d.id}${d.stato === 'in-conflitto' ? ' (conflitto con la memoria)' : ''}`).join(', ')}` : 'nessuna domanda bloccante', isCritica: true },
    { ok: t.dipendeDa.every(d => fatti.has(d)), testo: 'dipendenze completate', isCritica: true },
    { ok: !t.daRivedere, testo: t.daRivedere ? `da rivedere: ${t.daRivedere}` : 'coerente con la memoria', isCritica: true },
    { ok: vincoliRotti.length === 0, testo: vincoliRotti.length ? `vincoli superati: ${vincoliRotti.join(', ')}` : 'vincoli validi', isCritica: true },
    { ok: t.stima !== undefined && t.stima < 8, testo: t.stima === undefined ? 'stima' : `stima ${t.stima}`, isCritica: false },
  ]
  return { isPronto: voci.every(v => v.ok || !v.isCritica), voci }
}

export const vistaQualita = (piano: Piano): string => {
  const pr = controlliQualita(piano)
  if (!pr.length) return 'qualita 100: nessun problema.'
  return [`qualita ${punteggio(pr)}/100, ${pr.filter(p => p.livello === 'critico').length} critici:`, ...pr.slice(0, 40).map(p => `- [${p.livello}] ${p.id}: ${p.testo}`)].join('\n')
}
