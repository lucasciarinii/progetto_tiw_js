window.skuPage = (function () {
    const stato = {
        listaSku: [],
        skuSelezionata: null
    };

    let formCreaSku;
    let listaSkuDisponibili;
    let hintSkuVuote;
    let dettaglioContent;

    async function init() {
        formCreaSku = document.getElementById('form-crea-sku');
        listaSkuDisponibili = document.getElementById('lista-sku-disponibili');
        hintSkuVuote = document.getElementById('hint-sku-vuote');
        dettaglioContent = document.getElementById('dettaglio-content');

        if (formCreaSku) {
            formCreaSku.addEventListener('submit', onSubmitCreaSku);
        }

        await caricaListaSku();
    }

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

    function validaFormSku(formData) {
        const codice = (formData.get('codice') || '').toString().trim();
        const nome = (formData.get('nome') || '').toString().trim();
        const descrizioneTecnica = (formData.get('descrizioneTecnica') || '').toString().trim();
        const prezzo = (formData.get('prezzo') || '').toString().trim();

        if (!codice || !nome || !descrizioneTecnica || !prezzo) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi obbligatori.', 'error');
            return false;
        }

        if (!Number.isInteger(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome('Il codice deve essere un numero intero valido.', 'error');
            return false;
        }

        if (Number.isNaN(Number(prezzo)) || Number(prezzo) < 0) {
            window.appFornitore.mostraMessaggioHome('Il prezzo inserito non è valido.', 'error');
            return false;
        }

        return true;
    }

    function mostraDettaglioSku(sku) {
        stato.skuSelezionata = { ...sku };

        if (!dettaglioContent) {
            return;
        }

        dettaglioContent.innerHTML = '';

        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = sku.nome || 'SKU';
        wrapper.appendChild(titolo);

        const nomeEditabile = creaCampoEditabile({
            etichetta: 'Nome',
            valore: sku.nome || '',
            chiave: 'nome',
            multilinea: false
        });
        wrapper.appendChild(nomeEditabile);

        const codice = document.createElement('p');
        codice.innerHTML = `<strong>Codice:</strong> <span>${escapeHtml(sku.codice)}</span>`;
        wrapper.appendChild(codice);

        if (sku.fotografia) {
            const photoBox = document.createElement('div');
            photoBox.className = 'detail-photo';

            const img = document.createElement('img');
            img.src = sku.fotografia;
            img.alt = `Foto SKU ${sku.nome || ''}`.trim();

            photoBox.appendChild(img);
            wrapper.appendChild(photoBox);
        }

        const titoloDescrizione = document.createElement('h4');
        titoloDescrizione.className = 'section-title';
        titoloDescrizione.style.fontSize = '0.95rem';
        titoloDescrizione.style.marginTop = '1rem';
        titoloDescrizione.textContent = 'Descrizione tecnica';
        wrapper.appendChild(titoloDescrizione);

        const descrizione = creaCampoEditabile({
            etichetta: null,
            valore: sku.descrizioneTecnica || '',
            chiave: 'descrizioneTecnica',
            multilinea: true
        });
        wrapper.appendChild(descrizione);

        const prezzoBox = document.createElement('p');
        prezzoBox.className = 'price-line';
        prezzoBox.innerHTML = `<span>€${formattaPrezzo(sku.prezzo)}</span>`;
        wrapper.appendChild(prezzoBox);

        const azioni = document.createElement('div');
        azioni.className = 'actions-row';

        const btnModificaPrezzo = document.createElement('button');
        btnModificaPrezzo.type = 'button';
        btnModificaPrezzo.className = 'btn btn-outline btn-sm';
        btnModificaPrezzo.textContent = 'Modifica prezzo';
        btnModificaPrezzo.addEventListener('click', () => {
            sostituisciPrezzoConInput(prezzoBox);
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
                renderMessaggioDettaglioVuoto();
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

        dettaglioContent.appendChild(wrapper);
    }

    function creaCampoEditabile({ etichetta, valore, chiave, multilinea }) {
        const container = document.createElement('div');
        container.className = 'form-group';

        if (etichetta) {
            const label = document.createElement('label');
            label.textContent = etichetta;
            container.appendChild(label);
        }

        const view = document.createElement('p');
        view.className = 'muted';
        view.textContent = valore || '-';
        view.style.cursor = 'pointer';
        view.title = 'Clicca per modificare';

        view.addEventListener('click', () => {
            const input = multilinea
                ? document.createElement('textarea')
                : document.createElement('input');

            if (!multilinea) {
                input.type = 'text';
            }

            input.value = valore || '';
            if (multilinea) {
                input.rows = 4;
            }

            input.addEventListener('blur', async () => {
                const nuovoValore = input.value.trim();
                const valoreAttuale = (stato.skuSelezionata && stato.skuSelezionata[chiave]) || '';

                if (nuovoValore === valoreAttuale) {
                    container.replaceChild(view, input);
                    return;
                }

                try {
                    await aggiornaCampoSku(chiave, nuovoValore);

                    stato.skuSelezionata[chiave] = nuovoValore;
                    window.appFornitore.mostraMessaggioHome('SKU aggiornata con successo.', 'success');

                    await caricaListaSku();
                    mostraDettaglioSku(stato.skuSelezionata);
                } catch (error) {
                    console.error('[sku.js] errore aggiornamento campo SKU:', error);
                    window.appFornitore.mostraMessaggioHome(
                        error.message || 'Aggiornamento non riuscito.',
                        'error'
                    );
                    container.replaceChild(view, input);
                }
            });

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
        });

        container.appendChild(view);
        return container;
    }

    function sostituisciPrezzoConInput(prezzoBox) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '0.01';
        input.value = stato.skuSelezionata?.prezzo ?? '';
        input.style.maxWidth = '180px';

        prezzoBox.replaceWith(input);
        input.focus();

        input.addEventListener('blur', async () => {
            const nuovoPrezzo = input.value.trim();

            if (nuovoPrezzo === '' || Number.isNaN(Number(nuovoPrezzo)) || Number(nuovoPrezzo) < 0) {
                window.appFornitore.mostraMessaggioHome('Il prezzo inserito non è valido.', 'error');
                mostraDettaglioSku(stato.skuSelezionata);
                return;
            }

            try {
                await aggiornaCampoSku('prezzo', nuovoPrezzo);

                stato.skuSelezionata.prezzo = Number(nuovoPrezzo);
                window.appFornitore.mostraMessaggioHome('Prezzo aggiornato con successo.', 'success');

                await caricaListaSku();
                mostraDettaglioSku(stato.skuSelezionata);
            } catch (error) {
                console.error('[sku.js] errore aggiornamento prezzo:', error);
                window.appFornitore.mostraMessaggioHome(
                    error.message || 'Aggiornamento prezzo non riuscito.',
                    'error'
                );
                mostraDettaglioSku(stato.skuSelezionata);
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                input.blur();
            }

            if (event.key === 'Escape') {
                mostraDettaglioSku(stato.skuSelezionata);
            }
        });
    }

    async function aggiornaCampoSku(campo, valore) {
        if (!stato.skuSelezionata || !stato.skuSelezionata.id) {
            throw new Error('SKU non selezionata.');
        }

        const body = new URLSearchParams({
            id: stato.skuSelezionata.id,
            campo,
            valore
        });

        const response = await fetch('apifornitoreskuaggiorna', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        return window.appFornitore.parseJsonResponse(response);
    }

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

    function renderMessaggioDettaglioVuoto() {
        if (!dettaglioContent) {
            return;
        }

        dettaglioContent.innerHTML = `
            <p class="muted">
                Dopo una creazione o una ricerca, qui comparirà il dettaglio dell'oggetto selezionato.
            </p>
        `;
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
        caricaListaSku,
        mostraDettaglioSku,
        getListaSku() {
            return [...stato.listaSku];
        }
    };
})();