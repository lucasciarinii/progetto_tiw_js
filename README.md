# Progetto TIW 2026 — Configuratore di Prodotto (Versione JavaScript)

> Corso di Tecnologie Web — Politecnico di Milano
> Stack: Java Servlet (API JSON) + Vanilla JavaScript + JDBC + MySQL
> Runtime: Apache Tomcat 11 (`jakarta.servlet`)

---

## Descrizione generale

Questa è la versione **Single-Page Application** del configuratore di prodotto.
A differenza della versione HTML pura, qui l'interfaccia è contenuta in una **sola pagina HTML per ruolo**.
Tutta la comunicazione con il server avviene in modo **asincrono** tramite `fetch()`,
e il server risponde con **JSON** invece di renderizzare HTML con Thymeleaf.

> Le due versioni (HTML pura e JS) sono progetti Maven **distinti** che condividono lo stesso database.

---

## Struttura del progetto

```
TIW2026-JS/
├── pom.xml
└── src/
    └── main/
        ├── java/
        │   └── it/polimi/tiw/js/
        │       ├── beans/                    ← RIUSATI dalla versione HTML (invariati)
        │       │   ├── Utente.java
        │       │   ├── SKU.java
        │       │   ├── Prodotto.java
        │       │   └── Configurazione.java
        │       ├── dao/                      ← RIUSATI dalla versione HTML (invariati)
        │       │   ├── UtenteDAO.java
        │       │   ├── SKUDAO.java
        │       │   ├── ProdottoDAO.java
        │       │   └── ConfigurazioneDAO.java
        │       ├── utils/
        │       │   └── ConnectionFactory.java
        │       └── api/                      ← NUOVE servlet, rispondono JSON
        │           ├── CheckLoginServlet.java
        │           ├── LogoutServlet.java
        │           ├── fornitore/
        │           │   ├── GetSKUListServlet.java
        │           │   ├── CreaSKUServlet.java
        │           │   ├── AggiornaSKUServlet.java
        │           │   ├── GetProdottiDisponibiliServlet.java
        │           │   ├── CreaProdottoServlet.java
        │           │   ├── AggiornaProdottoServlet.java
        │           │   ├── RimuoviAssociazioneServlet.java
        │           │   ├── EliminaOggettoServlet.java
        │           │   └── RicercaProdottiServlet.java
        │           └── cliente/
        │               ├── GetProdottiTopLevelServlet.java
        │               ├── GetSottoprodottiServlet.java
        │               ├── SalvaConfigurazioneServlet.java
        │               ├── GetConfigurazioniServlet.java
        │               ├── GetDettaglioConfigurazioneServlet.java
        │               ├── CancellaConfigurazioneServlet.java
        │               └── ClonaConfigurazioneServlet.java
        └── webapp/
            ├── WEB-INF/
            │   └── web.xml
            ├── index.html                    ← pagina di login
            ├── fornitore.html                ← SPA fornitore (unica pagina)
            ├── cliente.html                  ← SPA cliente (unica pagina)
            ├── css/
            │   └── style.css                 ← RIUSATO dalla versione HTML (invariato)
            └── js/
                ├── login.js
                ├── fornitore/
                │   ├── main.js               ← init, navigazione sezioni, logout
                │   ├── sku.js                ← crea SKU, inline edit attributi SKU
                │   ├── prodotto.js           ← costruzione albero prodotto, +/-/-*, SALVA
                │   └── ricerca.js            ← ricerca prodotti/SKU, dettaglio, modifica
                └── cliente/
                    ├── main.js               ← init, navigazione sezioni, logout
                    ├── homecliente.js        ← lista top-level, paginazione
                    ├── sceltaSku.js          ← albero progressivo, selezione SKU, salva
                    ├── configurazioni.js     ← le mie configurazioni, clona, cancella
                    └── dettaglio.js          ← dettaglio configurazione salvata
```

---

## Stack tecnico

| Componente      | Tecnologia                        |
|-----------------|-----------------------------------|
| Server          | Apache Tomcat 11                  |
| Servlet API     | Jakarta Servlet 6.x               |
| Serializzazione | Gson 2.x                          |
| Database        | MySQL 8.x                         |
| Driver JDBC     | MySQL Connector/J                 |
| Frontend        | HTML5 + CSS3 + Vanilla JS (ES6+)  |
| Build           | Maven 3.x                         |

> Nessun framework JavaScript esterno (no React, no Vue, no jQuery). Vanilla JS puro.

