# Sviluppo

Come modificare il mod senza rompere la validazione, i test o la grafica.

[← torna al README](../README.md) · [architettura](architettura.md) · [CONTRIBUTING](../CONTRIBUTING.md)

---

## Indice

- [Ambiente](#ambiente)
- [Ciclo di lavoro](#ciclo-di-lavoro)
- [Regole del validatore](#regole-del-validatore)
- [Dove mettere il codice](#dove-mettere-il-codice)
- [Test](#test)
- [Anteprima grafica](#anteprima-grafica)
- [Controllo dei tipi](#controllo-dei-tipi)
- [Aggiungere qualcosa](#aggiungere-qualcosa)
- [Testi e stile](#testi-e-stile)
- [Rilascio di una versione](#rilascio-di-una-versione)

---

## Ambiente

| serve | per |
| --- | --- |
| Claude Code | validazione, test, prova dal vivo |
| un editor con TypeScript | tipi e completamento |
| python 3 | anteprima grafica (testo e HTML) |
| node e `playwright` | anteprima grafica come immagini (facoltativo) |

Per avere i tipi nell'editor carica il mod una volta da cartella:

```bash
claude --plugin-dir ./gestione-sprint
```

Claude Code crea `gestione-sprint/.claude-plugin/types/`, che resta fuori da git.

---

## Ciclo di lavoro

```bash
cd gestione-sprint
claude plugin validate .      # regole del validatore
claude plugin test .          # 187 test
```

Per provare dal vivo senza reinstallare:

```bash
claude --plugin-dir ./gestione-sprint
# dopo ogni modifica, dentro Claude Code:
/reload-plugins
```

Su Windows, quando la modifica è pronta, `install.bat` reinstalla la versione nuova.

---

## Regole del validatore

Claude Code controlla il codice dei hook prima di caricarlo. Le regole che contano qui:

| regola | come rispettarla |
| --- | --- |
| `$` si passa solo a funzioni dichiarate con `function` **nello stesso file** | ogni funzione che riceve `$` sta in `hooks/register.tsx` |
| `$` non attraversa un import | la logica in `hooks/sprint/` e `hooks/contesto/` non riceve mai `$` |
| `$` non si mette in un oggetto | passalo come parametro; niente `{ $, piano }` |
| gli atomi di stato sono `const` dello stesso file | dichiarati una volta in `register.tsx`, usati con il loro nome |
| un evento senza matcher si registra una volta sola | gli eventi condivisi dai due moduli sono una sola catena (vedi [architettura](architettura.md#i-due-moduli-e-il-ponte)) |

Esempio corretto:

```tsx
// in hooks/register.tsx
async function apriScheda($: EngineInterface, vista: Vista): Promise<void> {
  await update($, vistaA, () => vista)                       // atomo dello stesso file
  await $.ui.open({ id: 'sprint', title: 'Sprint', focus: true })
}

// un pulsante chiama la funzione, passando $ come parametro
<Button key="sprint-domande" onPress={() => void apriScheda($, 'domande')}>Domande</Button>
```

Esempio sbagliato:

```tsx
// hooks/sprint/azioni.ts  ✗  $ attraversa un import
export async function apriScheda($: EngineInterface) { … }

// ✗  $ dentro un oggetto
const ctx = { $, piano }
```

Versioni diverse di Claude Code possono essere più o meno severe: `install.bat` mostra l'errore e la versione se la validazione fallisce.

---

## Dove mettere il codice

| tipo di codice | file |
| --- | --- |
| calcolo sul piano (nessun effetto) | `hooks/sprint/logic.ts` |
| regole di qualità e definition of ready | `hooks/sprint/qualita.ts` |
| file di memoria da cercare, testi per haiku | `hooks/sprint/memoria.ts` |
| testi che il mod invia a Claude | `hooks/sprint/prompts.ts` |
| regole del contesto, compressione, stack | `hooks/contesto/*.ts` |
| tutto ciò che usa `$`: file, disegno, strumenti, comandi | `hooks/register.tsx`, nella sezione giusta |
| tipi dello stato e del piano | `types/index.d.ts` |

Regola pratica: scrivi la logica come funzione pura in `sprint/` o `contesto/`, testala lì, poi chiamala da `register.tsx`.

Sezioni di `register.tsx`, in ordine:

1. archivio: lettura e scrittura del piano
2. ponte: collegamenti tra i moduli
3. pannello e banda sprint
4. modulo sprint: comandi, strumenti, guardie
5. modulo contesto
6. punto d'ingresso `register`

---

## Test

| file | cosa prova |
| --- | --- |
| `hooks/sprint/logic.test.ts` | modifiche al piano, risposte, conflitti, stati |
| `hooks/sprint/qualita.test.ts` | qualità, definition of ready, analisi d'impatto, velocità |
| `hooks/sprint/flusso.test.tsx` | flusso completo con strumenti e comandi |
| `hooks/sprint/pannello.test.tsx` | pannello senza piano |
| `hooks/banda.test.tsx` | banda: senza piano, con piano, pulsanti che aprono la scheda giusta |
| `hooks/ponte.test.tsx` | integrazione tra memoria della sessione e memoria di progetto |
| `hooks/analisi.test.tsx` | analisi: comandi di verifica, analisi incrementale, superpowers installato dopo |
| `hooks/robustezza.test.tsx` | migliaia di modifiche casuali: id unici, salva e ricarica senza perdite; banda e pannello con piani casuali |
| `hooks/concorrenza.test.tsx` | modifiche in parallelo: task e fonti non si perdono, file illeggibile non sovrascritto |
| `hooks/contesto/*.test.ts` | modulo contesto |

Nei test gli effetti di Claude Code si simulano con `on(...)`. Ogni effetto restituisce `{ value }`:

```tsx
const files = new Map<string, string>()
const v = (value: unknown) => ({ value }) as never

on('session.root', () => v('/progetto'))
on('fs.read', ($, e) => v(files.get(e.path)))
on('fs.write', ($, e) => { files.set(e.path, e.text); return v(undefined) })
on('ui.open', () => v({ isPlaced: true }))
await $.session.start({ cwd: '/progetto' } as never)

// disegnare e premere
const ui = await $.ui.mount({ plugin: 'gestione-sprint', surface: 'terminal', component: 'AbovePrompt', props: { … } as never })
await ui.press({ key: 'sprint-azione' })
```

Ogni pulsante ha un `key` stabile (`sprint-azione`, `sprint-domande`, `sprint-business`, `apri-sprint`, `principale`…): usalo nei test.

---

## Anteprima grafica

Per vedere banda e pannello senza aprire Claude Code:

```bash
tools/anteprima/anteprima.sh       # Linux, macOS
tools\anteprima\anteprima.bat      # Windows
```

| file | ruolo |
| --- | --- |
| `anteprima.test.tsx` | crea un piano di esempio e stampa i disegni di banda e pannello |
| `render.py` | trasforma i disegni in testo e in `anteprima.html` |
| `foto.js` | salva un'immagine per ogni vista in `img/` (serve `npm i playwright`) |

Controlla sempre a 120, 80 e 46 colonne: niente righe che vanno a capo a metà, niente tasti doppi.
Le immagini in `docs/img/` vengono da qui.

---

## Controllo dei tipi

`claude plugin validate` non fa il controllo completo dei tipi. Per farlo:

```json
{
  "compilerOptions": {
    "target": "es2023", "lib": ["es2023", "esnext"], "types": [],
    "module": "esnext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true, "noEmit": true, "skipLibCheck": true,
    "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
  },
  "include": [
    "<repo>/gestione-sprint/.claude-plugin/types/claude-code/index.d.ts",
    "<repo>/gestione-sprint/hooks",
    "<repo>/gestione-sprint/types"
  ]
}
```

Mettilo fuori dal repository (es. `../tc/tsconfig.json`) e sostituisci `<repo>` con il percorso della cartella.

```bash
tsc -p percorso/del/tsconfig
```

---

## Aggiungere qualcosa

| vuoi aggiungere | dove |
| --- | --- |
| un controllo di qualità | `controlliQualita` in `sprint/qualita.ts` + test in `qualita.test.ts` |
| un metodo di progetto da riconoscere | `CANDIDATI` in `sprint/memoria.ts` |
| un comando di verifica da riconoscere | `MANIFESTI` e `comandiVerifica` in `sprint/memoria.ts` + test in `qualita.test.ts` |
| un punto da passare in rassegna nell'analisi | `PUNTI_SCOPERTI` in `sprint/prompts.ts` |
| un file di memoria da proteggere | `isFileMemoria` in `sprint/logic.ts` |
| un comando di terminale che scrive file | `SCRITTORI` in `sprint/logic.ts` |
| una nuova mossa del pulsante ▶ | `prossimaMossa` e `eseguiMossa` in `register.tsx` + test in `banda.test.tsx` |
| un pulsante nella banda | `BandaSprint` in `register.tsx` |
| un comando `/` | `$.command.register` all'avvio del modulo sprint + `on('command.run', { command })` |
| uno strumento per Claude | `$.tool.register` + `on('tool.call', { tool: 'mcp__gestione-sprint__…' })`; differito se raro |
| un'opzione | `userConfig` in `.claude-plugin/plugin.json`, letta nel punto d'ingresso |
| regole del modulo contesto | vedi [modulo-contesto.md](modulo-contesto.md#-sviluppo) |

---

## Testi e stile

| testo | regole |
| --- | --- |
| per l'utente (pannello, banda, avvisi) | italiano, frasi corte, accenti corretti, niente maiuscolo per enfasi, plurali giusti con `pl()` |
| per il modello (`prompts.ts`, descrizioni degli strumenti) | brevi: ogni parola costa token a ogni uso; istruzioni operative, niente spiegazioni |
| sezione fissa del system prompt | non deve cambiare con il piano, altrimenti la cache si perde |
| messaggi di rifiuto | dicono sempre cosa fare al posto di ciò che è stato rifiutato |

---

## Rilascio di una versione

1. Aggiorna la versione in `gestione-sprint/.claude-plugin/plugin.json` e in `.claude-plugin/marketplace.json`.
2. Aggiungi la voce in `CHANGELOG.md`: cosa cambia per chi usa il mod, poi le correzioni.
3. Aggiorna badge e numero dei test nel README.
4. `claude plugin validate gestione-sprint` e `claude plugin test gestione-sprint`.
5. Se è cambiata la grafica: anteprima e immagini in `docs/img/`.
6. Prova `install.bat` su Windows con la versione di Claude Code che usi.
7. Commit e tag (`v0.8.3`).

[← torna al README](../README.md)
