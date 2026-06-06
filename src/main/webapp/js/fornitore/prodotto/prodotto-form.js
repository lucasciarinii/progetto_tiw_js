window.prodottoForm = (function () {
    function getState() {
        // Recupera lo stato condiviso del modulo prodotto.
        return window.prodottoPage.getState();
    }

    function bindEvents() {
        const state = getState();

        // Submit del form prodotto semplice.
        if (state.formProdottoSemplice) {
            state.formProdottoSemplice.addEventListener('submit', onSubmitProdottoSemplice);
        }

        // Submit del form prodotto composto.
        if (state.formProdottoComposto) {
            state.formProdottoComposto.addEventListener('submit', onSubmitProdottoComposto);
        }
    }

    async function onSubmitProdottoSemplice(event) {
        const state = getState();
        event.preventDefault();

        // Leggo i dati inseriti nel form.
        const formData = new FormData(state.formProdottoSemplice);
        const codice = String(formData.get('codice') || '').trim();
        const nome = String(formData.get('nome') || '').trim();
        const skuIds = formData.getAll('skuIds');

        // Validazione minima lato client.
        if (!codice || !nome) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi del prodotto semplice.', 'error');
            return;
        }

        if (!Number.isInteger(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome('Il codice del prodotto semplice non è valido.', 'error');
            return;
        }

        if (!skuIds || skuIds.length === 0) {
            window.appFornitore.mostraMessaggioHome('Seleziona almeno una SKU.', 'error');
            return;
        }

        try {
            // Il prodotto semplice viene creato subito lato server.
            const response = await fetch('apifornitoreprodottocrea', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            state.formProdottoSemplice.reset();
            window.appFornitore.mostraMessaggioHome('Prodotto semplice creato con successo.', 'success');

            // Se disponibile, mostro subito il dettaglio del prodotto creato.
            if (data) {
                window.prodottoDettaglio.mostraDettaglioProdottoCreato(data);
            }

            // Ricarico le liste per tenere la home allineata al server.
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

        // Leggo i dati del form del prodotto composto.
        const formData = new FormData(state.formProdottoComposto);
        const codice = String(formData.get('codice') || '').trim();
        const nome = String(formData.get('nome') || '').trim();
        const descrizione = String(formData.get('descrizione') || '').trim();
        const prezzoMin = String(formData.get('prezzoMin') || '').trim();
        const prezzoMax = String(formData.get('prezzoMax') || '').trim();
        const figlioIds = formData.getAll('figlioIds');

        // Validazione minima lato client dei campi obbligatori.
        if (!codice || !nome || !descrizione || !prezzoMin || !prezzoMax) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi del prodotto composto.', 'error');
            return;
        }

        if (!Number.isInteger(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome('Il codice del prodotto composto non è valido.', 'error');
            return;
        }

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
            // Prendo dalla cache solo i prodotti top-level selezionati nel form.
            const figliSelezionatiBase = state.prodottiDisponibiliCache.filter(
                (prodotto) => figlioIds.includes(String(prodotto.id)) && prodotto.padreId == null
            );

            // Per ogni figlio selezionato carico il dettaglio completo,
            // così nel builder ho già anche eventuali discendenti.
            const figliCompleti = await Promise.all(
                figliSelezionatiBase.map((prodotto) =>
                    window.prodottoApi.caricaDettaglioProdotto(prodotto.id, prodotto.tipo)
                )
            );

            // Creo la bozza client-side del builder.
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

        if (!state.listaSkuDisponibili || !state.hintSkuVuote) {
            return;
        }

        // Ricostruisco da zero la lista checkbox delle SKU.
        state.listaSkuDisponibili.innerHTML = '';

        if (!lista || lista.length === 0) {
            state.hintSkuVuote.hidden = false;
            return;
        }

        state.hintSkuVuote.hidden = true;

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

        if (!state.listaFigliDisponibili || !state.hintProdottiVuoti) {
            return;
        }

        // Ricostruisco la lista dei prodotti selezionabili come figli iniziali.
        state.listaFigliDisponibili.innerHTML = '';

        const prodottiRenderizzabili = Array.isArray(lista)
            ? lista.filter((prodotto) => prodotto && prodotto.id != null && prodotto.padreId == null)
            : [];

        if (prodottiRenderizzabili.length === 0) {
            state.hintProdottiVuoti.hidden = false;
            return;
        }

        state.hintProdottiVuoti.hidden = true;

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
        bindEvents,
        onSubmitProdottoSemplice,
        onSubmitProdottoComposto,
        aggiornaListaSku,
        renderProdottiDisponibili
    };
})();