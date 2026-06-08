window.ricercaPage = (function () {
    // Stato locale della sezione ricerca.
    const stato = {
        // Ultima keyword cercata.
        keywordCorrente: '',

        // Risultati normalizzati in un formato unico.
        risultati: [],

        // Elemento attualmente selezionato nella lista.
        selezionato: null,

        // Dettaglio completo dell'elemento selezionato.
        dettaglioCompleto: null
    };

    // Riferimenti principali al DOM.
    let inputRicerca;
    let btnCerca;
    let risultatiContainer;
    let dettaglioContainer;
    let messageBoxRicerca;

    async function init() {
        // Recupero gli elementi principali della sezione.
        inputRicerca = document.getElementById('input-ricerca');
        btnCerca = document.getElementById('btn-cerca');
        risultatiContainer = document.getElementById('ricerca-risultati');
        dettaglioContainer = document.getElementById('ricerca-dettaglio');
        messageBoxRicerca = document.getElementById('message-box-ricerca');

        if (btnCerca) {
            btnCerca.addEventListener('click', onClickCerca);
        }

        if (inputRicerca) {
            inputRicerca.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    onClickCerca().catch(function (error) {
                        console.error('[ricerca.js] errore pressione invio:', error);
                        mostraMessaggioRicerca(
                            error.message || 'Errore durante la ricerca.',
                            'error'
                        );
                    });
                }
            });
        }

        renderStatoIniziale();
    }

    async function onClickCerca() {
        // Prima di una nuova ricerca pulisco i messaggi precedenti.
        nascondiMessaggiRicerca();

        const keyword = String(inputRicerca?.value || '').trim();

        if (!keyword) {
            mostraMessaggioRicerca('Inserisci una parola chiave per cercare prodotti e SKU.', 'error');
            return;
        }

        await eseguiRicerca(keyword);
    }

    async function eseguiRicerca(keyword) {
        try {
            const response = await fetch(`api/fornitore/ricerca?keyword=${encodeURIComponent(keyword)}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json'
                }
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            stato.keywordCorrente = String(data?.keyword || keyword);
            stato.risultati = normalizzaRisultati(data);
            stato.selezionato = null;
            stato.dettaglioCompleto = null;

            renderRisultati();
            renderDettaglioVuoto();
        } catch (error) {
            console.error('[ricerca.js] errore durante la ricerca:', error);

            mostraMessaggioRicerca(
                error.message || 'Errore durante la ricerca.',
                'error'
            );
        }
    }

    function normalizzaRisultati(data) {
        const risultati = [];

        // Il backend restituisce prodotti e SKU in due liste separate;
        // qui le porto in un formato unico per la lista risultati.
        const listaProdotti = Array.isArray(data && data.prodotti) ? data.prodotti : [];
        const listaSku = Array.isArray(data && data.sku) ? data.sku : [];

        listaProdotti.forEach(function (prodotto) {
            if (!prodotto || prodotto.id == null) {
                return;
            }

            risultati.push({
                categoria: 'PRODOTTO',
                tipo: prodotto.tipo || 'PRODOTTO',
                id: prodotto.id,
                nome: prodotto.nome,
                codice: prodotto.codice,
                raw: prodotto
            });
        });

        listaSku.forEach(function (item) {
            if (!item || item.id == null) {
                return;
            }

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

        risultatiContainer.innerHTML = '';

        if (!Array.isArray(stato.risultati) || stato.risultati.length === 0) {
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

            // Ogni risultato è cliccabile e carica il dettaglio a destra.
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'result-link';

            if (
                stato.selezionato &&
                String(stato.selezionato.id) === String(item.id) &&
                stato.selezionato.categoria === item.categoria
            ) {
                button.classList.add('is-active');
            }

            button.addEventListener('click', function () {
                selezionaRisultato(item).catch(function (error) {
                    console.error('[ricerca.js] errore selezione risultato:', error);
                    mostraMessaggioRicerca(
                        error.message || 'Errore durante la selezione del risultato.',
                        'error'
                    );
                });
            });

            const main = document.createElement('span');
            main.className = 'result-main';

            const titolo = document.createElement('span');
            titolo.textContent = item.nome || 'Senza nome';

            const codice = document.createElement('span');
            codice.className = 'result-code';
            codice.textContent = `Codice: ${item.codice ?? '-'}`;

            main.appendChild(titolo);
            main.appendChild(codice);

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
        // Aggiorno subito lo stato visivo della lista
        // e mostro un placeholder nel pannello dettaglio.
        stato.selezionato = item;
        stato.dettaglioCompleto = null;
        renderRisultati();
        renderDettaglioCaricamento(item);

        try {
            // Per le SKU di solito bastano già i dati della ricerca.
            if (item.categoria === 'SKU') {
                stato.dettaglioCompleto = item.raw || item;
                renderDettaglio(stato.dettaglioCompleto);
                return;
            }

            // Per i prodotti recupero il dettaglio completo.
            const dettaglio = await window.prodottoApi.caricaDettaglioProdotto(item.id, item.tipo);
            stato.dettaglioCompleto = dettaglio || item.raw || item;
            renderDettaglio(stato.dettaglioCompleto);
        } catch (error) {
            console.error('[ricerca.js] errore caricamento dettaglio:', error);

            mostraMessaggioRicerca(
                error.message || 'Impossibile caricare il dettaglio selezionato.',
                'error'
            );

            // Se il fetch fallisce, provo comunque a mostrare i dati già noti.
            renderDettaglio(item.raw || item);
        }
    }

    function renderDettaglio(item) {
        if (!dettaglioContainer) {
            return;
        }

        if (!item) {
            renderDettaglioVuoto();
            return;
        }

        // Il render concreto è delegato ai moduli specializzati.
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

        dettaglioContainer.innerHTML = `
            <p class="detail-empty-box">
                Caricamento dettaglio di <strong>${escapeHtml(item?.nome || 'elemento')}</strong>...
            </p>
        `;
    }

    function renderDettaglioSkuRicerca(sku) {
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

        dettaglioContainer.innerHTML = `
            <p class="detail-empty-box">
                Seleziona un risultato per vedere i dettagli.
            </p>
        `;
    }

    function rimuoviRisultatoDaLista(id, categoria) {
        // Rimuove un singolo elemento dai risultati correnti.
        if (id == null || !categoria) {
            return;
        }

        stato.risultati = stato.risultati.filter(function (item) {
            return !(String(item.id) === String(id) && item.categoria === categoria);
        });

        if (
            stato.selezionato &&
            String(stato.selezionato.id) === String(id) &&
            stato.selezionato.categoria === categoria
        ) {
            stato.selezionato = null;
            stato.dettaglioCompleto = null;
            renderDettaglioVuoto();
        }

        renderRisultati();
    }

    function rimuoviRisultatiSottoalbero(prodotto) {
        // Rimuove dai risultati un intero sottoalbero di prodotti
        // e le eventuali SKU coinvolte.
        if (!prodotto) {
            return;
        }

        const prodottoIds = new Set();
        const skuIds = new Set();

        function raccogli(nodo) {
            if (!nodo || nodo.id == null) {
                return;
            }

            prodottoIds.add(String(nodo.id));

            if (Array.isArray(nodo.skuList)) {
                nodo.skuList.forEach(function (sku) {
                    if (sku && sku.id != null) {
                        skuIds.add(String(sku.id));
                    }
                });
            }

            if (Array.isArray(nodo.figli)) {
                nodo.figli.forEach(function (figlio) {
                    raccogli(figlio);
                });
            }
        }

        raccogli(prodotto);

        // Passaggio extra: intercetto anche eventuali figli presenti in lista
        // ma non inclusi direttamente nel dettaglio completo.
        let aggiunti;

        do {
            aggiunti = false;

            stato.risultati.forEach(function (item) {
                if (item.categoria !== 'PRODOTTO' || item.id == null) {
                    return;
                }

                const padreId = item.raw?.padreId;

                if (
                    padreId != null &&
                    prodottoIds.has(String(padreId)) &&
                    !prodottoIds.has(String(item.id))
                ) {
                    prodottoIds.add(String(item.id));
                    aggiunti = true;
                }
            });
        } while (aggiunti);

        stato.risultati = stato.risultati.filter(function (item) {
            if (item.categoria === 'PRODOTTO') {
                return !prodottoIds.has(String(item.id));
            }

            if (item.categoria === 'SKU') {
                return !skuIds.has(String(item.id));
            }

            return true;
        });

        if (stato.selezionato) {
            const selezionatoId = String(stato.selezionato.id);
            const selezionatoCategoria = stato.selezionato.categoria;

            const rimosso =
                (selezionatoCategoria === 'PRODOTTO' && prodottoIds.has(selezionatoId)) ||
                (selezionatoCategoria === 'SKU' && skuIds.has(selezionatoId));

            if (rimosso) {
                stato.selezionato = null;
                stato.dettaglioCompleto = null;
                renderDettaglioVuoto();
            }
        }

        renderRisultati();
    }

    function aggiornaRisultatoInLista(id, categoria, patch) {
        // Aggiorna in locale un risultato già presente.
        if (id == null || !categoria || !patch) {
            return;
        }

        stato.risultati = stato.risultati.map(function (item) {
            if (String(item.id) !== String(id) || item.categoria !== categoria) {
                return item;
            }

            return {
                ...item,
                ...patch,
                raw: { ...(item.raw || {}), ...patch }
            };
        });

        if (
            stato.selezionato &&
            String(stato.selezionato.id) === String(id) &&
            stato.selezionato.categoria === categoria
        ) {
            stato.selezionato = { ...stato.selezionato, ...patch };

            if (stato.dettaglioCompleto) {
                stato.dettaglioCompleto = { ...stato.dettaglioCompleto, ...patch };
            }
        }

        renderRisultati();
    }

    function mostraMessaggioRicerca(messaggio, tipo) {
        // Messaggio locale della sezione ricerca.
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
        // Etichetta mostrata nel badge del risultato.
        if (item.categoria === 'SKU') return 'SKU';
        if (item.tipo === 'SEMPLICE') return 'SEMPLICE';
        if (item.tipo === 'COMPOSTO') return 'COMPOSTO';
        return 'PRODOTTO';
    }

    function escapeHtml(valore) {
        // Escape minimo per i casi in cui uso innerHTML.
        return String(valore ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    return {
        init,
        rimuoviRisultatoDaLista,
        rimuoviRisultatiSottoalbero,
        aggiornaRisultatoInLista,
        mostraMessaggioRicerca
    };
})();