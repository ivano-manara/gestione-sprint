// Testi che il mod invia al modello. Brevi: ogni parola qui costa token a ogni uso.

export const INSTALLA_SUPERPOWERS = [
  'claude plugin marketplace add obra/superpowers-marketplace',
  'claude plugin install superpowers@superpowers-marketplace',
]

/** Installazione di claude-mem da terminale (equivale a /plugin marketplace add e /plugin install). */
export const INSTALLA_CLAUDE_MEM = [
  'claude plugin marketplace add thedotmack/claude-mem',
  'claude plugin install claude-mem@thedotmack',
]

/** Come usare claude-mem nei testi per il modello: nomi esatti degli strumenti e progetto. */
export type UsoMemoria = {
  stato: 'attivo' | 'assente' | 'spento'
  progetto: string
  search: string
  timeline: string
  get: string
  save: string
  outline: string
  unfold: string
}

/** Righe per l'analisi: claude-mem prima dei file, a strati; se manca, proposta di installazione. */
export const passoClaudeMem = (m: UsoMemoria | undefined): string[] => {
  if (!m || m.stato === 'spento') return []
  if (m.stato === 'assente') {
    return [
      `- claude-mem non risulta installato: senza, ogni sessione riparte dai soli file e rilegge il codice. Controlla con "claude plugin list" (o se hai strumenti di claude-mem); se manca davvero, prima dell'analisi chiedi all'utente se vuole installarlo (serve Node 20 o superiore):`,
      ...INSTALLA_CLAUDE_MEM.map(c => `    ${c}`),
      `  poi una sessione nuova. Se accetta, eseguili con Bash e intanto continua sui file. Se rifiuta, registra in decisioni "claude-mem: non installare" e non chiederlo piu.`,
    ]
  }
  return [
    `- claude-mem e attivo: e la memoria delle sessioni passate. Interrogalo PRIMA dei file, a strati, per spendere pochi token:`,
    `    ${m.search} query=<tema> limit=5 (con project="${m.progetto}" se escono altri progetti); obs_type=decision per le decisioni, feature,bugfix per cio che e gia fatto;`,
    `    ${m.timeline} solo se serve la storia attorno a un risultato; ${m.get} una volta sola, con tutti gli id scelti insieme.`,
    `    Temi minimi: architettura e stack, decisioni prese, lavoro gia fatto, problemi aperti.`,
    `- Cio che trovi in claude-mem: fatti vincolanti in memoria con fonte "claude-mem #<id>"; decisioni gia prese in decisioni (fonte memoria); task gia fatti completati con la prova "claude-mem #<id>".`,
    `- Se claude-mem e un file dicono cose diverse: registra la voce del file e crea una domanda con conflittoCon:[id]; non scegliere tu.`,
    `- Un'osservazione di claude-mem contraria a una voce o decisione gia nel piano non la cambia: se e piu recente della decisione crea una domanda con conflittoCon, altrimenti e storia superata. Non reimportare regole superate.`,
    `- Codice gia osservato: ${m.outline} per la struttura e ${m.unfold} sul simbolo che serve, invece di Read interi.`,
  ]
}

const rigaMemProcedi = (m: UsoMemoria | undefined): string[] =>
  m?.stato === 'attivo'
    ? [`- Prima di aprire i file del task: ${m.search} con il tema del task (limit 3) per lavoro gia fatto e decisioni; file di codice grandi con ${m.outline} e ${m.unfold}.`]
    : []

const passoSkill = (skill: string, isPresente: boolean | undefined): string[] => {
  if (isPresente === false) {
    return [
      `La skill ${skill} non risulta da "claude plugin list". Se e comunque nel tuo elenco delle skill usala; altrimenti, prima di tutto, chiedi all'utente se vuole installarla con:`,
      ...INSTALLA_SUPERPOWERS.map(c => `  ${c}`),
      `(poi /reload-plugins). Se accetta, eseguili con Bash; se rifiuta, continua col metodo integrato (scopo, 2-3 approcci, YAGNI, design a sezioni) e dichiaralo.`,
    ]
  }
  return [
    `Usa la skill ${skill} (strumento Skill) per l'analisi. Se non e nell'elenco delle skill, proponi all'utente l'installazione:`,
    ...INSTALLA_SUPERPOWERS.map(c => `  ${c}`),
    `e se rifiuta usa il metodo integrato (scopo, 2-3 approcci, YAGNI, design a sezioni).`,
  ]
}

