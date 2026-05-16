window.prodottoPage = (function () {
    const stato = {
        listaSku: [],
        prodottiDisponibili: []
    };

    let formProdottoSemplice;
    let formProdottoComposto;
    let listaFigliDisponibili;
    let hintProdottiVuoti;

    async function init() {
        formProdottoSemplice = document.getElementById('form-crea-prodotto-semplice');
        formProdottoComposto = document.getElementById('form-crea-prodotto-composto');
        listaFigliDisponibili = document.getElementById('lista-prodotti-disponibili');
        hintProdottiVuoti = document.getElementById('hint-prodotti-vuoti');

        if (formProdottoSemplice) {
            formProdottoSemplice.addEventListener('submit', onSubmitProdottoSemplice);
        }

        if (formProdottoComposto) {
            formProdottoComposto.addEventListener('submit', onSubmitProdottoComposto);
        }

        await caricaProdottiDisponibili();
    }

    function aggiornaListaSku(listaSku) {
        stato.listaSku = Array.isArray(listaSku) ? [...listaSku] : [];
    }

    async function caricaProdottiDisponibili() {
        try {
            const response = await fetch('apifornitoreprodotti-disponibili', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const data = await window.appFornitore.parseJsonResponse(response);
            stato.prodottiDisponibili = Array.isArray(data) ? data : [];
            renderProdottiDisponibili(stato.prodottiDisponibili);
        } catch (error) {
            console.error('Errore durante il caricamento dei prodotti disponibili:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante il caricamento dei prodotti disponibili.',
                'error'
            );
        }
    }

    function renderProdottiDisponibili(lista) {
        if (!listaFigliDisponibili || !hintProdottiVuoti) {
            return;
        }

        listaFigliDisponibili.innerHTML = '';

        if (!lista || lista.length === 0) {
            hintProdottiVuoti.hidden = false;
            return;
        }

        hintProdottiVuoti.hidden = true;

        lista.forEach((prodotto) => {
            const label = document.createElement('label');
            label.className = 'checkbox-row';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'figlioIds';
            input.value = prodotto.id;

            const testo = document.createElement('span');
            testo.textContent = `${prodotto.nome} - ${prodotto.codice} - ${prodotto.tipo}`;

            label.appendChild(input);
            label.appendChild(testo);
            listaFigliDisponibili.appendChild(label);
        });
    }

    async function onSubmitProdottoSemplice(event) {
        event.preventDefault();
        window.appFornitore.nascondiMessaggi();

        const formData = new FormData(formProdottoSemplice);
        formData.append('tipo', 'SEMPLICE');

        if (!validaProdottoSemplice(formData)) {
            return;
        }

        try {
            const response = await fetch('apifornitoreprodottocrea', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            formProdottoSemplice.reset();
            window.appFornitore.mostraMessaggioHome('Prodotto semplice creato con successo.', 'success');

            await caricaProdottiDisponibili();

            if (data) {
                renderDettaglioProdottoCreato(data);
            }
        } catch (error) {
            console.error('Errore durante la creazione del prodotto semplice:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante la creazione del prodotto semplice.',
                'error'
            );
        }
    }

    async function onSubmitProdottoComposto(event) {
        event.preventDefault();
        window.appFornitore.nascondiMessaggi();

        const formData = new FormData(formProdottoComposto);
        formData.append('tipo', 'COMPOSTO');

        if (!validaProdottoComposto(formData)) {
            return;
        }

        try {
            const response = await fetch('apifornitoreprodottocrea', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            formProdottoComposto.reset();
            window.appFornitore.mostraMessaggioHome('Prodotto composto creato con successo.', 'success');

            await caricaProdottiDisponibili();

            if (data) {
                renderDettaglioProdottoCreato(data);
            }
        } catch (error) {
            console.error('Errore durante la creazione del prodotto composto:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante la creazione del prodotto composto.',
                'error'
            );
        }
    }

    function validaProdottoSemplice(formData) {
        const codice = (formData.get('codice') || '').toString().trim();
        const nome = (formData.get('nome') || '').toString().trim();
        const skuIds = formData.getAll('skuIds');

        if (!codice || !nome) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi del prodotto semplice.', 'error');
            return false;
        }

        if (Number.isNaN(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome('Il codice del prodotto semplice non è valido.', 'error');
            return false;
        }

        if (!skuIds || skuIds.length === 0) {
            window.appFornitore.mostraMessaggioHome('Seleziona almeno una SKU.', 'error');
            return false;
        }

        return true;
    }

    function validaProdottoComposto(formData) {
        const codice = (formData.get('codice') || '').toString().trim();
        const nome = (formData.get('nome') || '').toString().trim();
        const descrizione = (formData.get('descrizione') || '').toString().trim();
        const prezzoMin = (formData.get('prezzoMin') || '').toString().trim();
        const prezzoMax = (formData.get('prezzoMax') || '').toString().trim();
        const figlioIds = formData.getAll('figlioIds');

        if (!codice || !nome || !descrizione || !prezzoMin || !prezzoMax) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi del prodotto composto.', 'error');
            return false;
        }

        if (Number.isNaN(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome('Il codice del prodotto composto non è valido.', 'error');
            return false;
        }

        if (Number.isNaN(Number(prezzoMin)) || Number(prezzoMin) < 0 ||
            Number.isNaN(Number(prezzoMax)) || Number(prezzoMax) < 0) {
            window.appFornitore.mostraMessaggioHome('La fascia di prezzo non è valida.', 'error');
            return false;
        }

        if (Number(prezzoMin) > Number(prezzoMax)) {
            window.appFornitore.mostraMessaggioHome('Il prezzo minimo non può superare il massimo.', 'error');
            return false;
        }

        if (!figlioIds || figlioIds.length === 0) {
            window.appFornitore.mostraMessaggioHome('Seleziona almeno un sottoprodotto.', 'error');
            return false;
        }

        return true;
    }

    function renderDettaglioProdottoCreato(prodotto) {
        const dettaglioContent = document.getElementById('dettaglio-content');
        if (!dettaglioContent) {
            return;
        }

        dettaglioContent.innerHTML = '';

        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = prodotto.nome || 'Prodotto';
        wrapper.appendChild(titolo);

        const codice = document.createElement('p');
        codice.innerHTML = `<strong>Codice:</strong> <span>${escapeHtml(prodotto.codice)}</span>`;
        wrapper.appendChild(codice);

        const tipo = document.createElement('p');
        tipo.innerHTML = `<strong>Tipo:</strong> <span>${escapeHtml(prodotto.tipo)}</span>`;
        wrapper.appendChild(tipo);

        if (prodotto.tipo === 'SEMPLICE' && Array.isArray(prodotto.skuList)) {
            const titoloSku = document.createElement('h4');
            titoloSku.className = 'section-title';
            titoloSku.style.fontSize = '0.95rem';
            titoloSku.style.marginTop = '1rem';
            titoloSku.textContent = 'SKU associate';
            wrapper.appendChild(titoloSku);

            prodotto.skuList.forEach((sku) => {
                const riga = document.createElement('p');
                riga.className = 'muted';
                riga.textContent = `${sku.codice} - ${sku.nome} - €${formattaPrezzo(sku.prezzo)}`;
                wrapper.appendChild(riga);
            });
        }

        if (prodotto.tipo === 'COMPOSTO') {
            const descrizione = document.createElement('p');
            descrizione.className = 'muted';
            descrizione.textContent = prodotto.descrizione || '-';
            wrapper.appendChild(descrizione);

            const prezzi = document.createElement('p');
            prezzi.innerHTML = `<strong>Fascia prezzo:</strong> <span>€${formattaPrezzo(prodotto.prezzoMin)} - €${formattaPrezzo(prodotto.prezzoMax)}</span>`;
            wrapper.appendChild(prezzi);
        }

        dettaglioContent.appendChild(wrapper);
    }

    function formattaPrezzo(prezzo) {
        const numero = Number(prezzo);
        return Number.isNaN(numero) ? '0.00' : numero.toFixed(2);
    }

    function escapeHtml(valore) {
        return String(valore ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    return {
        init,
        aggiornaListaSku,
        caricaProdottiDisponibili
    };
})();