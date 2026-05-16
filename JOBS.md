# JOBS.md — Divisione del lavoro
# Progetto TIW 2026 — Versione JavaScript (SPA)

> Persona A = Fornitore | Persona B = Cliente (questa chat)
> File già completati e condivisi: `pom.xml`, `BaseApiServlet.java`,
> `CheckLoginServlet.java`, `LogoutServlet.java`, `web.xml`, `index.html`, `login.js`

---

## FILE CONDIVISI (già fatti — non toccare)

| File | Dove |
|------|------|
| `pom.xml` | root |
| `BaseApiServlet.java` | `api/` |
| `CheckLoginServlet.java` | `api/` |
| `LogoutServlet.java` | `api/` |
| `web.xml` | `WEB-INF/` |
| `index.html` | `webapp/` |
| `js/login.js` | `webapp/js/` |
| `assets/css/style.css` | riusato dalla versione HTML |
| `beans/*.java` | copiati dalla versione HTML (package aggiornato) |
| `dao/*.java` | copiati dalla versione HTML (package aggiornato) |

---

## PERSONA A — FORNITORE

### Servlet API da creare (`api/fornitore/`)

| Classe | Metodo | URL | Servlet HTML di riferimento |
|--------|--------|-----|-----------------------------|
| `GetSKUListServlet` | GET | `/api/fornitore/sku` | `GoToHomeFornitore` |
| `CreaSKUServlet` | POST | `/api/fornitore/sku/crea` | `CreaSKU` |
| `AggiornaSKUServlet` | POST | `/api/fornitore/sku/aggiorna` | *(nuovo — inline edit)* |
| `GetProdottiDisponibiliServlet` | GET | `/api/fornitore/prodotti-disponibili` | `GoToHomeFornitore` |
| `CreaProdottoServlet` | POST | `/api/fornitore/prodotto/crea` | `CreaProdottoSemplice` + `CreaProdottoComposto` |
| `AggiornaProdottoServlet` | POST | `/api/fornitore/prodotto/aggiorna` | *(nuovo — inline edit)* |
| `RimuoviAssociazioneServlet` | POST | `/api/fornitore/associazione/rimuovi` | `RimuoviSKU` + `RimuoviSottoprodotto` |
| `EliminaOggettoServlet` | POST | `/api/fornitore/oggetto/elimina` | `EliminaOggetto` |
| `RicercaProdottiServlet` | GET | `/api/fornitore/ricerca` | `GoToRicerca` |

### Pagina HTML da creare

**`fornitore.html`** — SPA unica con due macro-sezioni:

```
#sezione-home
  navbar: "Pannello Fornitore" | Ciao Nome Cognome | [Ricerca prodotti] [Logout]
  → struttura identica a home_fornitore.html (two-columns: form a sx, dettaglio a dx)
  → Form crea SKU         (card)   → classi: card, form-group, btn btn-primary
  → Form crea semplice    (card)   → checkbox-list per le SKU
  → Form crea composto    (card)   → checkbox-list per i sottoprodotti
  → Pannello dettaglio    (aside side-panel) → tree-node/tree-nodo-* per l'albero

#sezione-ricerca
  navbar: "Configuratore" | Home | Ciao Nome Cognome | [Logout]
  → struttura identica a ricerca_prodotti.html
  → ricerca-toolbar con input keyword + bottone Cerca
  → ricerca-grid: colonna sx risultati (result-list) | colonna dx dettaglio
```

### File JS da creare (`js/fornitore/`)

| File | Responsabilità |
|------|----------------|
| `main.js` | Init pagina, verifica sessione, navigazione tra #sezione-home e #sezione-ricerca, logout |
| `sku.js` | Fetch crea SKU, render dettaglio SKU con inline edit (click → input → blur → salva) |
| `prodotto.js` | Costruzione albero prodotto nel DOM, bottoni +/-/-*, SALVA PRODOTTO (unica chiamata server) |
| `ricerca.js` | Fetch ricerca, render risultati (result-list), click → dettaglio, modifica inline attributi |

