document.addEventListener('DOMContentLoaded', async () => {
    // Riferimenti alle due macro-sezioni della SPA fornitore.
    // La navigazione interna avviene mostrando/nascondendo queste sezioni,
    // senza cambiare pagina.
    const sezioneHome = document.getElementById('sezione-home');
    const sezioneRicerca = document.getElementById('sezione-ricerca');

    // Link della navbar per passare da home a ricerca e viceversa.
    const linkRicercaProdotti = document.getElementById('link-ricerca-prodotti');
    const linkHomeFornitore = document.getElementById('link-home-fornitore');

    // I due bottoni logout sono presenti nelle due sezioni.
    // Usiamo la stessa funzione per entrambi.
    const btnLogoutHome = document.getElementById('btn-logout-home');
    const btnLogoutRicerca = document.getElementById('btn-logout-ricerca');

    // Elementi della navbar dove mostriamo nome e cognome del fornitore.
    const utenteNome = document.getElementById('utente-nome');
    const utenteCognome = document.getElementById('utente-cognome');
    const utenteNomeRicerca = document.getElementById('utente-nome-ricerca');
    const utenteCognomeRicerca = document.getElementById('utente-cognome-ricerca');

    // Box dei messaggi nelle due sezioni.
    // Li teniamo separati così ogni area ha il suo feedback.
    const messageBoxHome = document.getElementById('message-box-home');
    const messageBoxRicerca = document.getElementById('message-box-ricerca');

    // Stato minimo condiviso della pagina.
    // Ci basta sapere chi è l'utente loggato e in quale sezione ci troviamo.
    const statoPagina = {
        sezioneCorrente: 'home',
        utente: null
    };

    inizializzaEventi();

    // Prima di inizializzare davvero la pagina controlliamo la sessione.
    // Se la sessione non è valida, il metodo fa già il redirect alla login.
    const sessioneValida = await controllaSessione();
    if (!sessioneValida) {
        return;
    }

    // API condivisa tra i vari file JS della parte fornitore.
    // Gli altri moduli (sku.js, prodotto.js, ricerca.js) possono appoggiarsi qui
    // per recuperare info di contesto o mostrare messaggi in modo uniforme.
    window.appFornitore = {
        // Warning IDE: "Unused function getUtente".
        // Per ora non sembra usata nei file che abbiamo controllato,
        // ma la lasciamo perché può tornare utile ai moduli figli
        // e fa parte dell'API comune esposta da main.js.
        getUtente() {
            return statoPagina.utente;
        },

        getSezioneCorrente() {
            return statoPagina.sezioneCorrente;
        },

        // Warning IDE: "Unused property mostraSezione".
        // La funzione è sicuramente usata dentro main.js.
        // Il warning riguarda la proprietà esposta sull'oggetto globale:
        // può essere un falso positivo se l'IDE non segue bene gli accessi dinamici.
        mostraSezione,

        mostraMessaggioHome,

        // Warning IDE: "Unused property mostraMessaggioRicerca".
        // La teniamo esposta perché è coerente con la struttura a due sezioni.
        // Anche se oggi nessun modulo la richiama direttamente, è utile averla pronta.
        mostraMessaggioRicerca,

        // Warning IDE: "Unused property mostraMessaggioCorrente".
        // Idem come sopra: utility comoda per scegliere automaticamente
        // il box messaggi corretto in base alla sezione attiva.
        mostraMessaggioCorrente,

        nascondiMessaggi,

        async parseJsonResponse(response) {
            const data = await leggiJsonSicuro(response);

            if (!response.ok) {
                // Warning IDE: "Unresolved variable errore".
                // Qui non c'è nessuna variabile mancante: "errore" è una proprietà
                // attesa del JSON restituito dal server in caso di fallimento.
                // L'IDE si lamenta perché non conosce in modo statico la forma del JSON.
                throw new Error(data?.errore || 'Richiesta non riuscita.');
            }

            return data;
        }
    };

    // All'avvio mostriamo la home del fornitore.
    mostraSezione('home');

    // Una volta verificata la sessione e preparato l'oggetto condiviso,
    // possiamo inizializzare i moduli secondari.
    inizializzaModuliFigli();

    function inizializzaEventi() {
        if (linkRicercaProdotti) {
            linkRicercaProdotti.addEventListener('click', (event) => {
                event.preventDefault();
                nascondiMessaggi();
                mostraSezione('ricerca');
            });
        }

        if (linkHomeFornitore) {
            linkHomeFornitore.addEventListener('click', (event) => {
                event.preventDefault();
                nascondiMessaggi();
                mostraSezione('home');
            });
        }

        if (btnLogoutHome) {
            btnLogoutHome.addEventListener('click', eseguiLogout);
        }

        if (btnLogoutRicerca) {
            btnLogoutRicerca.addEventListener('click', eseguiLogout);
        }
    }

    async function controllaSessione() {
        try {
            const resp = await fetch('api/check-login', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const data = await leggiJsonSicuro(resp);

            // Warning IDE: "Unresolved variable loggedIn".
            // Anche qui non è una variabile mancante: è una proprietà del JSON
            // che il backend usa per dire se la sessione è valida oppure no.
            if (!resp.ok || !data || !data.loggedIn) {
                window.location.href = 'index.html';
                return false;
            }

            if (!data.utente) {
                mostraMessaggioHome('Sessione valida ma dati utente mancanti.', 'error');
                return false;
            }

            statoPagina.utente = data.utente;
            aggiornaUtenteNavbar(data.utente);
            return true;
        } catch (err) {
            console.error('Errore durante il controllo sessione:', err);
            window.location.href = 'index.html';
            return false;
        }
    }

    function aggiornaUtenteNavbar(utente) {
        const nome = utente.nome || '';

        // Warning IDE: "Unresolved variable cognome".
        // Stesso motivo di prima: "cognome" non è una variabile globale,
        // ma una proprietà dell'oggetto utente arrivato dal backend.
        const cognome = utente.cognome || '';

        if (utenteNome) utenteNome.textContent = nome;
        if (utenteCognome) utenteCognome.textContent = cognome;
        if (utenteNomeRicerca) utenteNomeRicerca.textContent = nome;
        if (utenteCognomeRicerca) utenteCognomeRicerca.textContent = cognome;
    }

    function mostraSezione(nomeSezione) {
        // Ogni volta che cambiamo sezione ripuliamo i messaggi visibili,
        // così evitiamo di trascinarci errori o successi della sezione precedente.
        nascondiMessaggi();

        if (nomeSezione === 'ricerca') {
            if (sezioneHome) sezioneHome.hidden = true;
            if (sezioneRicerca) sezioneRicerca.hidden = false;
            statoPagina.sezioneCorrente = 'ricerca';

            // Piccola comodità: quando entro nella ricerca porto subito il focus
            // sull'input, così l'utente può iniziare a scrivere senza altri click.
            const inputRicerca = document.getElementById('input-ricerca');
            if (inputRicerca) {
                inputRicerca.focus();
            }
            return;
        }

        // Se non siamo in ricerca, mostriamo la home come stato di default.
        if (sezioneHome) sezioneHome.hidden = false;
        if (sezioneRicerca) sezioneRicerca.hidden = true;
        statoPagina.sezioneCorrente = 'home';
    }

    async function eseguiLogout() {
        try {
            const resp = await fetch('api/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!resp.ok) {
                const data = await leggiJsonSicuro(resp);

                // Warning IDE: "Unresolved variable errore".
                // Stesso caso già visto sopra: proprietà prevista del JSON di errore.
                const messaggio = data?.errore || 'Logout non riuscito.';
                mostraMessaggioCorrente(messaggio, 'error');
                return;
            }

            window.location.href = 'index.html';
        } catch (err) {
            console.error('Errore durante il logout:', err);
            mostraMessaggioCorrente('Errore di connessione al server.', 'error');
        }
    }

    function mostraMessaggioHome(testo, tipo) {
        mostraMessaggio(messageBoxHome, testo, tipo);
    }

    function mostraMessaggioRicerca(testo, tipo) {
        mostraMessaggio(messageBoxRicerca, testo, tipo);
    }

    function mostraMessaggioCorrente(testo, tipo) {
        if (statoPagina.sezioneCorrente === 'ricerca') {
            mostraMessaggioRicerca(testo, tipo);
        } else {
            mostraMessaggioHome(testo, tipo);
        }
    }

    function mostraMessaggio(box, testo, tipo) {
        if (!box) {
            return;
        }

        box.hidden = false;
        box.textContent = testo;
        box.classList.remove('alert-error', 'alert-success');

        if (tipo === 'success') {
            box.classList.add('alert-success');
        } else {
            box.classList.add('alert-error');
        }
    }

    function nascondiMessaggi() {
        nascondiMessaggio(messageBoxHome);
        nascondiMessaggio(messageBoxRicerca);
    }

    function nascondiMessaggio(box) {
        if (!box) {
            return;
        }

        box.hidden = true;
        box.textContent = '';
        box.classList.remove('alert-error', 'alert-success');
    }

    async function leggiJsonSicuro(response) {
        try {
            return await response.json();
        } catch (err) {
            // Qui volutamente non rilanciamo l'errore.
            // In alcuni casi può arrivare una risposta vuota o non JSON,
            // e preferiamo restituire null per gestirla a valle.
            return null;
        }
    }

    function inizializzaModuliFigli() {
        // Ogni modulo si inizializza solo se è presente ed espone init().
        // In questo modo main.js resta robusto anche se un file viene caricato
        // più tardi o temporaneamente non è disponibile.
        if (window.skuPage && typeof window.skuPage.init === 'function') {
            window.skuPage.init().catch(err => console.error('[main.js] errore skuPage', err));
        }

        if (window.prodottoPage && typeof window.prodottoPage.init === 'function') {
            window.prodottoPage.init().catch(err => console.error('[main.js] errore prodottoPage', err));
        }

        if (window.ricercaPage && typeof window.ricercaPage.init === 'function') {
            window.ricercaPage.init().catch(err => console.error('[main.js] errore ricercaPage', err));
        }
    }
});