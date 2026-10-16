# Changelog

## 0.8.3 - 2026-10-16

Correzioni, trovate con uno stress test di migliaia di modifiche casuali:

- **Task con lo stesso id in due sprint**: se Claude indicava per un task nuovo l'id di un task di un altro sprint (anche in minuscolo, `s1-t1`), il piano finiva con due task uguali e stato, dipendenze e domande puntavano a quello sbagliato. Ora la modifica viene rifiutata con il motivo; gli id di sprint, task e domande non distinguono le maiuscole.
- **Voce nata da claude-mem superata**: il mod creava un aggiornamento da applicare sul "file" `claude-mem #id`, che non esiste. Ora l'aggiornamento chiede di annotare la correzione in claude-mem.
- Una contraddizione con un testo vuoto diventava comunque una domanda di conflitto: ora viene ignorata.
- Scegliere "mantieni la memoria" senza voci collegate lasciava la risposta "resta valido: ": ora dice "resta valida la memoria".
- Nuovo `hooks/robustezza.test.tsx`: 150 piani casuali da 25 passi (id unici, salva e ricarica senza perdite, nessuna eccezione) e banda e pannello disegnati con piani casuali. 187 test.

## 0.8.2 - 2026-10-16

Correzioni:

- **`~/.claude-mem/settings.json` non si poteva modificare**: il mod lo permetteva e lo suggeriva (`/peso`), ma la lettura della cartella `.claude-mem` era bloccata, e senza lettura Claude Code non modifica un file. Ora le opzioni si leggono e si modificano; database, indici e log restano protetti.
- Quando il nome esatto di uno strumento di claude-mem non è noto, il mod scriveva "search", confondibile con altri strumenti dallo stesso nome: ora scrive "search di claude-mem".
- Se `claude plugin list` non riesce a girare, claude-mem risultava "assente" anche se installato: ora Claude controlla prima di proporne l'installazione.
- Immagini della documentazione rigenerate con i controlli di qualità attuali. 183 test.

## 0.8.1 - 2026-10-16

Tutto il mod coerente con claude-mem:

- **Un solo riconoscimento**: se claude-mem risulta installato come plugin, anche il modulo contesto lo usa subito (guida di sistema, compattazione corta, passaggio salvato in memoria, rimedi per i file grandi). Prima i due moduli potevano vederlo in modo diverso.
- **Chi vale**: piano.json per piano e decisioni approvate, CLAUDE.md per le regole del progetto, claude-mem per la storia. È scritto nella guida di sistema e nell'analisi: un'osservazione di claude-mem non cambia il piano da sola.
- **Regole superate non tornano**: quando applica un aggiornamento di memoria approvato, Claude lo annota in claude-mem ("vecchia → nuova"); l'analisi non reimporta regole superate.
- **Business e qualità** consultano claude-mem: esigenze già discusse o realizzate, stime da lavori simili.
- **Dati di claude-mem protetti**: database, indici e log si modificano solo con i suoi strumenti, anche da terminale; `settings.json` resta modificabile.
- **Pannello**: le voci di memoria nate da claude-mem sono segnate con ◇ e contate; una riga dice se claude-mem è attivo o assente.
- I messaggi del modulo contesto si firmano `gestione-sprint` (prima `controllo-contesto`). 182 test.

## 0.8.0 - 2026-10-16

claude-mem al centro dell'analisi:

