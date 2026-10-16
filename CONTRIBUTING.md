# Contribuire

Grazie dell'interesse. Questa pagina spiega come proporre una modifica senza sorprese.

---

## Prima di iniziare

| vuoi | fai |
| --- | --- |
| segnalare un problema | apri una issue con il modello "segnalazione di un problema" |
| proporre una funzione | apri una issue con il modello "proposta" e aspetta un parere prima di scrivere codice |
| segnalare un problema di sicurezza | **non** aprire una issue pubblica: vedi [SECURITY.md](SECURITY.md) |
| correggere un refuso nella documentazione | apri direttamente una pull request |

---

## Preparare l'ambiente

```bash
git clone <url-del-repository>
cd ModProgetti/gestione-sprint
claude plugin validate .
claude plugin test .
```

Dettagli, regole del validatore e controllo dei tipi: [docs/sviluppo.md](docs/sviluppo.md).

---

## Regole del codice

1. Ogni funzione che riceve `$` sta in `hooks/register.tsx` ed è dichiarata con `function`.
2. La logica senza effetti va in `hooks/sprint/` o `hooks/contesto/`, con i suoi test.
3. `$` non va mai dentro un oggetto.
4. Un errore del mod non deve mai bloccare il lavoro: proteggi i hook con `.catch` e lascia passare la chiamata.
5. Ogni rifiuto dice al modello cosa fare al suo posto.
6. La sezione fissa del system prompt non cambia con il piano.
7. Il mod non scrive mai una risposta al posto dell'utente e non modifica la memoria senza una scelta approvata.

---

## Testi

- Italiano, frasi corte, accenti corretti.
- Niente maiuscolo per dare enfasi.
- Testi per il modello: brevi, operativi.
- Plurali con `pl()`.

---

## Pull request

Una pull request viene accettata se:

- [ ] `claude plugin validate gestione-sprint` passa;
- [ ] `claude plugin test gestione-sprint` passa, con un test nuovo per ciò che cambia;
- [ ] se tocca la grafica: anteprima controllata a 120, 80 e 46 colonne (`tools/anteprima`), immagini aggiornate in `docs/img/` se cambiano;
- [ ] `CHANGELOG.md` ha una voce sotto la versione in preparazione;
- [ ] la documentazione è aggiornata (README, guide in `docs/`);
- [ ] nessun dato reale di clienti nei test o negli esempi.

Una pull request per argomento. Il titolo dice cosa cambia per chi usa il mod.

---

## Messaggi di commit

Brevi, in italiano, al presente: `banda: pulsante per chiudere lo sprint`, `qualita: segnala le dipendenze circolari`.

---

## Licenza

Contribuendo accetti che il tuo codice sia distribuito con la licenza [MIT](LICENSE) del progetto.