---

## Componenti riusati dalla versione HTML pura

I seguenti file vengono copiati **senza modifiche** nel nuovo progetto:

| File                   | Note                                         |
|------------------------|----------------------------------------------|
| `beans/*.java`         | Tutti e 4 i bean (Utente, SKU, Prodotto, Configurazione) |
| `dao/*.java`           | Tutti e 4 i DAO                              |
| `css/style.css`        | Stesso foglio di stile, grafica identica     |

> La `BaseServlet.java` della versione HTML non viene riusata direttamente
> perché conteneva la logica Thymeleaf. Nella versione JS si crea una nuova
> `BaseApiServlet.java` più leggera, senza template engine.

---

## Architettura SPA

### Pagine HTML statiche

| File             | Ruolo     | Descrizione                                      |
|------------------|-----------|--------------------------------------------------|
| `index.html`     | Tutti     | Form di login                                    |
| `fornitore.html` | Fornitore | SPA completa del fornitore, caricata una sola volta |
| `cliente.html`   | Cliente   | SPA completa del cliente, caricata una sola volta   |

### Sezioni dinamiche (show/hide via JS)

**fornitore.html** contiene due macro-sezioni:
- `#sezione-home` — form crea SKU / prodotto semplice / prodotto composto + area dettaglio/albero
- `#sezione-ricerca` — ricerca prodotti e SKU con pannello dettaglio e modifica inline

**cliente.html** contiene quattro macro-sezioni:
- `#sezione-home` — lista prodotti top-level con paginazione
- `#sezione-scelta-sku` — albero prodotto con espansione progressiva e selezione SKU
- `#sezione-dettaglio` — dettaglio configurazione salvata
- `#sezione-mie-configurazioni` — lista configurazioni con azioni

---

## API Endpoint (Servlet JSON)

Tutte le servlet rispondono con `Content-Type: application/json`.
In caso di errore restituiscono un HTTP status appropriato e un body `{ "errore": "..." }`.

### Autenticazione (condivisa)

| Metodo | URL           | Descrizione                          |
|--------|---------------|--------------------------------------|
| POST   | `/api/login`  | Verifica credenziali, crea sessione  |
| POST   | `/api/logout` | Invalida la sessione                 |

### Fornitore

| Metodo | URL                                  | Descrizione                                         |
|--------|--------------------------------------|-----------------------------------------------------|
| GET    | `/api/fornitore/sku`                 | Restituisce tutte le SKU                            |
| POST   | `/api/fornitore/sku/crea`            | Crea una nuova SKU                                  |
| POST   | `/api/fornitore/sku/aggiorna`        | Aggiorna un attributo SKU (inline edit on blur)     |
| GET    | `/api/fornitore/prodotti-disponibili`| Prodotti senza padre (per il form prodotto composto)|
| POST   | `/api/fornitore/prodotto/crea`       | Crea prodotto semplice o composto con la sua struttura |
| POST   | `/api/fornitore/prodotto/aggiorna`   | Aggiorna un attributo di un prodotto                |
| POST   | `/api/fornitore/associazione/rimuovi`| Rimuove relazione padre↔figlio o semplice↔SKU       |
| POST   | `/api/fornitore/oggetto/elimina`     | Elimina SKU / prodotto (e discendenti se composto)  |
| GET    | `/api/fornitore/ricerca?keyword=...` | Ricerca case-insensitive su nome e descrizione      |

### Cliente

| Metodo | URL                                       | Descrizione                                          |
|--------|-------------------------------------------|------------------------------------------------------|
| GET    | `/api/cliente/prodotti?pagina=n`          | Prodotti top-level paginati (10 per volta)           |
| GET    | `/api/cliente/sottoprodotti?id=...`       | Figli diretti di un prodotto (espansione progressiva)|
| POST   | `/api/cliente/configurazione/salva`       | Crea o aggiorna una configurazione                   |
| GET    | `/api/cliente/configurazioni`             | Lista configurazioni dell'utente loggato             |
| GET    | `/api/cliente/configurazione?id=...`      | Dettaglio di una configurazione con SKU scelte       |
| POST   | `/api/cliente/configurazione/cancella`    | Cancella una configurazione                          |
| POST   | `/api/cliente/configurazione/clona`       | Clona una configurazione                             |

---

## Funzionalità speciali della versione JS

### Inline editing (Fornitore)

