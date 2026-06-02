
document.addEventListener('DOMContentLoaded', async () => {
    const sezioneHome = document.getElementById('sezione-home');
    const sezioneRicerca = document.getElementById('sezione-ricerca');

    const linkRicercaProdotti = document.getElementById('link-ricerca-prodotti');
    const linkHomeFornitore = document.getElementById('link-home-fornitore');

    const btnLogoutHome = document.getElementById('btn-logout-home');
    const btnLogoutRicerca = document.getElementById('btn-logout-ricerca');

    const utenteNome = document.getElementById('utente-nome');
    const utenteCognome = document.getElementById('utente-cognome');
    const utenteNomeRicerca = document.getElementById('utente-nome-ricerca');
    const utenteCognomeRicerca = document.getElementById('utente-cognome-ricerca');

    const messageBoxHome = document.getElementById('message-box-home');
    const messageBoxRicerca = document.getElementById('message-box-ricerca');

    const statoPagina = {
        sezioneCorrente: 'home',
        utente: null
    };

    inizializzaEventi();

    const sessioneValida = await controllaSessione();
    if (!sessioneValida) {
        return;
    }

    window.appFornitore = {
        getUtente() {
            return statoPagina.utente;
        },

        getSezioneCorrente() {
            return statoPagina.sezioneCorrente;
        },

        mostraSezione,
        mostraMessaggioHome,
        mostraMessaggioRicerca,
        mostraMessaggioCorrente,
        nascondiMessaggi,

        async parseJsonResponse(response) {
            const data = await leggiJsonSicuro(response);

            if (!response.ok) {
                throw new Error(data?.errore || 'Richiesta non riuscita.');
            }

            return data;
        }
    };

    mostraSezione('home');
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
        const cognome = utente.cognome || '';

        if (utenteNome) utenteNome.textContent = nome;
        if (utenteCognome) utenteCognome.textContent = cognome;
        if (utenteNomeRicerca) utenteNomeRicerca.textContent = nome;
        if (utenteCognomeRicerca) utenteCognomeRicerca.textContent = cognome;
    }

    function mostraSezione(nomeSezione) {
        nascondiMessaggi();

        if (nomeSezione === 'ricerca') {
            if (sezioneHome) sezioneHome.hidden = true;
            if (sezioneRicerca) sezioneRicerca.hidden = false;
            statoPagina.sezioneCorrente = 'ricerca';

            const inputRicerca = document.getElementById('input-ricerca');
            if (inputRicerca) {
                inputRicerca.focus();
            }
            return;
        }

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
            return null;
        }
    }

    function inizializzaModuliFigli() {
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