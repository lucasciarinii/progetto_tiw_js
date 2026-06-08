window.prodottoBuilder = (function () {
    function getState() {
        // Recupera lo stato condiviso del modulo prodotto.
        return window.prodottoPage.getState();
    }

    function nextBuilderNodeId() {
        // Genera un id client-side univoco per un nodo prodotto della bozza.
        const state = getState();
        state.builderNodeSeq += 1;
        return `builder-node-${state.builderNodeSeq}`;
    }

    function nextBuilderSkuId() {
        // Genera un id client-side univoco per una SKU della bozza.
        const state = getState();
        state.builderSkuSeq += 1;
        return `builder-sku-${state.builderSkuSeq}`;
    }

    function trovaNodoBuilder(radice, clientId) {
        // Cerca ricorsivamente un nodo del builder usando il clientId.
        if (!radice) return null;
        if (radice.clientId === clientId) return radice;

        if (radice.tipo === 'COMPOSTO' && Array.isArray(radice.figli)) {
            for (const figlio of radice.figli) {
                const trovato = trovaNodoBuilder(figlio, clientId);
                if (trovato) return trovato;
            }
        }

        return null;
    }

    function removeNodeByClientId(nodo, clientId) {
        // Rimuove un nodo dalla bozza cercandolo tra i figli del nodo corrente.
        if (!nodo || nodo.tipo !== 'COMPOSTO' || !Array.isArray(nodo.figli)) {
            return false;
        }

        const indice = nodo.figli.findIndex((figlio) => figlio.clientId === clientId);
        if (indice !== -1) {
            nodo.figli.splice(indice, 1);
            return true;
        }

        for (const figlio of nodo.figli) {
            if (removeNodeByClientId(figlio, clientId)) {
                return true;
            }
        }

        return false;
    }

    function registraEliminazioneProdotto(nodo) {
        // Memorizza gli id reali dei prodotti che andranno eliminati sul server.
        const state = getState();

        if (!state.builderState || !nodo) {
            return;
        }

        if (!state.builderState.deletedProductIds) {
            state.builderState.deletedProductIds = new Set();
        }

        // Registro solo i nodi già esistenti nel database.
        if (nodo.id != null) {
            state.builderState.deletedProductIds.add(nodo.id);
        }

        if (nodo.tipo === 'COMPOSTO' && Array.isArray(nodo.figli)) {
            nodo.figli.forEach(registraEliminazioneProdotto);
        }
    }

    function rimuoviNodoDalBuilder(clientId) {
        const state = getState();

        // La radice non si rimuove da qui.
        if (!state.builderState || state.builderState.clientId === clientId) {
            return;
        }

        const conferma = window.confirm('Vuoi rimuovere questo sottoprodotto dalla bozza?');
        if (!conferma) {
            return;
        }

        // Qui rimuovo solo il collegamento nella bozza locale.
        removeNodeByClientId(state.builderState, clientId);
        renderBuilder();
    }

    function eliminaNodoDalBuilder(clientId) {
        const state = getState();

        if (!state.builderState || state.builderState.clientId === clientId) {
            return;
        }

        const nodo = trovaNodoBuilder(state.builderState, clientId);
        if (!nodo) {
            return;
        }

        const conferma = window.confirm('Vuoi eliminare questo nodo e tutti i suoi discendenti dalla bozza?');
        if (!conferma) {
            return;
        }

        // Prima segno l'eliminazione reale lato server, poi tolgo il nodo dalla bozza.
        registraEliminazioneProdotto(nodo);
        removeNodeByClientId(state.builderState, clientId);
        renderBuilder();
    }

    function rimuoviSkuDalBuilder(nodo, sku) {
        // Rimuove una SKU dal prodotto semplice nella bozza,
        // senza segnarla per l'eliminazione dal database.
        if (!nodo || !Array.isArray(nodo.skuList)) {
            return;
        }

        nodo.skuList = nodo.skuList.filter((item) => item.clientSkuId !== sku.clientSkuId);
        renderBuilder();
    }

    function eliminaSkuDalBuilder(nodo, sku) {
        const state = getState();

        if (!nodo || !Array.isArray(nodo.skuList)) {
            return;
        }

        const conferma = window.confirm('Vuoi eliminare questa SKU dalla bozza?');
        if (!conferma) {
            return;
        }

        if (!state.builderState.deletedSkuIds) {
            state.builderState.deletedSkuIds = new Set();
        }

        // Se la SKU esiste già nel DB, la segno per l'eliminazione reale.
        if (sku.id != null) {
            state.builderState.deletedSkuIds.add(sku.id);
        }

        nodo.skuList = nodo.skuList.filter((item) => item.clientSkuId !== sku.clientSkuId);
        renderBuilder();
    }

    function validaBuilder(nodo, profondita) {
        // Valida ricorsivamente tutta la bozza prima del salvataggio.
        if (!nodo) return 'La bozza del prodotto non è valida.';
        if (profondita > 4) return 'Profondità massima superata.';
        if (!nodo.nome || !String(nodo.nome).trim()) return 'Ogni prodotto deve avere un nome.';
        if (!Number.isInteger(Number(nodo.codice)) || Number(nodo.codice) < 0) {
            return 'Ogni prodotto deve avere un codice valido.';
        }

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

        if (nodo.tipo === 'SEMPLICE') {
            if (!Array.isArray(nodo.skuList) || nodo.skuList.length === 0) {
                return `Il prodotto semplice ${nodo.nome} deve avere almeno una SKU.`;
            }

            // Le SKU nuove vanno validate tutte; per quelle già esistenti basta l'id.
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
        // Converte un nodo della bozza nel payload JSON per il server.
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

    function mappaProdottoEsistentePerBuilder(prodotto) {
        // Adatta un prodotto ricevuto dal server alla struttura usata nel builder.
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

    function renderBuilderNode(nodo, isRoot) {
        // Renderizza un nodo della bozza e, se serve, il suo sottoalbero.
        const card = document.createElement('div');
        card.className = 'tree-node';
        card.style.marginTop = '0.75rem';

        const titolo = document.createElement('h5');
        titolo.className = 'section-title';
        titolo.style.marginBottom = '0.5rem';
        titolo.textContent = nodo.tipo === 'COMPOSTO'
            ? 'Prodotto composto'
            : 'Prodotto semplice';
        card.appendChild(titolo);

        // Campi modificabili inline.
        card.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Nome', nodo.nome, async (valore) => {
                nodo.nome = valore;
                renderBuilder();
            })
        );

        card.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Codice', nodo.codice, async (valore) => {
                const numero = Number(valore);
                if (!Number.isInteger(numero) || numero < 0) {
                    throw new Error('Il codice del prodotto deve essere un intero non negativo.');
                }

                nodo.codice = numero;
                renderBuilder();
            })
        );

        if (nodo.tipo === 'COMPOSTO') {
            card.appendChild(
                window.prodottoUi.creaRigaCampoProdotto('Descrizione', nodo.descrizione, async (valore) => {
                    nodo.descrizione = valore;
                    renderBuilder();
                })
            );

            card.appendChild(
                window.prodottoUi.creaRigaCampoProdotto('Prezzo minimo', nodo.prezzoMin, async (valore) => {
                    const numero = Number(valore);
                    if (Number.isNaN(numero) || numero < 0) {
                        throw new Error('Il prezzo minimo non è valido.');
                    }

                    if (!Number.isNaN(Number(nodo.prezzoMax)) && numero > Number(nodo.prezzoMax)) {
                        throw new Error('Il prezzo minimo non può essere maggiore del prezzo massimo.');
                    }

                    nodo.prezzoMin = numero;
                    renderBuilder();
                })
            );

            card.appendChild(
                window.prodottoUi.creaRigaCampoProdotto('Prezzo massimo', nodo.prezzoMax, async (valore) => {
                    const numero = Number(valore);
                    if (Number.isNaN(numero) || numero < 0) {
                        throw new Error('Il prezzo massimo non è valido.');
                    }

                    if (!Number.isNaN(Number(nodo.prezzoMin)) && numero < Number(nodo.prezzoMin)) {
                        throw new Error('Il prezzo massimo non può essere minore del prezzo minimo.');
                    }

                    nodo.prezzoMax = numero;
                    renderBuilder();
                })
            );
        }

        const meta = document.createElement('p');
        meta.className = 'muted';
        meta.textContent = nodo.tipo === 'COMPOSTO'
            ? `Sottoprodotti: ${Array.isArray(nodo.figli) ? nodo.figli.length : 0}`
            : `SKU associate: ${Array.isArray(nodo.skuList) ? nodo.skuList.length : 0}`;
        card.appendChild(meta);

        const azioni = document.createElement('div');
        azioni.className = 'actions-row';
        azioni.style.marginTop = '0.75rem';

        // Se non sono sulla radice, posso scollegare o eliminare il nodo.
        if (!isRoot) {
            const btnRemove = window.prodottoUi.creaBottoneAzione('-', 'btn-warning btn-sm', 'Scollega dal padre');
            btnRemove.addEventListener('click', () => rimuoviNodoDalBuilder(nodo.clientId));
            azioni.appendChild(btnRemove);

            const btnDelete = window.prodottoUi.creaBottoneAzione('-*', 'btn-danger btn-sm', 'Elimina nodo e discendenti');
            btnDelete.addEventListener('click', () => eliminaNodoDalBuilder(nodo.clientId));
            azioni.appendChild(btnDelete);
        }

        // Bottone "+" con menu contestuale.
        const btnAdd = window.prodottoUi.creaBottoneAzione('+', 'btn-success btn-sm', 'Aggiungi');
        const menu = document.createElement('div');
        menu.className = 'actions-menu';
        menu.hidden = true;

        if (nodo.tipo === 'COMPOSTO') {
            menu.appendChild(window.prodottoUi.creaVoceMenu('Sottoprodotto semplice', () => {
                aggiungiFiglioSemplice(nodo.clientId);
                menu.hidden = true;
            }));

            menu.appendChild(window.prodottoUi.creaVoceMenu('Sottoprodotto composto', () => {
                aggiungiFiglioComposto(nodo.clientId);
                menu.hidden = true;
            }));
        }

        if (nodo.tipo === 'SEMPLICE') {
            menu.appendChild(window.prodottoUi.creaVoceMenu('SKU esistente', () => {
                aggiungiSkuEsistente(nodo.clientId);
                menu.hidden = true;
            }));

            menu.appendChild(window.prodottoUi.creaVoceMenu('Nuova SKU', () => {
                aggiungiSkuNuova(nodo.clientId);
                menu.hidden = true;
            }));
        }

        btnAdd.addEventListener('click', () => {
            if (menu.childElementCount > 0) {
                menu.hidden = !menu.hidden;
            }
        });

        azioni.appendChild(btnAdd);
        card.appendChild(azioni);
        card.appendChild(menu);

        if (nodo.tipo === 'SEMPLICE') {
            // Elenco SKU del prodotto semplice.
            const bloccoSku = document.createElement('div');
            bloccoSku.style.marginTop = '0.85rem';

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
                    info.textContent = `${sku.codice} - ${sku.nome || 'Nuova SKU'} - €${window.prodottoUi.formattaPrezzo(sku.prezzo)}`;

                    const azioniSku = document.createElement('div');
                    azioniSku.className = 'tree-actions';

                    const btnRimuoviSku = window.prodottoUi.creaBottoneAzione('-', 'btn-warning btn-sm', 'Rimuovi SKU dal prodotto');
                    btnRimuoviSku.addEventListener('click', () => rimuoviSkuDalBuilder(nodo, sku));

                    const btnEliminaSku = window.prodottoUi.creaBottoneAzione('-*', 'btn-danger btn-sm', 'Elimina SKU');
                    btnEliminaSku.addEventListener('click', () => eliminaSkuDalBuilder(nodo, sku));

                    azioniSku.appendChild(btnRimuoviSku);
                    azioniSku.appendChild(btnEliminaSku);
                    riga.appendChild(info);
                    riga.appendChild(azioniSku);
                    bloccoSku.appendChild(riga);
                });
            }

            card.appendChild(bloccoSku);
        }

        if (nodo.tipo === 'COMPOSTO' && Array.isArray(nodo.figli) && nodo.figli.length > 0) {
            // Render ricorsivo dei figli del composto.
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

    function renderBuilder() {
        const state = getState();

        if (!state.dettaglioContent || !state.builderState) {
            return;
        }

        // Ricostruisco da zero il pannello del builder.
        state.dettaglioContent.innerHTML = '';

        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = 'Builder prodotto composto';
        wrapper.appendChild(titolo);

        // Campi principali della radice.
        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Nome', state.builderState.nome, async (valore) => {
                state.builderState.nome = valore;
                renderBuilder();
            })
        );

        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Codice', state.builderState.codice, async (valore) => {
                const numero = Number(valore);
                if (!Number.isInteger(numero) || numero < 0) {
                    throw new Error('Il codice del prodotto composto deve essere un intero non negativo.');
                }

                state.builderState.codice = numero;
                renderBuilder();
            })
        );

        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Descrizione', state.builderState.descrizione, async (valore) => {
                state.builderState.descrizione = valore;
                renderBuilder();
            })
        );

        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Prezzo minimo', state.builderState.prezzoMin, async (valore) => {
                const numero = Number(valore);
                if (Number.isNaN(numero) || numero < 0) {
                    throw new Error('Il prezzo minimo non è valido.');
                }

                if (!Number.isNaN(Number(state.builderState.prezzoMax)) &&
                    numero > Number(state.builderState.prezzoMax)) {
                    throw new Error('Il prezzo minimo non può essere maggiore del prezzo massimo.');
                }

                state.builderState.prezzoMin = numero;
                renderBuilder();
            })
        );

        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Prezzo massimo', state.builderState.prezzoMax, async (valore) => {
                const numero = Number(valore);
                if (Number.isNaN(numero) || numero < 0) {
                    throw new Error('Il prezzo massimo non è valido.');
                }

                if (!Number.isNaN(Number(state.builderState.prezzoMin)) &&
                    numero < Number(state.builderState.prezzoMin)) {
                    throw new Error('Il prezzo massimo non può essere minore del prezzo minimo.');
                }

                state.builderState.prezzoMax = numero;
                renderBuilder();
            })
        );

        const tipo = document.createElement('p');
        tipo.textContent = 'Tipo: COMPOSTO';
        wrapper.appendChild(tipo);

        const titoloStruttura = document.createElement('h4');
        titoloStruttura.className = 'section-title';
        titoloStruttura.style.marginTop = '1.25rem';
        titoloStruttura.textContent = 'Struttura prodotto';
        wrapper.appendChild(titoloStruttura);

        wrapper.appendChild(renderBuilderNode(state.builderState, true));

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

            state.builderState = null;
            state.dettaglioContent.innerHTML = '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';
        });

        azioni.appendChild(bottoneSalva);
        azioni.appendChild(bottoneAnnulla);
        wrapper.appendChild(azioni);

        state.dettaglioContent.appendChild(wrapper);
    }

    function aggiungiFiglioSemplice(parentClientId) {
        const state = getState();
        const padre = trovaNodoBuilder(state.builderState, parentClientId);

        if (!padre || padre.tipo !== 'COMPOSTO') {
            return;
        }

        // Per semplicità qui la creazione avviene tramite prompt.
        const codice = window.prompt('Codice del nuovo prodotto semplice');
        if (codice === null) return;

        const nome = window.prompt('Nome del nuovo prodotto semplice');
        if (nome === null) return;

        if (!Number.isInteger(Number(codice)) || Number(codice) < 0 || !nome.trim()) {
            window.appFornitore.mostraMessaggioHome('Dati del nuovo prodotto semplice non validi.', 'error');
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
        const state = getState();
        const padre = trovaNodoBuilder(state.builderState, parentClientId);

        if (!padre || padre.tipo !== 'COMPOSTO') {
            return;
        }

        const codice = window.prompt('Codice del nuovo prodotto composto');
        if (codice === null) return;

        const nome = window.prompt('Nome del nuovo prodotto composto');
        if (nome === null) return;

        const descrizione = window.prompt('Descrizione del nuovo prodotto composto');
        if (descrizione === null) return;

        const prezzoMin = window.prompt('Prezzo minimo del nuovo prodotto composto');
        if (prezzoMin === null) return;

        const prezzoMax = window.prompt('Prezzo massimo del nuovo prodotto composto');
        if (prezzoMax === null) return;

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
            window.appFornitore.mostraMessaggioHome('Dati del nuovo prodotto composto non validi.', 'error');
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

    function aggiungiSkuEsistente(nodeClientId) {
        const state = getState();
        const nodo = trovaNodoBuilder(state.builderState, nodeClientId);

        if (!nodo || nodo.tipo !== 'SEMPLICE') {
            return;
        }

        if (!state.skuDisponibiliCache.length) {
            window.appFornitore.mostraMessaggioHome('Non ci sono SKU disponibili da associare.', 'error');
            return;
        }

        const elenco = state.skuDisponibiliCache
            .map((sku) => `${sku.id} - ${sku.codice} - ${sku.nome} - €${window.prodottoUi.formattaPrezzo(sku.prezzo)}`)
            .join('\n');

        const scelta = window.prompt(`Inserisci l'id della SKU da associare:\n\n${elenco}`);
        if (scelta === null) {
            return;
        }

        const skuSelezionata = state.skuDisponibiliCache.find((sku) => String(sku.id) === String(scelta.trim()));
        if (!skuSelezionata) {
            window.appFornitore.mostraMessaggioHome('SKU selezionata non valida.', 'error');
            return;
        }

        // Evito duplicati nello stesso prodotto semplice.
        if (nodo.skuList.some((sku) => sku.id === skuSelezionata.id)) {
            window.appFornitore.mostraMessaggioHome('Questa SKU è già associata al prodotto semplice.', 'error');
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
        const state = getState();
        const nodo = trovaNodoBuilder(state.builderState, nodeClientId);

        if (!nodo || nodo.tipo !== 'SEMPLICE') {
            return;
        }

        const codice = window.prompt('Codice della nuova SKU');
        if (codice === null) return;

        const nome = window.prompt('Nome della nuova SKU');
        if (nome === null) return;

        const descrizioneTecnica = window.prompt('Descrizione tecnica della nuova SKU');
        if (descrizioneTecnica === null) return;

        const prezzo = window.prompt('Prezzo della nuova SKU');
        if (prezzo === null) return;

        if (
            !Number.isInteger(Number(codice)) ||
            Number(codice) < 0 ||
            !nome.trim() ||
            !descrizioneTecnica.trim() ||
            Number.isNaN(Number(prezzo)) ||
            Number(prezzo) < 0
        ) {
            window.appFornitore.mostraMessaggioHome('Dati della nuova SKU non validi.', 'error');
            return;
        }

        // Evito due SKU con lo stesso codice nello stesso nodo semplice.
        if (nodo.skuList.some((sku) => Number(sku.codice) === Number(codice))) {
            window.appFornitore.mostraMessaggioHome('Nel nodo è già presente una SKU con questo codice.', 'error');
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

    async function onSalvaBuilder() {
        const state = getState();

        if (!state.builderState) {
            window.appFornitore.mostraMessaggioHome('Nessuna bozza presente da salvare.', 'error');
            return;
        }

        // Prima controllo che tutta la struttura sia valida.
        const errore = validaBuilder(state.builderState, 1);
        if (errore) {
            window.appFornitore.mostraMessaggioHome(errore, 'error');
            return;
        }

        const payload = serializzaNodoBuilder(state.builderState);
        payload.eliminaProdotti = Array.from(state.builderState.deletedProductIds || []);
        payload.eliminaSku = Array.from(state.builderState.deletedSkuIds || []);

        try {
            // Unica chiamata che persiste tutta la struttura costruita lato client.
            const response = await fetch('api/fornitore/prodotto/crea', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            state.builderState = null;
            if (state.formProdottoComposto) {
                state.formProdottoComposto.reset();
            }

            window.appFornitore.mostraMessaggioHome('Prodotto composto salvato con successo.', 'success');

            if (data) {
                window.prodottoDettaglio.mostraDettaglioProdottoCreato(data);
            } else if (state.dettaglioContent) {
                state.dettaglioContent.innerHTML = '<p class="muted">Prodotto salvato correttamente.</p>';
            }

            // Aggiorno le liste così la home resta coerente col server.
            await Promise.all([
                window.prodottoApi.caricaProdottiDisponibili(),
                window.prodottoApi.caricaSkuDisponibili()
            ]);
        } catch (error) {
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante il salvataggio del prodotto composto.',
                'error'
            );
        }
    }

    return {
        renderBuilder,
        renderBuilderNode,
        nextBuilderNodeId,
        nextBuilderSkuId,
        trovaNodoBuilder,
        removeNodeByClientId,
        registraEliminazioneProdotto,
        rimuoviNodoDalBuilder,
        eliminaNodoDalBuilder,
        rimuoviSkuDalBuilder,
        eliminaSkuDalBuilder,
        validaBuilder,
        serializzaNodoBuilder,
        mappaProdottoEsistentePerBuilder,
        aggiungiFiglioSemplice,
        aggiungiFiglioComposto,
        aggiungiSkuEsistente,
        aggiungiSkuNuova,
        onSalvaBuilder
    };
})();