- **Analisi**: con claude-mem attivo, Claude lo interroga prima dei file, a strati e con pochi risultati (`search` con `limit` e filtro `project`, `timeline` solo se serve, `get_observations` una volta sola). Cerca decisioni, lavoro già fatto e problemi aperti. Ciò che trova entra nel piano con fonte `claude-mem #id`; se contraddice un file, nasce un conflitto.
- **Esecuzione e domande**: prima di aprire i file di un task o di fare una domanda, Claude cerca in claude-mem; file di codice grandi con `smart_outline` e `smart_unfold`.
- **Chiusura dello sprint**: l'esito si salva con `save_memory`, così le sessioni future lo trovano.
- **Se manca**: `install.bat` lo propone (passo 6, con controllo di Node 20 o superiore); il pannello mostra **claude-mem assente** e il pulsante **installa claude-mem**, anche prima della prima analisi; l'analisi chiede a Claude di proportelo. Se rifiuti, la scelta resta nel piano e non viene richiesta. `claudeMem` = `spento` lo disattiva.
- Il mod usa i nomi esatti degli strumenti di claude-mem così come li vede Claude.
- Le voci di memoria che vengono da claude-mem non vengono più segnalate come "senza estratto".
- `install.bat`: il messaggio finale indica i pulsanti invece dei comandi. 180 test.

## 0.7.0 - 2026-10-16

Analisi più precisa:

- **Comandi di verifica reali**: il mod legge `composer.json`, `package.json`, `pyproject.toml`, `requirements*.txt`, `pytest.ini`, `phpunit.xml`, `Makefile`, `go.mod`, `Cargo.toml` e passa a Claude i comandi del progetto (`php artisan test`, `vendor/bin/phpstan analyse`, `npm run lint`, `pytest -q`…). I criteri di accettazione li citano invece di "funziona". Se non ce ne sono, Claude deve chiedere come si prova il progetto.
- **Analisi incrementale**: il mod salva un'impronta di ogni file letto. All'analisi successiva Claude sa quali file sono nuovi, cambiati o uguali, e rilegge solo quelli che servono. Con un piano già presente lo integra senza ricrearlo né duplicare le voci.
- **File grandi**: la rilevazione indica le dimensioni; quelli oltre 20 KB vanno letti a pezzi.
- **Punti spesso scoperti**: nell'analisi Claude passa in rassegna dati e migrazioni, ruoli e permessi, errori e casi limite, prestazioni, sicurezza e dati personali, integrazioni esterne, deploy e ritorno indietro, test e dati di prova, compatibilità. Ognuno diventa un criterio, una decisione o una domanda.
- **Ambito**: obiettivo verificabile, utenti e ruoli; ciò che resta fuori ambito diventa un'ipotesi da confermare.
- **Domande migliori**: ogni domanda dice cosa cambia a seconda della risposta; niente domande la cui risposta è già nella memoria o nel codice.
- **Business**: esigenze implicite; date, scadenze, volumi e vincoli normativi diventano criteri, memoria o rischi.
- **14 controlli di qualità nuovi**: dipendenze verso task annullati, task completati prima delle loro dipendenze o senza prova, obiettivi di sprint non verificabili, troppi task in corso insieme, sprint avviato con il precedente aperto, sprint sovraccarico rispetto alla velocità, esigenze must lasciate all'ultimo sprint, requisiti verso esigenze superate, voci di memoria senza estratto, mitigazioni affidate a task inesistenti, domande bloccanti senza sprint o task, domande doppie.

Correzioni:

- **Blocco con piani grandi**: la ricerca delle dipendenze circolari cresceva in modo esponenziale (24 task collegati: 4,6 secondi, a ogni messaggio e a ogni disegno della banda). Ora è lineare: 60 task in pochi millisecondi.
- Un divieto (`vietato`) scritto male veniva scartato in silenzio: Claude credeva la regola attiva. Ora `piano_aggiorna` lo dice subito.
- Superpowers installato a sessione aperta: il mod continuava a dire che mancava. Ora ricontrolla. 180 test.

## 0.6.3 - 2026-10-16

Correzioni:

- **Modifiche al piano perse quando Claude usa più strumenti insieme**: due `task_stato` in parallelo ne salvavano uno solo. Ora le modifiche a `piano.json` passano una alla volta, in coda.
- **Fonti di business**: due fonti incollate insieme ricevevano lo stesso id (una delle due andava persa); con un `piano.json` illeggibile una fonte nuova sovrascriveva il testo di F1. Ora ogni fonte ha il suo id e, se il piano non si legge, nessun file viene toccato.
- **Scritture da terminale sulla memoria non riconosciute**: comandi dentro `powershell -Command`, `pwsh -c`, `cmd /c`, `bash -c`, e `git checkout -- CLAUDE.md` / `git restore CLAUDE.md`. Ora vengono bloccati come gli altri.
- `cartellaPiano` scritta come `./.claude/sprint` produceva percorsi con `\.\`: ora si normalizza.
- Pannello con `piano.json` illeggibile: l'azione principale è **▶ ricarica il piano**, non più "analizza il progetto". 174 test.

## 0.6.2 - 2026-10-16

Correzioni:

- **Comandi `/sprint…` e strumenti del piano senza protezione dagli errori** (13 hook segnalati dal validatore come "gating hook without .catch"): ora un errore diventa un messaggio che dice cosa fare, invece di un errore crudo a Claude.
- All'avvio, un errore nel caricamento del piano faceva ripetere tutto l'avvio (comandi e strumenti registrati due volte): ora l'avvio arriva sempre in fondo e il problema si vede nella banda.
- I pulsanti che mandano un messaggio a Claude aspettano la fine del turno: mentre Claude lavora il pulsante ▶ è attenuato e un clic avvisa invece di interrompere.
- Con `cartellaPiano` scritta con la barra finale (`.claude/sprint/`) la protezione di `piano.json` da Edit e Write non scattava.
- Un piano senza sprint non viene più presentato come "completato": la banda dice "nessuno sprint ancora" e il pulsante ▶ **Completa il piano**.
- "riapri" una risposta, **Ricarica**, i pulsanti della banda e **Crea il piano** mostrano un avviso se qualcosa va storto, invece di fallire in silenzio; **Ricarica** dice com'è andata.

Pubblicazione su GitHub:

- `.gitattributes`: i `.bat` restano CRLF anche dopo un clone (con LF `install.bat` non funziona), gli `.sh` LF.
- Il repository è pronto da caricare: niente file generati (`install.log`, tipi, anteprime) sotto controllo di versione. 170 test.

## 0.6.1 - 2026-10-16

Documentazione completa per GitHub:

- README riorganizzato: indice, perché esiste, avvio rapido, immagini di banda e pannello, simboli, compatibilità, indice della documentazione.
- Nuove guide in `docs/`: guida utente passo passo, formato di `piano.json`, architettura (eventi, strumenti, controlli di qualità, prossima mossa), sviluppo (regole del validatore, test, tipi, rilascio), risoluzione dei problemi con domande frequenti.
- `CONTRIBUTING.md`, `SECURITY.md` (cosa protegge e cosa no, dati inviati ai modelli), modelli per issue e pull request in `.github/`.
- `tools/anteprima`: script per disegnare banda e pannello con dati di esempio e salvarne le immagini.
- I messaggi del mod indicano i pulsanti sopra il prompt invece dei comandi `/`.

Correzione:

- **Un `piano.json` rovinato veniva sovrascritto con un piano vuoto** alla modifica successiva. Ora il mod si ferma, la banda mostra l'errore con il pulsante **Ricarica**, e il file resta com'è. 168 test.

## 0.6.0 - 2026-10-16

Uso con i pulsanti, senza comandi `/`:

- **Banda sprint sopra il prompt**: barra di avanzamento dello sprint corrente allineata a quella del contesto, titolo dello sprint, conflitti, domande da decidere, memoria da aggiornare e qualita del piano.
- **Pulsante ▶ che cambia da solo**: mostra la prossima cosa da fare (crea il piano, risolvi il conflitto, chiudi lo sprint, invia le risposte, analizza il business, procedi...). E la stessa logica dell'azione principale del pannello.
- Pulsanti **Domande**, **Incolla business**, **Piano**: aprono il pannello gia sulla scheda giusta.
- Senza piano la banda propone **▶ Crea il piano**.
- Da tastiera: `ctrl+x tab` sulla banda, poi `x` `d` `b` `p`. A meno di 100 colonne le etichette si accorciano.
- README: sezione "Uso in 30 secondi"; i comandi diventano facoltativi. 167 test.

## 0.5.3 - 2026-10-16

Correzione:

- **install.bat si fermava alla validazione** con la versione di Claude Code installata sul PC: questa versione non accetta che `$` venga passato a funzioni di un altro file. Tutti i hook sono ora in un solo `hooks/register.tsx` (come nel vecchio controllo-contesto); la logica pura resta in `hooks/sprint` e `hooks/contesto`. Comportamento invariato, 165 test.
- install.bat: se la validazione fallisce mostra subito l'errore e la versione di Claude Code, e la scrive in install.log.

## 0.5.2 - 2026-10-16

Grafica (verificata disegnando pannello e banda a 72 e a 46 colonne):

- Tasti doppi tolti: "g: g: chiedi…" e "q: q: …" (il tasto lo mostra gia il pulsante).
- Riga d'aiuto corta e contestuale (prima andava a capo); i tasti 1-9 si citano solo nella scheda domande.
- Testi in italiano corretto: accenti (qualità, velocità, perché, già, è) e plurali ("1 conflitto", "invia 1 risposta").
- Barra di avanzamento con la parte vuota attenuata; velocità e sprint corrente su una riga sola.
- Righe dei task piu corte (◌ non pronto, ↺ da rivedere) con una legenda sotto: non vanno piu a capo nel pannello stretto.
- Dettaglio del task: mostra solo i requisiti che mancano per partire, piu il conteggio; i criteri vaghi sono segnati in giallo e non con la spunta.
- Stati leggibili ("da fare", "in corso") al posto degli identificativi.
- Riquadro qualità piu compatto (3 voci); scheda memoria senza righe vuote doppie.
- Banda sopra il prompt: la riga del piano colora solo i segnali (conflitti, bloccanti, da chiudere, qualità), non tutta la riga.

## 0.5.1 - 2026-10-16

Correzioni:

- Memoria e piano aggirabili da terminale: `echo >> CLAUDE.md`, `sed -i`, `tee`, `Set-Content`, `rm`, `mv` e simili su CLAUDE.md, AGENTS.md, `.claude/memory`, `memory-bank` o sui file del piano non venivano bloccati (solo Edit e Write lo erano). Ora valgono le stesse regole; le letture (`cat`, `grep`) e le copie da questi file restano libere.
- Gli strumenti non trovavano task e fonti scritti in minuscolo (`s1-t2`, `f1`): ora l'id si riconosce comunque.
- `/sprint-procedi` su un task non pronto (per esempio senza criteri) avviava lo stesso l'esecuzione, che poi veniva rifiutata: ora si ferma subito e dice cosa manca.
- La stessa fonte di business incollata due volte creava due fonti: ora viene riconosciuta.
- Una fonte poteva finire nel piano senza il suo testo se il salvataggio del file falliva: ora si salva prima il file.
- Un errore durante un'azione del pannello (risposta, scelta, incolla) passava in silenzio: ora compare un avviso.
- Test: 165.

## 0.5.0 - 2026-10-16

Miglioramenti:

- Revisione e retrospettiva: a sprint completato il mod lo segnala e propone la chiusura (`/sprint-chiudi`, tasto `x`). Claude verifica l'obiettivo e le esigenze collegate, prepara cosa provare, registra le lezioni durevoli come memoria e aggiorna i rischi; solo allora lo sprint risulta chiuso.
- Velocita e previsione: punti completati per sprint e sprint rimanenti stimati, nella testata del pannello e nello stato che riceve il modello.
- Controlli di qualita: avviso per gli sprint completati e non chiusi.

Correzioni:

- Uno sprint con tutti i task annullati restava "da fare" e bloccava il passaggio allo sprint successivo: ora risulta annullato.
- "Decidi tu" veniva confrontato con la memoria come testo letterale: ora si confronta la scelta consigliata.
- Le risposte alle domande che il mod genera sulla memoria stessa (verifica, impatto, ipotesi) non passano piu dal controllo dei conflitti (falsi conflitti).
- Due regole di progetto in contrasto tra loro, scoperte in chat: la regola scartata ora viene superata anche quando scegli "vale la prima"; prima si registrava solo una decisione.
- I campi di testo del pannello (nuova domanda, incolla fonte) restavano pieni dopo l'invio, con il rischio di salvare due volte: ora si svuotano.
- Test: 164.

## 0.4.1 - 2026-10-16

Correzioni dell'integrazione:

- I messaggi che il mod invia da solo (analisi, esecuzione autonoma, risposte dal pannello) venivano registrati come richieste dell'utente: finivano nel registro del lavoro e nel controllo delle contraddizioni della chat. Ora sono esclusi.
- Riga di stato contesa: il piano e il contesto si sovrascrivevano a vicenda. Ora la riga di stato e del contesto; il piano sta nella banda sopra il prompt.
- La riga del piano nella banda compare anche con la barra del contesto spenta (`showMeter` = stato o spento) o prima della prima misura.
- `fonte_leggi` restituisce le fonti lunghe a pezzi di 12000 caratteri (parametro `da`): una mail o un documento enorme non riempie piu il contesto in un colpo.
- `/sprint-fonte` con un file troppo grande o illeggibile ora risponde con un messaggio invece di fallire; accetta anche percorsi tra virgolette.
- Test: 161.

## 0.4.0 - 2026-10-16

Integrato il mod **controllo-contesto 1.3.1** come modulo contesto: un solo plugin, un solo punto d'ingresso.

- Struttura: `hooks/sprint` e `hooks/contesto`; gli eventi comuni (avvio, prompt, fine turno, scritture) sono registrati una volta e passano per entrambi i moduli.
- Stato e tipi uniti; opzioni unite (30), con un solo modello per tutti i controlli di coerenza (`conflictCheck`, `conflictModel`).
- La memoria di progetto entra nel controllo delle contraddizioni della chat; basta una richiesta che la contraddice per far partire il controllo.
- Le scelte fatte in chat entrano nel piano; se superano una regola di progetto parte lo stesso percorso del pannello (aggiornamento da approvare, analisi d'impatto).
- Compattazione e `/passaggio` non riassumono il piano: riportano solo il punto in cui si e, e il modello lo rilegge dopo. Dopo una compattazione lo stato del piano torna col messaggio successivo.
- Banda sopra il prompt: sotto la barra del contesto la riga del piano con il pulsante Sprint.
- Definition of done: chiudendo un task il mod segnala gli errori ancora aperti nel registro del lavoro.
- install.bat toglie il vecchio controllo-contesto (plugin, marketplace, copie manuali) e avvisa se `CLAUDE_CODE_PLUGIN_DIRS` lo carica ancora.
- Guida completa del modulo contesto in `docs/modulo-contesto.md`; 160 test (131 del modulo contesto, 29 del modulo sprint e dell'integrazione).

## 0.3.0 - 2026-10-16

Qualita dell'analisi (pratiche di project management):

- Definition of ready: un task parte solo se pronto (criteri, niente domande bloccanti, dipendenze completate, vincoli validi, non da rivedere).
- Definition of done: un task si chiude solo con la prova della verifica; DoD comune modificabile.
- Stime in punti, task INVEST (da 8 punti si spezza), criteri misurabili, dipendenze controllate (inesistenti, circolari, verso sprint successivi), task finale di verifica per ogni sprint.
- Priorita MoSCoW sulle esigenze, registro dei rischi con mitigazioni, ipotesi di Claude da confermare.
- Controlli di qualita con punteggio 0-100 (`piano_leggi formato qualita`, tasto `g`); l'analisi corregge finche non restano problemi critici.

Rotture della memoria:

- Le modifiche di Claude al piano vengono confrontate con memoria, decisioni ed esigenze: ogni contrasto diventa un conflitto a scelta obbligata.
- Regole verificabili nel codice (divieto + ambito): una scrittura che le viola viene bloccata.
- Deriva: ogni voce di memoria conserva la riga originale; se il file cambia, la voce va verificata (controllo locale all'avvio e all'analisi).
- Analisi d'impatto: quando una voce viene superata, i task completati che la usavano ricevono una domanda, quelli da fare vengono segnati da rivedere.
- Mantenere la memoria in un conflitto scarta anche la voce nuova che la contraddiceva.
- Conflitti che contraddicevano solo voci ora superate tornano domande normali da verificare.

Pannello: testata con punteggio di qualita, task con stima, "non pronto" e "da rivedere", dettaglio con checklist di prontezza, vincoli e rischi, scheda memoria con ipotesi da confermare, memoria da verificare e rischi.

## 0.2.1 - 2026-10-16

Correzioni:

- Token: il system prompt del mod ora e fisso; lo stato del piano viaggia come contesto del messaggio solo quando cambia (e ogni 15 messaggi, e dopo /clear). Prima ogni modifica al piano invalidava la cache del prompt di tutta la conversazione.
- Memoria protetta: con un aggiornamento approvato si puo modificare solo il file indicato, non tutti i file di memoria.
- task_stato su uno sprint accetta solo annullato o bloccato (prima metteva in-corso anche tutti i task).
- Un task con un conflitto aperto non puo essere segnato completato.
- Se il modello di verifica non e disponibile la risposta non va persa: viene salvata con l'avviso.
- Le domande create da Claude non possono risultare scritte dall'utente ne essere conflitti senza voci collegate.
- Lo sprint corrente si puo chiudere nel pannello.
- superpowers: se non risulta da `claude plugin list` ma e tra le skill, viene usato senza proporre l'installazione.
- Rilevazione di superpowers con timeout piu corto.
- install.bat / uninstall.bat: riconoscimento del marketplace piu robusto.
- 4 test in piu (18).

## 0.2.0 - 2026-10-16

- Analisi della memoria: rileva CLAUDE.md, AGENTS.md, docs, memory-bank, regole e strumenti MCP di memoria (claude-mem); i fatti vincolanti diventano voci di memoria tracciate (M1, M2...).
- Logica esistente: riconosce superpowers, GSD, spec-kit, BMAD, Taskmaster, roadmap e TODO; importa con riferimento al file originale e lo aggiorna senza cambiarne la struttura.
- Fonti di business: incolla email, verbali, documenti o ticket; esigenze estratte e coperte su piu sprint, con percentuale di copertura.
- Conflitti: ogni risposta viene confrontata con memoria, decisioni ed esigenze; in caso di contrasto la scelta e obbligata (mantieni o sostituisci) e il task resta bloccato.
- Protezione della memoria: i file di memoria si modificano solo per applicare scelte approvate.
- Pannello ridisegnato: testata con avanzamento, schede piano/domande/business/memoria, domande una alla volta con tasti 1-9, una sola azione principale (x).
- Domande dell'utente direttamente sui task.
- superpowers: rilevato all'analisi; se manca, il mod ne propone l'installazione.
- Token: contesto fisso piu corto, `piano_leggi` a formati, strumenti rari differiti, verifica con modello piccolo.
- install.bat / uninstall.bat con rimozione delle versioni precedenti e backup delle copie manuali.

## 0.1.0 - 2026-10-16

- Prima versione: sprint, task, domande, pannello, esecuzione autonoma.