/** Punti che nei progetti restano spesso non decisi: ognuno va coperto da un criterio, una decisione o una domanda. */
export const PUNTI_SCOPERTI = [
  'dati: origine, formato, volumi, migrazione di quelli esistenti',
  'utenti, ruoli e permessi',
  'errori e casi limite (vuoto, duplicato, troppo grande, concorrenza)',
  'prestazioni attese',
  'sicurezza e dati personali (GDPR, log, segreti)',
  'integrazioni esterne e loro guasti',
  'ambienti, deploy e ritorno alla versione precedente',
  'test e dati di prova',
  'compatibilita con cio che esiste gia',
] as const

const REGOLE_DOMANDE = [
  `Non fare domande in chat una alla volta: ogni dubbio va nel piano (piano_aggiorna.domande) con testo, perche, 2-4 opzioni, raccomandata, bloccante, sprint/task.`,
  `Bloccante = senza risposta il risultato puo essere sbagliato o irreversibile. Le preferenze minori le decidi tu e le registri in decisioni.`,
  `Ogni domanda: perche dice cosa cambia nel piano a seconda della risposta. Niente domande la cui risposta e gia nella memoria o nel codice: cercala prima.`,
  `Conflitti: se una fonte di business, una tua proposta o un'esigenza contraddice una voce di memoria (M), una decisione (DEC) o un'esigenza (F-E), crea una domanda con conflittoCon:[id] e raccomandata = la nuova versione. Non risolverla tu.`,
]

export const promptAnalisi = (o: {
  cartella: string
  skill: string
  isSkill: boolean | undefined
  rilevazione: string
  note: string
  mem?: UsoMemoria
}): string =>
  [
    `Analizza il progetto e costruisci o migliora il piano sprint (mod gestione-sprint). Non scrivere codice in questa fase.`,
    o.note ? `Indicazioni dell'utente: ${o.note}` : '',
    '',
    `Rilevato dal mod:`,
    o.rilevazione,
    '',
    `1. Memoria (solo lettura; Grep prima di Read, file lunghi a pezzi):`,
    ...passoClaudeMem(o.mem),
    `- piano_leggi formato memoria; i file di memoria trovati (solo cio che claude-mem non dice, se c'e); git log --oneline -30.`,
    `- Registra in piano_aggiorna.memoria ogni fatto vincolante: una frase, tipo, fonte "file:riga", estratto = la riga ESATTA copiata dal file (serve a scoprire se la memoria cambia).`,
    `- Se la regola e verificabile nel codice aggiungi vietato (regex di cio che vieta) e ambito (.php,.py o cartella). Es: "non usare le funzioni mysql_* deprecate" -> vietato "\\bmysql_\\w+\\(" ambito ".php". Solo regole nette: un divieto sbagliato blocca il lavoro.`,
    `- Le scelte che fai tu senza conferma vanno in decisioni (fonte analisi): sono ipotesi che l'utente confermera. Non presentarle come fatti.`,
    `- Voci gia registrate: non duplicarle. Se un file cambiato ora dice altro, crea una domanda con conflittoCon:[id della voce] invece di una voce nuova.`,
    '',
    `2. Logica esistente (rispettala):`,
    `- Metodo gia in uso in progetto.metodo e i suoi file in progetto.fileLogica.`,
    `- Importa sprint/fasi/storie con origine "esistente", stessi id, titoli e ordine, rif = "file#sezione". Segna completati (task_stato) quelli gia fatti, con la prova nella nota.`,
    `- Migliora solo: criteri, dipendenze, stime, task mancanti. Non rinominare, non riordinare.`,
    '',
    `3. Business: fonte_leggi sulle fonti da analizzare; esigenze atomiche con priorita (alta = must, media = should, bassa = could); collega ogni esigenza ai task (requisiti), anche su piu sprint.`,
    '',
    `4. Ambito: obiettivo del progetto in una frase verificabile, utenti e ruoli. Cio che resta fuori ambito va in decisioni (fonte analisi, testo "fuori ambito: ..."): l'utente lo conferma o lo riporta dentro.`,
    '',
    `5. Brainstorming:`,
    ...passoSkill(o.skill, o.isSkill).map(r => `- ${r}`),
    ...REGOLE_DOMANDE.map(r => `- ${r}`),
    `- Passa in rassegna questi punti, spesso lasciati aperti: ${PUNTI_SCOPERTI.join('; ')}. Per ognuno che riguarda il progetto: criterio, decisione o domanda.`,
    '',
    `6. Pianificazione (pratiche di project management):`,
    `- Obiettivo di progetto e di ogni sprint specifico e verificabile. Primo sprint = scheletro funzionante da capo a fondo; prima le parti rischiose e le must.`,
    `- Task INVEST: indipendenti, piccoli (stima 1-5 punti; 8 o piu va spezzato), verificabili. Fette verticali, non strati tecnici.`,
    `- Ogni task: criteri misurabili con i comandi di verifica del progetto (test, comando, output atteso; anche "dato... quando... allora..."; niente "funziona bene"), dipendenze, requisiti, vincoli = id delle voci di memoria/decisioni su cui si basa.`,
    `- Dipendenze solo verso task dello stesso sprint o precedenti. 3-8 task per sprint; l'ultimo e la verifica dello sprint.`,
    `- Rischi (piano_aggiorna.rischi): probabilita, impatto, mitigazione e, se grave, un task che la realizza. Definition of done in progetto.dod se il progetto ne ha una propria.`,
    '',
    `7. Controllo qualita: piano_leggi formato qualita e correggi finche non restano problemi critici (o diventano domande per l'utente).`,
    `8. Fine: riepilogo in 6 righe (sprint, memoria acquisita o cambiata, ipotesi da confermare, copertura business, rischi gravi, domande bloccanti/conflitti). Ricorda all'utente il pulsante Domande sopra il prompt per rispondere.`,
    `Il riferimento resta ${o.cartella}/piano.json; se la skill salva un documento di design, collegalo in progetto.fileLogica.`,
  ]
    .filter((r, i, a) => !(r === '' && a[i - 1] === ''))
    .join('\n')

