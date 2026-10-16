// Contratto dei valori che il mod tiene in $.state.

export type StatoLavoro = 'da-fare' | 'in-corso' | 'completato' | 'bloccato' | 'annullato'
export type Origine = 'esistente' | 'migliorato' | 'nuovo'
export type StatoDomanda = 'aperta' | 'in-conflitto' | 'risposta' | 'delegata' | 'superata'

export type Task = {
  id: string
  titolo: string
  descrizione?: string
  stato: StatoLavoro
  origine: Origine
  criteri: string[]
  dipendeDa: string[]
  /** esigenze di business coperte (F1-E2...) */
  requisiti: string[]
  /** riferimento al piano originale del progetto (file#sezione) */
  rif?: string
  note?: string
  /** punti di stima (1, 2, 3, 5, 8): 8 o piu va spezzato */
  stima?: number
  /** voci di memoria o decisioni su cui il task si basa (M3, DEC2) */
  vincoli: string[]
  /** motivo per cui il task va rivisto (una voce su cui si basava e stata superata) */
  daRivedere?: string
}

export type Sprint = {
  id: string
  titolo: string
  obiettivo: string
  stato: StatoLavoro
  origine: Origine
  rif?: string
  task: Task[]
  /** revisione e retrospettiva fatte a sprint completato */
  chiusura?: { data: string; esito: string }
}

export type Conflitto = {
  /** id delle voci contraddette: M (memoria), DEC (decisioni), F-E (esigenze) */
  con: string[]
  spiegazione: string
  rispostaProposta: string
  /** id della voce nuova (M, DEC, F-E) da scartare se l'utente mantiene la memoria */
  nuovo?: string
}

/** Effetto automatico di una risposta: affermativa = prima opzione o "si". */
export type Azione =
  | { tipo: 'voce-memoria'; id: string }
  | { tipo: 'impatto'; task: string }
  | { tipo: 'ipotesi'; id: string }

export type Domanda = {
  id: string
  testo: string
  perche?: string
  sprint?: string
  task?: string
  opzioni: string[]
  raccomandata?: string
  bloccante: boolean
  tipo: 'normale' | 'conflitto'
  autore: 'claude' | 'utente'
  stato: StatoDomanda
  conflitto?: Conflitto
  azione?: Azione
  risposta?: string
  fonte?: 'pannello' | 'chat'
  rispostaIl?: string
}

export type Decisione = {
  id: string
  testo: string
  fonte: 'utente' | 'memoria' | 'analisi'
  data: string
  domanda?: string
  superata?: boolean
  /** per le ipotesi di Claude (fonte analisi): confermata dall'utente */
  confermata?: boolean
}

export type Esigenza = {
  id: string
  testo: string
  priorita: 'alta' | 'media' | 'bassa'
  stato: 'valida' | 'superata'
}

export type FonteBusiness = {
  id: string
  titolo: string
  tipo: 'email' | 'documento' | 'verbale' | 'ticket' | 'altro'
  data: string
  file: string
  stato: 'da-analizzare' | 'analizzata'
  /** impronta del testo: la stessa fonte incollata due volte non si duplica */
  impronta?: string
  sintesi?: string
  esigenze: Esigenza[]
}

export type VoceMemoria = {
  id: string
  testo: string
  /** file e riga, oppure claude-mem */
  fonte: string
  tipo: 'vincolo' | 'convenzione' | 'architettura' | 'business' | 'stack'
  stato: 'valida' | 'da-verificare' | 'superata'
  sostituitaDa?: string
  /** riga copiata dal file sorgente: se sparisce, la memoria e cambiata fuori dal piano */
  estratto?: string
  /** espressione regolare di cio che la regola vieta nel codice */
  vietato?: string
  /** a quali file si applica il divieto: estensioni o parti di percorso, separate da virgola */
  ambito?: string
}

export type Rischio = {
  id: string
  testo: string
  probabilita: 'alta' | 'media' | 'bassa'
  impatto: 'alto' | 'medio' | 'basso'
  mitigazione: string
  task?: string
  stato: 'aperto' | 'mitigato' | 'chiuso'
}

export type AggiornamentoMemoria = {
  id: string
  testo: string
  file?: string
  motivo: string
  stato: 'da-applicare' | 'applicato'
  nota?: string
}

export type Evento = { data: string; testo: string }

export type Piano = {
  versione: 2
  progetto: {
    nome: string
    obiettivo: string
    stack?: string
    /** metodo di sviluppo gia in uso (superpowers, GSD, spec-kit...) */
    metodo?: string
    fileLogica: string[]
    fonti: string[]
    /** definition of done comune a tutti i task */
    dod: string[]
    /** impronta di ogni file letto all'ultima analisi: alla successiva si rileggono solo i file cambiati */
    impronte?: Record<string, string>
  }
  aggiornato: string
  sprint: Sprint[]
  domande: Domanda[]
  decisioni: Decisione[]
  business: FonteBusiness[]
  memoria: VoceMemoria[]
  aggiornamentiMemoria: AggiornamentoMemoria[]
  rischi: Rischio[]
  registro: Evento[]
}

export type Vista = 'piano' | 'domande' | 'business' | 'memoria'

// ---------- modulo contesto (ex controllo-contesto) ----------


/** L'ultima misura del contesto, per la banda e il pannello. */
export type MeterState = {
  percent: number
  tokens?: number
  window: number
  /** Il limite del piano più vicino al tetto (es. finestra di 5 ore), se noto. */
  limit?: { kind: string; percentUsed: number }
}

/** Quanto ha risparmiato la compressione dell'output in questa sessione. */
export type SavedState = { compressions: number; charsSaved: number }

/** Registro del lavoro: file modificati, errori aperti, ultime richieste. */
export type LedgerState = {
  files: string[]
  errors: { command: string; line: string }[]
  requests: string[]
}

/** Una proposta del consigliere, con le scelte da mostrare come pulsanti. */
export type ProposalState = {
  id: 'context' | 'plan' | 'turns' | 'mcp' | 'claudemd' | 'errors' | 'conflict'
  severity: 'info' | 'warn' | 'critical'
  text: string
  actions: ('compact' | 'handoff' | 'details' | 'claudemd' | 'snooze' | 'mute' | 'keepNew' | 'keepOld' | 'keepBoth' | 'dismiss' | 'compactAnyway' | 'cancelCompact')[]
  value: number
  ref?: string
}

/** Memoria della sessione: richieste, decisioni, contraddizioni (vedi hooks/conflicts.ts). */
export type MemoryState = {
  history: string[]
  decisions: { topic: string; text: string; status: 'valida' | 'superata'; replacedBy?: string }[]
  conflicts: {
    id: string
    topic: string
    older: string
    newer: string
    status: 'aperta' | 'risolta'
    resolution?: 'nuova' | 'vecchia' | 'entrambe' | 'nessuna'
  }[]
  total: number
  checked: number
  pending: string[]
}

declare module 'claude-code' {
  interface PluginState {
    'gestione-sprint': {
      piano: Piano | null
      vista: Vista
      errore: string
      inAttesa: string[]
      taskSel: string
      sprintSel: string
      domandaSel: string
      verifica: string
      // modulo contesto
      meter: MeterState | null
      saved: SavedState
      isBandHidden: boolean
      ledger: LedgerState
      proposals: ProposalState[]
      memory: MemoryState
    }
  }
}
