# Sicurezza

## Segnalare un problema

Non aprire una issue pubblica.
Usa la segnalazione privata di GitHub (scheda **Security** → **Report a vulnerability**) oppure scrivi al responsabile del repository.

Indica:

- versione del mod e `claude --version`;
- cosa succede e come riprodurlo;
- l'impatto che vedi.

Riceverai una risposta appena possibile. La correzione esce in una nuova versione, citata nel [CHANGELOG](CHANGELOG.md).

## Versioni seguite

| versione | correzioni di sicurezza |
| --- | --- |
| 0.8.x | sì |
| precedenti | no: aggiorna con `install.bat` |

---

## Cosa protegge il mod

| protezione | come |
| --- | --- |
| piano e fonti | Edit e Write su `.claude/sprint/` rifiutati; si modificano solo con gli strumenti del mod |
| memoria del progetto | CLAUDE.md, AGENTS.md, `.claude/memory`, `memory-bank` non si modificano senza un aggiornamento approvato, né con Edit/Write né con comandi di terminale riconosciuti |
| regole nel codice | le voci con `vietato` bloccano le modifiche con Edit e Write che le violano |
| decisioni | le risposte le scrive solo l'utente; i conflitti li decide solo l'utente |
| codice sui dubbi | con `sicurezza` = `blocca`, un task con domande bloccanti non modifica il codice |
| dati di claude-mem | database, indici e log in `~/.claude-mem` si modificano solo con gli strumenti di claude-mem, né con Edit/Write né da terminale; `settings.json` resta modificabile |
| credenziali | lettura di `.env`, chiavi e file di configurazione con token rifiutata, anche con `cat`, `grep`, `head`, `git diff`… |
| dati | tutto resta nel progetto; nessun invio a servizi esterni oltre ai modelli di Claude Code |

## Cosa non protegge

Il mod riduce gli errori di un agente che collabora, **non è una barriera contro chi vuole aggirarlo**:

- un programma o uno script lanciato da Claude può scrivere file senza passare dai controlli;
- un comando di terminale non riconosciuto (per esempio uno script Python che scrive un file) può leggere o scrivere file protetti;
- le regole `vietato` controllano il testo della modifica, non il comportamento del codice;
- una ricerca su tutta la cartella può ancora toccare un file con credenziali;
- con `sicurezza` = `avvisa` o `proteggiMemoria` = `false` le protezioni diventano avvisi o si spengono.

Per dati sensibili usa anche i permessi di Claude Code (`permissions` in `settings.json`), git e le normali protezioni del sistema.

## Dati inviati ai modelli

| cosa | a chi |
| --- | --- |
| stato breve del piano, testi guida | al modello della sessione, come ogni messaggio |
| testo di una risposta e voci di memoria pertinenti | al modello dei controlli (`conflictModel`, predefinito haiku) |
| le tue richieste recenti in chat, per cercare contraddizioni | al modello dei controlli; `conflictCheck` = `false` lo spegne |
| fonti di business | al modello della sessione, solo quando le legge con `fonte_leggi` |
| esito di ogni sprint chiuso | a claude-mem (`save_memory`), che lo conserva sul tuo computer in `~/.claude-mem` |

Non incollare nelle fonti di business dati che non vuoi mandare al modello.