---

## PERSONA B — CLIENTE

### Servlet API da creare (`api/cliente/`)

| Classe | Metodo | URL | Servlet HTML di riferimento |
|--------|--------|-----|-----------------------------|
| `GetProdottiTopLevelServlet` | GET | `/api/cliente/prodotti?pagina=n` | `GoToHomeCliente` |
| `GetSottoprodottiServlet` | GET | `/api/cliente/sottoprodotti?id=X` | `GoToSceltaSKU` |
| `SalvaConfigurazioneServlet` | POST | `/api/cliente/configurazione/salva` | `SalvaConfigurazione` |
| `GetConfigurazioniServlet` | GET | `/api/cliente/configurazioni` | `GoToMieConfigurazioni` |
| `GetDettaglioConfigurazioneServlet` | GET | `/api/cliente/configurazione?id=X` | `GoToDettaglioConfigurazione` |
| `CancellaConfigurazioneServlet` | POST | `/api/cliente/configurazione/cancella` | `CancellaConfigurazione` |
| `ClonaConfigurazioneServlet` | POST | `/api/cliente/configurazione/clona` | `ClonaConfigurazione` |

### Pagina HTML da creare

**`cliente.html`** — SPA unica con quattro macro-sezioni:

```
#sezione-home
  navbar: "Pannello Cliente" | Ciao Nome Cognome | [Le mie configurazioni] [Logout]
  → struttura identica a home_cliente.html
  → lista prodotti top-level (card con ul, ogni <li> è cliccabile)
  → paginazione (div.pagination con btn btn-outline btn-sm)

#sezione-scelta-sku
  navbar: "Pannello Cliente" | [Home] [Le mie configurazioni] [Logout]
  → struttura identica a scelta_sku.html
  → card "Nome configurazione" (form-group con input nomeConf)
  → card "Selezione componenti":
      albero espandibile progressivamente:
        .tree-nodo-composto → header cliccabile che espande i figli via fetch
        .tree-nodo-figli → indentato con border-left
        .tree-nodo-semplice → ha select con le SKU disponibili (form-group)
  → alert alert-error se SKU mancanti o nome vuoto
  → bottone "Salva configurazione" / "Aggiorna configurazione"

#sezione-dettaglio
  navbar: "Pannello Cliente" | [Home] [Le mie configurazioni] [Logout]
  → struttura identica a dettaglio_configurazione.html
  → intestazione: nome configurazione + bottone [Modifica]
  → card metadati: creata il, ultima modifica, prezzo totale
  → card tabella SKU selezionate (table con thead/tbody/tfoot)

#sezione-mie-configurazioni
  navbar: "Pannello Cliente" | [Home] [Le mie configurazioni] [Logout]
  → struttura identica a mie_configurazioni.html
  → card con tabella (Nome | Creata il | Ultima modifica | Prezzo | Azioni)
  → azioni: [Modifica] btn-outline | [Clona] btn-ghost | [Cancella] btn-danger
  → stato vuoto: card con messaggio + link "Sfoglia i prodotti"
```

### File JS da creare (`js/cliente/`)

| File | Responsabilità |
|------|----------------|
| `main.js` | Init pagina, verifica sessione al caricamento, navigazione tra sezioni, logout |
| `homecliente.js` | Fetch prodotti top-level, render lista, gestione paginazione (PRECEDENTI/SUCCESSIVI), click → apre #sezione-scelta-sku |
| `sceltaSku.js` | Fetch sottoprodotti progressivi al click, render albero DOM, gestione select SKU, validazione, fetch salva/aggiorna configurazione |
| `configurazioni.js` | Fetch lista configurazioni, render tabella, fetch cancella (con confirm), fetch clona, click Modifica → apre #sezione-scelta-sku con dati precaricati |
| `dettaglio.js` | Fetch dettaglio configurazione, render metadati + tabella SKU, bottone Modifica |

