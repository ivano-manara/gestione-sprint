// Consigliere proattivo: guarda la sessione e propone l'azione giusta, con i pulsanti pronti.
// Solo funzioni pure: le regole ricevono i segnali e restituiscono le proposte.
//
// Principi:
// - una proposta alla volta nella banda (la più urgente), tutte nel pannello /contesto;
// - "Più tardi" non zittisce per sempre: la proposta torna se la situazione peggiora;
// - nessuna azione parte da sola: compattare, ripartire o creare file lo decidi tu con un clic.

export type Severity = 'info' | 'warn' | 'critical'

export type ActionId =
  | 'compact' | 'handoff' | 'details' | 'claudemd' | 'snooze' | 'mute'
  // Contraddizioni nella memoria: quale vale
  | 'keepNew' | 'keepOld' | 'keepBoth' | 'dismiss'
  // Compattazione in attesa dei chiarimenti
  | 'compactAnyway' | 'cancelCompact'

export type Proposal = {
  /** Stabile per tipo di situazione: serve per rimandarla. */
  id: 'context' | 'plan' | 'turns' | 'mcp' | 'claudemd' | 'errors' | 'conflict'
  severity: Severity
  text: string
  actions: ActionId[]
  /** Il valore misurato quando è nata: il rinvio si confronta con questo. */
  value: number
  /** Per una contraddizione: il suo id nella memoria della sessione. */
  ref?: string
}

export type Signals = {
  percent?: number
  warn: number
  strong: number
  critical: number
  /** Turni dall'ultima compattazione. */
  turns: number
  maxTurns: number
  /** Token degli strumenti MCP, se misurati. */
  mcpTokens?: number
  /** Il limite del piano più vicino al tetto, in %. */
  limitPercent?: number
  /** undefined = non ancora controllato. */
  hasClaudeMd?: boolean
  profiles: readonly string[]
  /** Errori aperti nel registro del lavoro. */
  openErrors: number
  isCompacting: boolean
  /** Contraddizioni aperte nella memoria della sessione, dalla più vecchia. */
  conflicts?: readonly { id: string; topic: string; older: string; newer: string }[]
  /** Una compattazione aspetta che tu chiarisca le contraddizioni: prima si chiarisce, poi si compatta. */
  isClarifying?: boolean
}

/** Rinvio: il valore e la gravità di quando hai detto "Più tardi". */
export type Snooze = { value: number; severity: Severity }

export type Snoozes = Partial<Record<Proposal['id'], Snooze>>

const RANK: Record<Severity, number> = { info: 0, warn: 1, critical: 2 }

/** Di quanto deve peggiorare una situazione rimandata per tornare a proporla. */
const STEP: Record<Proposal['id'], number> = {
  context: 10, plan: 10, turns: 20, mcp: Number.POSITIVE_INFINITY, claudemd: Number.POSITIVE_INFINITY, errors: 2,
  // Rimandata, una contraddizione torna quando se ne aggiunge un'altra.
  conflict: 1,
}

