document.addEventListener('DOMContentLoaded', async () => {
    // Riferimenti alle due macro-sezioni della SPA fornitore.
    const sezioneHome = document.getElementById('sezione-home');
    const sezioneRicerca = document.getElementById('sezione-ricerca');

    // Link della navbar per passare da home a ricerca e viceversa.
    const linkRicercaProdotti = document.getElementById('link-ricerca-prodotti');
    const linkHomeFornitore = document.getElementById('link-home-fornitore');

    // Bottoni logout presenti nelle due sezioni.
    const btnLogoutHome = document.getElementById('btn-logout-home');
    const btnLogoutRicerca = document.getElementById('btn-logout-ricerca');

    // Elementi dove mostriamo nome e cognome del fornitore.
    const utenteNome = document.getElementById('utente-nome');
    const utenteCognome = document.getElementById('utente-cognome');
    const utenteNomeRicerca = document.getElementById('utente-nome-ricerca');
    const utenteCognomeRicerca = document.getElementById('utente-cognome-ricerca');

    // Box dei messaggi nelle due sezioni.
    const messageBoxHome = document.getElementById('message-box-home');
    const messageBoxRicerca = document.getElementById('message-box-ricerca');

    // Stato minimo condiviso della pagina.
    const statoPagina = {
        sezioneCorrente: 'home',
        utente: null
    };

    inizializzaEventi();

    // Prima di inizializzare la pagina controllo la sessione.
    const sessioneValida = await controllaSessione();
    if (!sessioneValida) {
        return;
    }

    // API condivisa esposta ai moduli figli del fornitore.
    window.appFornitore = {
        mostraMessaggioHome,
        mostraMessaggioRicerca,
        nascondiMessaggi,

        async parseJsonResponse(response) {
            const data = await leggiJsonSicuro(response);

            if (!response.ok) {
                throw new Error(data?.errore || 'Richiesta non riuscita.');
            }

            return data;
        }
    };

    // All'avvio mostro la home del fornitore.
    mostraSezione('home');

    // Dopo il controllo sessione posso inizializzare i moduli secondari.
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
            const resp = await fetch('api/login', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json'
                }
            });

            const data = await leggiJsonSicuro(resp);

            if (!resp.ok || !data || !data.loggedIn) {
                window.location.href = 'index.html';
                return false;
            }

            if (!data.utente) {
                window.location.href = 'index.html';
                return false;
            }

            statoPagina.utente = data.utente;
            aggiornaUtenteNavbar(data.utente);
            return true;
        } catch (err) {
            console.error('[main.js] errore durante il controllo sessione:', err);
            window.location.href = 'index.html';
            return false;
        }
    }

    function aggiornaUtenteNavbar(utente) {
        const nome = utente.nome || '';
        const cognome = utente.cognome || '';

        if (utenteNome) utenteNome.textContent = nome;
        if (utenteCognome) utenteCognome.textContent = cognome;
        if (utenteNomeRicerca) utenteNomeRicerca.textContent = nome;
        if (utenteCognomeRicerca) utenteCognomeRicerca.textContent = cognome;
    }

    function mostraSezione(nomeSezione) {
        // Quando cambio sezione pulisco prima i messaggi visibili.
        nascondiMessaggi();

        if (nomeSezione === 'ricerca') {
            if (sezioneHome) sezioneHome.hidden = true;
            if (sezioneRicerca) sezioneRicerca.hidden = false;
            statoPagina.sezioneCorrente = 'ricerca';

            // Entro in ricerca e porto subito il focus sull'input.
            const inputRicerca = document.getElementById('input-ricerca');
            if (inputRicerca) {
                inputRicerca.focus();
            }
            return;
        }

        // In tutti gli altri casi torno alla home.
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
                    Accept: 'application/json'
                }
            });

            if (!resp.ok) {
                const data = await leggiJsonSicuro(resp);
                const messaggio = data?.errore || 'Logout non riuscito.';
                mostraMessaggioCorrente(messaggio, 'error');
                return;
            }

            window.location.href = 'index.html';
        } catch (err) {
            console.error('[main.js] errore durante il logout:', err);
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
            // Se la risposta non è JSON o è vuota, restituisco null.
            return null;
        }
    }

    function inizializzaModuliFigli() {
        // Ogni modulo si inizializza solo se presente e con init() disponibile.
        if (window.skuPage && typeof window.skuPage.init === 'function') {
            window.skuPage.init().catch((err) => console.error('[main.js] errore skuPage:', err));
        }

        if (window.prodottoPage && typeof window.prodottoPage.init === 'function') {
            window.prodottoPage.init().catch((err) => console.error('[main.js] errore prodottoPage:', err));
        }

        if (window.ricercaPage && typeof window.ricercaPage.init === 'function') {
            window.ricercaPage.init().catch((err) => console.error('[main.js] errore ricercaPage:', err));
        }
    }
});