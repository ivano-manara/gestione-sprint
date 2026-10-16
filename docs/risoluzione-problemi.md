# Risoluzione dei problemi

Errori comuni, cosa significano, come uscirne. In fondo, le domande frequenti.

[← torna al README](../README.md)

---

## Indice

- [Installazione](#installazione)
- [La banda e il pannello](#la-banda-e-il-pannello)
- [Blocchi durante il lavoro](#blocchi-durante-il-lavoro)
- [Piano e memoria](#piano-e-memoria)
- [Contesto e compattazione](#contesto-e-compattazione)
- [Domande frequenti](#domande-frequenti)
- [Chiedere aiuto](#chiedere-aiuto)

---

## Installazione

| messaggio | causa | cosa fare |
| --- | --- | --- |
| `comando "claude" non trovato nel PATH` | Claude Code non installato, o terminale aperto prima dell'installazione | installa Claude Code, chiudi e riapri il terminale |
| `il mod non supera la validazione` | la tua versione di Claude Code applica regole diverse | guarda l'errore mostrato e `install.log`; aggiorna Claude Code (`claude update`); apri una segnalazione con l'errore e la versione |
| `manca …\plugin.json` | cartella incompleta o spostata | scarica di nuovo il repository e rilancia `install.bat` dalla sua cartella |
| `marketplace non registrato` | percorso con caratteri strani o permessi | sposta la cartella in un percorso semplice (es. `C:\Progetti\ModProgetti`) e rilancia |
| `CLAUDE_CODE_PLUGIN_DIRS e impostata` | un vecchio mod si carica ancora da cartella | togli la variabile da `%USERPROFILE%\.claude\settings.json` o dalle variabili di Windows |
| `controllo-contesto risulta ancora installato` | disinstallazione non riuscita | `claude plugin uninstall controllo-contesto@<marketplace>` (il nome esatto è in `claude plugin list`) |
| `superpowers non installato` | rete o GitHub non raggiungibili | il mod funziona lo stesso; riprova più tardi con i due comandi del README |
| `Node.js non trovato` o `troppo vecchio` | claude-mem richiede Node 20 o superiore | installa Node da nodejs.org e rilancia `install.bat` |
| `claude-mem non installato` | rete, GitHub o Node | riprova con i due comandi del README; la prima sessione dopo l'installazione può partire senza memoria mentre claude-mem si prepara |

Dopo l'installazione:

```bat
claude plugin list
```

deve mostrare `gestione-sprint@mod-progetti` attivo, e **non** `controllo-contesto`.

---

## La banda e il pannello

| sintomo | causa probabile | cosa fare |
| --- | --- | --- |
| la banda non compare | mod non caricato in questa sessione | `/reload-plugins` o riapri Claude Code; controlla `claude plugin list` |
| la banda compare due volte, o due barre del contesto | il vecchio controllo-contesto è ancora attivo | rilancia `install.bat`; controlla `CLAUDE_CODE_PLUGIN_DIRS` |
| c'è la riga sprint ma non quella del contesto | `showMeter` è `stato` o `spento`, oppure il contesto non è ancora misurato | normale; manda un messaggio o cambia `showMeter` |
| la banda sparisce a tratti | Claude Code mostra un questionario sopra il prompt | torna dopo la risposta |
| il pulsante ▶ è attenuato e dice "Claude sta lavorando" | Claude sta ancora lavorando: i pulsanti che gli mandano un messaggio aspettano | premi di nuovo a fine turno; Domande e Piano funzionano sempre |
| i tasti `x` `d` `b` `p` scrivono nel prompt | il cursore è nel prompt, non sulla banda | clicca un pulsante, oppure `ctrl+x tab` per spostarti sulla banda |
| il pannello non si apre al clic | il terminale non passa i clic del mouse | usa `ctrl+x tab` e i tasti, oppure `/sprint` |
| caratteri strani al posto di `█` `░` | il terminale non ha i caratteri a blocchi | opzione `barStyle` = `ascii`; su Windows usa Windows Terminal |
| colori poco leggibili | tema del terminale | i colori seguono il tema: provane uno scuro o chiaro diverso |
| `Sprint ⚠ piano.json non leggibile` | il file è rovinato (modifica a mano, merge di git) | vedi [piano.json rovinato](#pianojson-rovinato) |

---

## Blocchi durante il lavoro

Ogni blocco spiega il motivo. I più comuni:

| messaggio | perché | cosa fare |
| --- | --- | --- |
| `il piano e le fonti si modificano solo con gli strumenti` | Claude ha provato a scrivere `piano.json` a mano | normale: Claude userà `piano_aggiorna` |
| `la memoria del progetto non si modifica direttamente` | modifica a CLAUDE.md o simili senza un aggiornamento approvato | se il fatto è cambiato, scegli `2` sul conflitto; poi ▶ Aggiorna la memoria |
| `questa modifica viola la memoria del progetto: M2 …` | il codice usa ciò che una regola vieta | se la regola è giusta, Claude cambia approccio; se è sbagliata, crea un conflitto e scegli |
| `S2-T1 ha domande aperte` | task in corso con domande bloccanti | ▶ Rispondi alla domanda |
| `non e pronto (definition of ready)` | mancano criteri, dipendenze o risposte | ▶ Prepara il task |
| `non puo dirsi completato` | manca la prova nella nota o c'è un conflitto | Claude deve verificare e scrivere la prova |
| comando di terminale rifiutato su un file di memoria | scrittura con `>`, `sed -i`, `cp`, `rm`… | come sopra: serve un aggiornamento approvato |
| lettura di `.env` rifiutata | protezione delle credenziali | normale; `protectSecrets` = `false` per disattivarla (sconsigliato) |

Troppi blocchi sui dubbi aperti mentre esplori? Opzione `sicurezza` = `avvisa`: i dubbi vengono solo segnalati.

---

## Piano e memoria

### piano.json rovinato

Il mod **non sovrascrive mai** un `piano.json` che non riesce a leggere. Finché non è corretto, ogni modifica si ferma.

1. Apri `.claude/sprint/piano.json` e cerca l'errore indicato nella banda (spesso una virgola o un conflitto di merge `<<<<<<<`).
2. Oppure recupera l'ultima versione buona: `git checkout -- .claude/sprint/piano.json`.
3. Oppure rinomina il file per ripartire da zero.
4. Clicca **Ricarica** nella banda (o `r` nel pannello).

### Altri casi

| sintomo | causa | cosa fare |
| --- | --- | --- |
| `memoria cambiata fuori dal piano: M3` | qualcuno ha cambiato la riga di CLAUDE.md da cui veniva M3 | rispondi alla domanda bloccante: la voce vale ancora o va sostituita? |
| `verifica non eseguita` su una risposta | il modello dei controlli non ha risposto | la risposta è salvata; usa `/contraddizioni` per ricontrollare |
| troppi conflitti inutili | voci di memoria troppo generiche | chiedi a Claude di riformularle in modo più preciso; scegli `1` sui falsi conflitti |
| Claude non ha importato il mio piano | metodo non riconosciuto | indica i file nel prompt prima di ▶ Crea il piano, es. "il piano è in docs/roadmap.md" |
| la stessa email non si aggiunge | il testo è già una fonte | normale: lo dice il messaggio con l'id della fonte |
| il punteggio di qualità resta basso | problemi critici aperti | nel pannello premi `g`: Claude corregge ciò che può, il resto diventa domande |

---

## Contesto e compattazione

| sintomo | cosa fare |
| --- | --- |
| la barra resta alta dopo `/compact` | la misura si aggiorna al messaggio successivo |
| il riassunto ha perso un dettaglio | `/alleggerisci <cosa conservare>` lo tiene di sicuro; il piano resta comunque nel file |
| un comando ha l'output troppo corto | ripetilo con `CC_RAW=1` davanti; oppure `compressOutput` = `false` |
| un file grande viene rifiutato | alza `maxFileKb` o metti `largeFileAction` = `warn` |

Guida completa: [modulo-contesto.md](modulo-contesto.md).

---

## Domande frequenti

<details>
<summary><b>Devo usare per forza i pulsanti?</b></summary>

No. Ogni pulsante ha un comando equivalente (`/sprint`, `/sprint-procedi`…), e puoi rispondere alle domande anche scrivendo in chat.
</details>

<details>
<summary><b>Il mod cambia il mio CLAUDE.md?</b></summary>

Solo per applicare un aggiornamento che hai approvato tu, scegliendo `2` su un conflitto. Mai di sua iniziativa.
</details>

<details>
<summary><b>Posso modificare piano.json a mano?</b></summary>

Sì, con un editor. Dopo, clicca **Ricarica** o premi `r` nel pannello. Claude invece non può: deve usare gli strumenti del mod.
</details>

<details>
<summary><b>Funziona senza claude-mem?</b></summary>

Sì, ma ogni sessione riparte dai soli file e l'analisi rilegge di più. Il mod te lo propone una volta; se rifiuti non lo chiede più. Per non sentirlo mai: opzione `claudeMem` = `spento`.
</details>

<details>
<summary><b>Funziona senza superpowers?</b></summary>

Sì. Il mod usa un metodo di brainstorming integrato e ti ricorda che superpowers darebbe un risultato migliore.
</details>

<details>
<summary><b>Quanto costa in token?</b></summary>

Poco: 5-7 righe fisse nel system prompt (in cache), 2-5 righe di stato con ogni messaggio, e una chiamata breve a haiku per ogni risposta o modifica al piano da controllare. L'analisi iniziale è la parte più costosa, come ogni brainstorming.
</details>

<details>
<summary><b>Posso usarlo su progetti non PHP o Python?</b></summary>

Sì. Il piano funziona con qualsiasi progetto. Le regole specifiche (Laravel, LangChain) si attivano solo dove servono.
</details>

<details>
<summary><b>Ho due account Claude sullo stesso PC.</b></summary>

I plugin sono legati all'utente di Windows, non all'account Claude. Controlla con `claude plugin list` dopo il login; se manca, rilancia `install.bat`.
</details>

<details>
<summary><b>Il mio PC è gestito dall'azienda.</b></summary>

Alcune funzioni (contesto nel system prompt, compattazione) possono essere limitate dalle impostazioni centrali. Il mod ha delle riserve; se non compare in `claude plugin list`, chiedi all'amministratore.
</details>

<details>
<summary><b>Come tolgo tutto?</b></summary>

`uninstall.bat`. I piani nei progetti restano: se vuoi, cancella a mano `.claude/sprint` in ogni progetto.
</details>

---

## Chiedere aiuto

Apri una segnalazione con il modello "segnalazione di un problema" e allega:

- `claude --version`;
- il messaggio esatto e, per l'installazione, `install.log`;
- cosa stavi facendo e cosa ti aspettavi.

Non allegare `piano.json` se contiene dati del cliente: basta la parte che dà problemi, con i testi anonimizzati.

[← torna al README](../README.md)
