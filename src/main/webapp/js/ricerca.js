console.log('=== RICERCA JS CARICATO DAVVERO ===');
alert('RICERCA JS CARICATO DAVVERO');7
window.ricercaPage = (function () {
    const stato = {
        keywordCorrente: '',
        risultati: [],
        selezionato: null
    };

    let inputRicerca;
    let btnCerca;
    let risultatiContainer;
    let dettaglioContainer;
    let messageBoxRicerca;

    async function init() {
        console.log('[ricerca.js] init chiamato');

        inputRicerca = document.getElementById('input-ricerca');
        btnCerca = document.getElementById('btn-cerca');
        risultatiContainer = document.getElementById('ricerca-risultati');
        dettaglioContainer = document.getElementById('ricerca-dettaglio');
        messageBoxRicerca = document.getElementById('message-box-ricerca');

        console.log('[ricerca.js] inputRicerca trovato:', !!inputRicerca);
        console.log('[ricerca.js] btnCerca trovato:', !!btnCerca);
        console.log('[ricerca.js] risultatiContainer trovato:', !!risultatiContainer);
        console.log('[ricerca.js] dettaglioContainer trovato:', !!dettaglioContainer);
        console.log('[ricerca.js] messageBoxRicerca trovato:', !!messageBoxRicerca);

        if (btnCerca) {
            btnCerca.addEventListener('click', onClickCerca);
            console.log('[ricerca.js] listener click agganciato a btn-cerca');
        } else {
            console.warn('[ricerca.js] btn-cerca non trovato');
        }

        if (inputRicerca) {
            inputRicerca.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    console.log('[ricerca.js] Enter premuto dentro input ricerca');
                    event.preventDefault();
                    onClickCerca();
                }
            });
            console.log('[ricerca.js] listener keydown agganciato a input-ricerca');
        } else {
            console.warn('[ricerca.js] input-ricerca non trovato');
        }

        renderStatoIniziale();
        console.log('[ricerca.js] stato iniziale renderizzato');
    }

    async function onClickCerca() {
        console.log('[ricerca.js] click su Cerca intercettato');

        nascondiMessaggiRicerca();

        const keyword = (inputRicerca?.value || '').trim();
        console.log('[ricerca.js] keyword letta:', keyword);

        if (!keyword) {
            console.warn('[ricerca.js] keyword vuota');
            mostraMessaggioRicerca('Inserisci una parola chiave per cercare prodotti e SKU.', 'error');
            return;
        }

        await eseguiRicerca(keyword);
    }

    async function eseguiRicerca(keyword) {
        console.log('[ricerca.js] inizio eseguiRicerca con keyword:', keyword);

        try {
            const url = `apifornitorericerca?keyword=${encodeURIComponent(keyword)}`;
            console.log('[ricerca.js] fetch URL:', url);

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('[ricerca.js] response status:', response.status);
            console.log('[ricerca.js] response ok:', response.ok);

            const data = await window.appFornitore.parseJsonResponse(response);
            console.log('[ricerca.js] JSON ricevuto:', data);

            stato.keywordCorrente = data?.keyword || keyword;
            stato.risultati = normalizzaRisultati(data);
            stato.selezionato = null;

            console.log('[ricerca.js] numero risultati normalizzati:', stato.risultati.length);
            console.log('[ricerca.js] risultati normalizzati:', stato.risultati);

            renderRisultati();
            renderDettaglioVuoto();

            console.log('[ricerca.js] render risultati completato');

        } catch (error) {
            console.error('[ricerca.js] errore durante la ricerca:', error);
            mostraMessaggioRicerca(
                error.message || 'Errore durante la ricerca.',
                'error'
            );
        }
    }

    function normalizzaRisultati(data) {
        console.log('[ricerca.js] normalizzaRisultati input:', data);

        const risultati = [];

        const prodotti = Array.isArray(data?.prodotti) ? data.prodotti : [];
        const sku = Array.isArray(data?.sku) ? data.sku : [];

        console.log('[ricerca.js] prodotti trovati nel JSON:', prodotti.length);
        console.log('[ricerca.js] sku trovate nel JSON:', sku.length);

        prodotti.forEach((prodotto) => {
            risultati.push({
                categoria: 'PRODOTTO',
                tipo: prodotto.tipo || 'PRODOTTO',
                id: prodotto.id,
                nome: prodotto.nome,
                codice: prodotto.codice,
                raw: prodotto
            });
        });

        sku.forEach((item) => {
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
        if (risultatiContainer) {
            risultatiContainer.innerHTML = `
                <p class="muted">
                    Inserisci una parola chiave per cercare prodotti e SKU.
                </p>
            `;
        }

        renderDettaglioVuoto();
    }

    function renderRisultati() {
        console.log('[ricerca.js] renderRisultati chiamato');

        if (!risultatiContainer) {
            console.warn('[ricerca.js] risultatiContainer assente');
            return;
        }

        risultatiContainer.innerHTML = '';

        if (!stato.risultati || stato.risultati.length === 0) {
            console.log('[ricerca.js] nessun risultato da mostrare');

            risultatiContainer.innerHTML = `
                <p class="muted">
                    Nessun risultato trovato.
                </p>
            `;
            return;
        }

        const lista = document.createElement('div');
        lista.className = 'result-list';

        stato.risultati.forEach((item) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'result-item';
            button.addEventListener('click', () => {
                console.log('[ricerca.js] click su risultato:', item);
                selezionaRisultato(item);
            });

            const titolo = document.createElement('div');
            titolo.className = 'result-item-title';
            titolo.textContent = `${getEtichettaTipo(item)} - ${item.nome || 'Senza nome'}`;

            const meta = document.createElement('div');
            meta.className = 'result-item-meta';

            if (item.categoria === 'SKU') {
                meta.textContent = `Codice: ${item.codice} - €${formattaPrezzo(item.prezzo)}`;
            } else {
                meta.textContent = `Codice: ${item.codice}`;
            }

            button.appendChild(titolo);
            button.appendChild(meta);
            lista.appendChild(button);
        });

        risultatiContainer.appendChild(lista);
        console.log('[ricerca.js] lista risultati appesa al DOM');
    }

    function selezionaRisultato(item) {
        console.log('[ricerca.js] selezionaRisultato:', item);
        stato.selezionato = item;
        renderDettaglio(item);
    }

    function renderDettaglio(item) {
        console.log('[ricerca.js] renderDettaglio:', item);

        if (!dettaglioContainer || !item) {
            console.warn('[ricerca.js] dettaglio non renderizzato: container o item mancante');
            return;
        }

        dettaglioContainer.innerHTML = '';

        if (item.categoria === 'SKU') {
            renderDettaglioSku(item.raw);
            return;
        }

        renderDettaglioProdotto(item.raw);
    }

    function renderDettaglioSku(sku) {
        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = sku.nome || 'SKU';
        wrapper.appendChild(titolo);

        const tipo = document.createElement('p');
        tipo.className = 'muted';
        tipo.textContent = 'Tipo: SKU';
        wrapper.appendChild(tipo);

        const nomeEditabile = creaCampoEditabileSku({
            etichetta: 'Nome',
            valore: sku.nome || '',
            chiave: 'nome'
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

        const descrizione = creaCampoEditabileSku({
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
            console.log('[ricerca.js] click su Modifica prezzo SKU');
            sostituisciPrezzoConInputSku(prezzoBox);
        });

        azioni.appendChild(btnModificaPrezzo);
        wrapper.appendChild(azioni);

        dettaglioContainer.appendChild(wrapper);
    }

    function renderDettaglioProdotto(prodotto) {
        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = prodotto.nome || 'Prodotto';
        wrapper.appendChild(titolo);

        const tipo = document.createElement('p');
        tipo.className = 'muted';
        tipo.textContent = `Tipo: ${prodotto.tipo || 'PRODOTTO'}`;
        wrapper.appendChild(tipo);

        const nomeEditabile = creaCampoEditabileProdotto({
            etichetta: 'Nome',
            valore: prodotto.nome || '',
            chiave: 'nome'
        });
        wrapper.appendChild(nomeEditabile);

        const codice = document.createElement('p');
        codice.innerHTML = `<strong>Codice:</strong> <span>${escapeHtml(prodotto.codice)}</span>`;
        wrapper.appendChild(codice);

        if (prodotto.tipo === 'COMPOSTO') {
            const titoloDescrizione = document.createElement('h4');
            titoloDescrizione.className = 'section-title';
            titoloDescrizione.style.fontSize = '0.95rem';
            titoloDescrizione.style.marginTop = '1rem';
            titoloDescrizione.textContent = 'Descrizione';
            wrapper.appendChild(titoloDescrizione);

            const descrizione = creaCampoEditabileProdotto({
                etichetta: null,
                valore: prodotto.descrizione || '',
                chiave: 'descrizione',
                multilinea: true
            });
            wrapper.appendChild(descrizione);

            const prezzoMin = creaCampoEditabileProdotto({
                etichetta: 'Prezzo minimo',
                valore: prodotto.prezzoMin != null ? String(prodotto.prezzoMin) : '',
                chiave: 'prezzoMin',
                numerico: true
            });
            wrapper.appendChild(prezzoMin);

            const prezzoMax = creaCampoEditabileProdotto({
                etichetta: 'Prezzo massimo',
                valore: prodotto.prezzoMax != null ? String(prodotto.prezzoMax) : '',
                chiave: 'prezzoMax',
                numerico: true
            });
            wrapper.appendChild(prezzoMax);
        }

        if (prodotto.tipo === 'SEMPLICE' && Array.isArray(prodotto.skuList) && prodotto.skuList.length > 0) {
            const titoloSku = document.createElement('h4');
            titoloSku.className = 'section-title';
            titoloSku.style.fontSize = '0.95rem';
            titoloSku.style.marginTop = '1rem';
            titoloSku.textContent = 'SKU associate';
            wrapper.appendChild(titoloSku);

            const lista = document.createElement('ul');
            lista.className = 'item-list';

            prodotto.skuList.forEach((sku) => {
                const li = document.createElement('li');
                li.textContent = `${sku.codice} - ${sku.nome} - €${formattaPrezzo(sku.prezzo)}`;
                lista.appendChild(li);
            });

            wrapper.appendChild(lista);
        }

        if (prodotto.tipo === 'COMPOSTO' && Array.isArray(prodotto.figli) && prodotto.figli.length > 0) {
            const titoloFigli = document.createElement('h4');
            titoloFigli.className = 'section-title';
            titoloFigli.style.fontSize = '0.95rem';
            titoloFigli.style.marginTop = '1rem';
            titoloFigli.textContent = 'Sottoprodotti';
            wrapper.appendChild(titoloFigli);

            wrapper.appendChild(renderAlberoProdotto(prodotto.figli));
        }

        dettaglioContainer.appendChild(wrapper);
    }

    function renderAlberoProdotto(figli) {
        const container = document.createElement('div');
        container.className = 'tree-nodo-figli';

        figli.forEach((figlio) => {
            const nodo = document.createElement('div');
            nodo.className = 'tree-nodo';

            const titolo = document.createElement('div');
            titolo.innerHTML = `<strong>${escapeHtml(figlio.nome)}</strong> <span class="muted">(${escapeHtml(figlio.tipo)})</span>`;
            nodo.appendChild(titolo);

            const meta = document.createElement('div');
            meta.className = 'muted';
            meta.textContent = `Codice: ${figlio.codice}`;
            nodo.appendChild(meta);

            if (figlio.tipo === 'SEMPLICE' && Array.isArray(figlio.skuList) && figlio.skuList.length > 0) {
                const listaSku = document.createElement('ul');
                listaSku.className = 'item-list';

                figlio.skuList.forEach((sku) => {
                    const li = document.createElement('li');
                    li.textContent = `${sku.codice} - ${sku.nome} - €${formattaPrezzo(sku.prezzo)}`;
                    listaSku.appendChild(li);
                });

                nodo.appendChild(listaSku);
            }

            if (figlio.tipo === 'COMPOSTO' && Array.isArray(figlio.figli) && figlio.figli.length > 0) {
                nodo.appendChild(renderAlberoProdotto(figlio.figli));
            }

            container.appendChild(nodo);
        });

        return container;
    }

    function creaCampoEditabileSku({ etichetta, valore, chiave, multilinea = false }) {
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
            const input = multilinea ? document.createElement('textarea') : document.createElement('input');

            if (!multilinea) {
                input.type = 'text';
            } else {
                input.rows = 4;
            }

            input.value = valore || '';

            input.addEventListener('blur', async () => {
                const nuovoValore = input.value.trim();
                const valoreAttuale = leggiValoreCorrenteSelezionato(chiave);

                if (nuovoValore === valoreAttuale) {
                    container.replaceChild(view, input);
                    return;
                }

                try {
                    await aggiornaCampoSku(chiave, nuovoValore);

                    stato.selezionato.raw[chiave] = nuovoValore;
                    sincronizzaRisultatoSelezionato();
                    mostraMessaggioRicerca('SKU aggiornata con successo.', 'success');
                    renderDettaglio(stato.selezionato);
                    renderRisultati();
                } catch (error) {
                    console.error('[ricerca.js] errore aggiornamento campo SKU:', error);
                    mostraMessaggioRicerca(
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

    function creaCampoEditabileProdotto({
                                            etichetta,
                                            valore,
                                            chiave,
                                            multilinea = false,
                                            numerico = false
                                        }) {
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
            const input = multilinea ? document.createElement('textarea') : document.createElement('input');

            if (!multilinea) {
                input.type = numerico ? 'number' : 'text';
                if (numerico) {
                    input.min = '0';
                    input.step = '0.01';
                }
            } else {
                input.rows = 4;
            }

            input.value = valore || '';

            input.addEventListener('blur', async () => {
                const nuovoValore = input.value.trim();
                const valoreAttuale = leggiValoreCorrenteSelezionato(chiave);

                if (nuovoValore === valoreAttuale) {
                    container.replaceChild(view, input);
                    return;
                }

                if (numerico && (nuovoValore === '' || Number.isNaN(Number(nuovoValore)) || Number(nuovoValore) < 0)) {
                    mostraMessaggioRicerca('Il valore numerico inserito non è valido.', 'error');
                    container.replaceChild(view, input);
                    return;
                }

                try {
                    await aggiornaCampoProdotto(chiave, nuovoValore);

                    stato.selezionato.raw[chiave] = numerico ? Number(nuovoValore) : nuovoValore;
                    sincronizzaRisultatoSelezionato();
                    mostraMessaggioRicerca('Prodotto aggiornato con successo.', 'success');
                    renderDettaglio(stato.selezionato);
                    renderRisultati();
                } catch (error) {
                    console.error('[ricerca.js] errore aggiornamento campo prodotto:', error);
                    mostraMessaggioRicerca(
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

    function sostituisciPrezzoConInputSku(prezzoBox) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '0.01';
        input.value = stato.selezionato?.raw?.prezzo ?? '';
        input.style.maxWidth = '180px';

        prezzoBox.replaceWith(input);
        input.focus();

        input.addEventListener('blur', async () => {
            const nuovoPrezzo = input.value.trim();

            if (nuovoPrezzo === '' || Number.isNaN(Number(nuovoPrezzo)) || Number(nuovoPrezzo) < 0) {
                mostraMessaggioRicerca('Il prezzo inserito non è valido.', 'error');
                renderDettaglio(stato.selezionato);
                return;
            }

            try {
                await aggiornaCampoSku('prezzo', nuovoPrezzo);

                stato.selezionato.raw.prezzo = Number(nuovoPrezzo);
                sincronizzaRisultatoSelezionato();
                mostraMessaggioRicerca('Prezzo aggiornato con successo.', 'success');
                renderDettaglio(stato.selezionato);
                renderRisultati();
            } catch (error) {
                console.error('[ricerca.js] errore aggiornamento prezzo SKU:', error);
                mostraMessaggioRicerca(
                    error.message || 'Aggiornamento prezzo non riuscito.',
                    'error'
                );
                renderDettaglio(stato.selezionato);
            }
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                input.blur();
            }

            if (event.key === 'Escape') {
                renderDettaglio(stato.selezionato);
            }
        });
    }

    async function aggiornaCampoSku(campo, valore) {
        const id = stato.selezionato?.raw?.id;

        if (!id) {
            throw new Error('SKU non selezionata.');
        }

        const body = new URLSearchParams({
            id,
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

    async function aggiornaCampoProdotto(campo, valore) {
        const id = stato.selezionato?.raw?.id;

        if (!id) {
            throw new Error('Prodotto non selezionato.');
        }

        const body = new URLSearchParams({
            id,
            campo,
            valore
        });

        const response = await fetch('apifornitoreprodottoaggiorna', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        return window.appFornitore.parseJsonResponse(response);
    }

    function sincronizzaRisultatoSelezionato() {
        if (!stato.selezionato || !stato.selezionato.raw) {
            return;
        }

        stato.selezionato.nome = stato.selezionato.raw.nome;

        if (stato.selezionato.categoria === 'SKU') {
            stato.selezionato.prezzo = stato.selezionato.raw.prezzo;
        }

        const indice = stato.risultati.findIndex((item) =>
            item.categoria === stato.selezionato.categoria && item.id === stato.selezionato.id
        );

        if (indice >= 0) {
            stato.risultati[indice] = {
                ...stato.risultati[indice],
                nome: stato.selezionato.raw.nome,
                prezzo: stato.selezionato.raw.prezzo,
                raw: stato.selezionato.raw
            };
        }
    }

    function leggiValoreCorrenteSelezionato(chiave) {
        return ((stato.selezionato?.raw?.[chiave]) ?? '').toString().trim();
    }

    function renderDettaglioVuoto() {
        if (!dettaglioContainer) {
            return;
        }

        dettaglioContainer.innerHTML = `
            <p class="muted">
                Seleziona un risultato per vedere i dettagli.
            </p>
        `;
    }

    function mostraMessaggioRicerca(messaggio, tipo) {
        console.log('[ricerca.js] messaggio ricerca:', tipo, messaggio);

        if (!messageBoxRicerca) {
            console.warn('[ricerca.js] messageBoxRicerca non trovato');
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
        if (item.categoria === 'SKU') {
            return 'SKU';
        }

        if (item.tipo === 'SEMPLICE') {
            return 'PRODOTTO SEMPLICE';
        }

        if (item.tipo === 'COMPOSTO') {
            return 'PRODOTTO COMPOSTO';
        }

        return 'PRODOTTO';
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
        init
    };
})();