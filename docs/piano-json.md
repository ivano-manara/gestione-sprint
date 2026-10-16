# Formato dei dati: piano.json

Tutto lo stato del piano sta in un file, dentro il progetto.
Questa pagina descrive il formato (versione 2) per chi lo legge, lo versiona o lo usa da altri strumenti.

[← torna al README](../README.md)

---

## Dove sta

```
<progetto>/.claude/sprint/
├── piano.json     fonte di verità
├── SPRINT.md      vista leggibile, rigenerata a ogni modifica (non modificarla a mano)
└── fonti/F1.md    testo di ogni fonte di business, così come l'hai incollato
```

La cartella si cambia con l'opzione `cartellaPiano`.

> `piano.json` si modifica solo con gli strumenti del mod: Edit e Write su quella cartella vengono rifiutati.
> Se lo modifichi a mano con un editor, premi `r` nel pannello per ricaricarlo.

---

## Struttura generale

| campo | tipo | contenuto |
| --- | --- | --- |
| `versione` | `2` | versione del formato |
| `progetto` | oggetto | nome, obiettivo, stack, metodo, file di logica, fonti lette, definition of done |
| `aggiornato` | testo | data e ora dell'ultima modifica (`AAAA-MM-GG hh:mm`) |
| `sprint` | lista | sprint con i loro task |
| `domande` | lista | domande aperte, risposte, conflitti |
| `decisioni` | lista | decisioni tue, dalla memoria o ipotesi di Claude |
| `business` | lista | fonti di business con le esigenze estratte |
| `memoria` | lista | voci vincolanti lette dai file di memoria |
| `aggiornamentiMemoria` | lista | modifiche ai file di memoria approvate da te |
| `rischi` | lista | registro rischi |
| `registro` | lista | storico degli eventi |

---

## Identificativi

| prefisso | cosa | esempio |
| --- | --- | --- |
| `S` | sprint | `S2` |
| `S…-T` | task | `S2-T3` |
| `D` | domanda | `D7` |
| `DEC` | decisione | `DEC4` |
| `M` | voce di memoria | `M1` |
| `F` | fonte di business | `F2` |
| `F…-E` | esigenza di una fonte | `F2-E1` |
| `R` | rischio | `R1` |
| `U` | aggiornamento di memoria | `U3` |

Gli id non si riusano: un elemento annullato o superato tiene il suo.
Quando Claude importa un piano esistente, sprint e task tengono gli id originali.

---

## progetto

| campo | significato |
| --- | --- |
| `nome` | nome del progetto |
| `obiettivo` | obiettivo verificabile |
| `stack` | tecnologie (es. "Laravel 11, SQL Server 2019") |
| `metodo` | metodo già in uso: superpowers, GSD, spec-kit… |
| `fileLogica` | file del metodo esistente (piani, roadmap, spec) |
| `fonti` | file di memoria letti durante l'analisi |
| `dod` | definition of done comune a tutti i task |

---

## sprint e task

Sprint:

| campo | significato |
| --- | --- |
| `id`, `titolo`, `obiettivo` | identità e obiettivo verificabile |
| `stato` | `da-fare`, `in-corso`, `completato`, `bloccato`, `annullato` (segue i task) |
| `origine` | `esistente` (importato), `migliorato`, `nuovo` |
| `rif` | riferimento al piano originale, `file#sezione` |
| `task` | lista dei task |
| `chiusura` | `{ data, esito }`: revisione e retrospettiva fatte |

Task:

| campo | significato |
| --- | --- |
| `id`, `titolo`, `descrizione` | identità |
| `stato` | come per lo sprint |
| `origine`, `rif` | come per lo sprint |
| `criteri` | criteri di accettazione misurabili |
| `dipendeDa` | id dei task che devono essere completati prima |
| `requisiti` | id delle esigenze di business coperte (`F1-E2`) |
| `vincoli` | id delle voci di memoria o decisioni su cui si basa (`M3`, `DEC2`) |
| `stima` | punti: 1, 2, 3, 5, 8 (8 va spezzato) |
| `note` | per un task completato: la prova della verifica |
| `daRivedere` | motivo, se una voce su cui si basava è stata superata |

Regole sugli stati:

| passaggio | condizione |
| --- | --- |
| → `in-corso` | il task è pronto (definition of ready) |
| → `completato` | nota con la prova della verifica, nessun conflitto aperto |
| → `bloccato` | serve un motivo |
| → `annullato` | serve un motivo; sprint e task esistenti non si cancellano mai |

---

## domande