export const promptQualita = (mem?: UsoMemoria): string =>
  [
    `Migliora la qualita del piano sprint (mod gestione-sprint): piano_leggi formato qualita.`,
    `- Correggi con piano_aggiorna cio che puoi decidere tu: criteri misurabili, stime, task troppo grandi da spezzare, task finale di verifica, dipendenze, copertura delle esigenze, mitigazioni dei rischi, vincoli.`,
    `- Per i task da rivedere: confrontali con la memoria valida, aggiornali e segnali con rivisto:true.`,
    ...(mem?.stato === 'attivo' ? [`- Stime e criteri: cerca in claude-mem (${mem.search}, limit 3) come sono andati lavori simili e usalo per stimare.`] : []),
    `- Cio che richiede una scelta dell'utente diventa una domanda. Non toccare risposte, memoria esistente o task gia completati.`,
    `- Fine: punteggio prima/dopo e cosa resta, in 3 righe.`,
  ].join('\n')

export const promptBusiness = (ids: readonly string[], mem?: UsoMemoria): string =>
  [
    `Analizza le nuove fonti di business ${ids.join(', ')} (mod gestione-sprint).`,
    `- Leggile con fonte_leggi. Estrai esigenze atomiche con priorita (piano_aggiorna.business: id, sintesi, esigenze, stato "analizzata"). Anche quelle implicite (chi le usa, quando, quanto spesso).`,
    `- Date, scadenze, volumi, vincoli normativi o contrattuali citati: diventano criteri, voci di memoria (tipo business) o rischi. Le parole del business che indicano un criterio ("entro", "almeno", "solo se") vanno nei criteri dei task, citate.`,
    `- Confrontale con piano_leggi formato memoria. Ogni contraddizione con memoria, decisioni o altre esigenze = domanda con conflittoCon.`,
    ...(mem?.stato === 'attivo' ? [`- Per ogni esigenza cerca in claude-mem (${mem.search}, limit 3) se e gia stata discussa o realizzata: se si, collegala al task esistente e cita "claude-mem #<id>".`] : []),
    `- Collega ogni esigenza ai task esistenti (requisiti), anche su piu sprint; se manca copertura aggiungi task o sprint nuovi; se e ambigua crea una domanda sul task.`,
    ...REGOLE_DOMANDE.slice(0, 2).map(r => `- ${r}`),
    `- Fine: tabella breve esigenza -> task, e cosa resta scoperto.`,
  ].join('\n')

export const promptDomandeTask = (taskId: string, mem?: UsoMemoria): string =>
  [
    `Per il task ${taskId} (mod gestione-sprint): leggi piano_leggi formato sprint e il codice coinvolto (solo le parti utili).`,
    ...(mem?.stato === 'attivo' ? [`Prima di creare una domanda cerca la risposta in claude-mem con ${mem.search} (limit 3): se c'e, usala e cita "claude-mem #<id>".`] : []),
    `Trova i punti non definiti che impedirebbero di completarlo in autonomia e in sicurezza (dati, casi limite, permessi, errori, interfacce, test).`,
    `Registra solo quelli reali come domande sul task (piano_aggiorna.domande con task:"${taskId}"), con opzioni e raccomandata. Aggiungi i criteri mancanti al task. Non scrivere codice.`,
  ].join('\n')

