window.prodottoForm = (function () {
    function getState() {
        // Recupera lo stato condiviso del modulo prodotto.
        // Qui mi serve soprattutto per accedere ai form e alle liste renderizzate nella home.
        return window.prodottoPage.getState();
    }

    function bindEvents() {
        const state = getState();

        // Collego il submit del form del prodotto semplice.
        if (state.formProdottoSemplice) {
            state.formProdottoSemplice.addEventListener('submit', onSubmitProdottoSemplice);
        }

        // Collego il submit del form del prodotto composto.
        if (state.formProdottoComposto) {
            state.formProdottoComposto.addEventListener('submit', onSubmitProdottoComposto);
        }
    }

    async function onSubmitProdottoSemplice(event) {
        const state = getState();
        event.preventDefault();

        // Recupero i dati del form così come sono stati inseriti dall'utente.
        const formData = new FormData(state.formProdottoSemplice);
        const codice = String(formData.get('codice') || '').trim();
        const nome = String(formData.get('nome') || '').trim();
        const skuIds = formData.getAll('skuIds');

        // Validazione minima lato client dei campi obbligatori.
        if (!codice || !nome) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi del prodotto semplice.', 'error');
            return;
        }

        // Il codice deve essere un intero non negativo.
        if (!Number.isInteger(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome('Il codice del prodotto semplice non è valido.', 'error');
            return;
        }

        // Un prodotto semplice deve avere almeno una SKU associata.
        if (!skuIds || skuIds.length === 0) {
            window.appFornitore.mostraMessaggioHome('Seleziona almeno una SKU.', 'error');
            return;
        }

        try {
            // Invio direttamente il FormData alla servlet di creazione prodotto.
            // In questo caso non costruisco nessuna bozza: il prodotto semplice
            // viene creato subito sul server.
            const response = await fetch('apifornitoreprodottocrea', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            // Reset del form dopo creazione riuscita.
            state.formProdottoSemplice.reset();
            window.appFornitore.mostraMessaggioHome('Prodotto semplice creato con successo.', 'success');

            // Se il server restituisce il prodotto appena creato, lo mostro subito nel pannello dettaglio.
            if (data) {
                window.prodottoDettaglio.mostraDettaglioProdottoCreato(data);
            }

            // Ricarico le liste, così la home resta coerente con lo stato del server.
            await Promise.all([
                window.prodottoApi.caricaProdottiDisponibili(),
                window.prodottoApi.caricaSkuDisponibili()
            ]);
        } catch (error) {
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante la creazione del prodotto semplice.',
                'error'
            );
        }
    }

    async function onSubmitProdottoComposto(event) {
        const state = getState();
        event.preventDefault();

        // Recupero i dati inseriti nel form del prodotto composto.
        const formData = new FormData(state.formProdottoComposto);
        const codice = String(formData.get('codice') || '').trim();
        const nome = String(formData.get('nome') || '').trim();
        const descrizione = String(formData.get('descrizione') || '').trim();
        const prezzoMin = String(formData.get('prezzoMin') || '').trim();
        const prezzoMax = String(formData.get('prezzoMax') || '').trim();
        const figlioIds = formData.getAll('figlioIds');

        // Tutti i campi principali del composto sono obbligatori.
        if (!codice || !nome || !descrizione || !prezzoMin || !prezzoMax) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi del prodotto composto.', 'error');
            return;
        }

        // Il codice deve essere un intero non negativo.
        if (!Number.isInteger(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome('Il codice del prodotto composto non è valido.', 'error');
            return;
        }

        // Controllo che la fascia di prezzo sia numericamente valida.
        if (
            Number.isNaN(Number(prezzoMin)) ||
            Number(prezzoMin) < 0 ||
            Number.isNaN(Number(prezzoMax)) ||
            Number(prezzoMax) < 0 ||
            Number(prezzoMin) > Number(prezzoMax)
        ) {
            window.appFornitore.mostraMessaggioHome('La fascia di prezzo non è valida.', 'error');
            return;
        }

        try {
            // Prendo dall'elenco in cache solo i prodotti top-level selezionati nel form.
            // Questi saranno i figli iniziali della bozza del prodotto composto.
            const figliSelezionatiBase = state.prodottiDisponibiliCache.filter(
                (prodotto) => figlioIds.includes(String(prodotto.id)) && prodotto.padreId == null
            );

            // Per ogni figlio selezionato carico il dettaglio completo dal server,
            // così se è un prodotto composto ho già anche il suo sottoalbero.
            const figliCompleti = await Promise.all(
                figliSelezionatiBase.map((prodotto) =>
                    window.prodottoApi.caricaDettaglioProdotto(prodotto.id, prodotto.tipo)
                )
            );

            // Creo la bozza client-side del builder.
            // Da qui in poi il prodotto composto non viene ancora salvato nel DB:
            // l'utente può continuare a modificarlo nel pannello di destra.
            state.builderState = {
                clientId: window.prodottoBuilder.nextBuilderNodeId(),
                id: null,
                codice: Number(codice),
                nome,
                tipo: 'COMPOSTO',
                descrizione,
                prezzoMin: Number(prezzoMin),
                prezzoMax: Number(prezzoMax),
                figli: figliCompleti
                    .map(window.prodottoBuilder.mappaProdottoEsistentePerBuilder)
                    .filter(Boolean),
                deletedProductIds: new Set(),
                deletedSkuIds: new Set()
            };

            // Mostro il builder della bozza appena creata.
            window.prodottoBuilder.renderBuilder();
            window.appFornitore.mostraMessaggioHome('Bozza del prodotto composto creata con successo.', 'success');
        } catch (error) {
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante il caricamento dei prodotti selezionati.',
                'error'
            );
        }
    }

    function aggiornaListaSku(lista) {
        const state = getState();

        // Se mancano i riferimenti al DOM, esco subito.
        if (!state.listaSkuDisponibili || !state.hintSkuVuote) return;

        // Svuoto la lista e la ricostruisco da zero.
        state.listaSkuDisponibili.innerHTML = '';

        if (!lista || lista.length === 0) {
            // Se non ci sono SKU disponibili mostro il messaggio dedicato.
            state.hintSkuVuote.hidden = false;
            return;
        }

        state.hintSkuVuote.hidden = true;

        // Per ogni SKU creo una checkbox nella lista del form prodotto semplice.
        lista.forEach((sku) => {
            const label = document.createElement('label');
            label.className = 'checkbox-row';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'skuIds';
            input.value = sku.id;

            const span = document.createElement('span');
            span.textContent = `${sku.codice} - ${sku.nome} - €${window.prodottoUi.formattaPrezzo(sku.prezzo)}`;

            label.appendChild(input);
            label.appendChild(span);
            state.listaSkuDisponibili.appendChild(label);
        });
    }

    function renderProdottiDisponibili(lista) {
        const state = getState();

        // Se mancano i riferimenti al DOM, non posso renderizzare niente.
        if (!state.listaFigliDisponibili || !state.hintProdottiVuoti) return;

        // Svuoto la lista attuale.
        state.listaFigliDisponibili.innerHTML = '';

        // Renderizzo solo prodotti validi, top-level e selezionabili come figli iniziali.
        const prodottiRenderizzabili = Array.isArray(lista)
            ? lista.filter((prodotto) => prodotto && prodotto.id != null && prodotto.padreId == null)
            : [];

        if (prodottiRenderizzabili.length === 0) {
            // Se non ci sono prodotti disponibili, mostro l'hint dedicato.
            state.hintProdottiVuoti.hidden = false;
            return;
        }

        state.hintProdottiVuoti.hidden = true;

        // Per ogni prodotto disponibile creo una checkbox nel form del composto.
        prodottiRenderizzabili.forEach((prodotto) => {
            const label = document.createElement('label');
            label.className = 'checkbox-row';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'figlioIds';
            input.value = prodotto.id;

            const span = document.createElement('span');
            span.textContent = `${prodotto.nome} - ${prodotto.codice} - ${prodotto.tipo}`;

            label.appendChild(input);
            label.appendChild(span);
            state.listaFigliDisponibili.appendChild(label);
        });
    }

    return {
        // Metodi pubblici del modulo form.
        bindEvents,
        onSubmitProdottoSemplice,
        onSubmitProdottoComposto,
        aggiornaListaSku,
        renderProdottiDisponibili
    };
})();