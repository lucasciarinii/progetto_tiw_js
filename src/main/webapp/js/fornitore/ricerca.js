window.ricercaPage = (function () {
    // Questo modulo gestisce tutta la sezione "ricerca prodotti" del fornitore.
    // L'idea è tenerci qui dentro lo stato locale della ricerca, il rendering della lista
    // e il rendering del dettaglio, così main.js deve solo inizializzare il modulo
    // senza conoscere i dettagli dell'interfaccia.
    const stato = {
        // Ultima keyword cercata con successo.
        // La usiamo soprattutto per mostrare messaggi tipo:
        // "nessun risultato trovato per ...".
        keywordCorrente: '',

        // Lista normalizzata dei risultati della ricerca.
        // Dentro ci finiscono sia i prodotti sia le SKU, portati però ad un formato comune
        // così il rendering della lista resta semplice e uniforme.
        risultati: [],

        // Elemento attualmente selezionato nella colonna sinistra.
        // Serve sia per evidenziare il risultato attivo sia per capire cosa mostrare a destra.
        selezionato: null,

        // Quando clicco un prodotto, nella lista spesso ho solo dati sintetici.
        // Qui salvo il dettaglio completo, una volta caricato dal server.
        dettaglioCompleto: null
    };

    // Riferimenti DOM principali della sezione ricerca.
    // Li inizializziamo nella init() perché il file viene caricato subito,
    // ma gli elementi HTML devono essere già presenti nel DOM.
    let inputRicerca;
    let btnCerca;
    let risultatiContainer;
    let dettaglioContainer;
    let messageBoxRicerca;

    async function init() {
        // Aggancio degli elementi HTML principali della sezione.
        // Se in futuro cambia qualche id nella pagina, il primo posto da controllare è questo.
        inputRicerca = document.getElementById('input-ricerca');
        btnCerca = document.getElementById('btn-cerca');
        risultatiContainer = document.getElementById('ricerca-risultati');
        dettaglioContainer = document.getElementById('ricerca-dettaglio');
        messageBoxRicerca = document.getElementById('message-box-ricerca');

        // Click sul bottone "Cerca".
        // Qui non facciamo la ricerca direttamente nell'handler anonimo:
        // preferiamo delegare ad una funzione con nome, più leggibile e riusabile.
        if (btnCerca) {
            btnCerca.addEventListener('click', onClickCerca);
        }

        // Supporto al tasto Invio dentro il campo di ricerca.
        // In questo modo il comportamento è naturale anche senza cliccare il bottone.
        if (inputRicerca) {
            inputRicerca.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    onClickCerca();
                }
            });
        }

        // All'avvio mostriamo uno stato neutro:
        // nessun risultato ancora caricato e dettaglio vuoto.
        renderStatoIniziale();
    }

    async function onClickCerca() {
        // Prima di ogni nuova ricerca puliamo eventuali messaggi vecchi,
        // altrimenti rischiamo di lasciare a schermo errori non più attuali.
        nascondiMessaggiRicerca();

        const keyword = (inputRicerca?.value || '').trim();

        // Validazione minima lato client.
        // Evitiamo chiamate inutili al server con keyword vuota.
        if (!keyword) {
            mostraMessaggioRicerca('Inserisci una parola chiave per cercare prodotti e SKU.', 'error');
            return;
        }

        await eseguiRicerca(keyword);
    }

    async function eseguiRicerca(keyword) {
        try {
            // Chiamata alla servlet di ricerca del fornitore.
            // La keyword viene codificata nell'URL per evitare problemi con spazi o caratteri speciali.
            const response = await fetch(`apifornitorericerca?keyword=${encodeURIComponent(keyword)}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            // Il parsing e la gestione degli errori HTTP sono centralizzati in main.js,
            // così tutti i moduli si comportano allo stesso modo.
            const data = await window.appFornitore.parseJsonResponse(response);

            // Aggiorniamo lo stato locale con la nuova ricerca.
            // Quando parte una ricerca nuova, azzeriamo anche selezione e dettaglio.
            stato.keywordCorrente = data?.keyword || keyword;
            stato.risultati = normalizzaRisultati(data);
            stato.selezionato = null;
            stato.dettaglioCompleto = null;

            // Ridisegniamo la colonna risultati e rimettiamo il pannello di destra
            // in stato neutro, in attesa di una selezione esplicita.
            renderRisultati();
            renderDettaglioVuoto();
        } catch (error) {
            console.error('[ricerca.js] errore durante la ricerca:', error);

            // Se la chiamata fallisce, mostriamo un messaggio leggibile all'utente.
            mostraMessaggioRicerca(
                error.message || 'Errore durante la ricerca.',
                'error'
            );
        }
    }

    function normalizzaRisultati(data) {
        const risultati = [];

        // Il backend può restituire due liste separate: prodotti e SKU.
        // Qui le portiamo in un formato unico, così la UI della lista non deve
        // conoscere troppe differenze tra i due tipi di elemento.
        //
        // Nota warning IDE:
        // "prodotti" e "sku" non sono variabili mancanti, ma proprietà del JSON
        // restituito dalla servlet di ricerca. L'IDE non conosce lo shape del JSON
        // e quindi segnala un falso positivo.
        const prodotti = Array.isArray(data?.prodotti) ? data.prodotti : [];
        const sku = Array.isArray(data?.sku) ? data.sku : [];

        // I prodotti entrano nella lista con categoria "PRODOTTO".
        // Salviamo anche il record originale dentro raw, così se serve
        // possiamo recuperare campi non esposti direttamente nella lista.
        prodotti.forEach(function (prodotto) {
            risultati.push({
                categoria: 'PRODOTTO',
                tipo: prodotto.tipo || 'PRODOTTO',
                id: prodotto.id,
                nome: prodotto.nome,
                codice: prodotto.codice,
                raw: prodotto
            });
        });

        // Le SKU entrano nella stessa lista con categoria "SKU".
        // Anche qui salviamo il dato originale in raw per eventuale riuso nel dettaglio.
        sku.forEach(function (item) {
            risultati.push({
                categoria: 'SKU',
                tipo: 'SKU',
                id: item.id,
                nome: item.nome,
                codice: item.codice,
                prezzo: item.prezzo,
                raw: item
            });
        });

        return risultati;
    }

    function renderStatoIniziale() {
        if (!risultatiContainer) {
            return;
        }

        // Stato mostrato quando la sezione viene aperta per la prima volta
        // o comunque prima di eseguire una ricerca.
        risultatiContainer.innerHTML = `
            <p class="empty-box">
                Inserisci una parola chiave per cercare prodotti e SKU.
            </p>
        `;

        renderDettaglioVuoto();
    }

    function renderRisultati() {
        if (!risultatiContainer) {
            return;
        }

        // Ad ogni render ripartiamo da contenitore pulito.
        risultatiContainer.innerHTML = '';

        // Se non ci sono risultati, mostriamo un messaggio esplicito con la keyword cercata.
        if (!stato.risultati || stato.risultati.length === 0) {
            risultatiContainer.innerHTML = `
                <p class="empty-box">
                    Nessun risultato trovato per <strong>${escapeHtml(stato.keywordCorrente)}</strong>.
                </p>
            `;
            return;
        }

        const lista = document.createElement('ul');
        lista.className = 'result-list';

        stato.risultati.forEach(function (item) {
            const li = document.createElement('li');
            li.className = 'result-item';

            // Ogni risultato viene reso come bottone:
            // è semanticamente corretto perché scatena un'azione nella pagina,
            // cioè il caricamento del dettaglio.
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'result-link';

            // Evidenzio l'elemento attualmente selezionato.
            if (stato.selezionato &&
                stato.selezionato.id === item.id &&
                stato.selezionato.categoria === item.categoria) {
                button.classList.add('is-active');
            }

            button.addEventListener('click', function () {
                // Nota warning IDE:
                // "Promise returned from selezionaRisultato is ignored".
                // Il warning è comprensibile perché selezionaRisultato è async.
                // Qui però il comportamento è voluto: il click avvia il flusso asincrono
                // e gli errori sono già gestiti dentro la funzione con try/catch.
                selezionaRisultato(item);
            });

            // Parte sinistra del risultato: nome + codice.
            const main = document.createElement('span');
            main.className = 'result-main';

            const titolo = document.createElement('span');
            titolo.textContent = item.nome || 'Senza nome';

            const codice = document.createElement('span');
            codice.className = 'result-code';
            codice.textContent = `Codice: ${item.codice ?? '-'}`;

            main.appendChild(titolo);
            main.appendChild(codice);

            // Badge laterale per distinguere velocemente SKU, semplice o composto.
            const badge = document.createElement('span');
            badge.className = 'result-badge';
            badge.textContent = getEtichettaTipo(item);

            button.appendChild(main);
            button.appendChild(badge);
            li.appendChild(button);
            lista.appendChild(li);
        });

        risultatiContainer.appendChild(lista);
    }

    async function selezionaRisultato(item) {
        // Appena clicco un elemento, aggiorno subito lo stato visivo della lista
        // e mostro un placeholder di caricamento nel pannello di destra.
        stato.selezionato = item;
        stato.dettaglioCompleto = null;
        renderRisultati();
        renderDettaglioCaricamento(item);

        try {
            // Se l'elemento è una SKU, di solito i dati presenti bastano già
            // per renderne il dettaglio, quindi non serve una chiamata aggiuntiva.
            if (item.categoria === 'SKU') {
                stato.dettaglioCompleto = item.raw || item;
                renderDettaglio(stato.dettaglioCompleto);
                return;
            }

            // Se invece è un prodotto, provo a chiedere al server il dettaglio completo,
            // utile soprattutto per prodotti composti con figli o prodotti semplici con skuList.
            const dettaglio = await caricaDettaglioProdotto(item.id, item.tipo);
            stato.dettaglioCompleto = dettaglio || item.raw;
            renderDettaglio(stato.dettaglioCompleto);
        } catch (error) {
            console.error('[ricerca.js] errore caricamento dettaglio:', error);

            // Se il caricamento del dettaglio fallisce, segnalo l'errore ma provo comunque
            // a mostrare quello che già avevo nei dati raw, così l'interfaccia non resta vuota.
            mostraMessaggioRicerca(
                error.message || 'Impossibile caricare il dettaglio selezionato.',
                'error'
            );
            renderDettaglio(item.raw || item);
        }
    }

    function renderDettaglio(item) {
        if (!dettaglioContainer) {
            return;
        }

        // Nessun elemento selezionato o dettaglio non disponibile.
        if (!item) {
            renderDettaglioVuoto();
            return;
        }

        // La ricerca non si occupa di conoscere il dettaglio di SKU e prodotti nei dettagli:
        // delega ai moduli specializzati già presenti nel progetto.
        if (stato.selezionato?.categoria === 'SKU') {
            renderDettaglioSkuRicerca(item);
            return;
        }

        renderDettaglioProdottoRicerca(item);
    }

    function renderDettaglioCaricamento(item) {
        if (!dettaglioContainer) {
            return;
        }

        // Placeholder semplice mentre aspettiamo la risposta del server.
        dettaglioContainer.innerHTML = `
            <p class="detail-empty-box">
                Caricamento dettaglio di <strong>${escapeHtml(item?.nome || 'elemento')}</strong>...
            </p>
        `;
    }

    function renderDettaglioSkuRicerca(sku) {
        // Se il modulo SKU non è disponibile, mostriamo un fallback leggibile
        // invece di lasciare il pannello vuoto o rompere tutto con un errore JS.
        if (!window.skuPage || typeof window.skuPage.renderDettaglioSkuInContainer !== 'function') {
            dettaglioContainer.innerHTML = `
                <p class="detail-empty-box">
                    Renderer dettaglio SKU non disponibile.
                </p>
            `;
            return;
        }

        window.skuPage.renderDettaglioSkuInContainer(sku, dettaglioContainer);
    }

    function renderDettaglioProdottoRicerca(prodotto) {
        // Stesso discorso del metodo sopra, ma per il rendering dei prodotti.
        if (!window.prodottoPage || typeof window.prodottoPage.renderDettaglioProdottoInContainer !== 'function') {
            dettaglioContainer.innerHTML = `
                <p class="detail-empty-box">
                    Renderer dettaglio prodotto non disponibile.
                </p>
            `;
            return;
        }

        window.prodottoPage.renderDettaglioProdottoInContainer(prodotto, dettaglioContainer);
    }

    function renderDettaglioVuoto() {
        if (!dettaglioContainer) {
            return;
        }

        // Messaggio neutro mostrato quando non è ancora stato selezionato nulla.
        dettaglioContainer.innerHTML = `
            <p class="detail-empty-box">
                Seleziona un risultato per vedere i dettagli.
            </p>
        `;
    }

    function rimuoviRisultatoDaLista(id, categoria) {
        // Utility usata dagli altri moduli quando un oggetto viene eliminato
        // e deve sparire anche dai risultati correnti della ricerca.
        if (id == null || !categoria) {
            return;
        }

        stato.risultati = stato.risultati.filter((item) => {
            return !(String(item.id) === String(id) && item.categoria === categoria);
        });

        // Se ho rimosso proprio l'elemento attualmente selezionato,
        // svuoto anche il pannello dettaglio.
        if (stato.selezionato &&
            String(stato.selezionato.id) === String(id) &&
            stato.selezionato.categoria === categoria) {
            stato.selezionato = null;
            stato.dettaglioCompleto = null;
            renderDettaglioVuoto();
        }

        renderRisultati();
    }

    function rimuoviRisultatiSottoalbero(prodotto) {
        // Questa utility serve nei casi in cui viene eliminato un prodotto composto
        // o una porzione del suo albero: dobbiamo togliere dalla lista anche figli e SKU collegate.
        if (!prodotto) {
            return;
        }

        const prodottoIds = new Set();
        const skuIds = new Set();

        // Visita ricorsiva del prodotto completo per raccogliere tutti gli id coinvolti.
        // In prodottoIds mettiamo i prodotti del sottoalbero,
        // in skuIds tutte le SKU trovate lungo i nodi semplici.
        const raccogli = (nodo) => {
            if (!nodo || nodo.id == null) {
                return;
            }

            prodottoIds.add(String(nodo.id));

            if (Array.isArray(nodo.skuList)) {
                nodo.skuList.forEach((sku) => {
                    if (sku && sku.id != null) {
                        skuIds.add(String(sku.id));
                    }
                });
            }

            if (Array.isArray(nodo.figli)) {
                nodo.figli.forEach((figlio) => raccogli(figlio));
            }
        };

        raccogli(prodotto);

        // Secondo passaggio: cerco anche eventuali prodotti che erano già nella lista risultati
        // ma non erano dentro il dettaglio completo, usando il padreId come indizio.
        // Questo rende la pulizia della lista più robusta.
        let aggiunti;
        do {
            aggiunti = false;
            stato.risultati.forEach((item) => {
                if (item.categoria !== 'PRODOTTO' || item.id == null) {
                    return;
                }

                // Nota warning IDE:
                // padreId non è una variabile mancante, ma una proprietà del dato raw.
                // Il warning nasce dal fatto che l'IDE non sa che forma abbia il JSON.
                const padreId = item.raw?.padreId;

                if (padreId != null && prodottoIds.has(String(padreId))
                    && !prodottoIds.has(String(item.id))) {
                    prodottoIds.add(String(item.id));
                    aggiunti = true;
                }
            });
        } while (aggiunti);

        // A questo punto elimino dalla lista tutti i prodotti e le SKU
        // che appartengono al sottoalbero raccolto.
        stato.risultati = stato.risultati.filter((item) => {
            if (item.categoria === 'PRODOTTO') {
                return !prodottoIds.has(String(item.id));
            }
            if (item.categoria === 'SKU') {
                return !skuIds.has(String(item.id));
            }
            return true;
        });

        // Se tra gli elementi rimossi c'era anche quello selezionato,
        // azzero selezione e dettaglio per evitare riferimenti inconsistenti.
        if (stato.selezionato) {
            const selezionatoId = String(stato.selezionato.id);
            const selezionatoCategoria = stato.selezionato.categoria;
            const rimosso = (selezionatoCategoria === 'PRODOTTO' && prodottoIds.has(selezionatoId))
                || (selezionatoCategoria === 'SKU' && skuIds.has(selezionatoId));

            if (rimosso) {
                stato.selezionato = null;
                stato.dettaglioCompleto = null;
                renderDettaglioVuoto();
            }
        }

        renderRisultati();
    }

    function aggiornaRisultatoInLista(id, categoria, patch) {
        // Utility usata dagli altri moduli quando un elemento cambia
        // e la lista risultati deve riflettere subito il nuovo stato.
        if (id == null || !categoria || !patch) {
            return;
        }

        stato.risultati = stato.risultati.map((item) => {
            if (String(item.id) !== String(id) || item.categoria !== categoria) {
                return item;
            }

            // Nota warning IDE:
            // il warning sulla variabile "aggiornato" ridondante aveva senso,
            // quindi qui restituiamo direttamente l'oggetto aggiornato senza variabile intermedia.
            return {
                ...item,
                ...patch,
                raw: { ...(item.raw || {}), ...patch }
            };
        });

        // Se l'elemento aggiornato è anche quello selezionato nel pannello di destra,
        // allineiamo pure selezione e dettaglio completo.
        if (stato.selezionato
            && String(stato.selezionato.id) === String(id)
            && stato.selezionato.categoria === categoria) {
            stato.selezionato = { ...stato.selezionato, ...patch };

            if (stato.dettaglioCompleto) {
                stato.dettaglioCompleto = { ...stato.dettaglioCompleto, ...patch };
            }
        }

        renderRisultati();
    }

    function mostraMessaggioRicerca(messaggio, tipo) {
        // Messaggistica locale della sezione ricerca.
        // Qui non usiamo il box globale generico: ci teniamo separati
        // così questa sezione resta autonoma.
        if (!messageBoxRicerca) {
            return;
        }

        messageBoxRicerca.hidden = false;
        messageBoxRicerca.textContent = messaggio;
        messageBoxRicerca.className = tipo === 'success'
            ? 'alert alert-success'
            : 'alert alert-error';
    }

    function nascondiMessaggiRicerca() {
        if (!messageBoxRicerca) {
            return;
        }

        messageBoxRicerca.hidden = true;
        messageBoxRicerca.textContent = '';
        messageBoxRicerca.className = 'alert';
    }

    function getEtichettaTipo(item) {
        // Etichetta breve usata nel badge della lista risultati.
        if (item.categoria === 'SKU') return 'SKU';
        if (item.tipo === 'SEMPLICE') return 'SEMPLICE';
        if (item.tipo === 'COMPOSTO') return 'COMPOSTO';
        return 'PRODOTTO';
    }

    async function caricaDettaglioProdotto(idProdotto, tipoProdotto) {
        // Quando clicco un prodotto nella lista risultati,
        // faccio una chiamata dedicata per recuperare il dettaglio completo.
        const tipoNormalizzato = (tipoProdotto || '').toString().trim().toUpperCase();

        const response = await fetch(
            `apifornitoreprodotto-dettaglio?id=${encodeURIComponent(idProdotto)}&tipo=${encodeURIComponent(tipoNormalizzato)}`,
            {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        return window.appFornitore.parseJsonResponse(response);
    }

    function escapeHtml(valore) {
        // Piccola utility difensiva quando inseriamo testo dentro innerHTML.
        // Evita che caratteri speciali vengano interpretati come markup HTML.
        return String(valore ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    // Espongo solo quello che deve essere usato dall'esterno.
    // Il resto rimane privato al modulo.
    return {
        init,
        rimuoviRisultatoDaLista,
        rimuoviRisultatiSottoalbero,
        aggiornaRisultatoInLista,
        mostraMessaggioRicerca
    };
})();