- Un click su un attributo di SKU o Prodotto lo trasforma in un `<input>` editabile.
- All'evento `blur` (uscita dal campo) il nuovo valore viene inviato automaticamente al server.
- Per gli attributi di un **prodotto composto** in fase di costruzione, le modifiche
  restano lato client fino alla pressione del bottone **SALVA PRODOTTO**.

### Costruzione interattiva del prodotto composto (Fornitore)

- Tutta la struttura viene prima assemblata lato client (albero nel DOM).
- Il bottone **`+`** accanto a un prodotto composto → menu contestuale (sottoprodotto composto / semplice).
- Il bottone **`+`** accanto a un prodotto semplice → menu contestuale (nuova SKU / SKU esistente).
- Il bottone **`-`** → rimuove la relazione con il padre (il figlio diventa top-level).
- Il bottone **`-*`** → elimina il prodotto e tutti i suoi discendenti ricorsivamente.
- Il bottone **SALVA PRODOTTO** → unica chiamata al server che persiste l'intera struttura.

### Navigazione progressiva dell'albero (Cliente)

- La home mostra solo i prodotti di **primo livello**.
- Il click su un prodotto composto carica i figli diretti via `fetch` e li espande inline.
- L'espansione avviene fino al livello 3 (profondità massima ammessa dalla traccia).
- Accanto a ogni prodotto semplice compare il menu a tendina per scegliere la SKU.

---

## Validazione

| Regola                              | Lato client (JS) | Lato server (Servlet + DAO) |
|-------------------------------------|:----------------:|:---------------------------:|
| Campi obbligatori vuoti             | ✅               | ✅                          |
| Codici prodotto / SKU duplicati     | —                | ✅                          |
| Prezzi >= 0                         | ✅               | ✅                          |
| Aciclicità della gerarchia          | —                | ✅                          |
| Profondità massima (3 livelli)      | —                | ✅                          |
| Almeno una SKU per prodotto semplice| ✅               | ✅                          |
| Tutte le SKU selezionate nel salvataggio | ✅          | ✅                          |
| Controllo sessione e ruolo          | —                | ✅ (ogni servlet)           |

---

## Divisione del lavoro

| Componente                  | Persona A — Fornitore                     | Persona B — Cliente                          |
|-----------------------------|-------------------------------------------|----------------------------------------------|
| Pagina SPA                  | `fornitore.html`                          | `cliente.html`                               |
| File JavaScript             | `js/fornitore/` (4 file)                  | `js/cliente/` (5 file)                       |
| Servlet API                 | `api/fornitore/` (9 servlet)              | `api/cliente/` (7 servlet)                   |
| **File condivisi (entrambi)**| `index.html`, `login.js`, `CheckLoginServlet.java`, `LogoutServlet.java`, `BaseApiServlet.java`, `web.xml`, `style.css` |

---

## Avvio del progetto

1. Assicurarsi che il database MySQL sia già creato (stesso schema della versione HTML pura).
2. Configurare in `web.xml` i parametri `dbUrl` e `dbUser`.
3. Impostare la variabile d'ambiente `DB_PASSWORD` con la password del database.
4. Eseguire `mvn clean package` dalla root del progetto.
5. Copiare il file `.war` generato nella cartella `webapps/` di Tomcat 11.
6. Avviare Tomcat e accedere a `http://localhost:8080/TIW2026-JS/`.

---

## Convenzioni di sviluppo

- Commenti in italiano, stile naturale (non in stile AI).
- Nessuna libreria JS esterna: tutto vanilla ES6+.
- Ogni servlet verifica sempre sessione e ruolo prima di rispondere.
- Le servlet JSON non usano Thymeleaf: niente `WebContext`, niente `templateEngine`.
- Lo `style.css` è **condiviso** con la versione HTML: non duplicare, usare lo stesso file.
- Gestione errori uniforme: HTTP status semantico + body JSON `{ "errore": "messaggio" }`.

---

## Note sulla BaseApiServlet

La versione JS introduce una nuova `BaseApiServlet.java` che sostituisce
la `BaseServlet` della versione HTML. Le differenze principali sono:

- **Niente Thymeleaf**: rimossi `templateEngine` e `WebContext`.
- **Metodo `sendJson(resp, object)`**: serializza con Gson e scrive la risposta.
- **Metodo `sendError(resp, status, message)`**: risponde con status + JSON di errore.
- **`isLogged()` e `getUtenteInSessione()`**: invariati rispetto alla versione HTML.
- La connessione al DB viene gestita allo stesso modo (`init()` / `destroy()`).
