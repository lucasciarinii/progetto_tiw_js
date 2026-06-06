// Creazione oggetto appClienteStub (stub iniziale) dentro a window -> permette ai moduli figlio di chiamare appCliente.qualcosa (come avere oggetto globale)
window.appCliente = {
    getUtente(){ return null; },
    getSezioneCorrente(){ return 'home'; },
    mostraSezione() {},
    mostraMessaggio(testo, tipo){ console.log('[' + tipo + ']', testo); },
    nascondiMessaggi() {},
    async parseJsonResponse(response){ return null; }
};

// Tutto il codice è inglobato dall'evento di DOMContentLoaded -> per aspettare che tutto l'HTML sia stato letto e disegnato prima di far partire il JavaScript
document.addEventListener('DOMContentLoaded', async () => {

    //! RECUPERO RIFERIMENTI SULL'HTML
    // riferimenti alle 4 sezioni (home, scelta-sku, configurazioni, dettaglio)
    const sezioneHome= document.getElementById('sezione-home');
    const sezioneSceltaSku= document.getElementById('sezione-scelta-sku');
    const sezioneConfigurazioni= document.getElementById('sezione-mie-configurazioni');
    const sezioneDettaglio= document.getElementById('sezione-dettaglio');

    // navbar: link di navigazione
    const linkHome= document.querySelectorAll('.link-home');
    const linkConfigurazioni= document.querySelectorAll('.link-configurazioni');
    const bottoniLogout= document.querySelectorAll('.btn-logout');
    const spansNome= document.querySelectorAll('.utente-nome');
    const spansCognome= document.querySelectorAll('.utente-cognome');

    // message box (uno per ogni sezione)
    const messageBoxHome= document.getElementById('message-box-home');
    const messageBoxSceltaSku= document.getElementById('message-box-scelta-sku');
    const messageBoxConfigurazioni= document.getElementById('message-box-configurazioni');
    const messageBoxDettaglio= document.getElementById('message-box-dettaglio');

    //! STATO INTENRO DELLA PAGINA
    const stato = {
        sezioneCorrente: 'home',
        utente: null
    };

    //! OPERAZIONI
    // 1. aggancia eventi di navigazione prima di caricare la sessione (link home, link "le mie configurazioni", logout))
    inizializzaEventi();

    // 2. verifica sessione: se non loggato torna al login
    const sessioneValida = await controllaSessione();
    if (!sessioneValida) return;

    // 3. aggiorna l'oggetto globale con i metodi reali
    window.appCliente = {
        getUtente(){ return stato.utente; }, // l'utente effettivamente loggato (dati recuperati dall'API di check-login)
        getSezioneCorrente(){ return stato.sezioneCorrente; }, // la sezione attualmente visibile (home, scelta-sku, configurazioni o dettaglio)
        mostraSezione, // funzione per mostrare una sezione e nascondere le altre (accetta il nome della sezione da mostrare)
        mostraMessaggio, // funzione per mostrare un messaggio di successo o errore (accetta il testo del messaggio e il tipo 'success' o 'error')
        nascondiMessaggi, // funzione per nascondere tutti i message box e resettarli (testo vuoto e classi CSS)
        async parseJsonResponse(response) {
            const data = await leggiJsonSicuro(response); // estraiamo il corpo della risposta in JSON
            if (!response.ok) { // se c'è un errore HTTP blocchiamo l'esecuzione lanciando un'eccezione
                throw new Error(data?.errore || 'Richiesta non riuscita.');
            }
            return data; // se tutto ok restituiamo i dati estratti in JSON
        }
    };

    // 4. mostra la home e inizializza i sottomoduli
    mostraSezione('home');
    inizializzaModuliFigli();


    //! FUNZIONI

    // aggancia gli eventi di click sui link di NAVIGAZIONE e LOGOUT
    function inizializzaEventi() {
        linkHome.forEach(el => el.addEventListener('click', e => {
            e.preventDefault();
            nascondiMessaggi();
            mostraSezione('home');
        }));

        linkConfigurazioni.forEach(el => el.addEventListener('click', e => {
            e.preventDefault();
            nascondiMessaggi();
            mostraSezione('configurazioni');
        }));

        bottoniLogout.forEach(el => el.addEventListener('click', eseguiLogout));
    }

    // controlla se la sessione è valida chiamando l'api di check-login
    async function controllaSessione() {
        try {
            const resp = await fetch('api/login', {
                method: 'GET',
                credentials: 'same-origin', // invia automaticamente i cookie di sessione
                headers: { 'Accept': 'application/json' }
            });
            const data = await leggiJsonSicuro(resp); // estrae il corpo della risposta in JSON (o null se non è JSON)

            if (!resp.ok || !data?.loggedIn) { // loggedIn è una proprietà impostata nell'API per indicare se l'utente è loggato
                window.location.href = 'index.html';
                return false;
            }

            if (!data.utente) {
                mostraMessaggio('Sessione valida ma dati utente mancanti.', 'error');
                return false;
            }

            // sessione valida, aggiorna lo stato e la navbar con i dati dell'utente
            stato.utente = data.utente;
            aggiornaNavbar(data.utente); // aggiorna i campi della navbar (nome e cognome) con i dati dell'utente loggato
            return true;
        } catch (err) {
            console.error('[main.js] errore controllo sessione:', err);
            window.location.href = 'index.html';
            return false;
        }
    }

    // aggiorna i campi della navbar (nome e cognome) con i dati dell'utente loggato
    function aggiornaNavbar(utente) {
        spansNome.forEach(el=> { el.textContent = utente.nome    || ''; });
        spansCognome.forEach(el=> { el.textContent = utente.cognome || ''; });
    }

    // cuore della SPA: mostra una sezione e nasconde le altre in base al nome passato come parametro (home, scelta-sku, configurazioni o dettaglio)
    function mostraSezione(nome) {
        nascondiMessaggi();

        // mostra la sezione richiesta e nasconde le altre
        sezioneHome.hidden = (nome !== 'home');
        sezioneSceltaSku.hidden = (nome !== 'scelta-sku');
        sezioneConfigurazioni.hidden = (nome !== 'configurazioni');
        sezioneDettaglio.hidden = (nome !== 'dettaglio');

        // aggiorna lo stato con la sezione attualmente visibile (utile per mostrare il messaggio box corretto e per i moduli figli che potrebbero averne bisogno)
        stato.sezioneCorrente = nome;

        // notifica il modulo appena mostrato in modo che possa eseguire le proprie operazioni
        if (nome === 'home' && window.homeClientePage?.onMostra) // controlla se in window esiste il modulo homeClientePage e se ha la funzione onMostra
            window.homeClientePage.onMostra();
        if (nome === 'configurazioni' && window.configurazioniPage?.onMostra)
            window.configurazioniPage.onMostra();
        if (nome === 'dettaglio' && window.dettaglioPage?.onMostra)
            window.dettaglioPage.onMostra();
    }

    // esegue il logout chiamando l'API di logout e reindirizzando alla pagina di login (collegato al click del pulsante di logout nella navbar)
    async function eseguiLogout() {
        try {
            const resp = await fetch('api/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            if (!resp.ok) {
                const data = await leggiJsonSicuro(resp);
                mostraMessaggio(data?.errore || 'Logout non riuscito.', 'error');
                return;
            }
            window.location.href = 'index.html';
        } catch (err) {
            console.error('[main.js] errore logout:', err);
            mostraMessaggio('Errore di connessione al server.', 'error');
        }
    }

    // mostra un alert (div apposito) nella sezione attualmente visibile
    function mostraMessaggio(testo, tipo) {
        const box = boxPerSezione(stato.sezioneCorrente);
        if (!box) return;
        box.hidden = false;
        box.textContent = testo;
        box.className = tipo === 'success' ? 'alert alert-success' : 'alert alert-error'; // classi CSS per stile successo o errore
    }

    // nasconde tutti i message box e resetta il loro testo e classi
    function nascondiMessaggi() {
        [messageBoxHome, messageBoxSceltaSku, messageBoxConfigurazioni, messageBoxDettaglio]
            .forEach(b => { if (b) { b.hidden = true; b.textContent = ''; b.className = 'alert'; } });
    }

    // in base al nome della sezione, restituisce il riferimento al message box corrispondente nell'HTML
    function boxPerSezione(nome) {
        if (nome === 'home') return messageBoxHome;
        if (nome === 'scelta-sku') return messageBoxSceltaSku;
        if (nome === 'configurazioni') return messageBoxConfigurazioni;
        if (nome === 'dettaglio') return messageBoxDettaglio;
        return null;
    }

    // fa response.json() ma in un try catch
    async function leggiJsonSicuro(response) {
        try   { return await response.json(); } // estrae il corpo della risposta in JSON
        catch { return null; }
    }

    // chiama la funzione init di ogni modulo figlio (homecliente, scelta-sku, configurazioni, dettaglio) se esiste
    function inizializzaModuliFigli() {
        if (window.homeClientePage?.init)
            window.homeClientePage.init().catch(err => console.error('[main.js] homeClientePage:', err));
        if (window.sceltaSkuPage?.init)
            window.sceltaSkuPage.init().catch(err => console.error('[main.js] sceltaSkuPage:', err));
        if (window.configurazioniPage?.init)
            window.configurazioniPage.init().catch(err => console.error('[main.js] configurazioniPage:', err));
        if (window.dettaglioPage?.init)
            window.dettaglioPage.init().catch(err => console.error('[main.js] dettaglioPage:', err));
    }
});
