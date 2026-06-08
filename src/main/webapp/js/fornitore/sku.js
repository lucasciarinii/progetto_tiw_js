window.skuPage = (function () {
    // Stato locale del modulo SKU.
    const stato = {
        // SKU attualmente mostrata nel pannello di dettaglio.
        skuSelezionata: null
    };

    // Riferimenti principali al DOM.
    let formCreaSku;
    let dettaglioContent;

    function isContainerRicerca(container) {
        // Capisco il contesto guardando il contenitore reale del dettaglio.
        return container?.id === 'ricerca-dettaglio';
    }

    function mostraMessaggioPerContainer(container, testo, tipo) {
        // Il messaggio deve seguire il pannello che ha generato l'azione.
        if (isContainerRicerca(container)) {
            if (window.appFornitore?.mostraMessaggioRicerca) {
                window.appFornitore.mostraMessaggioRicerca(testo, tipo);
                return;
            }

            if (window.ricercaPage?.mostraMessaggioRicerca) {
                window.ricercaPage.mostraMessaggioRicerca(testo, tipo);
                return;
            }
        }

        window.appFornitore?.mostraMessaggioHome?.(testo, tipo);
    }

    async function init() {
        // Recupero i riferimenti principali della home fornitore.
        formCreaSku = document.getElementById('form-crea-sku');
        dettaglioContent = document.getElementById('dettaglio-content');

        if (formCreaSku) {
            formCreaSku.addEventListener('submit', onSubmitCreaSku);
        }

        renderMessaggioDettaglioVuoto();
    }

    async function aggiornaListaSkuProdotti() {
        // Dopo create / update / delete SKU riallineo anche la parte prodotto.
        if (window.prodottoPage && typeof window.prodottoPage.caricaSkuDisponibili === 'function') {
            await window.prodottoPage.caricaSkuDisponibili();
        }
    }

    async function onSubmitCreaSku(event) {
        // Submit gestito via fetch verso la servlet JSON.
        event.preventDefault();
        window.appFornitore.nascondiMessaggi();

        if (!formCreaSku) {
            return;
        }

        const formData = new FormData(formCreaSku);

        if (!validaFormSku(formData)) {
            return;
        }

        try {
            const response = await fetch('api/fornitore/sku/crea', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            });

            const data = await window.appFornitore.parseJsonResponse(response);
            const skuCreata = data && data.sku ? data.sku : data;

            formCreaSku.reset();
            window.appFornitore.mostraMessaggioHome('SKU creata con successo.', 'success');

            await aggiornaListaSkuProdotti();

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
        // Estraggo e normalizzo i campi del form.
        const codice = String(formData.get('codice') || '').trim();
        const nome = String(formData.get('nome') || '').trim();
        const descrizioneTecnica = String(formData.get('descrizioneTecnica') || '').trim();
        const prezzo = String(formData.get('prezzo') || '').trim();
        const fotografia = formData.get('fotografia');

        if (!codice || !nome || !descrizioneTecnica || !prezzo) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi obbligatori.', 'error');
            return false;
        }

        if (!/^\d+$/.test(codice)) {
            window.appFornitore.mostraMessaggioHome('Il codice deve essere un numero intero valido.', 'error');
            return false;
        }

        if (Number.isNaN(Number(prezzo)) || Number(prezzo) < 0) {
            window.appFornitore.mostraMessaggioHome('Il prezzo inserito non è valido.', 'error');
            return false;
        }

        if (fotografia && fotografia.size > 0) {
            if (!fotografia.type.startsWith('image/')) {
                window.appFornitore.mostraMessaggioHome('La fotografia deve essere un file immagine valido.', 'error');
                return false;
            }

            const maxSizeBytes = 5 * 1024 * 1024;
            if (fotografia.size > maxSizeBytes) {
                window.appFornitore.mostraMessaggioHome('La fotografia non può superare 5 MB.', 'error');
                return false;
            }
        }

        return true;
    }

    function mostraDettaglioSku(sku) {
        // Salvo una copia locale della SKU e aggiorno il pannello dettaglio della home.
        stato.skuSelezionata = sku ? { ...sku } : null;
        renderDettaglioSkuInContainer(stato.skuSelezionata, dettaglioContent);
    }

    function renderDettaglioSkuInContainer(sku, container) {
        // Render del dettaglio SKU dentro il contenitore passato.
        if (!container) {
            return;
        }

        const aggiornaRisultatoRicerca = (patch) => {
            // Aggiorno i risultati solo se sto davvero lavorando nel pannello ricerca.
            if (!isContainerRicerca(container)) {
                return;
            }

            if (window.ricercaPage && typeof window.ricercaPage.aggiornaRisultatoInLista === 'function') {
                window.ricercaPage.aggiornaRisultatoInLista(sku.id, 'SKU', patch);
            }
        };

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

        wrapper.appendChild(creaCampoEditabile({
            etichetta: 'Nome',
            multilinea: false,
            valoreIniziale: sku.nome,
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'nome', nuovoValore);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { nome: nuovoValore }
                );

                mostraMessaggioPerContainer(container, 'SKU aggiornata con successo.', 'success');
                await aggiornaListaSkuProdotti();
                aggiornaRisultatoRicerca({ nome: nuovoValore });
                renderDettaglioSkuInContainer(stato.skuSelezionata, container);
            }
        }));

        wrapper.appendChild(creaCampoEditabileNumero({
            etichetta: 'Codice',
            valoreIniziale: sku.codice,
            integerOnly: true,
            min: 0,
            step: '1',
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'codice', nuovoValore);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { codice: Number(nuovoValore) }
                );

                mostraMessaggioPerContainer(container, 'SKU aggiornata con successo.', 'success');
                await aggiornaListaSkuProdotti();
                aggiornaRisultatoRicerca({ codice: Number(nuovoValore) });
                renderDettaglioSkuInContainer(stato.skuSelezionata, container);
            }
        }));

        wrapper.appendChild(creaCampoFotoEditabile(sku, container));

        const titoloDescrizione = document.createElement('h4');
        titoloDescrizione.className = 'section-title';
        titoloDescrizione.style.fontSize = '0.95rem';
        titoloDescrizione.style.marginTop = '1rem';
        titoloDescrizione.textContent = 'Descrizione tecnica';
        wrapper.appendChild(titoloDescrizione);

        wrapper.appendChild(creaCampoEditabile({
            etichetta: null,
            multilinea: true,
            valoreIniziale: sku.descrizioneTecnica,
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'descrizioneTecnica', nuovoValore);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { descrizioneTecnica: nuovoValore }
                );

                mostraMessaggioPerContainer(container, 'SKU aggiornata con successo.', 'success');
                await aggiornaListaSkuProdotti();
                aggiornaRisultatoRicerca({ descrizioneTecnica: nuovoValore });
                renderDettaglioSkuInContainer(stato.skuSelezionata, container);
            }
        }));

        wrapper.appendChild(creaCampoEditabileNumero({
            etichetta: 'Prezzo',
            valoreIniziale: sku.prezzo,
            integerOnly: false,
            min: 0,
            step: '0.01',
            formatView: (valore) => `€${formattaPrezzo(valore)}`,
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'prezzo', nuovoValore);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { prezzo: Number(nuovoValore) }
                );

                mostraMessaggioPerContainer(container, 'Prezzo aggiornato con successo.', 'success');
                await aggiornaListaSkuProdotti();
                aggiornaRisultatoRicerca({ prezzo: Number(nuovoValore) });
                renderDettaglioSkuInContainer(stato.skuSelezionata, container);
            }
        }));

        const azioni = document.createElement('div');
        azioni.className = 'actions-row';

        const bottoneElimina = document.createElement('button');
        bottoneElimina.type = 'button';
        bottoneElimina.className = 'btn btn-action btn-danger btn-sm';
        bottoneElimina.textContent = '-*';
        bottoneElimina.title = 'Elimina SKU';
        bottoneElimina.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi eliminare definitivamente questa SKU?');
            if (!conferma) {
                return;
            }

            try {
                await eliminaSku(sku.id);

                if (
                    isContainerRicerca(container) &&
                    window.ricercaPage &&
                    typeof window.ricercaPage.rimuoviRisultatoDaLista === 'function'
                ) {
                    window.ricercaPage.rimuoviRisultatoDaLista(sku.id, 'SKU');
                }

                mostraMessaggioPerContainer(container, 'SKU eliminata con successo.', 'success');
                stato.skuSelezionata = null;
                renderMessaggioDettaglioVuoto(container);
                await aggiornaListaSkuProdotti();
            } catch (error) {
                console.error('[sku.js] errore eliminazione SKU:', error);

                mostraMessaggioPerContainer(
                    container,
                    error.message || 'Errore durante l\'eliminazione della SKU.',
                    'error'
                );
            }
        });

        azioni.appendChild(bottoneElimina);
        wrapper.appendChild(azioni);
        container.appendChild(wrapper);
    }

    function creaCampoEditabile({ etichetta, multilinea, valoreIniziale, onSalva, containerMessaggi }) {
        // Helper per i campi testuali modificabili inline.
        const container = creaContenitoreCampo(etichetta);

        const view = creaVistaCampo(
            valoreIniziale ? valoreIniziale.toString() : '-'
        );

        attivaInlineEditor({
            container,
            view,
            creaInput: () => {
                const input = multilinea ? document.createElement('textarea') : document.createElement('input');

                if (multilinea) {
                    input.rows = 4;
                } else {
                    input.type = 'text';
                }

                input.className = 'form-control';
                input.value = valoreIniziale ?? '';
                return input;
            },
            getValore: (input) => input.value.trim(),
            onInvio: (input, event) => {
                if (!multilinea && event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            },
            valida: (nuovoValore) => ({
                valido: true,
                valoreDaSalvare: nuovoValore
            }),
            valoreOriginale: (valoreIniziale ?? '').toString().trim(),
            onSalva,
            containerMessaggi
        });

        container.appendChild(view);
        return container;
    }

    function creaCampoEditabileNumero({
                                          etichetta,
                                          valoreIniziale,
                                          integerOnly,
                                          min,
                                          step,
                                          formatView,
                                          onSalva,
                                          containerMessaggi
                                      }) {
        // Variante inline dedicata ai campi numerici.
        const container = creaContenitoreCampo(etichetta);

        const testo = formatView
            ? formatView(valoreIniziale)
            : (valoreIniziale ?? '-').toString();

        const view = creaVistaCampo(testo);

        attivaInlineEditor({
            container,
            view,
            creaInput: () => {
                const input = document.createElement('input');
                input.type = 'number';
                input.min = min != null ? String(min) : '0';
                input.step = step || '1';
                input.className = 'form-control';
                input.style.maxWidth = '200px';
                input.value = valoreIniziale ?? '';
                return input;
            },
            getValore: (input) => input.value.trim(),
            onInvio: (input, event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            },
            valida: (rawValue) => {
                if (rawValue === '') {
                    return {
                        valido: false,
                        messaggio: 'Il valore non può essere vuoto.'
                    };
                }

                if (integerOnly && !/^\d+$/.test(rawValue)) {
                    return {
                        valido: false,
                        messaggio: 'Inserisci un numero intero valido.'
                    };
                }

                const numero = Number(rawValue);
                if (Number.isNaN(numero) || (min != null && numero < min)) {
                    return {
                        valido: false,
                        messaggio: 'Il valore inserito non è valido.'
                    };
                }

                return {
                    valido: true,
                    valoreDaSalvare: rawValue
                };
            },
            valoreOriginale: String(Number(valoreIniziale)),
            confrontaValori: (originale, nuovoValore) => Number(originale) === Number(nuovoValore),
            onSalva,
            containerMessaggi
        });

        container.appendChild(view);
        return container;
    }

    function creaContenitoreCampo(etichetta) {
        // Wrapper base del campo con eventuale label.
        const container = document.createElement('div');
        container.className = 'form-group';

        if (etichetta) {
            const label = document.createElement('label');
            label.textContent = etichetta;
            container.appendChild(label);
        }

        return container;
    }

    function creaVistaCampo(testo) {
        // Vista statica del campo prima del click.
        const view = document.createElement('p');
        view.className = 'muted';
        view.style.cursor = 'pointer';
        view.title = 'Clicca per modificare';
        view.textContent = testo;
        return view;
    }

    function attivaInlineEditor({
                                    container,
                                    view,
                                    creaInput,
                                    getValore,
                                    onInvio,
                                    valida,
                                    valoreOriginale,
                                    confrontaValori,
                                    onSalva,
                                    containerMessaggi
                                }) {
        // Logica comune dell'editor inline.
        view.addEventListener('click', () => {
            const input = creaInput();

            const ripristinaVista = () => {
                container.replaceChild(view, input);
            };

            const stessiValori = (nuovoValore) => {
                if (typeof confrontaValori === 'function') {
                    return confrontaValori(valoreOriginale, nuovoValore);
                }
                return nuovoValore === valoreOriginale;
            };

            const salva = async () => {
                const valoreLetto = getValore(input);

                if (stessiValori(valoreLetto)) {
                    ripristinaVista();
                    return;
                }

                const esitoValidazione = valida(valoreLetto);

                if (!esitoValidazione.valido) {
                    mostraMessaggioPerContainer(
                        containerMessaggi,
                        esitoValidazione.messaggio || 'Valore non valido.',
                        'error'
                    );
                    ripristinaVista();
                    return;
                }

                try {
                    await onSalva(esitoValidazione.valoreDaSalvare);
                } catch (error) {
                    console.error('[sku.js] errore aggiornamento campo SKU:', error);

                    mostraMessaggioPerContainer(
                        containerMessaggi,
                        error.message || 'Aggiornamento non riuscito.',
                        'error'
                    );
                    ripristinaVista();
                }
            };

            input.addEventListener('blur', salva, { once: true });

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    ripristinaVista();
                    return;
                }

                if (typeof onInvio === 'function') {
                    onInvio(input, event);
                }
            });

            container.replaceChild(input, view);
            input.focus();
            input.select?.();
        });
    }

    function creaCampoFotoEditabile(sku, containerMessaggi) {
        // Campo dedicato alla fotografia della SKU.
        const container = document.createElement('div');
        container.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = 'Fotografia';
        container.appendChild(label);

        const box = document.createElement('div');
        box.className = 'detail-photo';
        box.style.cursor = 'pointer';
        box.title = 'Clicca per cambiare la fotografia';

        if (sku.fotografia) {
            const img = document.createElement('img');
            img.src = risolviPercorsoFoto(sku.fotografia);
            img.alt = `Foto SKU ${sku.nome || ''}`.trim();
            img.loading = 'lazy';
            img.decoding = 'async';
            box.appendChild(img);
        } else {
            const placeholder = document.createElement('p');
            placeholder.className = 'muted';
            placeholder.textContent = 'Nessuna fotografia. Clicca per caricarne una.';
            box.appendChild(placeholder);
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.hidden = true;

        box.addEventListener('click', () => input.click());

        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) {
                return;
            }

            if (!file.type.startsWith('image/')) {
                mostraMessaggioPerContainer(containerMessaggi, 'La fotografia deve essere un file immagine valido.', 'error');
                input.value = '';
                return;
            }

            const maxSizeBytes = 5 * 1024 * 1024;
            if (file.size > maxSizeBytes) {
                mostraMessaggioPerContainer(containerMessaggi, 'La fotografia non può superare 5 MB.', 'error');
                input.value = '';
                return;
            }

            try {
                const aggiornato = await aggiornaFotoSku(sku.id, file);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { fotografia: aggiornato?.fotografia }
                );

                mostraMessaggioPerContainer(containerMessaggi, 'Fotografia aggiornata con successo.', 'success');
                await aggiornaListaSkuProdotti();
                renderDettaglioSkuInContainer(stato.skuSelezionata, containerMessaggi);
            } catch (error) {
                console.error('[sku.js] errore aggiornamento fotografia SKU:', error);

                mostraMessaggioPerContainer(
                    containerMessaggi,
                    error.message || 'Aggiornamento fotografia non riuscito.',
                    'error'
                );
            } finally {
                input.value = '';
            }
        });

        container.appendChild(box);
        container.appendChild(input);
        return container;
    }

    function normalizzaSkuAggiornata(aggiornato, fallback, patch) {
        // Fonde risposta server, stato precedente e patch locale.
        if (aggiornato && typeof aggiornato === 'object') {
            return { ...fallback, ...aggiornato, ...patch };
        }

        return { ...fallback, ...patch };
    }

    async function aggiornaCampoSku(skuId, campo, valore) {
        // Update di un singolo attributo SKU.
        if (!skuId) {
            throw new Error('SKU non selezionata.');
        }

        const body = new URLSearchParams();
        body.append('id', String(skuId));
        body.append('campo', String(campo));
        body.append('valore', String(valore));

        const response = await fetch('api/fornitore/sku/aggiorna', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json'
            },
            body: body.toString()
        });

        return window.appFornitore.parseJsonResponse(response);
    }

    async function aggiornaFotoSku(skuId, file) {
        // Update della fotografia tramite FormData.
        if (!skuId) {
            throw new Error('SKU non selezionata.');
        }

        const formData = new FormData();
        formData.append('id', String(skuId));
        formData.append('campo', 'fotografia');
        formData.append('fotografia', file);

        const response = await fetch('api/fornitore/sku/aggiorna', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });

        return window.appFornitore.parseJsonResponse(response);
    }

    async function eliminaSku(skuId) {
        // Eliminazione completa della SKU.
        const body = new URLSearchParams();
        body.append('id', String(skuId));
        body.append('tipo', 'SKU');

        const response = await fetch('api/fornitore/oggetto/elimina', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json'
            },
            body: body.toString()
        });

        return window.appFornitore.parseJsonResponse(response);
    }

    function renderMessaggioDettaglioVuoto(container = dettaglioContent) {
        // Stato neutro del pannello quando non c'è nessuna SKU selezionata.
        if (!container) {
            return;
        }

        container.innerHTML = `
            <p class="muted">
                Dopo una creazione o una selezione nella home, qui comparirà il dettaglio dell'oggetto.
            </p>
        `;
    }

    function formattaPrezzo(prezzo) {
        // Mostra sempre il prezzo con due decimali.
        const numero = Number(prezzo);
        return Number.isNaN(numero) ? '0.00' : numero.toFixed(2);
    }

    function risolviPercorsoFoto(fotografia) {
        // Normalizza il path della fotografia ricevuto dal backend.
        const fotoPath = String(fotografia || '').trim();
        if (!fotoPath) {
            return '';
        }

        if (
            fotoPath.startsWith('https://') ||
            fotoPath.startsWith('/')
        ) {
            return fotoPath;
        }

        if (fotoPath.startsWith('uploads/')) {
            return fotoPath;
        }

        return `uploads/${fotoPath}`;
    }

    return {
        init,
        renderDettaglioSkuInContainer
    };
})();