export const promptProcedi = (limite: number, mem?: UsoMemoria): string =>
  [
    `Procedi in autonomia sul piano sprint (mod gestione-sprint), al massimo ${limite} task.`,
    `- piano_leggi formato sprint; prendi il prossimo task. Se ha domande bloccanti o conflitti: elencali e fermati.`,
    `- task_stato in-corso (il mod rifiuta i task non pronti); implementa leggendo solo i file necessari; rispetta i vincoli del task.`,
    ...rigaMemProcedi(mem),
    `- Definition of done: criteri verificati eseguendo test o comandi, nessun test rotto; poi task_stato completato con la prova nella nota.`,
    `- Se il task ha rif, aggiorna anche il file originale del progetto (es. spunta la checkbox) senza cambiarne la struttura.`,
    `- Rispetta memoria valida, decisioni ed esigenze collegate. Un dubbio nuovo diventa una domanda bloccante: passa a un altro task non bloccato dello sprint.`,
    `- Non passare allo sprint successivo senza il task di verifica; a sprint completato fermati: va chiuso con revisione e retrospettiva (pulsante ▶ Chiudi lo sprint sopra il prompt).`,
    `- Alla fine: 3-5 righe su fatto e restante.`,
  ].join('\n')

export const promptChiusura = (sprintId: string, mem?: UsoMemoria): string =>
  [
    `Chiudi lo sprint ${sprintId} (mod gestione-sprint): revisione e retrospettiva, senza scrivere codice nuovo.`,
    `1. Revisione: piano_leggi formato sprint sprint=${sprintId}. Verifica che l'obiettivo sia raggiunto: per ogni task la prova nella nota, per ogni esigenza collegata se e davvero soddisfatta. Se qualcosa non torna: domanda o task nuovo, e non chiudere.`,
    `2. Cosa mostrare all'utente: 3 righe con i passi per provare il risultato.`,
    `3. Retrospettiva: al massimo 3 lezioni utili per i prossimi sprint (cosa ha funzionato, cosa no, cosa cambiare). Solo quelle durevoli vanno in piano_aggiorna.memoria (tipo convenzione, fonte "retrospettiva ${sprintId}").`,
    `4. Rischi: aggiorna lo stato (mitigato o chiuso) di quelli toccati dallo sprint; registra i nuovi.`,
    ...(mem?.stato === 'attivo' ? [`   Salva l'esito in claude-mem con ${mem.save}: "sprint ${sprintId} chiuso: obiettivo, cosa e stato fatto, lezioni" (una sola osservazione), cosi le prossime sessioni lo trovano.`] : []),
    `5. Chiudi con piano_aggiorna sprint [{ id: "${sprintId}", chiusura: { esito: "<una frase>" } }], poi piano_leggi formato qualita sullo sprint successivo e dimmi se e pronto.`,
  ].join('\n')

export const promptRisposte = (ids: readonly string[]): string =>
  `Ho risposto nel pannello sprint a ${ids.join(', ')}. Con piano_leggi formato sprint applica le risposte a task, criteri e sprint (piano_aggiorna), registra le nuove domande che ne nascono, poi dimmi in 2 righe se il prossimo task e pronto.`

export const promptMemoria = (mem?: UsoMemoria): string =>
  [
    `Applica gli aggiornamenti di memoria approvati dall'utente (piano_leggi formato memoria, sezione "da applicare"): modifica solo le righe indicate nei file indicati, poi chiama memoria_applicata per ognuno. Nessun'altra modifica.`,
    ...(mem?.stato === 'attivo' ? [`Quelli senza file (voci nate da claude-mem) non si applicano a un file: si annotano con ${mem.save}, poi memoria_applicata.`] : []),
    // claude-mem conserva le vecchie osservazioni: senza una nota esplicita, un'analisi futura potrebbe riportare la regola superata.
    ...(mem?.stato === 'attivo' ? [`Poi salva in claude-mem con ${mem.save} una sola osservazione: "regole cambiate: <vecchia> -> <nuova> (approvato dall'utente)", cosi le sessioni future non riprendono quelle superate.`] : []),
  ].join('\n')