| campo | significato |
| --- | --- |
| `id`, `testo`, `perche` | la domanda e perché serve |
| `sprint`, `task` | a cosa si riferisce |
| `opzioni`, `raccomandata` | scelte proposte e quella consigliata |
| `bloccante` | se `true`, il task non parte finché non rispondi |
| `tipo` | `normale` o `conflitto` |
| `autore` | `claude` o `utente` |
| `stato` | `aperta`, `in-conflitto`, `risposta`, `delegata` ("decidi tu"), `superata` |
| `conflitto` | per i conflitti: `con` (voci contraddette), `spiegazione`, `rispostaProposta`, `nuovo` |
| `azione` | effetto automatico di una risposta affermativa (voce di memoria, analisi d'impatto, ipotesi) |
| `risposta`, `fonte`, `rispostaIl` | la tua risposta, da pannello o chat, e quando |

Una risposta può essere scritta solo da te: Claude registra quelle date in chat, con le tue parole.

---

## decisioni

| campo | significato |
| --- | --- |
| `testo`, `data` | la decisione |
| `fonte` | `utente`, `memoria` o `analisi` (= ipotesi di Claude) |
| `domanda` | domanda da cui nasce |
| `confermata` | per le ipotesi: confermata da te |
| `superata` | sostituita da una decisione successiva |

---

## business

Fonte:

| campo | significato |
| --- | --- |
| `id`, `titolo`, `tipo` | `email`, `documento`, `verbale`, `ticket`, `altro` |
| `data`, `file` | quando e dove è salvato il testo (`fonti/F1.md`) |
| `stato` | `da-analizzare` o `analizzata` |
| `impronta` | impronta del testo: la stessa fonte non si duplica |
| `sintesi` | sintesi scritta da Claude |
| `esigenze` | lista delle esigenze |

Esigenza: `id`, `testo`, `priorita` (`alta` = must, `media` = should, `bassa` = could), `stato` (`valida`, `superata`).

---

## memoria

| campo | significato |
| --- | --- |
| `id`, `testo` | la regola, in una frase |
| `fonte` | `file:riga` oppure `claude-mem` |
| `tipo` | `vincolo`, `convenzione`, `architettura`, `business`, `stack` |
| `stato` | `valida`, `da-verificare` (il file è cambiato), `superata` |
| `sostituitaDa` | id di ciò che l'ha sostituita |
| `estratto` | riga copiata dal file: se sparisce, la memoria è cambiata fuori dal piano |
| `vietato` | espressione regolare di ciò che la regola vieta nel codice |
| `ambito` | dove vale il divieto: estensioni (`.php`) o parti di percorso, separate da virgola |

Esempio di regola verificabile:

```json
{
  "id": "M2",
  "testo": "niente funzioni mysql_ deprecate",
  "fonte": "CLAUDE.md:7",
  "tipo": "vincolo",
  "stato": "valida",
  "estratto": "- Non usare le funzioni mysql_* (deprecate)",
  "vietato": "\\bmysql_\\w+\\(",
  "ambito": ".php"
}
```

---

## aggiornamentiMemoria

| campo | significato |
| --- | --- |
| `id`, `testo` | cosa cambiare |
| `file` | file di memoria da modificare |
| `motivo` | la scelta che l'ha generato |
| `stato` | `da-applicare` o `applicato` |
| `nota` | cosa è stato fatto |

Solo con un aggiornamento `da-applicare` Claude può modificare quel file di memoria.

---

## rischi

| campo | significato |
| --- | --- |
| `id`, `testo` | il rischio |
| `probabilita` | `alta`, `media`, `bassa` |
| `impatto` | `alto`, `medio`, `basso` |
| `mitigazione` | come ridurlo |
| `task` | task che realizza la mitigazione |
| `stato` | `aperto`, `mitigato`, `chiuso` |

---

## registro

Lista di `{ data, testo }` in ordine di tempo: analisi, risposte, conflitti risolti, task completati, sprint chiusi.
Serve a ricostruire chi ha deciso cosa e quando.

---

## Esempio minimo

```json
{
  "versione": 2,
  "progetto": { "nome": "portale-consulenti", "obiettivo": "portale per i consulenti", "fileLogica": [], "fonti": ["CLAUDE.md"], "dod": [] },
  "aggiornato": "2026-10-16 15:40",
  "sprint": [
    {
      "id": "S1", "titolo": "accesso e profili", "obiettivo": "login MFA e profili", "stato": "in-corso", "origine": "nuovo",
      "task": [
        { "id": "S1-T1", "titolo": "login", "stato": "da-fare", "origine": "nuovo", "criteri": ["test login verde"], "dipendeDa": [], "requisiti": [], "vincoli": ["M1"], "stima": 3 }
      ]
    }
  ],
  "domande": [],
  "decisioni": [],
  "business": [],
  "memoria": [
    { "id": "M1", "testo": "il database è SQL Server 2019", "fonte": "CLAUDE.md:3", "tipo": "stack", "stato": "valida", "estratto": "Database: SQL Server 2019" }
  ],
  "aggiornamentiMemoria": [],
  "rischi": [],
  "registro": []
}
```

Tipi completi in TypeScript: [gestione-sprint/types/index.d.ts](../gestione-sprint/types/index.d.ts).

[← torna al README](../README.md)
