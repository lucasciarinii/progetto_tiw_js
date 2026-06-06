window.prodottoDettaglio = (function () {
    function getState() {
        // Recupera lo stato condiviso del modulo prodotto.
        return window.prodottoPage.getState();
    }

    function isContainerRicerca(container) {
        // Capisco il contesto guardando il contenitore reale del dettaglio.
        return container?.id === 'ricerca-dettaglio';
    }

    function mostraMessaggioPerContainer(container, messaggio, tipo) {
        // Il messaggio deve apparire nella stessa sezione del dettaglio attivo.
        if (isContainerRicerca(container)) {
            if (window.appFornitore?.mostraMessaggioRicerca) {
                window.appFornitore.mostraMessaggioRicerca(messaggio, tipo);
                return;
            }

            if (window.ricercaPage?.mostraMessaggioRicerca) {
                window.ricercaPage.mostraMessaggioRicerca(messaggio, tipo);
                return;
            }
        }

        window.appFornitore?.mostraMessaggioHome?.(messaggio, tipo);
    }

    function mostraErrore(messaggio, container) {
        mostraMessaggioPerContainer(container, messaggio, 'error');
    }

    function mostraSuccesso(messaggio, container) {
        mostraMessaggioPerContainer(container, messaggio, 'success');
    }

    function estraiProdottoAggiornato(risposta) {
        // Prova a individuare il prodotto aggiornato dentro la risposta del server.
        if (!risposta) return null;
        if (risposta.id != null && risposta.tipo) return risposta;
        if (risposta.prodottoAggiornato && risposta.prodottoAggiornato.id != null) {
            return risposta.prodottoAggiornato;
        }
        return null;
    }

    async function refreshContenitoreDaPadre(prodottoId, container) {
        // Ricarica il dettaglio del prodotto partendo dal suo id.
        if (!prodottoId || !container) {
            return;
        }

        for (const tipo of ['SEMPLICE', 'COMPOSTO']) {
            try {
                const prodottoAggiornato = await window.prodottoApi.caricaDettaglioProdotto(prodottoId, tipo);
                mostraDettaglioProdottoCreato(prodottoAggiornato, container);
                return;
            } catch (error) {
                // Se un tentativo fallisce, provo con l'altro tipo.
            }
        }
    }

    async function rerenderDaRisposta(risposta, prodottoPadreId, container) {
        // Se il server restituisce già il prodotto aggiornato uso quello,
        // altrimenti provo a ricaricarlo dal server.
        const prodottoAggiornato = estraiProdottoAggiornato(risposta);
        if (prodottoAggiornato) {
            mostraDettaglioProdottoCreato(prodottoAggiornato, container);
            return;
        }

        await refreshContenitoreDaPadre(prodottoPadreId, container);
    }

    function mostraDettaglioProdottoCreato(prodotto, container = getState().dettaglioContent) {
        const state = getState();

        // Se apro un dettaglio prodotto, chiudo eventuale builder attivo.
        state.builderState = null;

        renderDettaglioProdottoInContainer(prodotto, container);
    }

    function renderDettaglioProdottoInContainer(prodotto, container) {
        if (!container) {
            return;
        }

        // Se sono nel pannello ricerca, alcune modifiche devono aggiornare
        // anche la lista risultati mostrata a sinistra.
        const inRicerca = isContainerRicerca(container);

        if (!prodotto) {
            container.innerHTML = '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';
            return;
        }

        // Ricostruisco da zero tutto il pannello dettaglio.
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

                if (inRicerca && window.ricercaPage?.aggiornaRisultatoInLista) {
                    window.ricercaPage.aggiornaRisultatoInLista(prodotto.id, 'PRODOTTO', { nome: nuovoValore });
                }

                await rerenderDaRisposta(risposta, prodotto.id, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
        );

        // Campo codice con validazione minima lato client.
        wrapper.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Codice', prodotto.codice, async (nuovoValore) => {
                const numero = Number(nuovoValore);
                if (!Number.isInteger(numero) || numero < 0) {
                    throw new Error('Codice non valido');
                }

                const risposta = await window.prodottoApi.aggiornaCampoProdotto(prodotto.id, 'codice', numero);

                if (inRicerca && window.ricercaPage?.aggiornaRisultatoInLista) {
                    window.ricercaPage.aggiornaRisultatoInLista(prodotto.id, 'PRODOTTO', { codice: numero });
                }

                await rerenderDaRisposta(risposta, prodotto.id, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
        );

        const tipo = document.createElement('p');
        tipo.innerHTML = `Tipo: ${window.prodottoUi.escapeHtml(prodotto.tipo)}`;
        wrapper.appendChild(tipo);

        if (prodotto.tipo === 'SEMPLICE') {
            renderBloccoSkuProdottoSemplice(wrapper, prodotto, container);
        } else {
            renderBloccoProdottoComposto(wrapper, prodotto, container);
        }

        const azioni = document.createElement('div');
        azioni.className = 'actions-row';
        azioni.style.marginTop = '1rem';

        // Pulsante di eliminazione dell'intero prodotto.
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
                // Se il prodotto è composto provo a recuperare il sottoalbero completo,
                // utile soprattutto per aggiornare la sezione ricerca.
                const sottoalbero = prodotto.tipo === 'COMPOSTO'
                    ? await window.prodottoApi.caricaDettaglioProdotto(prodotto.id, prodotto.tipo).catch(() => null)
                    : null;

                await window.prodottoApi.eliminaOggetto(prodotto.id, prodotto.tipo);

                if (inRicerca && window.ricercaPage?.rimuoviRisultatiSottoalbero && sottoalbero) {
                    window.ricercaPage.rimuoviRisultatiSottoalbero(sottoalbero);
                } else if (inRicerca && window.ricercaPage?.rimuoviRisultatoDaLista) {
                    window.ricercaPage.rimuoviRisultatoDaLista(prodotto.id, 'PRODOTTO');
                }

                container.innerHTML = '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';

                await Promise.all([
                    window.prodottoApi.caricaProdottiDisponibili(),
                    window.prodottoApi.caricaSkuDisponibili()
                ]);

                mostraSuccesso('Prodotto eliminato con successo.', container);
            } catch (error) {
                mostraErrore(error.message || 'Errore durante l\'eliminazione del prodotto.', container);
            }
        });

        azioni.appendChild(bottoneElimina);
        wrapper.appendChild(azioni);
        container.appendChild(wrapper);
    }

    function renderBloccoSkuProdottoSemplice(wrapper, prodotto, container) {
        // Sezione SKU del prodotto semplice.
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
        // Campi specifici del prodotto composto.
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

        prodotto.figli.forEach((figlio) => {
            blocco.appendChild(renderNodoDettaglioProdotto(figlio, prodotto.id, container));
        });

        wrapper.appendChild(blocco);
    }

    function renderNodoDettaglioProdotto(nodo, padreId, container) {
        // Render di un nodo dell'albero prodotto.
        const card = document.createElement('div');
        card.className = 'tree-node';
        card.style.marginTop = '0.75rem';

        card.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Nome', nodo.nome, async (nuovoValore) => {
                const risposta = await window.prodottoApi.aggiornaCampoProdotto(nodo.id, 'nome', nuovoValore);
                await rerenderDaRisposta(risposta, padreId, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
        );

        card.appendChild(
            window.prodottoUi.creaRigaCampoProdotto('Codice', nodo.codice, async (nuovoValore) => {
                const numero = Number(nuovoValore);
                if (!Number.isInteger(numero) || numero < 0) {
                    throw new Error('Il codice del prodotto deve essere un intero non negativo.');
                }

                const risposta = await window.prodottoApi.aggiornaCampoProdotto(nodo.id, 'codice', numero);
                await rerenderDaRisposta(risposta, padreId, container);
                await window.prodottoApi.caricaProdottiDisponibili();
            })
        );

        const tipo = document.createElement('p');
        tipo.innerHTML = `Tipo: ${window.prodottoUi.escapeHtml(nodo.tipo)}`;
        card.appendChild(tipo);

        if (nodo.tipo === 'COMPOSTO') {
            // Campi specifici del sottoprodotto composto.
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
            // "-" scollega il figlio dal padre senza eliminarlo dal sistema.
            const btnRimuovi = document.createElement('button');
            btnRimuovi.type = 'button';
            btnRimuovi.className = 'btn btn-action btn-warning btn-sm';
            btnRimuovi.textContent = '-';
            btnRimuovi.addEventListener('click', async () => {
                const conferma = window.confirm('Vuoi scollegare questo sottoprodotto?');
                if (!conferma) {
                    return;
                }

                try {
                    const risposta = await window.prodottoApi.rimuoviAssociazionePadreFiglio(nodo.id, padreId);
                    await rerenderDaRisposta(risposta, padreId, container);
                    await window.prodottoApi.caricaProdottiDisponibili();
                    mostraSuccesso('Sottoprodotto scollegato con successo.', container);
                } catch (error) {
                    mostraErrore(error.message || 'Impossibile scollegare il sottoprodotto.', container);
                }
            });
            azioni.appendChild(btnRimuovi);
        }

        // "-*" elimina del tutto il prodotto.
        const btnElimina = document.createElement('button');
        btnElimina.type = 'button';
        btnElimina.className = 'btn btn-action btn-danger btn-sm';
        btnElimina.textContent = '-*';
        btnElimina.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi eliminare questo prodotto?');
            if (!conferma) {
                return;
            }

            try {
                await window.prodottoApi.eliminaOggetto(nodo.id, nodo.tipo, padreId);
                await refreshContenitoreDaPadre(padreId, container);

                await Promise.all([
                    window.prodottoApi.caricaProdottiDisponibili(),
                    window.prodottoApi.caricaSkuDisponibili()
                ]);

                mostraSuccesso('Prodotto eliminato con successo.', container);
            } catch (error) {
                mostraErrore(error.message || 'Errore durante l\'eliminazione del prodotto.', container);
            }
        });

        azioni.appendChild(btnElimina);
        card.appendChild(azioni);

        if (nodo.tipo === 'SEMPLICE') {
            // Elenco SKU associate al sottoprodotto semplice.
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
            // Render ricorsivo dei figli.
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
        // Render di una SKU nel dettaglio del prodotto semplice.
        const riga = document.createElement('div');
        riga.className = 'tree-sku-row';

        const info = document.createElement('div');
        info.className = 'tree-meta';

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

        // "-" rimuove l'associazione tra SKU e prodotto semplice.
        const btnRimuovi = document.createElement('button');
        btnRimuovi.type = 'button';
        btnRimuovi.className = 'btn btn-action btn-warning btn-sm';
        btnRimuovi.textContent = '-';
        btnRimuovi.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi rimuovere questa SKU dal prodotto semplice?');
            if (!conferma) {
                return;
            }

            try {
                const risposta = await window.prodottoApi.rimuoviAssociazioneProdottoSku(prodottoPadre.id, sku.id);
                await rerenderDaRisposta(risposta, prodottoPadre.id, container);

                await Promise.all([
                    window.prodottoApi.caricaProdottiDisponibili(),
                    window.prodottoApi.caricaSkuDisponibili()
                ]);

                mostraSuccesso('Associazione SKU rimossa con successo.', container);
            } catch (error) {
                mostraErrore(error.message || 'Impossibile rimuovere la SKU dal prodotto semplice.', container);
            }
        });

        // "-*" elimina definitivamente la SKU.
        const btnElimina = document.createElement('button');
        btnElimina.type = 'button';
        btnElimina.className = 'btn btn-action btn-danger btn-sm';
        btnElimina.textContent = '-*';
        btnElimina.addEventListener('click', async () => {
            const conferma = window.confirm('Vuoi eliminare definitivamente questa SKU?');
            if (!conferma) {
                return;
            }

            try {
                await window.prodottoApi.eliminaOggetto(sku.id, 'SKU', prodottoPadre.id);
                await refreshContenitoreDaPadre(prodottoPadre.id, container);

                await Promise.all([
                    window.prodottoApi.caricaProdottiDisponibili(),
                    window.prodottoApi.caricaSkuDisponibili()
                ]);

                mostraSuccesso('SKU eliminata con successo.', container);
            } catch (error) {
                mostraErrore(error.message || 'Errore durante l\'eliminazione della SKU.', container);
            }
        });

        azioni.appendChild(btnRimuovi);
        azioni.appendChild(btnElimina);
        riga.appendChild(info);
        riga.appendChild(azioni);

        return riga;
    }

    return {
        estraiProdottoAggiornato,
        rerenderDaRisposta,
        mostraDettaglioProdottoCreato,
        renderDettaglioProdottoInContainer,
        refreshContenitoreDaPadre
    };
})();