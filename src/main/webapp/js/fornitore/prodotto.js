window.prodottoPage = (function () {
    // Modulo della pagina fornitore dedicato alla gestione di prodotti e builder composti.
    let formProdottoSemplice;
    let formProdottoComposto;
    let listaSkuDisponibili;
    let hintSkuVuote;
    let listaFigliDisponibili;
    let hintProdottiVuoti;
    let dettaglioContent;

    let skuDisponibiliCache = [];
    let prodottiDisponibiliCache = [];

    let builderState = null;
    let builderNodeSeq = 0;
    let builderSkuSeq = 0;

    function mostraMessaggioGlobale(testo, tipo) {
        if (window.appFornitore.getSezioneCorrente?.() === 'ricerca'
            && window.ricercaPage
            && typeof window.ricercaPage.mostraMessaggioRicerca === 'function') {
            window.ricercaPage.mostraMessaggioRicerca(testo, tipo);
            return;
        }
        window.appFornitore.mostraMessaggioHome(testo, tipo);
    }

    function aggiornaRisultatoRicerca(prodottoId, patch) {
        if (window.appFornitore.getSezioneCorrente?.() !== 'ricerca') {
            return;
        }
        if (window.ricercaPage && typeof window.ricercaPage.aggiornaRisultatoInLista === 'function') {
            window.ricercaPage.aggiornaRisultatoInLista(prodottoId, 'PRODOTTO', patch);
        }
    }

    async function init() {
        // Cache dei riferimenti ai nodi DOM e caricamento iniziale dei dati disponibili.
        formProdottoSemplice = document.getElementById('form-crea-semplice');
        formProdottoComposto = document.getElementById('form-crea-composto');
        listaSkuDisponibili = document.getElementById('lista-sku-disponibili');
        hintSkuVuote = document.getElementById('hint-sku-vuote');
        listaFigliDisponibili = document.getElementById('lista-prodotti-disponibili');
        hintProdottiVuoti = document.getElementById('hint-prodotti-vuoti');
        dettaglioContent = document.getElementById('dettaglio-content');

        if (formProdottoSemplice) {
            formProdottoSemplice.addEventListener('submit', onSubmitProdottoSemplice);
        }

        if (formProdottoComposto) {
            formProdottoComposto.addEventListener('submit', onSubmitProdottoComposto);
        }

        await Promise.all([
            caricaSkuDisponibili(),
            caricaProdottiDisponibili()
        ]);
    }

    async function onSubmitProdottoSemplice(event) {
        // Creazione classica di un prodotto semplice con invio form-urlencoded.
        event.preventDefault();
        window.appFornitore.nascondiMessaggi();

        if (!formProdottoSemplice) {
            return;
        }

        const formData = new FormData(formProdottoSemplice);
        formData.append('tipo', 'SEMPLICE');

        const codice = String(formData.get('codice') || '').trim();
        const nome = String(formData.get('nome') || '').trim();
        const skuIds = formData.getAll('skuIds');

        if (!codice || !nome) {
            window.appFornitore.mostraMessaggioHome(
                'Compila tutti i campi del prodotto semplice.',
                'error'
            );
            return;
        }

        if (!Number.isInteger(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome(
                'Il codice del prodotto semplice non è valido.',
                'error'
            );
            return;
        }

        if (!skuIds || skuIds.length === 0) {
            window.appFornitore.mostraMessaggioHome(
                'Seleziona almeno una SKU.',
                'error'
            );
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

            window.appFornitore.mostraMessaggioHome(
                'Prodotto semplice creato con successo.',
                'success'
            );

            if (data) {
                mostraDettaglioProdottoCreato(data);
            }

            await Promise.all([
                caricaProdottiDisponibili(),
                caricaSkuDisponibili()
            ]);
        } catch (error) {
            console.error('[prodotto.js] errore creazione prodotto semplice:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante la creazione del prodotto semplice.',
                'error'
            );
        }
    }

    async function onSubmitProdottoComposto(event) {
        // Qui non salviamo subito sul backend: iniziamo una bozza locale del builder.
        event.preventDefault();
        window.appFornitore.nascondiMessaggi();

        if (!formProdottoComposto) {
            return;
        }

        const formData = new FormData(formProdottoComposto);

        const codice = String(formData.get('codice') || '').trim();
        const nome = String(formData.get('nome') || '').trim();
        const descrizione = String(formData.get('descrizione') || '').trim();
        const prezzoMin = String(formData.get('prezzoMin') || '').trim();
        const prezzoMax = String(formData.get('prezzoMax') || '').trim();
        const figlioIds = formData.getAll('figlioIds');

        if (!codice || !nome || !descrizione || !prezzoMin || !prezzoMax) {
            window.appFornitore.mostraMessaggioHome(
                'Compila tutti i campi del prodotto composto.',
                'error'
            );
            return;
        }

        if (!Number.isInteger(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome(
                'Il codice del prodotto composto non è valido.',
                'error'
            );
            return;
        }

        if (
            Number.isNaN(Number(prezzoMin)) ||
            Number(prezzoMin) < 0 ||
            Number.isNaN(Number(prezzoMax)) ||
            Number(prezzoMax) < 0
        ) {
            window.appFornitore.mostraMessaggioHome(
                'La fascia di prezzo non è valida.',
                'error'
            );
            return;
        }

        if (Number(prezzoMin) > Number(prezzoMax)) {
            window.appFornitore.mostraMessaggioHome(
                'Il prezzo minimo non può superare il massimo.',
                'error'
            );
            return;
        }

        try {
            const figliSelezionatiBase = prodottiDisponibiliCache.filter((prodotto) => {
                return figlioIds.includes(String(prodotto.id))
                    && prodotto.padreId == null;
            });

            const figliCompleti = await Promise.all(
                figliSelezionatiBase.map((prodotto) =>
                    caricaDettaglioProdotto(prodotto.id, prodotto.tipo)
                )
            );

            const figliSelezionati = figliCompleti
                .map(mappaProdottoEsistentePerBuilder)
                .filter(Boolean);

            builderState = {
                clientId: nextBuilderNodeId(),
                id: null,
                codice: Number(codice),
                nome,
                tipo: 'COMPOSTO',
                descrizione,
                prezzoMin: Number(prezzoMin),
                prezzoMax: Number(prezzoMax),
                figli: figliSelezionati,
                deletedProductIds: new Set(),
                deletedSkuIds: new Set()
            };

            renderBuilder();

            window.appFornitore.mostraMessaggioHome(
                figliSelezionati.length > 0
                    ? 'Bozza del prodotto composto creata con i sottoprodotti selezionati.'
                    : 'Bozza del prodotto composto creata. Ora puoi aggiungere sottoprodotti e SKU.',
                'success'
            );
        } catch (error) {
            console.error('[prodotto.js] errore caricamento sottoprodotti iniziali:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante il caricamento dei prodotti selezionati.',
                'error'
            );
        }
    }

    async function caricaSkuDisponibili() {
        try {
            const response = await fetch('apifornitoresku', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json'
                }
            });

            const data = await window.appFornitore.parseJsonResponse(response);
            skuDisponibiliCache = Array.isArray(data) ? data : [];
            aggiornaListaSku(skuDisponibiliCache);
        } catch (error) {
            console.error('[prodotto.js] errore caricamento SKU:', error);
        }
    }

    async function caricaProdottiDisponibili() {
        if (!listaFigliDisponibili || !hintProdottiVuoti) {
            return;
        }

        try {
            const response = await fetch('apifornitoreprodotti-disponibili', {
                method: 'GET',
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            // Filtro difensivo lato client:
            // nel form devono comparire solo prodotti esistenti senza padre.
            prodottiDisponibiliCache = Array.isArray(data)
                ? data.filter((prodotto) => {
                    return prodotto
                        && prodotto.id != null
                        && prodotto.padreId == null;
                })
                : [];

            renderProdottiDisponibili(prodottiDisponibiliCache);
        } catch (error) {
            console.error('[prodotto.js] errore caricamento prodotti disponibili:', error);
        }
    }

    async function caricaDettaglioProdotto(idProdotto, tipoProdotto) {
        const tipoNormalizzato = String(tipoProdotto || '').trim().toUpperCase();

        const response = await fetch(
            `apifornitoreprodotto-dettaglio?id=${encodeURIComponent(idProdotto)}&tipo=${encodeURIComponent(tipoNormalizzato)}`,
            {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json'
                }
            }
        );

        return window.appFornitore.parseJsonResponse(response);
    }

    function aggiornaListaSku(lista) {
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

            const span = document.createElement('span');
            span.textContent = `${sku.codice} - ${sku.nome} - €${formattaPrezzo(sku.prezzo)}`;

            label.appendChild(input);
            label.appendChild(span);
            listaSkuDisponibili.appendChild(label);
        });
    }

    function renderProdottiDisponibili(lista) {
        if (!listaFigliDisponibili || !hintProdottiVuoti) {
            return;
        }

        listaFigliDisponibili.innerHTML = '';

        const prodottiRenderizzabili = Array.isArray(lista)
            ? lista.filter((prodotto) => {
                return prodotto
                    && prodotto.id != null
                    && prodotto.padreId == null;
            })
            : [];

        if (prodottiRenderizzabili.length === 0) {
            hintProdottiVuoti.hidden = false;
            return;
        }

        hintProdottiVuoti.hidden = true;

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
            listaFigliDisponibili.appendChild(label);
        });
    }

    function mostraDettaglioProdottoCreato(prodotto, container = dettaglioContent) {
        builderState = null;
        renderDettaglioProdottoInContainer(prodotto, container);
    }

    function renderDettaglioProdottoInContainer(prodotto, container) {
        if (!container) {
            return;
        }

        const mostraMessaggio = mostraMessaggioGlobale;
        const inRicerca = window.appFornitore.getSezioneCorrente?.() === 'ricerca'
            || container?.id === 'ricerca-dettaglio';

        if (!prodotto) {
            container.innerHTML = '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';
            return;
        }

        container.innerHTML = '';

        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = 'Dettaglio prodotto';
        wrapper.appendChild(titolo);

        wrapper.appendChild(
            creaRigaCampoProdotto('Nome', prodotto.nome, async (nuovoValore) => {
                const aggiornato = await aggiornaCampoProdotto(prodotto.id, 'nome', nuovoValore);
                aggiornaRisultatoRicerca(prodotto.id, { nome: nuovoValore });
                mostraDettaglioProdottoCreato(
                    aggiornato || { ...prodotto, nome: nuovoValore },
                    container
                );
                await caricaProdottiDisponibili();
            })
        );

        wrapper.appendChild(
            creaRigaCampoProdotto('Codice', prodotto.codice, async (nuovoValore) => {
                const codiceNumerico = Number(nuovoValore);
                if (!Number.isInteger(codiceNumerico) || codiceNumerico < 0) {
                    window.appFornitore.mostraMessaggioHome(
                        'Il codice del prodotto non è valido.',
                        'error'
                    );
                    throw new Error('Codice non valido');
                }

                const aggiornato = await aggiornaCampoProdotto(prodotto.id, 'codice', codiceNumerico);
                mostraDettaglioProdottoCreato(
                    aggiornato || { ...prodotto, codice: codiceNumerico },
                    container
                );
                await caricaProdottiDisponibili();
            })
        );

        const tipo = document.createElement('p');
        tipo.innerHTML = `Tipo: ${escapeHtml(prodotto.tipo)}`;
        wrapper.appendChild(tipo);

        if (prodotto.tipo === 'SEMPLICE') {
            renderBloccoSkuProdottoSemplice(wrapper, prodotto, container);
        }

        if (prodotto.tipo === 'COMPOSTO') {
            renderBloccoProdottoComposto(wrapper, prodotto, container);
        }

        const azioniFinali = document.createElement('div');
        azioniFinali.className = 'actions-row';
        azioniFinali.style.marginTop = '1rem';

        const bottoneElimina = document.createElement('button');
        bottoneElimina.type = 'button';
        bottoneElimina.className = 'btn btn-action btn-danger btn-sm';
        bottoneElimina.textContent = '-*';
        bottoneElimina.title = 'Elimina prodotto';
        bottoneElimina.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi eliminare questo prodotto?');
            if (!conferma) {
                return;
            }

            try {
                let sottoalberoRicerca = null;
                if (window.appFornitore.getSezioneCorrente?.() === 'ricerca'
                    && prodotto.tipo === 'COMPOSTO') {
                    try {
                        sottoalberoRicerca = await caricaDettaglioProdotto(prodotto.id, prodotto.tipo);
                    } catch (erroreCaricamento) {
                        console.warn('[prodotto.js] impossibile caricare sottoalbero prima eliminazione:', erroreCaricamento);
                    }
                }

                await eliminaOggetto(prodotto.id, prodotto.tipo);

                if (inRicerca
                    && window.ricercaPage
                    && prodotto.tipo === 'COMPOSTO'
                    && typeof window.ricercaPage.rimuoviRisultatiSottoalbero === 'function') {
                     window.ricercaPage.rimuoviRisultatiSottoalbero(sottoalberoRicerca || prodotto);
                } else if (inRicerca
                    && window.ricercaPage
                    && typeof window.ricercaPage.rimuoviRisultatoDaLista === 'function') {
                     window.ricercaPage.rimuoviRisultatoDaLista(prodotto.id, 'PRODOTTO');
                 }

                mostraMessaggio('Prodotto eliminato con successo.', 'success');

                container.innerHTML =
                    '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';

                await Promise.all([
                    caricaProdottiDisponibili(),
                    caricaSkuDisponibili()
                ]);
            } catch (error) {
                console.error('[prodotto.js] errore eliminazione prodotto:', error);
                mostraMessaggio(
                    error.message || 'Errore durante l\'eliminazione del prodotto.',
                    'error'
                );
            }
        });

        azioniFinali.appendChild(bottoneElimina);
        wrapper.appendChild(azioniFinali);

        container.appendChild(wrapper);
    }

    function renderBloccoSkuProdottoSemplice(wrapper, prodotto, container) {
        const titoloSku = document.createElement('h4');
        titoloSku.className = 'section-title';
        titoloSku.style.fontSize = '0.95rem';
        titoloSku.style.marginTop = '1rem';
        titoloSku.textContent = 'SKU associate';
        wrapper.appendChild(titoloSku);

        if (!Array.isArray(prodotto.skuList) || prodotto.skuList.length === 0) {
            const vuoto = document.createElement('p');
            vuoto.className = 'muted';
            vuoto.textContent = 'Nessuna SKU associata.';
            wrapper.appendChild(vuoto);
            return;
        }

        prodotto.skuList.forEach((sku) => {
            wrapper.appendChild(renderRigaSkuDettaglio(sku, prodotto, container));
        });
    }

    function renderBloccoProdottoComposto(wrapper, prodotto, container) {
        wrapper.appendChild(
            creaRigaCampoProdotto('Descrizione', prodotto.descrizione, async (nuovoValore) => {
                const aggiornato = await aggiornaCampoProdotto(
                    prodotto.id,
                    'descrizione',
                    nuovoValore
                );

                mostraDettaglioProdottoCreato(
                    aggiornato || { ...prodotto, descrizione: nuovoValore },
                    container
                );

                await caricaProdottiDisponibili();
            })
        );

        wrapper.appendChild(
            creaRigaCampoProdotto(
                'Prezzo minimo',
                formattaPrezzo(prodotto.prezzoMin),
                async (nuovoValore) => {
                    const aggiornato = await aggiornaCampoProdotto(
                        prodotto.id,
                        'prezzoMin',
                        nuovoValore
                    );

                    mostraDettaglioProdottoCreato(
                        aggiornato || { ...prodotto, prezzoMin: Number(nuovoValore) },
                        container
                    );

                    await caricaProdottiDisponibili();
                }
            )
        );

        wrapper.appendChild(
            creaRigaCampoProdotto(
                'Prezzo massimo',
                formattaPrezzo(prodotto.prezzoMax),
                async (nuovoValore) => {
                    const aggiornato = await aggiornaCampoProdotto(
                        prodotto.id,
                        'prezzoMax',
                        nuovoValore
                    );

                    mostraDettaglioProdottoCreato(
                        aggiornato || { ...prodotto, prezzoMax: Number(nuovoValore) },
                        container
                    );

                    await caricaProdottiDisponibili();
                }
            )
        );

        const titoloFigli = document.createElement('h4');
        titoloFigli.className = 'section-title';
        titoloFigli.style.fontSize = '0.95rem';
        titoloFigli.style.marginTop = '1rem';
        titoloFigli.textContent = 'Sottoprodotti';
        wrapper.appendChild(titoloFigli);

        if (!Array.isArray(prodotto.figli) || prodotto.figli.length === 0) {
            const vuoto = document.createElement('p');
            vuoto.className = 'muted';
            vuoto.textContent = 'Nessun sottoprodotto.';
            wrapper.appendChild(vuoto);
            return;
        }

        const albero = document.createElement('div');
        albero.style.marginTop = '0.75rem';

        prodotto.figli.forEach((figlio) => {
            albero.appendChild(renderNodoDettaglioProdotto(figlio, prodotto.id, container));
        });

        wrapper.appendChild(albero);
    }

    function renderNodoDettaglioProdotto(nodo, padreId, container) {
        const card = document.createElement('div');
        card.className = 'tree-node';
        card.style.marginTop = '0.75rem';

        const mostraMessaggio = mostraMessaggioGlobale;
        const inRicerca = window.appFornitore.getSezioneCorrente?.() === 'ricerca'
            || container?.id === 'ricerca-dettaglio';

        card.appendChild(
            creaRigaCampoProdotto('Nome', nodo.nome, async (nuovoValore) => {
                const aggiornato = await aggiornaCampoProdotto(nodo.id, 'nome', nuovoValore);
                if (aggiornato) {
                    mostraDettaglioProdottoCreato(aggiornato, container);
                } else {
                    await refreshContenitoreDaPadre(padreId, container);
                }
                await caricaProdottiDisponibili();
            })
        );

        const codice = document.createElement('p');
        codice.innerHTML = `Codice: ${escapeHtml(nodo.codice)}`;
        card.appendChild(codice);

        const tipo = document.createElement('p');
        tipo.innerHTML = `Tipo: ${escapeHtml(nodo.tipo)}`;
        card.appendChild(tipo);

        // Solo i composti possono contenere altri sottoprodotti.
        if (nodo.tipo === 'COMPOSTO') {
            card.appendChild(
                creaRigaCampoProdotto('Descrizione', nodo.descrizione, async (nuovoValore) => {
                    const aggiornato = await aggiornaCampoProdotto(
                        nodo.id,
                        'descrizione',
                        nuovoValore
                    );
                    if (aggiornato) {
                        mostraDettaglioProdottoCreato(aggiornato, container);
                    } else {
                        await refreshContenitoreDaPadre(padreId, container);
                    }
                    await caricaProdottiDisponibili();
                })
            );

            card.appendChild(
                creaRigaCampoProdotto(
                    'Prezzo minimo',
                    formattaPrezzo(nodo.prezzoMin),
                    async (nuovoValore) => {
                        const aggiornato = await aggiornaCampoProdotto(
                            nodo.id,
                            'prezzoMin',
                            nuovoValore
                        );
                        if (aggiornato) {
                            mostraDettaglioProdottoCreato(aggiornato, container);
                        } else {
                            await refreshContenitoreDaPadre(padreId, container);
                        }
                        await caricaProdottiDisponibili();
                    }
                )
            );

            card.appendChild(
                creaRigaCampoProdotto(
                    'Prezzo massimo',
                    formattaPrezzo(nodo.prezzoMax),
                    async (nuovoValore) => {
                        const aggiornato = await aggiornaCampoProdotto(
                            nodo.id,
                            'prezzoMax',
                            nuovoValore
                        );
                        if (aggiornato) {
                            mostraDettaglioProdottoCreato(aggiornato, container);
                        } else {
                            await refreshContenitoreDaPadre(padreId, container);
                        }
                        await caricaProdottiDisponibili();
                    }
                )
            );
        }

        const azioni = document.createElement('div');
        azioni.className = 'tree-actions';
        azioni.style.marginTop = '0.75rem';

        if (padreId != null && nodo.id != null) {
            const bottoneRimuovi = document.createElement('button');
            bottoneRimuovi.type = 'button';
            bottoneRimuovi.className = 'btn btn-action btn-warning btn-sm';
            bottoneRimuovi.textContent = '-';
            bottoneRimuovi.title = 'Rimuovi';
            bottoneRimuovi.addEventListener('click', async () => {
                const conferma = window.confirm('Vuoi scollegare questo sottoprodotto?');
                if (!conferma) {
                    return;
                }

                try {
                    const aggiornato = await rimuoviAssociazionePadreFiglio(nodo.id, padreId);

                    if (window.appFornitore.getSezioneCorrente?.() === 'ricerca'
                        && window.ricercaPage
                        && typeof window.ricercaPage.rimuoviRisultatoDaLista === 'function') {
                        window.ricercaPage.rimuoviRisultatoDaLista(nodo.id, 'PRODOTTO');
                    }

                    mostraMessaggio('Sottoprodotto rimosso correttamente.', 'success');

                    if (aggiornato) {
                        mostraDettaglioProdottoCreato(aggiornato, container);
                    } else {
                        await refreshContenitoreDaPadre(padreId, container);
                    }

                    await caricaProdottiDisponibili();
                } catch (error) {
                    console.error('[prodotto.js] errore rimozione sottoprodotto:', error);
                    mostraMessaggio(
                        error.message || 'Errore durante la rimozione del sottoprodotto.',
                        'error'
                    );
                }
            });

            azioni.appendChild(bottoneRimuovi);
        }

        if (nodo.id != null) {
            const bottoneElimina = document.createElement('button');
            bottoneElimina.type = 'button';
            bottoneElimina.className = 'btn btn-action btn-danger btn-sm';
            bottoneElimina.textContent = '-*';
            bottoneElimina.title = 'Elimina';
            bottoneElimina.addEventListener('click', async () => {
                const conferma = window.confirm('Vuoi eliminare questo prodotto?');
                if (!conferma) {
                    return;
                }

                try {
                    await eliminaOggetto(nodo.id, nodo.tipo);

                    if (window.appFornitore.getSezioneCorrente?.() === 'ricerca'
                        && window.ricercaPage
                        && typeof window.ricercaPage.rimuoviRisultatoDaLista === 'function') {
                        window.ricercaPage.rimuoviRisultatoDaLista(nodo.id, 'PRODOTTO');
                    }

                    mostraMessaggio('Prodotto eliminato con successo.', 'success');

                    if (padreId != null) {
                        await refreshContenitoreDaPadre(padreId, container);
                    } else {
                        container.innerHTML =
                            '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';
                    }

                    await Promise.all([
                        caricaProdottiDisponibili(),
                        caricaSkuDisponibili()
                    ]);
                } catch (error) {
                    console.error('[prodotto.js] errore eliminazione prodotto figlio:', error);
                    mostraMessaggio(
                        error.message || 'Errore durante l\'eliminazione del prodotto.',
                        'error'
                    );
                }
            });

            azioni.appendChild(bottoneElimina);
        }

        if (azioni.childNodes.length > 0) {
            card.appendChild(azioni);
        }

        // Solo i semplici possono ricevere SKU nel builder.
        if (nodo.tipo === 'SEMPLICE') {
            const bloccoSku = document.createElement('div');
            bloccoSku.style.marginTop = '0.85rem';

            const titoloSku = document.createElement('div');
            titoloSku.className = 'muted';
            titoloSku.textContent = 'SKU associate';
            bloccoSku.appendChild(titoloSku);

            if (!Array.isArray(nodo.skuList) || nodo.skuList.length === 0) {
                const vuoto = document.createElement('p');
                vuoto.className = 'muted';
                vuoto.textContent = 'Nessuna SKU associata.';
                bloccoSku.appendChild(vuoto);
            } else {
                nodo.skuList.forEach((sku) => {
                    bloccoSku.appendChild(renderRigaSkuDettaglio(sku, nodo, container, padreId));
                });
            }

            card.appendChild(bloccoSku);
        }

        if (nodo.tipo === 'COMPOSTO' && Array.isArray(nodo.figli) && nodo.figli.length > 0) {
            const figliWrap = document.createElement('div');
            figliWrap.style.marginTop = '0.85rem';
            figliWrap.style.paddingLeft = '1rem';

            nodo.figli.forEach((figlio) => {
                figliWrap.appendChild(renderNodoDettaglioProdotto(figlio, nodo.id, container));
            });

            card.appendChild(figliWrap);
        }

        return card;
    }

    function renderRigaSkuDettaglio(sku, prodottoPadre, container) {
        const riga = document.createElement('div');
        riga.className = 'tree-sku-row';

        const bloccoInfo = document.createElement('div');
        bloccoInfo.className = 'tree-meta';

        bloccoInfo.appendChild(
            creaRigaCampoSku('Codice', sku.codice, async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'codice', nuovoValore);
                await rerenderDopoUpdateSku(aggiornato, prodottoPadre.id, container);
            })
        );

        bloccoInfo.appendChild(
            creaRigaCampoSku('Nome', sku.nome, async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'nome', nuovoValore);
                await rerenderDopoUpdateSku(aggiornato, prodottoPadre.id, container);
            })
        );

        bloccoInfo.appendChild(
            creaRigaCampoSku('Prezzo', formattaPrezzo(sku.prezzo), async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'prezzo', nuovoValore);
                await rerenderDopoUpdateSku(aggiornato, prodottoPadre.id, container);
            })
        );

        riga.appendChild(bloccoInfo);

        const azioni = document.createElement('div');
        azioni.className = 'tree-actions';

        const getSkuCount = () => {
            if (Array.isArray(prodottoPadre.skuList)) {
                return prodottoPadre.skuList.length;
            }
            return container?.querySelectorAll?.('.tree-sku-row')?.length || 0;
        };

        const mostraMessaggio = mostraMessaggioGlobale;

        const mostraErroreUltimaSku = (testo) => {
            mostraMessaggio(testo, 'error');
        };

        const bottoneRimuovi = document.createElement('button');
        bottoneRimuovi.type = 'button';
        bottoneRimuovi.className = 'btn btn-action btn-warning btn-sm';
        bottoneRimuovi.textContent = '-';
        bottoneRimuovi.title = 'Rimuovi';
        bottoneRimuovi.addEventListener('click', async () => {
            if (getSkuCount() <= 1) {
                mostraErroreUltimaSku('Non puoi rimuovere l\'ultima SKU di un prodotto semplice.');
                return;
            }

            const conferma = window.confirm(
                'Vuoi rimuovere questa SKU dal prodotto semplice?'
            );
            if (!conferma) {
                return;
            }

            try {
                const aggiornato = await rimuoviAssociazioneProdottoSku(
                    prodottoPadre.id,
                    sku.id
                );

                if (window.appFornitore.getSezioneCorrente?.() === 'ricerca'
                    && window.ricercaPage
                    && typeof window.ricercaPage.rimuoviRisultatoDaLista === 'function') {
                    window.ricercaPage.rimuoviRisultatoDaLista(sku.id, 'SKU');
                }

                mostraMessaggio(
                    'SKU rimossa dal prodotto.',
                    'success'
                );

                if (aggiornato) {
                    mostraDettaglioProdottoCreato(aggiornato, container);
                } else {
                    await refreshContenitoreDaPadre(prodottoPadre.id, container);
                }

                await Promise.all([
                    caricaProdottiDisponibili(),
                    caricaSkuDisponibili()
                ]);
            } catch (error) {
                console.error('[prodotto.js] errore rimozione SKU:', error);
                mostraMessaggio(
                    error.message || 'Errore durante la rimozione della SKU.',
                    'error'
                );
            }
        });

        azioni.appendChild(bottoneRimuovi);

        const bottoneElimina = document.createElement('button');
        bottoneElimina.type = 'button';
        bottoneElimina.className = 'btn btn-action btn-danger btn-sm';
        bottoneElimina.textContent = '-*';
        bottoneElimina.title = 'Elimina';
        bottoneElimina.addEventListener('click', async () => {
            if (getSkuCount() <= 1) {
                mostraErroreUltimaSku('Non puoi eliminare l\'ultima SKU di un prodotto semplice.');
                return;
            }

            const conferma = window.confirm('Vuoi eliminare definitivamente questa SKU?');
            if (!conferma) {
                return;
            }

            try {
                const risultato = await eliminaOggetto(sku.id, 'SKU', prodottoPadre.id);

                if (window.appFornitore.getSezioneCorrente?.() === 'ricerca'
                    && window.ricercaPage
                    && typeof window.ricercaPage.rimuoviRisultatoDaLista === 'function') {
                    window.ricercaPage.rimuoviRisultatoDaLista(sku.id, 'SKU');
                }

                mostraMessaggio(
                    'SKU eliminata con successo.',
                    'success'
                );

                if (risultato && risultato.prodottoAggiornato) {
                    mostraDettaglioProdottoCreato(risultato.prodottoAggiornato, container);
                } else {
                    await refreshContenitoreDaPadre(prodottoPadre.id, container);
                }

                await Promise.all([
                    caricaProdottiDisponibili(),
                    caricaSkuDisponibili()
                ]);
            } catch (error) {
                console.error('[prodotto.js] errore eliminazione SKU:', error);
                mostraMessaggio(
                    error.message || 'Errore durante l\'eliminazione della SKU.',
                    'error'
                );
            }
        });

        azioni.appendChild(bottoneElimina);
        riga.appendChild(azioni);

        return riga;
    }

    async function rerenderDopoUpdateSku(rispostaAggiornamento, prodottoPadreId, container) {
        if (rispostaAggiornamento && rispostaAggiornamento.id && rispostaAggiornamento.tipo) {
            mostraDettaglioProdottoCreato(rispostaAggiornamento, container);
            return;
        }

        if (rispostaAggiornamento && rispostaAggiornamento.prodottoAggiornato) {
            mostraDettaglioProdottoCreato(rispostaAggiornamento.prodottoAggiornato, container);
            return;
        }

        await refreshContenitoreDaPadre(prodottoPadreId, container);
    }

    async function refreshContenitoreDaPadre(prodottoId, container) {
        if (!prodottoId || !container) {
            return;
        }

        try {
            const prodottoAggiornato = await caricaDettaglioProdotto(prodottoId, 'SEMPLICE');
            mostraDettaglioProdottoCreato(prodottoAggiornato, container);
        } catch (error) {
            try {
                const prodottoAggiornato = await caricaDettaglioProdotto(prodottoId, 'COMPOSTO');
                mostraDettaglioProdottoCreato(prodottoAggiornato, container);
            } catch (secondoErrore) {
                console.error('[prodotto.js] errore refresh contenitore:', secondoErrore);
            }
        }
    }

    function renderBuilder() {
        // Ridisegna completamente la bozza corrente del builder nel pannello dettaglio.
        if (!dettaglioContent || !builderState) {
            return;
        }

        dettaglioContent.innerHTML = '';

        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = 'Builder prodotto composto';
        wrapper.appendChild(titolo);

        wrapper.appendChild(
            creaRigaBuilderRoot('Nome', builderState.nome, async (valore) => {
                builderState.nome = valore;
                renderBuilder();
            })
        );

        wrapper.appendChild(
            creaRigaBuilderRoot('Codice', builderState.codice, async (valore) => {
                const codiceNumerico = Number(valore);
                if (!Number.isInteger(codiceNumerico) || codiceNumerico < 0) {
                    window.appFornitore.mostraMessaggioHome(
                        'Il codice del prodotto composto non è valido.',
                        'error'
                    );
                    throw new Error('Codice non valido');
                }

                builderState.codice = codiceNumerico;
                renderBuilder();
            })
        );

        wrapper.appendChild(
            creaRigaBuilderRoot('Descrizione', builderState.descrizione, async (valore) => {
                builderState.descrizione = valore;
                renderBuilder();
            })
        );

        const codice = document.createElement('p');
        codice.innerHTML = `Codice: ${escapeHtml(builderState.codice)}`;
        wrapper.appendChild(codice);

        const tipo = document.createElement('p');
        tipo.innerHTML = 'Tipo: COMPOSTO';
        wrapper.appendChild(tipo);

        const titoloStruttura = document.createElement('h4');
        titoloStruttura.className = 'section-title';
        titoloStruttura.style.marginTop = '1.25rem';
        titoloStruttura.textContent = 'Struttura prodotto';
        wrapper.appendChild(titoloStruttura);

        wrapper.appendChild(renderBuilderNode(builderState, true));

        const azioni = document.createElement('div');
        azioni.className = 'actions-row';
        azioni.style.marginTop = '1rem';

        const bottoneSalva = document.createElement('button');
        bottoneSalva.type = 'button';
        bottoneSalva.className = 'btn btn-primary';
        bottoneSalva.textContent = 'SALVA PRODOTTO';
        bottoneSalva.addEventListener('click', onSalvaBuilder);

        const bottoneAnnulla = document.createElement('button');
        bottoneAnnulla.type = 'button';
        bottoneAnnulla.className = 'btn btn-secondary';
        bottoneAnnulla.textContent = 'Annulla bozza';
        bottoneAnnulla.addEventListener('click', () => {
            const conferma = window.confirm('Vuoi annullare la bozza del prodotto composto?');
            if (!conferma) {
                return;
            }

            builderState = null;
            dettaglioContent.innerHTML =
                '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';

            window.appFornitore.mostraMessaggioHome('Bozza annullata.', 'success');
        });

        azioni.appendChild(bottoneSalva);
        azioni.appendChild(bottoneAnnulla);
        wrapper.appendChild(azioni);

        dettaglioContent.appendChild(wrapper);
    }

    function renderBuilderNode(nodo, isRoot) {
        // Ogni render del builder produce una card ad albero con azioni contestuali.
        const card = document.createElement('div');
        card.className = 'tree-node';
        card.style.marginTop = '0.75rem';

        const header = document.createElement('div');
        header.className = 'tree-meta';

        const titolo = document.createElement('div');
        titolo.textContent = `${nodo.nome} - ${nodo.codice} - ${nodo.tipo}`;
        header.appendChild(titolo);
        card.appendChild(header);

        const meta = document.createElement('p');
        meta.className = 'muted';
        meta.style.marginTop = '0.35rem';
        meta.textContent =
            nodo.tipo === 'COMPOSTO'
                ? `Sottoprodotti: ${Array.isArray(nodo.figli) ? nodo.figli.length : 0}`
                : `SKU associate: ${Array.isArray(nodo.skuList) ? nodo.skuList.length : 0}`;
        card.appendChild(meta);

        const azioni = document.createElement('div');
        azioni.className = 'actions-row';
        azioni.style.marginTop = '0.75rem';

        const btnRemove = creaBottoneAzione('-', 'btn-warning btn-sm', 'Scollega dal padre');
        btnRemove.disabled = !!isRoot;
        btnRemove.addEventListener('click', () => rimuoviNodoDalBuilder(nodo.clientId));

        const btnAdd = creaBottoneAzione('+', 'btn-success btn-sm', 'Aggiungi sottoelemento');

        const btnDelete = creaBottoneAzione('-*', 'btn-danger btn-sm', 'Elimina nodo e discendenti');
        btnDelete.addEventListener('click', () => {
            if (isRoot) {
                eliminaBozzaBuilder();
                return;
            }
            eliminaNodoDalBuilder(nodo.clientId);
        });

        azioni.appendChild(btnAdd);
        if (!isRoot) {
            azioni.appendChild(btnRemove);
            azioni.appendChild(btnDelete);
        }
        const menu = document.createElement('div');
        menu.className = 'actions-menu';
        menu.hidden = true;

        if (nodo.tipo === 'COMPOSTO') {
            menu.appendChild(creaVoceMenu('Sottoprodotto semplice', () => {
                aggiungiFiglioSemplice(nodo.clientId);
                menu.hidden = true;
            }));

            menu.appendChild(creaVoceMenu('Sottoprodotto composto', () => {
                aggiungiFiglioComposto(nodo.clientId);
                menu.hidden = true;
            }));
        }

        if (nodo.tipo === 'SEMPLICE') {
            menu.appendChild(creaVoceMenu('SKU esistente', () => {
                aggiungiSkuEsistente(nodo.clientId);
                menu.hidden = true;
            }));

            menu.appendChild(creaVoceMenu('Nuova SKU', () => {
                aggiungiSkuNuova(nodo.clientId);
                menu.hidden = true;
            }));
        }

        btnAdd.addEventListener('click', () => {
            if (!menu.childElementCount) {
                return;
            }
            menu.hidden = !menu.hidden;
        });

        card.appendChild(azioni);
        card.appendChild(menu);

        // Solo i semplici possono ricevere SKU nel builder.
        if (nodo.tipo === 'SEMPLICE') {
            const bloccoSku = document.createElement('div');
            bloccoSku.style.marginTop = '0.85rem';

            const titoloSku = document.createElement('div');
            titoloSku.className = 'muted';
            titoloSku.textContent = 'SKU associate';
            bloccoSku.appendChild(titoloSku);

            if (!nodo.skuList || nodo.skuList.length === 0) {
                const vuoto = document.createElement('p');
                vuoto.className = 'muted';
                vuoto.textContent = 'Nessuna SKU associata.';
                bloccoSku.appendChild(vuoto);
            } else {
                nodo.skuList.forEach((sku) => {
                    const riga = document.createElement('div');
                    riga.className = 'tree-sku-row';

                    const info = document.createElement('div');
                    info.className = 'tree-meta';
                    info.textContent = `${sku.codice} - ${sku.nome || 'Nuova SKU'} - €${formattaPrezzo(sku.prezzo)}`;

                    const azioniSku = document.createElement('div');
                    azioniSku.className = 'tree-actions';

                    const bottoneRimuoviSku = creaBottoneAzione('-', 'btn-warning btn-sm', 'Rimuovi SKU dal prodotto');
                    bottoneRimuoviSku.addEventListener('click', () => {
                        rimuoviSkuDalBuilder(nodo, sku);
                    });

                    const bottoneEliminaSku = creaBottoneAzione('-*', 'btn-danger btn-sm', 'Elimina SKU');
                    bottoneEliminaSku.addEventListener('click', () => {
                        eliminaSkuDalBuilder(nodo, sku);
                    });

                    azioniSku.appendChild(bottoneRimuoviSku);
                    azioniSku.appendChild(bottoneEliminaSku);
                    riga.appendChild(info);
                    riga.appendChild(azioniSku);
                    bloccoSku.appendChild(riga);
                });
            }

            card.appendChild(bloccoSku);
        }

        if (nodo.tipo === 'COMPOSTO' && Array.isArray(nodo.figli) && nodo.figli.length > 0) {
            const figliWrap = document.createElement('div');
            figliWrap.style.marginTop = '0.85rem';
            figliWrap.style.paddingLeft = '1rem';

            nodo.figli.forEach((figlio) => {
                figliWrap.appendChild(renderBuilderNode(figlio, false));
            });

            card.appendChild(figliWrap);
        }

        return card;
    }

    function creaRigaCampoProdotto(etichetta, valoreIniziale, onSalva) {
        const riga = document.createElement('p');

        const label = document.createElement('strong');
        label.textContent = `${etichetta}: `;
        riga.appendChild(label);

        const spanValore = document.createElement('span');
        spanValore.textContent = valoreIniziale || '-';
        spanValore.style.cursor = 'pointer';
        spanValore.title = 'Clicca per modificare';
        riga.appendChild(spanValore);

        spanValore.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = valoreIniziale ?? '';
            input.className = 'form-control';
            input.style.maxWidth = '260px';

            riga.replaceChild(input, spanValore);
            input.focus();
            if (typeof input.select === 'function') {
                input.select();
            }

            let ripristinato = false;

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    ripristinato = true;
                    riga.replaceChild(spanValore, input);
                }
            });

            input.addEventListener(
                'blur',
                async () => {
                    if (ripristinato) {
                        return;
                    }

                    const nuovoValore = input.value.trim();

                    try {
                        await onSalva(nuovoValore);
                    } catch (error) {
                        riga.replaceChild(spanValore, input);
                    }
                },
                { once: true }
            );
        });

        return riga;
    }

    function creaRigaCampoSku(etichetta, valoreIniziale, onSalva) {
        const riga = document.createElement('p');
        riga.style.margin = '0';

        const label = document.createElement('strong');
        label.textContent = `${etichetta}: `;
        riga.appendChild(label);

        const spanValore = document.createElement('span');
        spanValore.textContent = valoreIniziale || '-';
        spanValore.style.cursor = 'pointer';
        spanValore.title = 'Clicca per modificare';
        riga.appendChild(spanValore);

        spanValore.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = valoreIniziale ?? '';
            input.className = 'form-control';
            input.style.maxWidth = '220px';

            riga.replaceChild(input, spanValore);
            input.focus();
            if (typeof input.select === 'function') {
                input.select();
            }

            let ripristinato = false;

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    ripristinato = true;
                    riga.replaceChild(spanValore, input);
                }
            });

            input.addEventListener(
                'blur',
                async () => {
                    if (ripristinato) {
                        return;
                    }

                    const nuovoValore = input.value.trim();

                    try {
                        await onSalva(nuovoValore);
                    } catch (error) {
                        riga.replaceChild(spanValore, input);
                    }
                },
                { once: true }
            );
        });

        return riga;
    }

    function creaRigaBuilderRoot(etichetta, valoreIniziale, onSalva) {
        const riga = document.createElement('p');

        const label = document.createElement('strong');
        label.textContent = `${etichetta}: `;
        riga.appendChild(label);

        const spanValore = document.createElement('span');
        spanValore.textContent = valoreIniziale || '-';
        spanValore.style.cursor = 'pointer';
        spanValore.title = 'Clicca per modificare';
        riga.appendChild(spanValore);

        spanValore.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = valoreIniziale ?? '';
            input.className = 'form-control';
            input.style.maxWidth = '260px';

            riga.replaceChild(input, spanValore);
            input.focus();
            if (typeof input.select === 'function') {
                input.select();
            }

            let ripristinato = false;

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    ripristinato = true;
                    riga.replaceChild(spanValore, input);
                }
            });

            input.addEventListener(
                'blur',
                async () => {
                    if (ripristinato) {
                        return;
                    }

                    const nuovoValore = input.value.trim();

                    try {
                        await onSalva(nuovoValore);
                    } catch (error) {
                        riga.replaceChild(spanValore, input);
                    }
                },
                { once: true }
            );
        });

        return riga;
    }

    function creaBottoneAzione(testo, className, title) {
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = `btn btn-action ${className}`.trim();
        bottone.textContent = testo;
        if (title) {
            bottone.title = title;
        }
        return bottone;
    }

    function creaVoceMenu(testo, onClick) {
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = 'btn btn-ghost btn-sm';
        bottone.textContent = testo;
        bottone.addEventListener('click', onClick);
        return bottone;
    }

    function eliminaBozzaBuilder() {
        const conferma = window.confirm('Vuoi eliminare l\'intera bozza del prodotto composto?');
        if (!conferma) {
            return;
        }

        builderState = null;
        if (dettaglioContent) {
            dettaglioContent.innerHTML =
                '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';
        }

        window.appFornitore.mostraMessaggioHome('Bozza annullata.', 'success');
    }

    function mappaProdottoEsistentePerBuilder(prodotto) {
        // Converte il prodotto restituito dal backend in un nodo del builder.
        // L'id resta quello originale perché il prodotto non viene duplicato: nel builder
        // stiamo solo preparando il collegamento e mostrando il sottoalbero reale.
        if (!prodotto) {
            return null;
        }

        if (prodotto.tipo === 'SEMPLICE') {
            return {
                clientId: nextBuilderNodeId(),
                id: prodotto.id,
                codice: Number(prodotto.codice),
                nome: prodotto.nome,
                tipo: 'SEMPLICE',
                skuList: Array.isArray(prodotto.skuList)
                    ? prodotto.skuList.map((sku) => ({
                        clientSkuId: nextBuilderSkuId(),
                        id: sku.id,
                        codice: sku.codice,
                        nome: sku.nome,
                        descrizioneTecnica: sku.descrizioneTecnica,
                        prezzo: Number(sku.prezzo || 0)
                    }))
                    : []
            };
        }

        return {
            clientId: nextBuilderNodeId(),
            id: prodotto.id,
            codice: Number(prodotto.codice),
            nome: prodotto.nome,
            tipo: 'COMPOSTO',
            descrizione: prodotto.descrizione,
            prezzoMin: Number(prodotto.prezzoMin || 0),
            prezzoMax: Number(prodotto.prezzoMax || 0),
            figli: Array.isArray(prodotto.figli)
                ? prodotto.figli.map(mappaProdottoEsistentePerBuilder).filter(Boolean)
                : []
        };
    }

    function aggiungiFiglioSemplice(parentClientId) {
        // Aggiunge un nuovo prodotto semplice creato solo nella bozza locale.
        const padre = trovaNodoBuilder(builderState, parentClientId);
        if (!padre || padre.tipo !== 'COMPOSTO') {
            return;
        }

        const codice = window.prompt('Codice del nuovo prodotto semplice');
        if (codice === null) {
            return;
        }

        const nome = window.prompt('Nome del nuovo prodotto semplice');
        if (nome === null) {
            return;
        }

        if (!Number.isInteger(Number(codice)) || Number(codice) < 0 || !nome.trim()) {
            window.appFornitore.mostraMessaggioHome(
                'Dati del nuovo prodotto semplice non validi.',
                'error'
            );
            return;
        }

        padre.figli.push({
            clientId: nextBuilderNodeId(),
            id: null,
            codice: Number(codice),
            nome: nome.trim(),
            tipo: 'SEMPLICE',
            skuList: []
        });

        renderBuilder();
    }

    function aggiungiFiglioComposto(parentClientId) {
        // Aggiunge un nuovo prodotto composto creato solo nella bozza locale.
        const padre = trovaNodoBuilder(builderState, parentClientId);
        if (!padre || padre.tipo !== 'COMPOSTO') {
            return;
        }

        const codice = window.prompt('Codice del nuovo prodotto composto');
        if (codice === null) {
            return;
        }

        const nome = window.prompt('Nome del nuovo prodotto composto');
        if (nome === null) {
            return;
        }

        const descrizione = window.prompt('Descrizione del nuovo prodotto composto');
        if (descrizione === null) {
            return;
        }

        const prezzoMin = window.prompt('Prezzo minimo del nuovo prodotto composto');
        if (prezzoMin === null) {
            return;
        }

        const prezzoMax = window.prompt('Prezzo massimo del nuovo prodotto composto');
        if (prezzoMax === null) {
            return;
        }

        if (
            !Number.isInteger(Number(codice)) ||
            Number(codice) < 0 ||
            !nome.trim() ||
            !descrizione.trim() ||
            Number.isNaN(Number(prezzoMin)) ||
            Number.isNaN(Number(prezzoMax)) ||
            Number(prezzoMin) < 0 ||
            Number(prezzoMax) < 0 ||
            Number(prezzoMin) > Number(prezzoMax)
        ) {
            window.appFornitore.mostraMessaggioHome(
                'Dati del nuovo prodotto composto non validi.',
                'error'
            );
            return;
        }

        padre.figli.push({
            clientId: nextBuilderNodeId(),
            id: null,
            codice: Number(codice),
            nome: nome.trim(),
            tipo: 'COMPOSTO',
            descrizione: descrizione.trim(),
            prezzoMin: Number(prezzoMin),
            prezzoMax: Number(prezzoMax),
            figli: []
        });

        renderBuilder();
    }

    async function aggiungiFiglioEsistente(nodeClientId) {
        const nodo = trovaNodoBuilder(builderState, nodeClientId);
        if (!nodo || nodo.tipo !== 'COMPOSTO') {
            return;
        }

        const candidati = prodottiDisponibiliCache.filter((prodotto) => {
            if (!prodotto || prodotto.id == null) {
                return false;
            }

            // Un prodotto esistente è selezionabile solo se non ha già un padre.
            if (prodotto.padreId != null) {
                return false;
            }

            // Inoltre non deve essere già presente nel builder corrente.
            return !esisteProdottoConIdNelBuilder(builderState, prodotto.id);
        });

        if (!candidati.length) {
            window.appFornitore.mostraMessaggioHome(
                'Non ci sono prodotti top-level disponibili da aggiungere.',
                'error'
            );
            return;
        }

        const elenco = candidati
            .map((prodotto) => `${prodotto.id} - ${prodotto.nome} - ${prodotto.codice} - ${prodotto.tipo}`)
            .join('\n');

        const scelta = window.prompt(
            `Inserisci l'id del prodotto esistente da collegare:\n\n${elenco}`
        );

        if (scelta === null) {
            return;
        }

        const selezionato = candidati.find(
            (prodotto) => String(prodotto.id) === String(scelta.trim())
        );

        if (!selezionato) {
            window.appFornitore.mostraMessaggioHome(
                'Prodotto selezionato non valido.',
                'error'
            );
            return;
        }

        try {
            const prodottoCompleto = await caricaDettaglioProdotto(
                selezionato.id,
                selezionato.tipo
            );

            // Carichiamo l'albero completo del prodotto esistente così il builder mostra
            // davvero tutti i suoi discendenti già presenti a database.
            const nodoEsistente = mappaProdottoEsistentePerBuilder(prodottoCompleto);

            if (!nodoEsistente) {
                window.appFornitore.mostraMessaggioHome(
                    'Impossibile aggiungere il prodotto selezionato.',
                    'error'
                );
                return;
            }

            // Aggiungiamo al builder un riferimento reale al prodotto esistente.
            // Più avanti sistemeremo la servlet per ignorare i figli in persistenza
            // quando il nodo ha già un id, usandoli solo per la visualizzazione.
            nodo.figli.push(nodoEsistente);
            renderBuilder();
        } catch (error) {
            console.error('[prodotto.js] errore aggiunta prodotto esistente:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante il caricamento del prodotto esistente.',
                'error'
            );
        }
    }

    function aggiungiSkuEsistente(nodeClientId) {
        // Associa al semplice corrente una SKU già esistente a catalogo.
        const nodo = trovaNodoBuilder(builderState, nodeClientId);
        if (!nodo || nodo.tipo !== 'SEMPLICE') {
            return;
        }

        if (!skuDisponibiliCache.length) {
            window.appFornitore.mostraMessaggioHome(
                'Non ci sono SKU disponibili da associare.',
                'error'
            );
            return;
        }

        const elenco = skuDisponibiliCache
            .map((sku) => `${sku.id} - ${sku.codice} - ${sku.nome} - €${formattaPrezzo(sku.prezzo)}`)
            .join('\n');

        const scelta = window.prompt(
            `Inserisci l'id della SKU da associare:\n\n${elenco}`
        );

        if (scelta === null) {
            return;
        }

        const skuSelezionata = skuDisponibiliCache.find(
            (sku) => String(sku.id) === String(scelta.trim())
        );

        if (!skuSelezionata) {
            window.appFornitore.mostraMessaggioHome(
                'SKU selezionata non valida.',
                'error'
            );
            return;
        }

        if (nodo.skuList.some((sku) => sku.id === skuSelezionata.id)) {
            window.appFornitore.mostraMessaggioHome(
                'Questa SKU è già associata al prodotto semplice.',
                'error'
            );
            return;
        }

        nodo.skuList.push({
            clientSkuId: nextBuilderSkuId(),
            id: skuSelezionata.id,
            codice: skuSelezionata.codice,
            nome: skuSelezionata.nome,
            descrizioneTecnica: skuSelezionata.descrizioneTecnica,
            prezzo: skuSelezionata.prezzo
        });

        renderBuilder();
    }

    function aggiungiSkuNuova(nodeClientId) {
        // Crea una nuova SKU nella bozza del builder, senza persisterla subito.
        const nodo = trovaNodoBuilder(builderState, nodeClientId);
        if (!nodo || nodo.tipo !== 'SEMPLICE') {
            return;
        }

        const codice = window.prompt('Codice della nuova SKU');
        if (codice === null) {
            return;
        }

        const nome = window.prompt('Nome della nuova SKU');
        if (nome === null) {
            return;
        }

        const descrizioneTecnica = window.prompt('Descrizione tecnica della nuova SKU');
        if (descrizioneTecnica === null) {
            return;
        }

        const prezzo = window.prompt('Prezzo della nuova SKU');
        if (prezzo === null) {
            return;
        }

        if (
            !Number.isInteger(Number(codice)) ||
            Number(codice) < 0 ||
            !nome.trim() ||
            !descrizioneTecnica.trim() ||
            Number.isNaN(Number(prezzo)) ||
            Number(prezzo) < 0
        ) {
            window.appFornitore.mostraMessaggioHome(
                'Dati della nuova SKU non validi.',
                'error'
            );
            return;
        }

        if (nodo.skuList.some((sku) => Number(sku.codice) === Number(codice))) {
            window.appFornitore.mostraMessaggioHome(
                'Nel nodo è già presente una SKU con questo codice.',
                'error'
            );
            return;
        }

        nodo.skuList.push({
            clientSkuId: nextBuilderSkuId(),
            id: null,
            codice: Number(codice),
            nome: nome.trim(),
            descrizioneTecnica: descrizioneTecnica.trim(),
            prezzo: Number(prezzo)
        });

        renderBuilder();
    }

    function rimuoviNodoDalBuilder(clientId) {
        if (!builderState || builderState.clientId === clientId) {
            return;
        }

        const conferma = window.confirm('Vuoi rimuovere questo sottoprodotto dalla bozza?');
        if (!conferma) {
            return;
        }

        removeNodeByClientId(builderState, clientId);
        renderBuilder();
    }

    function eliminaNodoDalBuilder(clientId) {
        if (!builderState || builderState.clientId === clientId) {
            return;
        }

        const nodo = trovaNodoBuilder(builderState, clientId);
        if (!nodo) {
            return;
        }

        const conferma = window.confirm(
            'Vuoi eliminare questo nodo e tutti i suoi discendenti dalla bozza?'
        );
        if (!conferma) {
            return;
        }

        registraEliminazioneProdotto(nodo);
        removeNodeByClientId(builderState, clientId);
        renderBuilder();
    }

    function registraEliminazioneProdotto(nodo) {
        if (!builderState || !nodo) {
            return;
        }

        if (!builderState.deletedProductIds) {
            builderState.deletedProductIds = new Set();
        }

        if (nodo.id != null) {
            builderState.deletedProductIds.add(nodo.id);
        }

        if (nodo.tipo === 'COMPOSTO' && Array.isArray(nodo.figli)) {
            nodo.figli.forEach((figlio) => registraEliminazioneProdotto(figlio));
        }
    }

    function rimuoviSkuDalBuilder(nodo, sku) {
        if (!nodo || !Array.isArray(nodo.skuList)) {
            return;
        }

        nodo.skuList = nodo.skuList.filter((item) => item.clientSkuId !== sku.clientSkuId);
        renderBuilder();
    }

    function eliminaSkuDalBuilder(nodo, sku) {
        if (!nodo || !Array.isArray(nodo.skuList)) {
            return;
        }

        const conferma = window.confirm('Vuoi eliminare questa SKU dalla bozza?');
        if (!conferma) {
            return;
        }

        if (!builderState.deletedSkuIds) {
            builderState.deletedSkuIds = new Set();
        }

        if (sku.id != null) {
            builderState.deletedSkuIds.add(sku.id);
        }

        nodo.skuList = nodo.skuList.filter((item) => item.clientSkuId !== sku.clientSkuId);
        renderBuilder();
    }

    async function onSalvaBuilder() {
        // Serializza la bozza e la invia alla servlet che creerà il prodotto composto finale.
        if (!builderState) {
            window.appFornitore.mostraMessaggioHome(
                'Nessuna bozza presente da salvare.',
                'error'
            );
            return;
        }

        const errore = validaBuilder(builderState, 1);
        if (errore) {
            window.appFornitore.mostraMessaggioHome(errore, 'error');
            return;
        }

        const payload = serializzaNodoBuilder(builderState);
        payload.eliminaProdotti = Array.from(builderState.deletedProductIds || []);
        payload.eliminaSku = Array.from(builderState.deletedSkuIds || []);

        try {
            const response = await fetch('apifornitoreprodottocrea', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            builderState = null;

            window.appFornitore.mostraMessaggioHome(
                'Prodotto composto salvato con successo.',
                'success'
            );

            if (formProdottoComposto) {
                formProdottoComposto.reset();
            }

            if (data) {
                mostraDettaglioProdottoCreato(data);
            } else if (dettaglioContent) {
                dettaglioContent.innerHTML = '<p class="muted">Prodotto salvato correttamente.</p>';
            }

            await Promise.all([
                caricaProdottiDisponibili(),
                caricaSkuDisponibili()
            ]);
        } catch (error) {
            console.error('[prodotto.js] errore salvataggio builder:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante il salvataggio del prodotto composto.',
                'error'
            );
        }
    }

    function validaBuilder(nodo, profondita) {
        if (!nodo) {
            return 'La bozza del prodotto non è valida.';
        }

        if (profondita > 4) {
            return 'Profondità massima superata.';
        }

        if (!nodo.nome || !String(nodo.nome).trim()) {
            return 'Ogni prodotto deve avere un nome.';
        }

        if (!Number.isInteger(Number(nodo.codice)) || Number(nodo.codice) < 0) {
            return 'Ogni prodotto deve avere un codice valido.';
        }

        // Solo i composti possono contenere altri sottoprodotti.
        if (nodo.tipo === 'COMPOSTO') {
            if (!nodo.descrizione || !String(nodo.descrizione).trim()) {
                return 'Ogni prodotto composto deve avere una descrizione.';
            }

            if (
                Number.isNaN(Number(nodo.prezzoMin)) ||
                Number(nodo.prezzoMin) < 0 ||
                Number.isNaN(Number(nodo.prezzoMax)) ||
                Number(nodo.prezzoMax) < 0
            ) {
                return 'La fascia prezzo di un prodotto composto non è valida.';
            }

            if (Number(nodo.prezzoMin) > Number(nodo.prezzoMax)) {
                return 'Il prezzo minimo non può superare il massimo.';
            }

            if (!Array.isArray(nodo.figli) || nodo.figli.length === 0) {
                return 'Ogni prodotto composto deve avere almeno un sottoprodotto.';
            }

            for (const figlio of nodo.figli) {
                const erroreFiglio = validaBuilder(figlio, profondita + 1);
                if (erroreFiglio) {
                    return erroreFiglio;
                }
            }
        }

        // Solo i semplici possono ricevere SKU nel builder.
        if (nodo.tipo === 'SEMPLICE') {
            if (!Array.isArray(nodo.skuList) || nodo.skuList.length === 0) {
                return `Il prodotto semplice ${nodo.nome} deve avere almeno una SKU.`;
            }

            for (const sku of nodo.skuList) {
                if (sku.id == null) {
                    if (!Number.isInteger(Number(sku.codice)) || Number(sku.codice) < 0) {
                        return 'Una nuova SKU ha un codice non valido.';
                    }

                    if (
                        !sku.nome ||
                        !String(sku.nome).trim() ||
                        !sku.descrizioneTecnica ||
                        !String(sku.descrizioneTecnica).trim()
                    ) {
                        return 'Compila tutti i campi delle nuove SKU.';
                    }

                    if (Number.isNaN(Number(sku.prezzo)) || Number(sku.prezzo) < 0) {
                        return 'Il prezzo di una nuova SKU non è valido.';
                    }
                }
            }
        }

        return null;
    }

    function serializzaNodoBuilder(nodo) {
        // Solo i semplici possono ricevere SKU nel builder.
        if (nodo.tipo === 'SEMPLICE') {
            return {
                id: nodo.id ?? null,
                codice: Number(nodo.codice),
                nome: nodo.nome,
                tipo: 'SEMPLICE',
                skuList: nodo.skuList.map((sku) => ({
                    id: sku.id ?? null,
                    codice: sku.id ? null : Number(sku.codice),
                    nome: sku.id ? null : sku.nome,
                    descrizioneTecnica: sku.id ? null : sku.descrizioneTecnica,
                    prezzo: sku.id ? null : Number(sku.prezzo)
                }))
            };
        }

        return {
            id: nodo.id ?? null,
            codice: Number(nodo.codice),
            nome: nodo.nome,
            tipo: 'COMPOSTO',
            descrizione: nodo.descrizione,
            prezzoMin: Number(nodo.prezzoMin),
            prezzoMax: Number(nodo.prezzoMax),
            figli: nodo.figli.map(serializzaNodoBuilder)
        };
    }

    function trovaNodoBuilder(radice, clientId) {
        if (!radice) {
            return null;
        }

        if (radice.clientId === clientId) {
            return radice;
        }

        if (radice.tipo === 'COMPOSTO' && Array.isArray(radice.figli)) {
            for (const figlio of radice.figli) {
                const trovato = trovaNodoBuilder(figlio, clientId);
                if (trovato) {
                    return trovato;
                }
            }
        }

        return null;
    }

    function removeNodeByClientId(nodo, clientId) {
        if (!nodo || nodo.tipo !== 'COMPOSTO' || !Array.isArray(nodo.figli)) {
            return false;
        }

        const indice = nodo.figli.findIndex((figlio) => figlio.clientId === clientId);
        if (indice !== -1) {
            nodo.figli.splice(indice, 1);
            return true;
        }

        for (const figlio of nodo.figli) {
            const rimosso = removeNodeByClientId(figlio, clientId);
            if (rimosso) {
                return true;
            }
        }

        return false;
    }

    function esisteProdottoConIdNelBuilder(nodo, idProdotto) {
        if (!nodo || idProdotto == null) {
            return false;
        }

        if (nodo.id != null && Number(nodo.id) === Number(idProdotto)) {
            return true;
        }

        if (nodo.tipo === 'COMPOSTO' && Array.isArray(nodo.figli)) {
            return nodo.figli.some((figlio) =>
                esisteProdottoConIdNelBuilder(figlio, idProdotto)
            );
        }

        return false;
    }

    function nextBuilderNodeId() {
        builderNodeSeq += 1;
        return `builder-node-${builderNodeSeq}`;
    }

    function nextBuilderSkuId() {
        builderSkuSeq += 1;
        return `builder-sku-${builderSkuSeq}`;
    }

    async function aggiornaCampoProdotto(id, campo, valore) {
        const body = new URLSearchParams();
        body.append('id', id);
        body.append('campo', campo);
        body.append('valore', valore);

        const response = await fetch('apifornitoreprodottoaggiorna', {
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

    async function aggiornaCampoSku(id, campo, valore) {
        const body = new URLSearchParams();
        body.append('id', id);
        body.append('campo', campo);
        body.append('valore', valore);

        const response = await fetch('apifornitoreskuaggiorna', {
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

    async function rimuoviAssociazioneProdottoSku(prodottoId, skuId) {
        const body = new URLSearchParams();
        body.append('tipoRelazione', 'PRODOTTO_SKU');
        body.append('prodottoId', prodottoId);
        body.append('skuId', skuId);

        const response = await fetch('apifornitoreassociazionerimuovi', {
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

    async function rimuoviAssociazionePadreFiglio(figlioId, padreId) {
        const body = new URLSearchParams();
        body.append('tipoRelazione', 'PADRE_FIGLIO');
        body.append('figlioId', figlioId);
        body.append('padreId', padreId);

        const response = await fetch('apifornitoreassociazionerimuovi', {
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

    async function eliminaOggetto(id, tipo, returnProdottoId = null) {
        const body = new URLSearchParams();
        body.append('id', id);
        body.append('tipo', tipo);

        // se stiamo eliminando una SKU dal dettaglio di un prodotto semplice,
        // passiamo anche l'id del prodotto padre così il backend può restituire
        // il prodotto aggiornato già pronto da rerenderizzare
        if (returnProdottoId != null) {
            body.append('returnProdottoId', returnProdottoId);
        }

        const response = await fetch('apifornitoreoggettoelimina', {
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
    function formattaPrezzo(valore) {
        const numero = Number(valore);
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
        caricaProdottiDisponibili,
        caricaSkuDisponibili,
        mostraDettaglioProdottoCreato,
        renderDettaglioProdottoInContainer,
        getProdottiDisponibili() {
            return [...prodottiDisponibiliCache];
        }
    };
})();




