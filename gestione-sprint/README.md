# gestione-sprint

Il mod. Documentazione nel [README del repository](../README.md); per chi modifica il codice: [architettura](../docs/architettura.md) e [sviluppo](../docs/sviluppo.md).

- `hooks/register.tsx` tutti i hook, in un solo file: Claude Code non segue `$` attraverso gli import.
  Sezioni: archivio (dati del piano), ponte (collegamenti tra i moduli), pannello e banda sprint, modulo sprint (comandi, strumenti, guardie), modulo contesto, punto d'ingresso.
- `hooks/sprint/` logica pura del piano (nessun `$`): regole, memoria, qualita, testi per il modello
- `hooks/contesto/` logica pura del contesto (nessun `$`): barra, compressione, compattazione, contraddizioni, claude-mem, stack
- `types/index.d.ts` stato di entrambi i moduli

Regola per chi modifica: una funzione che riceve `$` va dichiarata con `function` dentro `hooks/register.tsx`.

Test: `claude plugin test .` · validazione: `claude plugin validate .`
