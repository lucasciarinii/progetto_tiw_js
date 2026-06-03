window.prodottoDettaglio = (function () {
    function getState() {
        // Recupera lo stato condiviso del modulo prodotto.
        // In particolare qui serve soprattutto per accedere al container
        // principale del pannello di dettaglio.
        return window.prodottoPage.getState();
    }

    function estraiProdottoAggiornato(risposta) {
        // Prova a capire dove si trova il prodotto aggiornato nella risposta del server.
        // Alcune servlet possono restituire direttamente il prodotto,
        // altre possono incapsularlo dentro una proprietà dedicata.
        if (!risposta) return null;
        if (risposta.id != null && risposta.tipo) return risposta;
        if (risposta.prodottoAggiornato && risposta.prodottoAggiornato.id != null) return risposta.prodottoAggiornato;
        return null;
    }

    async function refreshContenitoreDaPadre(prodottoId, container) {
        // Ricarica il dettaglio partendo dall'id del prodotto padre.
        // Prova prima come semplice e poi come composto:
        // appena una delle due fetch va a buon fine, aggiorna il pannello.
        if (!prodottoId || !container) return;

        for (const tipo of ['SEMPLICE', 'COMPOSTO']) {
            try {
                const prodottoAggiornato = await window.prodottoApi.caricaDettaglioProdotto(prodottoId, tipo);
                mostraDettaglioProdottoCreato(prodottoAggiornato, container);
                return;
            } catch (error) {
                // Se fallisce con un tipo, provo con l'altro.
            }
        }
    }

    async function rerenderDaRisposta(risposta, prodottoPadreId, container) {
        // Dopo un aggiornamento/rimozione il server può restituire direttamente
        // il prodotto già aggiornato. Se non lo fa, provo a ricaricarlo dal server.
        const prodottoAggiornato = estraiProdottoAggiornato(risposta);
        if (prodottoAggiornato) {
            mostraDettaglioProdottoCreato(prodottoAggiornato, container);
            return;
        }
        await refreshContenitoreDaPadre(prodottoPadreId, container);
    }

    function mostraDettaglioProdottoCreato(prodotto, container = getState().dettaglioContent) {
        const state = getState();

        // Quando mostro un prodotto nel pannello dettaglio,
        // chiudo eventuale builder attivo.
        state.builderState = null;

        renderDettaglioProdottoInContainer(prodotto, container);
    }

    function renderDettaglioProdottoInContainer(prodotto, container) {
        if (!container) return;

        // Capisco se mi trovo dentro la sezione ricerca:
        // in quel caso alcune modifiche devono aggiornare anche la lista dei risultati.
        const inRicerca = window.appFornitore.getSezioneCorrente?.() === 'ricerca';

        if (!prodotto) {
            container.innerHTML = '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';
            return;
        }

        // Svuoto il pannello e ricostruisco tutto il dettaglio da zero.
        container.innerHTML = '';
        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = 'Dettaglio prodotto';
        wrapper.appendChild(titolo);

        // Campo nome modificabile inline.
        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Nome', prodotto.nome, async (nuovoValore) => {
                const risposta = await window.prodottoApi.aggiornaCampoProdotto(prodotto.id, 'nome', nuovoValore);

                // Se sono nella sezione ricerca, provo ad aggiornare anche l'elemento della lista risultati.
                if (inRicerca && window.ricercaPage?.aggiornaRisultatoInLista) {
                    window.ricercaPage.aggiornaRisultatoInLista(prodotto.id, 'PRODOTTO', { nome: nuovoValore });
                }

                await rerenderDaRisposta(risposta, prodotto.id, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
        );

        // Campo codice modificabile inline, con una validazione minima lato client.
        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Codice', prodotto.codice, async (nuovoValore) => {
                const numero = Number(nuovoValore);
                if (!Number.isInteger(numero) || numero < 0) {
                    throw new Error('Codice non valido');
                }

                const risposta = await window.prodottoApi.aggiornaCampoProdotto(prodotto.id, 'codice', numero);
                await rerenderDaRisposta(risposta, prodotto.id, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
        );

        const tipo = document.createElement('p');
        tipo.innerHTML = `Tipo: ${window.prodottoUi.escapeHtml(prodotto.tipo)}`;
        wrapper.appendChild(tipo);

        // Da qui in poi il rendering diverge in base al tipo di prodotto.
        if (prodotto.tipo === 'SEMPLICE') {
            renderBloccoSkuProdottoSemplice(wrapper, prodotto, container);
        } else {
            renderBloccoProdottoComposto(wrapper, prodotto, container);
        }

        const azioni = document.createElement('div');
        azioni.className = 'actions-row';
        azioni.style.marginTop = '1rem';

        // Pulsante per eliminare l'intero prodotto.
        const bottoneElimina = document.createElement('button');
        bottoneElimina.type = 'button';
        bottoneElimina.className = 'btn btn-action btn-danger btn-sm';
        bottoneElimina.textContent = '-*';
        bottoneElimina.title = 'Elimina prodotto';
        bottoneElimina.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi eliminare questo prodotto?');
            if (!conferma) return;

            try {
                // Se il prodotto è composto provo prima a prendere il sottoalbero completo,
                // così nella sezione ricerca posso rimuovere tutti i risultati coinvolti.
                const sottoalbero = prodotto.tipo === 'COMPOSTO'
                    ? await window.prodottoApi.caricaDettaglioProdotto(prodotto.id, prodotto.tipo).catch(() => null)
                    : null;

                await window.prodottoApi.eliminaOggetto(prodotto.id, prodotto.tipo);

                // Aggiorno eventuale lista risultati della ricerca.
                if (inRicerca && window.ricercaPage?.rimuoviRisultatiSottoalbero && sottoalbero) {
                    window.ricercaPage.rimuoviRisultatiSottoalbero(sottoalbero);
                } else if (inRicerca && window.ricercaPage?.rimuoviRisultatoDaLista) {
                    window.ricercaPage.rimuoviRisultatoDaLista(prodotto.id, 'PRODOTTO');
                }

                // Dopo l'eliminazione svuoto il pannello dettaglio.
                container.innerHTML = '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';

                // Ricarico le liste principali per mantenere coerente la home.
                await Promise.all([
                    window.prodottoApi.caricaProdottiDisponibili(),
                    window.prodottoApi.caricaSkuDisponibili()
                ]);
            } catch (error) {
                window.prodottoPage.mostraMessaggioGlobale(
                    error.message || 'Errore durante l\'eliminazione del prodotto.',
                    'error'
                );
            }
        });

        azioni.appendChild(bottoneElimina);
        wrapper.appendChild(azioni);
        container.appendChild(wrapper);
    }

    function renderBloccoSkuProdottoSemplice(wrapper, prodotto, container) {
        // Render della sezione SKU per un prodotto semplice.
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

        // Per ogni SKU associata creo una riga di dettaglio.
        prodotto.skuList.forEach((sku) => {
            wrapper.appendChild(renderRigaSkuDettaglio(sku, prodotto, container));
        });
    }

    function renderBloccoProdottoComposto(wrapper, prodotto, container) {
        // Campi specifici del prodotto composto, tutti editabili inline.
        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Descrizione', prodotto.descrizione, async (nuovoValore) => {
                const risposta = await window.prodottoApi.aggiornaCampoProdotto(prodotto.id, 'descrizione', nuovoValore);
                await rerenderDaRisposta(risposta, prodotto.id, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
        );

        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Prezzo minimo', window.prodottoUi.formattaPrezzo(prodotto.prezzoMin), async (nuovoValore) => {
                const risposta = await window.prodottoApi.aggiornaCampoProdotto(prodotto.id, 'prezzoMin', nuovoValore);
                await rerenderDaRisposta(risposta, prodotto.id, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
        );

        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Prezzo massimo', window.prodottoUi.formattaPrezzo(prodotto.prezzoMax), async (nuovoValore) => {
                const risposta = await window.prodottoApi.aggiornaCampoProdotto(prodotto.id, 'prezzoMax', nuovoValore);
                await rerenderDaRisposta(risposta, prodotto.id, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
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

        const blocco = document.createElement('div');
        blocco.style.marginTop = '0.75rem';

        // Render ricorsivo dei figli del prodotto composto.
        prodotto.figli.forEach((figlio) => {
            blocco.appendChild(renderNodoDettaglioProdotto(figlio, prodotto.id, container));
        });

        wrapper.appendChild(blocco);
    }

    function renderNodoDettaglioProdotto(nodo, padreId, container) {
        // Render di un singolo nodo dell'albero nel dettaglio.
        const card = document.createElement('div');
        card.className = 'tree-node';
        card.style.marginTop = '0.75rem';

        // Anche il nome del sottoprodotto è modificabile inline.
        card.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Nome', nodo.nome, async (nuovoValore) => {
                const risposta = await window.prodottoApi.aggiornaCampoProdotto(nodo.id, 'nome', nuovoValore);
                await rerenderDaRisposta(risposta, padreId, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
        );

        const codice = document.createElement('p');
        codice.innerHTML = `Codice: ${window.prodottoUi.escapeHtml(nodo.codice)}`;
        card.appendChild(codice);

        const tipo = document.createElement('p');
        tipo.innerHTML = `Tipo: ${window.prodottoUi.escapeHtml(nodo.tipo)}`;
        card.appendChild(tipo);

        if (nodo.tipo === 'COMPOSTO') {
            // Se il nodo è composto, mostro e rendo editabili anche i suoi campi specifici.
            card.appendChild(
                window.prodottoUi.creaRigaCampoProdotto('Descrizione', nodo.descrizione, async (nuovoValore) => {
                    const risposta = await window.prodottoApi.aggiornaCampoProdotto(nodo.id, 'descrizione', nuovoValore);
                    await rerenderDaRisposta(risposta, padreId, container);
                    await window.prodottoApi.caricaProdottiDisponibili();
                })
            );
            card.appendChild(
                window.prodottoUi.creaRigaCampoProdotto('Prezzo minimo', window.prodottoUi.formattaPrezzo(nodo.prezzoMin), async (nuovoValore) => {
                    const risposta = await window.prodottoApi.aggiornaCampoProdotto(nodo.id, 'prezzoMin', nuovoValore);
                    await rerenderDaRisposta(risposta, padreId, container);
                    await window.prodottoApi.caricaProdottiDisponibili();
                })
            );
            card.appendChild(
                window.prodottoUi.creaRigaCampoProdotto('Prezzo massimo', window.prodottoUi.formattaPrezzo(nodo.prezzoMax), async (nuovoValore) => {
                    const risposta = await window.prodottoApi.aggiornaCampoProdotto(nodo.id, 'prezzoMax', nuovoValore);
                    await rerenderDaRisposta(risposta, padreId, container);
                    await window.prodottoApi.caricaProdottiDisponibili();
                })
            );
        }

        const azioni = document.createElement('div');
        azioni.className = 'tree-actions';
        azioni.style.marginTop = '0.75rem';

        if (padreId != null) {
            // Pulsante "-" = scollega il figlio dal padre, ma non lo elimina dal sistema.
            const btnRimuovi = document.createElement('button');
            btnRimuovi.type = 'button';
            btnRimuovi.className = 'btn btn-action btn-warning btn-sm';
            btnRimuovi.textContent = '-';
            btnRimuovi.addEventListener('click', async () => {
                const conferma = window.confirm('Vuoi scollegare questo sottoprodotto?');
                if (!conferma) return;

                const risposta = await window.prodottoApi.rimuoviAssociazionePadreFiglio(nodo.id, padreId);
                await rerenderDaRisposta(risposta, padreId, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            });
            azioni.appendChild(btnRimuovi);
        }

        // Pulsante "-*" = elimina del tutto il nodo.
        const btnElimina = document.createElement('button');
        btnElimina.type = 'button';
        btnElimina.className = 'btn btn-action btn-danger btn-sm';
        btnElimina.textContent = '-*';
        btnElimina.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi eliminare questo prodotto?');
            if (!conferma) return;

            await window.prodottoApi.eliminaOggetto(nodo.id, nodo.tipo, padreId);
            await refreshContenitoreDaPadre(padreId, container);

            await Promise.all([
                window.prodottoApi.caricaProdottiDisponibili(),
                window.prodottoApi.caricaSkuDisponibili()
            ]);
        });

        azioni.appendChild(btnElimina);
        card.appendChild(azioni);

        if (nodo.tipo === 'SEMPLICE') {
            // Se il nodo è semplice, mostro la lista delle SKU associate.
            const bloccoSku = document.createElement('div');
            bloccoSku.style.marginTop = '0.85rem';

            if (!Array.isArray(nodo.skuList) || nodo.skuList.length === 0) {
                const vuoto = document.createElement('p');
                vuoto.className = 'muted';
                vuoto.textContent = 'Nessuna SKU associata.';
                bloccoSku.appendChild(vuoto);
            } else {
                nodo.skuList.forEach((sku) => {
                    bloccoSku.appendChild(renderRigaSkuDettaglio(sku, nodo, container));
                });
            }

            card.appendChild(bloccoSku);
        }

        if (nodo.tipo === 'COMPOSTO' && Array.isArray(nodo.figli) && nodo.figli.length > 0) {
            // Se il nodo è composto, continuo il render dell'albero in profondità.
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
        // Render della riga di una SKU nel dettaglio del prodotto semplice.
        const riga = document.createElement('div');
        riga.className = 'tree-sku-row';

        const info = document.createElement('div');
        info.className = 'tree-meta';

        // I campi principali della SKU sono modificabili inline.
        info.appendChild(window.prodottoUi.creaRigaCampoSku('Codice', sku.codice, async (valore) => {
            const aggiornato = await window.prodottoApi.aggiornaCampoSku(sku.id, 'codice', valore);
            await rerenderDaRisposta(aggiornato, prodottoPadre.id, container);
        }));
        info.appendChild(window.prodottoUi.creaRigaCampoSku('Nome', sku.nome, async (valore) => {
            const aggiornato = await window.prodottoApi.aggiornaCampoSku(sku.id, 'nome', valore);
            await rerenderDaRisposta(aggiornato, prodottoPadre.id, container);
        }));
        info.appendChild(window.prodottoUi.creaRigaCampoSku('Prezzo', window.prodottoUi.formattaPrezzo(sku.prezzo), async (valore) => {
            const aggiornato = await window.prodottoApi.aggiornaCampoSku(sku.id, 'prezzo', valore);
            await rerenderDaRisposta(aggiornato, prodottoPadre.id, container);
        }));

        const azioni = document.createElement('div');
        azioni.className = 'tree-actions';

        // "-" = rimuove l'associazione SKU-prodotto semplice.
        const btnRimuovi = document.createElement('button');
        btnRimuovi.type = 'button';
        btnRimuovi.className = 'btn btn-action btn-warning btn-sm';
        btnRimuovi.textContent = '-';
        btnRimuovi.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi rimuovere questa SKU dal prodotto semplice?');
            if (!conferma) return;

            const risposta = await window.prodottoApi.rimuoviAssociazioneProdottoSku(prodottoPadre.id, sku.id);
            await rerenderDaRisposta(risposta, prodottoPadre.id, container);

            await Promise.all([
                window.prodottoApi.caricaProdottiDisponibili(),
                window.prodottoApi.caricaSkuDisponibili()
            ]);
        });

        // "-*" = elimina definitivamente la SKU.
        const btnElimina = document.createElement('button');
        btnElimina.type = 'button';
        btnElimina.className = 'btn btn-action btn-danger btn-sm';
        btnElimina.textContent = '-*';
        btnElimina.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi eliminare definitivamente questa SKU?');
            if (!conferma) return;

            await window.prodottoApi.eliminaOggetto(sku.id, 'SKU', prodottoPadre.id);
            await refreshContenitoreDaPadre(prodottoPadre.id, container);

            await Promise.all([
                window.prodottoApi.caricaProdottiDisponibili(),
                window.prodottoApi.caricaSkuDisponibili()
            ]);
        });

        azioni.appendChild(btnRimuovi);
        azioni.appendChild(btnElimina);
        riga.appendChild(info);
        riga.appendChild(azioni);

        return riga;
    }

    return {
        // Metodi pubblici esposti agli altri moduli.
        estraiProdottoAggiornato,
        rerenderDaRisposta,
        mostraDettaglioProdottoCreato,
        renderDettaglioProdottoInContainer,
        refreshContenitoreDaPadre
    };
})();