---

## CONTRATTO TRA PERSONA A e PERSONA B

Per permettere a entrambi di lavorare in modo indipendente, i JSON restituiti
dalle rispettive servlet devono rispettare questo formato concordato:

### GET `/api/cliente/prodotti?pagina=n`
```json
{
  "prodotti": [ { "id": 1, "nome": "PC Desktop", "codice": 100 } ],
  "paginaCorrente": 0,
  "totalePagine": 3,
  "hasPrecedenti": false,
  "hasSuccessivi": true
}
```

### GET `/api/cliente/sottoprodotti?id=X`
```json
[
  { "id": 2, "nome": "CPU", "codice": 101, "tipo": "SEMPLICE",
    "skuList": [ { "id": 10, "codice": 999, "nome": "AMD Ryzen 5", "prezzo": 199.99 } ] },
  { "id": 3, "nome": "Sistema di elaborazione", "codice": 102, "tipo": "COMPOSTO" }
]
```

### POST `/api/cliente/configurazione/salva`
Body: `prodottoId, nomeConf, configurazioneId (opzionale), sku_{sempliceId}=skuId, ...`
```json
{ "id": 42 }
```

### GET `/api/cliente/configurazioni`
```json
[
  {
    "id": 1, "nome": "Il mio PC", "prodottoId": 5,
    "dataCreazione": "2026-05-10T14:30:00",
    "dataUltimaModifica": null,
    "prezzoTotale": 1299.99
  }
]
```

### GET `/api/cliente/configurazione?id=X`
```json
{
  "id": 1, "nome": "Il mio PC", "prodottoId": 5,
  "dataCreazione": "2026-05-10T14:30:00",
  "dataUltimaModifica": null,
  "prezzoTotale": 1299.99,
  "skuScelte": [
    { "prodottoSempliceId": 7, "sku": { "id": 10, "codice": 999, "nome": "AMD Ryzen 5", "prezzo": 199.99, "descrizioneTecnica": "..." } }
  ]
}
```

### POST `/api/cliente/configurazione/cancella` e `/api/cliente/configurazione/clona`
Body: `configurazioneId=X`
```json
{ "ok": true }
```

---

## ORDINE DI IMPLEMENTAZIONE CONSIGLIATO

### Persona B (Cliente) — ordine suggerito:

1. `GetProdottiTopLevelServlet` + `homecliente.js` → home funzionante con paginazione
2. `GetSottoprodottiServlet` + `sceltaSku.js` (solo espansione albero, senza salvataggio)
3. `SalvaConfigurazioneServlet` + completamento `sceltaSku.js` con salva/valida
4. `GetDettaglioConfigurazioneServlet` + `dettaglio.js`
5. `GetConfigurazioniServlet` + `CancellaConfigurazioneServlet` + `ClonaConfigurazioneServlet` + `configurazioni.js`
6. `main.js` (navigazione tra sezioni, logout, verifica sessione)
7. `cliente.html` (struttura HTML completa con tutte le sezioni)

---

## NOTE COMUNI

- Ogni servlet controlla sessione (`isLogged`) e ruolo (`hasRole`) come prima istruzione.
- In caso di errore la servlet risponde sempre con: `{ "errore": "messaggio" }` + HTTP status.
- I campi `data*` nei JSON vengono serializzati come stringa ISO 8601 (`LocalDateTime` → Gson).
  Per gestirlo correttamente aggiungere al bean un `GsonBuilder` con `registerTypeAdapter`
  oppure convertire le date in String già nel DAO prima di serializzare.
- La navigazione tra sezioni avviene solo via JS (show/hide con `display:none` / `display:block`).
  Non si usano URL diversi per le sezioni interne.
- Le classi CSS da usare sono quelle già presenti in `style.css` senza aggiungerne di nuove
  salvo casi eccezionali (in quel caso documentarli con un commento).
