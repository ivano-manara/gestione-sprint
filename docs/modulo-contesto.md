> Documentazione completa del modulo contesto, incluso nel mod **gestione-sprint** dalla versione 0.4.0.
> Il mod separato controllo-contesto non va più installato: `install.bat` lo toglie.
>
> [← torna al README](../README.md)

<div align="center">

# 🧭 modulo contesto (ex controllo-contesto)

**Meno contesto sprecato, meno token, sessioni più lunghe.**
Un mod per Claude Code pensato per progetti **Laravel**, **PHP**, **Python** e **LangChain / LangGraph**.

![modulo](https://img.shields.io/badge/modulo%20di-gestione--sprint%200.8.3-blue)
![Claude Code](https://img.shields.io/badge/Claude%20Code-2.1.301-orange)
![stack](https://img.shields.io/badge/stack-Laravel%20%7C%20PHP%20%7C%20Python%20%7C%20LangChain-6f42c1)
![piattaforma](https://img.shields.io/badge/piattaforma-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

[Avvio rapido](#-avvio-rapido) ·
[Funzioni](#-funzioni) ·
[Comandi](#-comandi) ·
[Opzioni](#%EF%B8%8F-opzioni) ·
[Come funziona](#-come-funziona) ·
[Domande frequenti](#-domande-frequenti)

</div>

---

## 💡 Perché

Claude rilegge l'intera conversazione a ogni messaggio.
Ogni file letto per intero, ogni elenco enorme, ogni cartella di dipendenze esplorata
resta nel contesto e si paga a ogni turno.

Questo mod interviene **prima** che succeda:

| Senza il mod | Con il mod |
| --- | --- |
| Legge `laravel.log` intero (migliaia di righe) | Legge solo la fine con `tail -n 100` o cerca `local.ERROR` |
| Apre `composer.lock` per una versione | Usa `composer show vendor/pacchetto` |
| Esplora `vendor/` o `.venv/` | Cartella esclusa, con il motivo |
| `php artisan route:list` con centinaia di rotte | Suggerisce `--path=` o `--except-vendor` |
| `pytest` con output completo | `pytest -q --tb=short` |
| Stack trace di Laravel con 60 frame di `vendor/` | Errore + frame del tuo codice + "… 44 frame di librerie omessi" |
| `php artisan test` con 120 righe `✓` | Una riga di riepilogo, fallimenti completi |
| Cerca la configurazione tra i file di Laravel 11 | Sa che sta in `bootstrap/app.php` e usa `config:show` |
| Legge tutte le migrazioni per capire lo schema | `php artisan model:show Cliente` (Laravel ≥ 9.24) |
| Ti accorgi tardi che la sessione è pesante | Barra grafica colorata sopra il prompt, riga di stato e avvisi al 60% e all'80% |
| `AIMessage(...)` con `response_metadata`, `usage_metadata`, id di run | Solo contenuto e `tool_calls` |
| Embedding stampati: 1536 numeri | `[0.01, -0.04, 0.09, … 1536 numeri]` |
| 40 volte lo stesso `LangChainDeprecationWarning` in pytest | Una riga con `[ripetuto 40 volte]` |

---

## 🚀 Avvio rapido

**Windows: lancia `install.bat` nella cartella del repository** (installa tutto il mod gestione-sprint).

Oppure da terminale (cmd o PowerShell), nella cartella del mod:

```bat
claude plugin marketplace add C:\Progetti\ModProgetti
claude plugin install gestione-sprint@mod-progetti
```

Poi apri una nuova sessione di Claude Code e prova:

```
/peso
```

> Il mod non dipende dall'account Claude: funziona con qualsiasi abbonamento.

---

## ✨ Funzioni

### 📊 Misura
- **Barra grafica sopra il prompt**, colorata per livello (verde, giallo, rosso):

  ```
  Contesto ████████████░░░░░░░░ 62%  124k/200k · liberi 76k · risparmiati ~18k · piano 5h 35%  [Alleggerisci] [Dettagli]
  ```

  Il pulsante **Alleggerisci** compare dal 60%. **Dettagli** apre il pannello. `/barra` la nasconde o la rimostra.
- **Riga di stato** con mini-barra: `Contesto ▕██████░░░░▏ 62% 124k/200k · laravel`.
- **Pannello `/contesto`**: la barra grande, il limite del piano e una barra per ogni voce (messaggi, strumenti, memoria, MCP).
- La misura parte all'apertura della sessione, senza aspettare la prima risposta, e si aggiorna dopo ogni compattazione.
- **Avvisi** quando il contesto supera il 60% e l'80%, e dopo 40 turni.
- **Azzeramento** automatico degli avvisi dopo una compattazione.

### 🧹 Rimedi
- **`/peso`**: cosa occupa il contesto e cosa fare, con la barra. Non consuma token.
- **`/contesto`**: pannello grafico del contesto. Non consuma token.
- **`/alleggerisci`**: compatta la sessione conservando obiettivo, decisioni e file toccati.
- **`/passaggio`**: riepilogo breve per ripartire in una sessione nuova.
- **`/claudemd`**: un `CLAUDE.md` minimo per il tuo tipo di progetto. Non consuma token.
- **Compattazione automatica** (opzionale, spenta di default).

### 🗜️ Compressione intelligente dell'output
Riduce il rumore, **mai l'informazione utile**.

| Sempre conservato | Ridotto |
| --- | --- |
| Errori, eccezioni, avvisi, `SQLSTATE`, `Deprecated` | Frame di `vendor/`, `site-packages/`, `node_modules/` (resta il primo di ogni blocco) |
| Test falliti, asserzioni, riepilogo finale | Test superati (`✓ …`) raggruppati con il conteggio |
| Frame del tuo codice (`app/`, `src/`, `tests/`) | Righe identiche ripetute → una riga con `(×37)` |
| Inizio e fine dell'output | Righe di uguale forma: log INFO, `Downloading …`, `Installing …` |
| Contenuto e `tool_calls` dei messaggi LangChain | `additional_kwargs`, `response_metadata`, `usage_metadata`, id di run; testi oltre 600 caratteri |
| Blocchi di errore dei tracciati `set_debug(True)` | Blocchi JSON lunghi dei tracciati (restano inizio, fine e righe di errore) |
| La prima volta di ogni avviso, con il conteggio | Lo stesso avviso ripetuto (pytest *warnings summary*, `npm WARN deprecated`, `PHP Deprecated`, Pydantic) |
| Le prime 3 volte di un errore identico | Le ripetizioni successive con i loro frame |
|  | Liste di numeri (embedding, array numpy) → primi tre e conteggio |
|  | Righe di `pip`/`uv` (`Requirement already satisfied`, `Collecting`, `Downloading`…) |
|  | Colori e barre di avanzamento |

Tre livelli, scelti dal comando:

| Livello | Comandi | Cosa fa |
| --- | --- | --- |
| **completo** | `php artisan test`, `phpunit`, `pest`, `pytest`, `composer install`, `npm install/build`, `pip install`, `migrate`, `phpstan`, `rector`, `php-cs-fixer`, `ruff`, `mypy`, `pylint`, `langgraph dev` | tutte le riduzioni |
| **leggero** | tutto il resto, compreso `tail` sui log e `python agente.py` | frame di librerie, duplicati, avvisi ripetuti, metadati LangChain, numeri, log INFO e DEBUG |
| **nessuno** | `git diff`, `git show`, `grep`, `rg`, `cat`, `find`, `ls`, output JSON | niente: lì ogni riga conta |

- Si comprime solo sopra i 3.000 caratteri e solo se il guadagno supera il 20%.
- L'output compresso inizia sempre con una riga che dice cosa è stato ridotto.
- **Via di fuga:** `CC_RAW=1 comando` restituisce l'output originale. Il modello lo sa dall'intestazione.
- `/peso` mostra quanti token ha risparmiato la compressione nella sessione.

Esempio reale, `tail -n 103 storage/logs/laravel.log` (12.616 → 841 caratteri):

```
[gestione-sprint: output compresso da 103 a 12 righe. ...]
[2026-10-15 10:00:00] local.INFO: richiesta ok id=0
[2026-10-15 10:01:00] local.INFO: richiesta ok id=1
  … 37 righe simili omesse
[2026-10-15 10:39:00] local.INFO: richiesta ok id=39
[2026-10-15 11:00:00] local.ERROR: SQLSTATE[42S02]: Base table or view not found: ...
[stacktrace]
#0 /var/www/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(183): ...
… 13 frame di librerie omessi
#14 /var/www/app/Http/Controllers/ClienteController.php(42): ...->get()
#15 /var/www/vendor/laravel/framework/src/Illuminate/Pipeline/Pipeline.php(183): ...
… 44 frame di librerie omessi
#60 {main}
```

### 🧬 Consapevole della versione di Laravel
La versione si legge da `composer.lock` (esatta) o da `composer.json` (indicativa).
La struttura si verifica sui file, perché un progetto aggiornato dalla 10 alla 11 può avere ancora i `Kernel.php`.
Il modello riceve una guida breve (circa 150 token, una volta per sessione) con le scorciatoie giuste:

| Versione | Cosa sa il modello |
| --- | --- |
| **11, 12, 13** (struttura snella) | Middleware, eccezioni e rotte in `bootstrap/app.php`; `config:show <file>` invece di cercare in `config/` |
| **≥ 9.24** | `model:show <Modello>` e `db:table <tabella>` invece di leggere tutte le migrazioni; `php artisan about` |
| **9, 10** (struttura classica) | Middleware in `app/Http/Kernel.php`, eccezioni in `app/Exceptions/Handler.php` |
| **≤ 8** | `route:list --compact` (dalla 9 sostituito da `--except-vendor`) |

Anche il suggerimento su `route:list` usa le opzioni giuste per la versione.

### 🦜 Consapevole di LangChain e LangGraph

Riconosce il progetto da `langgraph.json` o dalle dipendenze (`pyproject.toml`, `requirements.txt`, `Pipfile`).
Legge le versioni da `uv.lock` o `poetry.lock` (esatte) oppure dalle dipendenze (indicative).

| Versione | Cosa sa il modello |
| --- | --- |
| **tutte** | `pip show` invece di site-packages; `draw_mermaid()` per la struttura del grafo; `stream_mode="updates"`; niente `set_debug(True)` su esecuzioni lunghe |
| **LangChain 1.x** | Agenti con `create_agent` di `langchain.agents`; catene storiche in `langchain-classic` |
| **LangGraph 1.x** | `create_react_agent` di `langgraph.prebuilt` è deprecato |
| **LangChain 0.x** | Preferire LCEL e LangGraph a `LLMChain` e `AgentExecutor` |

### 💬 Suggerimenti proattivi: non devi ricordarti i comandi

Il mod guarda la sessione e **propone lui** l'azione giusta, con i pulsanti pronti sopra il prompt:

```
Contesto ███████████████████████████░░░ 95%  190k/200k · liberi 10k                    [Dettagli]
⚠ Contesto al 95%: vuoi compattare adesso? Il lavoro resta nel registro verificato.
  [1 Compatta ora]  [2 Passaggio a sessione nuova]  [3 Più tardi]
```

| Quando | Cosa propone |
| --- | --- |
| Contesto oltre il 60% | Compattare ora, che costa poco |
| Oltre l'80% | Compattare o ripartire con un riepilogo |
| Oltre il 90% (`criticalPercent`) | La domanda diretta: *"vuoi compattare adesso?"* |
| Limite del piano oltre l'80% | Alleggerire per far durare i messaggi rimasti |
| Più di 40 turni | Ripartire con un riepilogo se cambi argomento |
| 3 o più errori aperti | Guardarli insieme nel pannello |
| Strumenti MCP oltre 15k token | Disattivare i server inutili |
| Progetto senza `CLAUDE.md` | Crearne uno breve con un clic (non sovrascrive mai) |

- **Una proposta alla volta** nella banda, la più urgente; tutte nel pannello `/contesto`.
- Le proposte gialle e rosse arrivano anche come avviso, una volta sola.
- **Più tardi** rimanda finché la situazione non peggiora di 10 punti o diventa più grave.
- **Non chiedere più** vale per la sessione.
- **Compatta ora** mentre il modello lavora diventa *Compatta a fine turno*.
- I pulsanti si premono anche con i tasti `1`, `2`, `3` quando la banda ha il focus (un clic o `ctrl+x tab`).
- Nulla parte da solo: decidi sempre tu. Per la compattazione senza domande resta `autoCompactPercent`.

### ⚖️ Contraddizioni: la memoria resta pulita

In una sessione lunga capita di cambiare idea: *"usa MySQL"*, poi *"passa a SQL Server"*.
Un riassunto automatico può riportarle entrambe come valide, e da lì il modello lavora su una memoria rotta.

```
? Contraddizione su «database»: prima «usa MySQL per i clienti», poi «passa a SQL Server». Quale vale?
  [1 Vale la più recente]  [2 Vale la prima]  [3 Valgono entrambe]  [4 Non è una contraddizione]
```

**Prima chiarisco, poi compatto.** Ogni compattazione chiesta da te (*Compatta ora*, `/alleggerisci`, `/compact`, quella a fine turno o automatica del mod) segue questo percorso:

```
chiedi di compattare
   │
   ▼
controllo delle richieste nuove ──► nessuna contraddizione ──► compatta
   │
   ▼ contraddizioni aperte
"Prima di compattare (1 di 2): … Quale vale?"
[Vale la più recente] [Vale la prima] [Valgono entrambe] [Non è una contraddizione] [Compatta lo stesso] [Annulla]
   │
   ▼ chiarita l'ultima
compatta da solo, con le scelte dentro le istruzioni del riassunto
```

- **Compatta lo stesso**: le contraddizioni finiscono nel riassunto come domande aperte, senza che il modello scelga.
- **Annulla**: niente compattazione; le contraddizioni restano nel pannello.
- `/compact` scritto da te viene fermato con un messaggio e ripreso dopo i chiarimenti.
- La compattazione automatica del motore (contesto pieno) non si ferma mai: lì le contraddizioni aperte vanno nel riassunto come domande.
- Funziona anche con i suggerimenti proattivi spenti: i chiarimenti fanno parte della compattazione.

| Passo | Come |
| --- | --- |
| **Quando controlla** | Subito se scrivi parole come *invece*, *anzi*, *non più*, *al posto di*, *cambia*; altrimenti ogni 3 richieste; sempre prima di compattare |
| **Chi controlla** | Un modello piccolo (`haiku`), in background: confronta le tue richieste e le decisioni già valide, cita i testi alla lettera |
| **Chi decide** | Tu, con un pulsante: la più recente, la prima, entrambe (contesti diversi), oppure "non è una contraddizione" |
| **Effetto immediato** | La scelta arriva al modello con il tuo messaggio successivo |
| **Nella compattazione** | Il riassunto riceve le decisioni **valide**, quelle **superate** (da non riportare come valide) e le domande **ancora aperte** (da non decidere da solo) |
| **Dopo la compattazione** | Il mod controlla il riassunto: se riporta come valida una decisione superata, al messaggio dopo arriva *"ATTENZIONE: … è superata da …"* |

- `/contraddizioni` controlla subito e apre il pannello con decisioni valide (✓), superate (✗) e domande aperte.
- La memoria delle decisioni sopravvive a compattazioni e ricariche del mod.
- Costo: una chiamata breve al modello piccolo ogni qualche richiesta, fuori dal contesto della sessione. Si spegne con `conflictCheck: false`.

### 🔒 Garanzie di qualità: la memoria non si rompe

Due rischi: la **compressione** può togliere una riga che serviva; la **compattazione** (riassunto fatto da un modello) può dimenticare un pezzo di lavoro. Il mod li controlla entrambi.

**Compressione verificata.** Prima di consegnare un output compresso, il mod controlla le *ancore*:
ogni errore e avviso distinto, ogni riepilogo (`Tests: …`, `== 3 failed ==`, `Found 5 errors`) e ogni riferimento `file:riga` del tuo codice.
Se ne manca anche una, scarta il risultato e riprova al livello leggero; se manca ancora, consegna l'originale.

| Output di prova | Prima | Dopo | Ancore perse |
| --- | --- | --- | --- |
| Log Laravel, stesso errore 6 volte con trace | 43.001 car | 1.334 | 0 |
| `php artisan test`, 300 ok e 2 falliti | 11.673 | 520 | 0 |
| pytest con 60 `LangChainDeprecationWarning` | 12.833 | 427 | 0 |
| Agente LangGraph con metadati ed embedding | 101.872 | 1.974 | 0 |
| `composer install`, 120 pacchetti | 12.253 | 426 | 0 |
| `ruff` con 400 segnalazioni, tutte utili | 17.381 | 17.381 (non compresso: ogni riga serve) | 0 |

**Originale sempre recuperabile.** L'output completo va in un file temporaneo (anello di 20 file in `%TEMP%\controllo-contesto`).
L'intestazione ne dà il percorso: il modello lo legge con Grep o Read a pezzi, **senza rieseguire** il comando (fondamentale per `migrate` o `composer update`).

**Algoritmi.**
- *Selezione con contesto*: quando un output va tagliato, restano inizio, fine e ogni riga d'errore con la riga prima e dopo.
- *Raggruppamento dei log intrecciati* (in stile Drain): le forme frequenti sparse restano due volte con il conteggio.
- *Errori ripetuti*: le prime 3 volte intere, poi il conteggio e l'ora dell'ultima.
- *Budget adattivo*: sotto il 40% di contesto fino a 600 righe; sopra il 70% al massimo 250.
- *Escalation*: se il modello ripete lo stesso comando, la seconda volta si comprime meno e la terza per niente.

**Compattazione verificata.** Il mod tiene un *registro del lavoro* piccolo e certo: file modificati, errori aperti (chiusi quando lo stesso comando riesce) e ultime richieste.
- Ogni compattazione (`/alleggerisci`, `/compact` e quella automatica) riceve istruzioni con **sezioni fisse** (obiettivo, decisioni, file, stato, prossimo passo), l'obbligo di **copiare alla lettera** nomi, percorsi ed errori, e l'elenco dei punti del registro.
- A riassunto fatto, il mod **controlla** che ci siano: *"Riassunto verificato: 5/6 punti conservati"*.
- Ciò che manca torna al modello come **nota di continuità** al messaggio successivo, una volta sola.
- Il registro resta anche se il mod si ricarica. `/contesto` mostra gli errori aperti.

### 🧠 Integrazione con claude-mem

Se usi [claude-mem](https://docs.claude-mem.ai), il mod lo riconosce da solo (plugin installato, strumenti MCP o cartella `~/.claude-mem`) e lavora con lui. Lo stesso riconoscimento vale per il modulo sprint: [README](../README.md#claude-mem-la-memoria-tra-le-sessioni).

| Dove | Senza claude-mem | Con claude-mem |
| --- | --- | --- |
| Prompt di sistema | — | Il modello cerca nella memoria (`search` → `timeline` → `get_observations` sugli id filtrati) invece di riesplorare il codice |
| File di codice oltre 200 KB | "Cerca con Grep, poi offset e limit" | "`smart_outline` per i simboli, poi `smart_unfold` sul simbolo" |
| `/passaggio` | Riepilogo da copiare e incollare | Riepilogo salvato con `save_memory`: la sessione nuova lo ritrova da sola |
| `/alleggerisci` | Riassunto normale | Riassunto più corto: il dettaglio è già in memoria |
| `get_observations` con più di 10 id | — | Suggerimento di filtrare prima (ognuna costa ~500-1000 token) |
| `/peso` | — | Peso degli strumenti MCP di claude-mem e consiglio su `CLAUDE_MEM_CONTEXT_OBSERVATIONS` |
| Cartelle escluse | — | `.claude-mem` (database e indici); `settings.json` si legge e si modifica |
| Scritture | — | database, indici e log di `.claude-mem` si modificano solo con gli strumenti di claude-mem; `settings.json` resta modificabile |
| Chi vale | — | piano.json per piano, regole e decisioni approvate; CLAUDE.md per le regole del progetto; claude-mem per la storia |

I nomi degli strumenti sono letti dalla sessione, quindi la guida usa quelli esatti.
La compressione dell'output aiuta anche claude-mem: osserva output più corti.
Opzione `claudeMem`: `auto` (default), `attivo`, `spento`.

### 🛡️ Blocchi intelligenti
- **Cartelle inutili**: dipendenze, build, cache, ambienti virtuali.
- **File grandi**: oltre 200 KB si leggono solo a pezzi.
- **File pesanti per tipo**: log, lock, file generati, dati, notebook (oltre 20 KB), ognuno con il suo rimedio.
- **File binari**: indici vettoriali e pesi dei modelli (`.faiss`, `.npy`, `.safetensors`, `.pt`, `.gguf`, `.onnx`).
- **Credenziali**: `.env`, chiavi, certificati, `auth.json` di Composer, `.npmrc`, `.pypirc`, `.git-credentials` non entrano nel contesto, né con Read né con Grep né da terminale (`cat`, `head`, `grep`, `Get-Content`, `git diff` …). `.env.example` sì.
- **Comandi con output enorme**: suggerimento della versione filtrata.

### 🔍 Riconoscimento del progetto

| Se trova | Profilo | Esclude in più |
| --- | --- | --- |
| `artisan` | Laravel | `vendor`, `storage/framework`, `bootstrap/cache`, `public/build`, `public/vendor`, `public/hot` |
| `composer.json` | PHP | `vendor`, `.phpunit.cache` |
| `pyproject.toml`, `requirements.txt`, `setup.py`, `setup.cfg`, `Pipfile` | Python | `.venv`, `site-packages`, `__pycache__`, `.mypy_cache`, `.pytest_cache`, `.ruff_cache`, `.tox`, `*.egg-info`, `htmlcov` |
| `langgraph.json`, oppure `langchain`/`langgraph` tra le dipendenze | LangChain (+ Python) | `.langgraph_api`, `chroma_db`, `.chroma`, `faiss_index`, `.lancedb`, `qdrant_storage`, `mlruns`, `wandb` |

I profili si sommano: un progetto Laravel con script Python li usa entrambi.
`storage/logs` resta leggibile, perché i log servono al debug.

---

## 🧰 Comandi

| Comando | Cosa fa | Costo |
| --- | --- | --- |
| `/contesto` | Pannello grafico: barra, limite del piano, una barra per voce | gratis |
| `/barra` | Nasconde o rimostra la barra sopra il prompt | gratis |
| `/contraddizioni` | Controlla subito le contraddizioni e mostra decisioni valide e superate | una chiamata breve al modello piccolo |
| `/peso` | Le voci più pesanti del contesto, profilo, cartelle escluse e cosa fare | gratis |
| `/claudemd` | Propone un `CLAUDE.md` breve per Laravel, PHP, Python o LangChain | gratis |
| `/alleggerisci [cosa conservare]` | Compatta la sessione e dice da quanti a quanti token | una chiamata al modello |
| `/passaggio` | Scrive nel prompt la richiesta di un riepilogo per una nuova sessione | una risposta breve |

Esempio:

```
/alleggerisci conserva le decisioni sulla migrazione della tabella clienti
```

---

## ⚙️ Opzioni

Si cambiano con:

```bat
claude plugin configure gestione-sprint@mod-progetti
```

oppure, in una sessione, con `/plugin configure gestione-sprint@mod-progetti` o `/config`.
Se non le tocchi valgono i default.

| Opzione | Default | Descrizione |
| --- | --- | --- |
| `profile` | `auto` | `auto`, `laravel`, `php`, `python`, `langchain`, `generico` |
| `showMeter` | `entrambi` | Indicatore: `entrambi`, `banda` (sopra il prompt), `stato` (riga di stato), `spento` |
| `barStyle` | `blocchi` | `blocchi` (█░) oppure `ascii` (#-) per terminali che non mostrano i blocchi |
| `claudeMem` | `auto` | Integrazione con claude-mem: `auto`, `attivo`, `spento` |
| `warnPercent` | `60` | Primo avviso sul contesto (%) |
| `strongPercent` | `80` | Consiglia una nuova sessione (%) |
| `criticalPercent` | `90` | Chiede subito se compattare (%) |
| `proactive` | `true` | Suggerimenti proattivi con pulsanti |
| `conflictCheck` | `true` | Controllo delle contraddizioni tra le tue richieste |
| `conflictModel` | `haiku` | Modello usato per il controllo |
| `maxTurns` | `40` | Avviso di sessione lunga |
| `maxFileKb` | `200` | Limite per leggere un file intero |
| `heavyFileKb` | `20` | Limite per log, lock, generati, dati, notebook |
| `largeFileAction` | `block` | `block` rifiuta, `warn` avvisa soltanto |
| `blockedDirs` | elenco comune | Cartelle sempre escluse, in più al profilo |
| `autoCompactPercent` | `0` | Compattazione automatica a fine turno (0 = spenta) |
| `compactInstructions` | vuoto | Note in più per il riassunto (struttura e registro ci sono già) |
| `suggestRemedies` | `true` | Gli avvisi citano i comandi di rimedio |
| `stackHints` | `true` | Suggerimenti su `route:list`, `artisan list`, `composer show`, `npm ls`, `pip list`, `git log` |
| `quietTests` | `true` | `pytest` con meno output |
| `protectSecrets` | `true` | Non legge `.env`, chiavi e certificati |
| `compressOutput` | `true` | Compressione intelligente dell'output dei comandi |
| `compressMinChars` | `3000` | Sotto questa lunghezza l'output non si tocca |
| `projectGuide` | `true` | Guida breve per la versione di Laravel e di LangChain/LangGraph |

In `blockedDirs` puoi scrivere:
- un nome: `vendor`
- un percorso: `storage/framework`
- un suffisso: `*.egg-info`

Per progetti .NET aggiungi `bin` e `obj`.

---

## 🔧 Come funziona

Il mod si aggancia a pochi eventi di Claude Code:

```
avvio sessione ──► riconosce il progetto ──► sceglie le regole
        │
lettura file / ricerca / comando ──► controllo ──► passa
        │                                  └──► rifiuta con il rimedio
        │
misura del contesto ──► barra di stato + avvisi
        │
fine turno ──► avviso turni + compattazione automatica (se attiva)
        │
output di un comando ──► livello (completo / leggero / nessuno) ──► compressione
        │
primo messaggio (Laravel) ──► guida per la versione, una volta sola
```

La guida Laravel va nel prompt di sistema quando Claude Code lo permette.
Dove non è permesso (ambienti gestiti, plugin di sicurezza), arriva come nota allegata al primo messaggio: il costo è lo stesso.

**Tre principi**
1. **Rifiutare con un'alternativa.** Ogni blocco dice al modello cosa fare al suo posto.
2. **Mai bloccare il lavoro per un errore del mod.** Se un controllo fallisce, la chiamata passa.
3. **Precisione prima di tutto.** I comandi di terminale vengono analizzati comando per comando:
   `git commit -m "fix build"` passa, `ls build` no.

**Suggerimenti morbidi.** Per `route:list`, `composer show`, `npm ls` e `git log` senza filtri
il primo tentativo riceve la versione filtrata. Se l'utente vuole davvero l'elenco completo,
lo stesso comando ripetuto passa.

---

## 🧪 Sviluppo

```bat
claude plugin validate .
claude plugin test .
```

Per lavorare sul codice con i tipi nell'editor, carica il mod una volta (`claude --plugin-dir .`):
Claude Code crea `.claude-plugin/types/`, che resta fuori dal controllo di versione.

Per aggiungere una regola:
- **cartelle di un profilo** → `PROFILE_DIRS` in `gestione-sprint/hooks/contesto/stack.ts`
- **tipi di file pesanti** → `HEAVY_RULES` in `gestione-sprint/hooks/contesto/stack.ts`
- **comandi da filtrare** → `stackHintFor` in `gestione-sprint/hooks/contesto/stack.ts`
- **comandi da comprimere** → `FULL` e `NEVER` in `gestione-sprint/hooks/contesto/compress.ts`
- **indicazioni per una versione di Laravel** → `laravelGuide` in `gestione-sprint/hooks/contesto/laravel.ts`
- **indicazioni per LangChain/LangGraph** → `langchainGuide` in `gestione-sprint/hooks/contesto/langchain.ts`
- **metadati LangChain da togliere** → `NOISY_KWARGS` in `gestione-sprint/hooks/contesto/compress.ts`
- **aspetto della barra** → `gestione-sprint/hooks/contesto/meter.ts`

Ogni regola nuova va con un test in `gestione-sprint/hooks/contesto/stack.test.ts`.

---

## ❓ Domande frequenti

<details>
<summary><b>Ho due account Claude sullo stesso PC: devo installarlo due volte?</b></summary>

Di solito no. I plugin sono legati all'utente di Windows (cartella `%USERPROFILE%\.claude`), non all'account Claude.
Dopo il login con l'altro account controlla con `claude plugin list`.
Se non compare, lancia di nuovo `install.bat`.
</details>

<details>
<summary><b>E su un altro PC?</b></summary>

Copia la cartella del repository e lancia `install.bat` da lì: l'installer usa la cartella in cui si trova.
</details>

<details>
<summary><b>Il mod ha bloccato una cosa che mi serve.</b></summary>

Il messaggio dice sempre perché. Puoi:
- togliere la cartella da `blockedDirs`;
- alzare `maxFileKb` o `heavyFileKb`;
- mettere `largeFileAction` a `warn`;
- disattivare `protectSecrets`, `stackHints` o `quietTests`.
</details>

<details>
<summary><b>La compressione può nascondere qualcosa che serve?</b></summary>

È progettata per non farlo: righe di errore, avviso e test falliti non vengono mai tolte,
e i comandi dove ogni riga conta (`git diff`, `grep`, `cat`, JSON) non vengono mai compressi.
Se il modello ha bisogno dell'output completo, l'intestazione gli dice di ripetere il comando con `CC_RAW=1` davanti.
Per spegnerla: `compressOutput` a `false`.
</details>

<details>
<summary><b>Funziona nella chat di claude.ai?</b></summary>

No. È un mod per Claude Code (terminale e sessioni Claude Code avviate dall'app desktop).
</details>

<details>
<summary><b>Il mio PC è gestito dall'azienda.</b></summary>

Se l'organizzazione gestisce Claude Code con impostazioni centrali, alcuni eventi
(la compattazione) non arrivano ai plugin installati dall'utente, e i plugin potrebbero essere disattivati.
Il mod ha una riserva per gli avvisi. Se non compare in `claude plugin list`, chiedi all'amministratore.
</details>

---

## ⚠️ Limiti

- La protezione di `.env` copre la lettura diretta e `cat`. **Non è una garanzia di sicurezza**:
  una ricerca su tutta la cartella può ancora toccarlo.
- Le cartelle "pesanti" sono quelle degli elenchi: il mod non conta i file dentro una cartella qualsiasi.
- Barra di stato e avvisi dipendono da cosa il terminale riesce a mostrare.
- Provato su Linux (Claude Code 2.1.300). Su Windows sono gestiti percorsi e comandi `type` e `Get-Content`,
  ma l'installer va verificato al primo uso.

---