/** Tutte le proposte valide adesso, dalla più urgente. */
export const proposalsFor = (signals: Signals): Proposal[] => {
  const out: Proposal[] = []
  const { percent } = signals
  const conflicts = signals.conflicts ?? []

  // Compattazione in attesa: prima le contraddizioni, una alla volta, con la via d'uscita.
  if (signals.isClarifying === true && conflicts.length > 0) {
    conflicts.forEach((conflict, index) => {
      out.push({
        id: 'conflict',
        severity: 'critical',
        text:
          `Prima di compattare (${index + 1} di ${conflicts.length}): su «${conflict.topic}» prima «${conflict.older}», ` +
          `poi «${conflict.newer}». Quale vale?`,
        actions: ['keepNew', 'keepOld', 'keepBoth', 'dismiss', 'compactAnyway', 'cancelCompact'],
        value: conflicts.length,
        ref: conflict.id,
      })
    })
  }

  if (percent !== undefined && percent >= signals.warn && !signals.isCompacting && signals.isClarifying !== true) {
    const rounded = Math.round(percent)

    if (percent >= signals.critical) {
      out.push({
        id: 'context',
        severity: 'critical',
        text: `Contesto al ${rounded}%: vuoi compattare adesso? Il lavoro resta nel registro verificato.`,
        actions: ['compact', 'handoff', 'snooze'],
        value: percent,
      })
    } else if (percent >= signals.strong) {
      out.push({
        id: 'context',
        severity: 'warn',
        text: `Contesto al ${rounded}%: conviene compattare o ripartire con un riepilogo.`,
        actions: ['compact', 'handoff', 'snooze'],
        value: percent,
      })
    } else {
      out.push({
        id: 'context',
        severity: 'info',
        text: `Contesto al ${rounded}%: compattare ora costa poco e libera spazio.`,
        actions: ['compact', 'details', 'snooze'],
        value: percent,
      })
    }
  }

  // Contraddizioni: una proposta per ciascuna (la banda mostra la più urgente, il pannello tutte).
  for (const conflict of signals.isClarifying === true ? [] : conflicts) {
    out.push({
      id: 'conflict',
      severity: 'warn',
      text: `Contraddizione su «${conflict.topic}»: prima «${conflict.older}», poi «${conflict.newer}». Quale vale?`,
      actions: ['keepNew', 'keepOld', 'keepBoth', 'dismiss'],
      value: (signals.conflicts ?? []).length,
      ref: conflict.id,
    })
  }

  if (signals.limitPercent !== undefined && signals.limitPercent >= 80) {
    out.push({
      id: 'plan',
      severity: signals.limitPercent >= 95 ? 'critical' : 'warn',
      text: `Limite del piano al ${Math.round(signals.limitPercent)}%: alleggerire il contesto fa durare di più i messaggi rimasti.`,
      actions: ['compact', 'snooze'],
      value: signals.limitPercent,
    })
  }

  if (signals.turns >= signals.maxTurns) {
    out.push({
      id: 'turns',
      severity: 'info',
      text: `Sessione lunga (${signals.turns} turni): se cambi argomento conviene ripartire con un riepilogo.`,
      actions: ['handoff', 'compact', 'snooze'],
      value: signals.turns,
    })
  }

  if (signals.openErrors >= 3) {
    out.push({
      id: 'errors',
      severity: 'info',
      text: `${signals.openErrors} errori ancora aperti: guardali insieme prima di andare avanti.`,
      actions: ['details', 'snooze'],
      value: signals.openErrors,
    })
  }

  if (signals.mcpTokens !== undefined && signals.mcpTokens >= 15000) {
    out.push({
      id: 'mcp',
      severity: 'info',
      text: `Gli strumenti MCP occupano ${Math.round(signals.mcpTokens / 1000)}k token a ogni messaggio: disattiva i server che qui non usi.`,
      actions: ['details', 'mute'],
      value: signals.mcpTokens,
    })
  }

  if (signals.hasClaudeMd === false && signals.profiles.length > 0) {
    out.push({
      id: 'claudemd',
      severity: 'info',
      text: 'Questo progetto non ha un CLAUDE.md: uno breve evita esplorazioni ripetute a ogni sessione.',
      actions: ['claudemd', 'mute'],
      value: 1,
    })
  }

  return out.sort((a, b) => RANK[b.severity] - RANK[a.severity])
}

/** Se una proposta rimandata deve tornare: è peggiorata abbastanza o è diventata più grave. */
export const isSnoozed = (proposal: Proposal, snoozes: Snoozes): boolean => {
  const snooze = snoozes[proposal.id]

  if (snooze === undefined) {
    return false
  }

  return RANK[proposal.severity] <= RANK[snooze.severity] && proposal.value < snooze.value + STEP[proposal.id]
}

/** Le proposte da mostrare, senza quelle rimandate o zittite. */
export const activeProposals = (signals: Signals, snoozes: Snoozes, muted: ReadonlySet<string>): Proposal[] =>
  proposalsFor(signals).filter(
    proposal =>
      // Durante i chiarimenti prima di compattare le contraddizioni non si possono rimandare né zittire.
      (signals.isClarifying === true && proposal.id === 'conflict') ||
      (!muted.has(proposal.id) && !isSnoozed(proposal, snoozes)),
  )

/** Rinvia una proposta da adesso. */
export const snooze = (snoozes: Snoozes, proposal: Proposal): Snoozes => ({
  ...snoozes,
  [proposal.id]: { value: proposal.value, severity: proposal.severity },
})

/** Dopo una compattazione le proposte sul contesto ripartono da zero. */
export const clearAfterCompaction = (snoozes: Snoozes): Snoozes => {
  const { context: _context, turns: _turns, ...rest } = snoozes

  return rest
}

/** Etichette dei pulsanti. */
export const ACTION_LABELS: Record<ActionId, string> = {
  compact: 'Compatta ora',
  handoff: 'Passaggio a sessione nuova',
  details: 'Dettagli',
  claudemd: 'Crea CLAUDE.md',
  snooze: 'Più tardi',
  mute: 'Non chiedere più',
  keepNew: 'Vale la più recente',
  keepOld: 'Vale la prima',
  keepBoth: 'Valgono entrambe',
  dismiss: 'Non è una contraddizione',
  compactAnyway: 'Compatta lo stesso',
  cancelCompact: 'Annulla',
}

/** Il simbolo davanti al testo, per gravità. */
export const severityMark = (severity: Severity): string => (severity === 'critical' ? '⚠' : severity === 'warn' ? '!' : 'i')

/** Il colore del tema per gravità. */
export const severityColor = (severity: Severity): 'error' | 'warning' | 'suggestion' =>
  severity === 'critical' ? 'error' : severity === 'warn' ? 'warning' : 'suggestion'

/** Una proposta è nuova (da annunciare con un avviso) se prima non c'era o è diventata più grave. */
export const isNewer = (proposal: Proposal | undefined, previous: { id: string; severity: Severity } | undefined): boolean =>
  proposal !== undefined &&
  (previous === undefined || previous.id !== proposal.id || RANK[proposal.severity] > RANK[previous.severity])
