window.skuPage = (function () {

    // Stato locale del modulo SKU.
    // Ci teniamo la lista completa delle SKU e l'eventuale SKU attualmente mostrata nel dettaglio.
    const stato = {
        listaSku: [],
        skuSelezionata: null
    };

    // Riferimenti ai principali elementi della pagina.
    let formCreaSku;
    let listaSkuDisponibili;
    let hintSkuVuote;
    let dettaglioContent;

    // Inizializzazione del modulo.
    // Recupera gli elementi dal DOM, aggancia gli eventi e carica i dati iniziali.
    async function init() {
        formCreaSku = document.getElementById('form-crea-sku');
        listaSkuDisponibili = document.getElementById('lista-sku-disponibili');
        hintSkuVuote = document.getElementById('hint-sku-vuote');
        dettaglioContent = document.getElementById('dettaglio-content');

        if (formCreaSku) {
            formCreaSku.addEventListener('submit', onSubmitCreaSku);
        }

        await caricaListaSku();
        renderMessaggioDettaglioVuoto();
    }

    // Carica dal server l'elenco completo delle SKU.
    // Questo elenco serve sia per il dettaglio sia per le checkbox del prodotto semplice.
    async function caricaListaSku() {
        try {
            const response = await fetch('apifornitoresku', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const data = await window.appFornitore.parseJsonResponse(response);
            stato.listaSku = Array.isArray(data) ? data : [];

            renderListaSkuCheckbox(stato.listaSku);

            // Se il modulo prodotti è già attivo, gli passiamo la lista aggiornata delle SKU.
            if (window.prodottoPage && typeof window.prodottoPage.aggiornaListaSku === 'function') {
                window.prodottoPage.aggiornaListaSku(stato.listaSku);
            }
        } catch (error) {
            console.error('[sku.js] errore caricamento SKU:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante il caricamento delle SKU.',
                'error'
            );
        }
    }

    // Disegna la lista di checkbox usata nella creazione del prodotto semplice.
    function renderListaSkuCheckbox(lista) {
        if (!listaSkuDisponibili || !hintSkuVuote) {
            return;
        }

        listaSkuDisponibili.innerHTML = '';

        if (!lista || lista.length === 0) {
            hintSkuVuote.hidden = false;
            return;
        }

        hintSkuVuote.hidden = true;

        lista.forEach((sku) => {
            const label = document.createElement('label');
            label.className = 'checkbox-row';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'skuIds';
            input.value = sku.id;

            const testo = document.createElement('span');
            testo.textContent = `${sku.codice} - ${sku.nome} - €${formattaPrezzo(sku.prezzo)}`;

            label.appendChild(input);
            label.appendChild(testo);
            listaSkuDisponibili.appendChild(label);
        });
    }

    // Gestisce l'invio del form di creazione SKU.
    async function onSubmitCreaSku(event) {
        event.preventDefault();
        window.appFornitore.nascondiMessaggi();

        const formData = new FormData(formCreaSku);

        if (!validaFormSku(formData)) {
            return;
        }

        try {
            const response = await fetch('apifornitoreskucrea', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            });

            const data = await window.appFornitore.parseJsonResponse(response);
            const skuCreata = data && data.sku ? data.sku : data;

            formCreaSku.reset();
            window.appFornitore.mostraMessaggioHome('SKU creata con successo.', 'success');

            await caricaListaSku();

            if (skuCreata && skuCreata.id) {
                mostraDettaglioSku(skuCreata);
            } else {
                renderMessaggioDettaglioVuoto();
            }
        } catch (error) {
            console.error('[sku.js] errore creazione SKU:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante la creazione della SKU.',
                'error'
            );
        }
    }

    // Validazione lato client del form SKU.
    // La fotografia non è obbligatoria, ma se presente deve essere plausibile.
    function validaFormSku(formData) {
        const codice = (formData.get('codice') || '').toString().trim();
        const nome = (formData.get('nome') || '').toString().trim();
        const descrizioneTecnica = (formData.get('descrizioneTecnica') || '').toString().trim();
        const prezzo = (formData.get('prezzo') || '').toString().trim();
        const fotografia = formData.get('fotografia');

        if (!codice || !nome || !descrizioneTecnica || !prezzo) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi obbligatori.', 'error');
            return false;
        }

        // Il codice deve essere un intero non negativo.
        if (!/^\d+$/.test(codice)) {
            window.appFornitore.mostraMessaggioHome('Il codice deve essere un numero intero valido.', 'error');
            return false;
        }

        // Il prezzo deve essere un numero valido maggiore o uguale a zero.
        if (Number.isNaN(Number(prezzo)) || Number(prezzo) < 0) {
            window.appFornitore.mostraMessaggioHome('Il prezzo inserito non è valido.', 'error');
            return false;
        }

        // Se l'utente carica una foto, controlliamo almeno tipo e dimensione.
        if (fotografia && fotografia.size > 0) {
            if (!fotografia.type.startsWith('image/')) {
                window.appFornitore.mostraMessaggioHome('La fotografia deve essere un file immagine valido.', 'error');
                return false;
            }

            const maxSizeBytes = 5 * 1024 * 1024; // 5 MB
            if (fotografia.size > maxSizeBytes) {
                window.appFornitore.mostraMessaggioHome('La fotografia non può superare 5 MB.', 'error');
                return false;
            }
        }

        return true;
    }

    // Aggiorna lo stato locale e ridisegna il pannello di dettaglio.
    function mostraDettaglioSku(sku) {
        stato.skuSelezionata = sku ? { ...sku } : null;
        renderDettaglioSkuInContainer(stato.skuSelezionata, dettaglioContent);
    }

    // Disegna il dettaglio di una SKU dentro il contenitore passato.
    function renderDettaglioSkuInContainer(sku, container) {
        if (!container) {
            return;
        }

        if (!sku) {
            renderMessaggioDettaglioVuoto(container);
            return;
        }

        container.innerHTML = '';

        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = sku.nome || 'SKU';
        wrapper.appendChild(titolo);

        // Campo editabile: nome.
        wrapper.appendChild(creaCampoEditabile({
            etichetta: 'Nome',
            chiave: 'nome',
            multilinea: false,
            valoreIniziale: sku.nome,
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'nome', nuovoValore);
                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { nome: nuovoValore }
                );

                window.appFornitore.mostraMessaggioHome('SKU aggiornata con successo.', 'success');
                await caricaListaSku();
                mostraDettaglioSku(stato.skuSelezionata);
            }
        }));

        const codice = document.createElement('p');
        codice.innerHTML = `<strong>Codice:</strong> <span>${escapeHtml(sku.codice)}</span>`;
        wrapper.appendChild(codice);

        // Se la SKU ha una foto valida, la mostriamo.
        if (sku.fotografia) {
            const photoBox = document.createElement('div');
            photoBox.className = 'detail-photo';

            const img = document.createElement('img');
            const fotoPath = String(sku.fotografia).trim();

            if (fotoPath.startsWith('http://') || fotoPath.startsWith('https://') || fotoPath.startsWith('/')) {
                img.src = fotoPath;
            } else {
                img.src = `uploads/${fotoPath}`;
            }

            img.alt = `Foto SKU ${sku.nome || ''}`.trim();
            img.loading = 'lazy';
            img.decoding = 'async';

            photoBox.appendChild(img);
            wrapper.appendChild(photoBox);
        }

        const titoloDescrizione = document.createElement('h4');
        titoloDescrizione.className = 'section-title';
        titoloDescrizione.style.fontSize = '0.95rem';
        titoloDescrizione.style.marginTop = '1rem';
        titoloDescrizione.textContent = 'Descrizione tecnica';
        wrapper.appendChild(titoloDescrizione);

        // Campo editabile: descrizione tecnica.
        wrapper.appendChild(creaCampoEditabile({
            etichetta: null,
            chiave: 'descrizioneTecnica',
            multilinea: true,
            valoreIniziale: sku.descrizioneTecnica,
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'descrizioneTecnica', nuovoValore);
                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { descrizioneTecnica: nuovoValore }
                );

                window.appFornitore.mostraMessaggioHome('SKU aggiornata con successo.', 'success');
                await caricaListaSku();
                mostraDettaglioSku(stato.skuSelezionata);
            }
        }));

        // Riga del prezzo.
        const prezzoBox = document.createElement('p');
        prezzoBox.className = 'price-line';
        prezzoBox.innerHTML = `<span>€${formattaPrezzo(sku.prezzo)}</span>`;
        wrapper.appendChild(prezzoBox);

        // Pulsanti azione del dettaglio.
        const azioni = document.createElement('div');
        azioni.className = 'actions-row';

        const btnModificaPrezzo = document.createElement('button');
        btnModificaPrezzo.type = 'button';
        btnModificaPrezzo.className = 'btn btn-outline btn-sm';
        btnModificaPrezzo.textContent = 'Modifica prezzo';
        btnModificaPrezzo.addEventListener('click', () => {
            sostituisciPrezzoConInput(prezzoBox, sku);
        });

        const btnEliminaSku = document.createElement('button');
        btnEliminaSku.type = 'button';
        btnEliminaSku.className = 'btn btn-danger btn-sm';
        btnEliminaSku.textContent = 'Elimina SKU';
        btnEliminaSku.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi eliminare questa SKU?');
            if (!conferma) {
                return;
            }

            try {
                await eliminaSku(sku.id);
                stato.skuSelezionata = null;
                window.appFornitore.mostraMessaggioHome('SKU eliminata con successo.', 'success');
                await caricaListaSku();
                renderMessaggioDettaglioVuoto(container);
            } catch (error) {
                console.error('[sku.js] errore eliminazione SKU:', error);
                window.appFornitore.mostraMessaggioHome(
                    error.message || 'Errore durante l\'eliminazione della SKU.',
                    'error'
                );
            }
        });

        azioni.appendChild(btnModificaPrezzo);
        azioni.appendChild(btnEliminaSku);
        wrapper.appendChild(azioni);

        container.appendChild(wrapper);
    }

    // Crea un campo testuale "clicca per modificare".
    // Alla perdita del focus prova a salvare il nuovo valore.
    function creaCampoEditabile({ etichetta, chiave, multilinea, valoreIniziale, onSalva }) {
        const container = document.createElement('div');
        container.className = 'form-group';

        if (etichetta) {
            const label = document.createElement('label');
            label.textContent = etichetta;
            container.appendChild(label);
        }

        const view = document.createElement('p');
        view.className = 'muted';
        view.style.cursor = 'pointer';
        view.title = 'Clicca per modificare';
        view.textContent = valoreIniziale ? valoreIniziale.toString() : '-';

        view.addEventListener('click', () => {
            const input = multilinea ? document.createElement('textarea') : document.createElement('input');

            if (!multilinea) {
                input.type = 'text';
            } else {
                input.rows = 4;
            }

            input.className = 'form-control';
            input.value = valoreIniziale ?? '';

            const salva = async () => {
                const nuovoValore = input.value.trim();

                // Se non è cambiato nulla, ripristiniamo la vista testuale.
                if (nuovoValore === (valoreIniziale ?? '').toString().trim()) {
                    container.replaceChild(view, input);
                    return;
                }

                try {
                    await onSalva(nuovoValore);
                } catch (error) {
                    console.error('[sku.js] errore aggiornamento campo SKU:', error);
                    window.appFornitore.mostraMessaggioHome(
                        error.message || 'Aggiornamento non riuscito.',
                        'error'
                    );
                    container.replaceChild(view, input);
                }
            };

            input.addEventListener('blur', salva, { once: true });

            input.addEventListener('keydown', (event) => {
                if (!multilinea && event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }

                if (event.key === 'Escape') {
                    container.replaceChild(view, input);
                }
            });

            container.replaceChild(input, view);
            input.focus();
            input.select?.();
        });

        container.appendChild(view);
        return container;
    }

    // Sostituisce la riga del prezzo con un input numerico temporaneo.
    function sostituisciPrezzoConInput(prezzoBox, sku) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '0.01';
        input.value = sku?.prezzo ?? '';
        input.className = 'form-control';
        input.style.maxWidth = '180px';

        prezzoBox.replaceWith(input);
        input.focus();
        input.select?.();

        input.addEventListener('blur', async () => {
            const nuovoPrezzo = input.value.trim();

            if (nuovoPrezzo === '' || Number.isNaN(Number(nuovoPrezzo)) || Number(nuovoPrezzo) < 0) {
                window.appFornitore.mostraMessaggioHome('Il prezzo inserito non è valido.', 'error');
                mostraDettaglioSku(sku);
                return;
            }

            try {
                const aggiornato = await aggiornaCampoSku(sku.id, 'prezzo', nuovoPrezzo);
                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { prezzo: Number(nuovoPrezzo) }
                );

                window.appFornitore.mostraMessaggioHome('Prezzo aggiornato con successo.', 'success');
                await caricaListaSku();
                mostraDettaglioSku(stato.skuSelezionata);
            } catch (error) {
                console.error('[sku.js] errore aggiornamento prezzo:', error);
                window.appFornitore.mostraMessaggioHome(
                    error.message || 'Aggiornamento prezzo non riuscito.',
                    'error'
                );
                mostraDettaglioSku(sku);
            }
        }, { once: true });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                input.blur();
            }

            if (event.key === 'Escape') {
                mostraDettaglioSku(sku);
            }
        });
    }

    // Fonde il dato appena restituito dal server con quello già presente lato client.
    function normalizzaSkuAggiornata(aggiornato, fallback, patch) {
        if (aggiornato && typeof aggiornato === 'object') {
            return { ...fallback, ...aggiornato, ...patch };
        }

        return { ...fallback, ...patch };
    }

    // Chiamata al server per aggiornare un singolo campo della SKU.
    async function aggiornaCampoSku(skuId, campo, valore) {
        if (!skuId) {
            throw new Error('SKU non selezionata.');
        }

        const body = new URLSearchParams();
        body.append('id', skuId);
        body.append('campo', campo);
        body.append('valore', valore);

        const response = await fetch('apifornitoreskuaggiorna', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body.toString()
        });

        return window.appFornitore.parseJsonResponse(response);
    }

    // Elimina la SKU selezionata.
    async function eliminaSku(skuId) {
        const body = new URLSearchParams();
        body.append('id', skuId);
        body.append('tipo', 'SKU');

        const response = await fetch('apifornitoreoggettoelimina', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body.toString()
        });

        return window.appFornitore.parseJsonResponse(response);
    }

    // Mostra il messaggio standard quando non c'è ancora nulla nel dettaglio.
    function renderMessaggioDettaglioVuoto(container = dettaglioContent) {
        if (!container) {
            return;
        }

        container.innerHTML = `
            <p class="muted">
                Dopo una creazione o una selezione nella home, qui comparirà il dettaglio dell'oggetto.
            </p>
        `;
    }

    // Formattazione semplice del prezzo.
    function formattaPrezzo(prezzo) {
        const numero = Number(prezzo);
        return Number.isNaN(numero) ? '0.00' : numero.toFixed(2);
    }

    // Escape minimo per evitare inserimenti HTML non voluti nel dettaglio.
    function escapeHtml(valore) {
        return String(valore ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    // API pubbliche del modulo.
    return {
        init,
        caricaListaSku,
        mostraDettaglioSku,
        renderDettaglioSkuInContainer,
        getListaSku() {
            return [...stato.listaSku];
        }
    };
})();