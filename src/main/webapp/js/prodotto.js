window.prodottoPage = (function () {
    let formProdottoSemplice;
    let formProdottoComposto;
    let listaSkuDisponibili;
    let hintSkuVuote;
    let listaFigliDisponibili;
    let hintProdottiVuoti;

    async function init() {
        console.log('[prodotto.js] init partita');

        formProdottoSemplice = document.getElementById('form-crea-semplice');
        formProdottoComposto = document.getElementById('form-crea-composto');
        listaSkuDisponibili = document.getElementById('lista-sku-disponibili');
        hintSkuVuote = document.getElementById('hint-sku-vuote');
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

    async function onSubmitProdottoSemplice(event) {
        event.preventDefault();
        window.appFornitore.nascondiMessaggi();

        const formData = new FormData(formProdottoSemplice);
        formData.append('tipo', 'SEMPLICE');

        const codice = (formData.get('codice') || '').toString().trim();
        const nome = (formData.get('nome') || '').toString().trim();
        const skuIds = formData.getAll('skuIds');

        console.log('[prodotto.js] submit semplice');
        stampaFormData(formData);

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
            const response = await fetch('apifornitoreprodottocrea', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            formProdottoSemplice.reset();
            window.appFornitore.mostraMessaggioHome('Prodotto semplice creato con successo.', 'success');

            if (data) {
                renderDettaglioProdottoCreato(data);
            }

            await caricaProdottiDisponibili();
        } catch (error) {
            console.error('[prodotto.js] errore creazione prodotto semplice:', error);
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

        const codice = (formData.get('codice') || '').toString().trim();
        const nome = (formData.get('nome') || '').toString().trim();
        const descrizione = (formData.get('descrizione') || '').toString().trim();
        const prezzoMin = (formData.get('prezzoMin') || '').toString().trim();
        const prezzoMax = (formData.get('prezzoMax') || '').toString().trim();
        const figlioIds = formData.getAll('figlioIds');

        console.log('[prodotto.js] submit composto');
        stampaFormData(formData);

        if (!codice || !nome || !descrizione || !prezzoMin || !prezzoMax) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi del prodotto composto.', 'error');
            return;
        }

        if (!Number.isInteger(Number(codice)) || Number(codice) < 0) {
            window.appFornitore.mostraMessaggioHome('Il codice del prodotto composto non è valido.', 'error');
            return;
        }

        if (Number.isNaN(Number(prezzoMin)) || Number(prezzoMin) < 0 ||
            Number.isNaN(Number(prezzoMax)) || Number(prezzoMax) < 0) {
            window.appFornitore.mostraMessaggioHome('La fascia di prezzo non è valida.', 'error');
            return;
        }

        if (Number(prezzoMin) > Number(prezzoMax)) {
            window.appFornitore.mostraMessaggioHome('Il prezzo minimo non può superare il massimo.', 'error');
            return;
        }

        if (!figlioIds || figlioIds.length === 0) {
            window.appFornitore.mostraMessaggioHome('Seleziona almeno un sottoprodotto.', 'error');
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

            if (data) {
                renderDettaglioProdottoCreato(data);
            }

            await caricaProdottiDisponibili();
        } catch (error) {
            console.error('[prodotto.js] errore creazione prodotto composto:', error);
            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante la creazione del prodotto composto.',
                'error'
            );
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
                headers: {
                    'Accept': 'application/json'
                }
            });

            const data = await window.appFornitore.parseJsonResponse(response);
            renderProdottiDisponibili(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('[prodotto.js] errore caricamento prodotti disponibili:', error);
        }
    }
    function aggiornaListaSku(lista) {
        console.log('DEBUG PRODOTTO JS NUOVO - aggiornaListaSku');

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

            const span = document.createElement('span');
            span.textContent = `${prodotto.nome} - ${prodotto.codice} - ${prodotto.tipo}`;

            label.appendChild(input);
            label.appendChild(span);
            listaFigliDisponibili.appendChild(label);
        });
    }

    function renderDettaglioProdottoCreato(prodotto) {
        const contenitore = document.getElementById('dettaglio-content');
        if (!contenitore) {
            return;
        }

        contenitore.innerHTML = '';

        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = 'Dettaglio prodotto';
        wrapper.appendChild(titolo);

        wrapper.appendChild(
            creaRigaCampoProdotto('Nome', prodotto.nome, async (nuovoValore) => {
                const aggiornato = await aggiornaCampoProdotto(prodotto.id, 'nome', nuovoValore);
                renderDettaglioProdottoCreato(aggiornato);
                await caricaProdottiDisponibili();
            })
        );

        const codice = document.createElement('p');
        codice.innerHTML = `<strong>Codice:</strong> <span>${escapeHtml(prodotto.codice)}</span>`;
        wrapper.appendChild(codice);

        const tipo = document.createElement('p');
        tipo.innerHTML = `<strong>Tipo:</strong> <span>${escapeHtml(prodotto.tipo)}</span>`;
        wrapper.appendChild(tipo);

        if (prodotto.tipo === 'SEMPLICE') {
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
            } else {
                prodotto.skuList.forEach((sku) => {
                    const riga = document.createElement('div');
                    riga.className = 'tree-sku-row';

                    const info = document.createElement('div');
                    info.className = 'tree-meta';
                    info.textContent = `${sku.codice} - ${sku.nome} - €${formattaPrezzo(sku.prezzo)}`;

                    const azioni = document.createElement('div');
                    azioni.className = 'tree-actions';

                    if (prodotto.skuList.length > 1) {
                        const bottoneRimuovi = document.createElement('button');
                        bottoneRimuovi.type = 'button';
                        bottoneRimuovi.className = 'btn btn-ghost btn-sm';
                        bottoneRimuovi.textContent = 'Rimuovi';

                        bottoneRimuovi.addEventListener('click', async () => {
                            const conferma = window.confirm('Vuoi rimuovere questa SKU dal prodotto semplice?');
                            if (!conferma) {
                                return;
                            }

                            try {
                                const aggiornato = await rimuoviAssociazioneProdottoSku(prodotto.id, sku.id);
                                window.appFornitore.mostraMessaggioHome('SKU rimossa dal prodotto.', 'success');

                                if (aggiornato) {
                                    renderDettaglioProdottoCreato(aggiornato);
                                }

                                await caricaProdottiDisponibili();
                            } catch (error) {
                                console.error('[prodotto.js] errore rimozione SKU:', error);
                                window.appFornitore.mostraMessaggioHome(
                                    error.message || 'Errore durante la rimozione della SKU.',
                                    'error'
                                );
                            }
                        });

                        azioni.appendChild(bottoneRimuovi);
                    }

                    const bottoneEliminaSku = document.createElement('button');
                    bottoneEliminaSku.type = 'button';
                    bottoneEliminaSku.className = 'btn btn-danger btn-sm';
                    bottoneEliminaSku.textContent = 'Elimina';

                    bottoneEliminaSku.addEventListener('click', async () => {
                        const conferma = window.confirm('Vuoi eliminare definitivamente questa SKU?');
                        if (!conferma) {
                            return;
                        }

                        try {
                            const risultato = await eliminaSkuNelDettaglio(sku.id, prodotto.id);
                            window.appFornitore.mostraMessaggioHome('SKU eliminata con successo.', 'success');

                            if (risultato && risultato.prodottoAggiornato) {
                                renderDettaglioProdottoCreato(risultato.prodottoAggiornato);
                            } else {
                                renderDettaglioProdottoCreato({
                                    ...prodotto,
                                    skuList: prodotto.skuList.filter((item) => item.id !== sku.id)
                                });
                            }

                            await caricaProdottiDisponibili();
                        } catch (error) {
                            console.error('[prodotto.js] errore eliminazione SKU:', error);
                            window.appFornitore.mostraMessaggioHome(
                                error.message || 'Errore durante l\'eliminazione della SKU.',
                                'error'
                            );
                        }
                    });

                    azioni.appendChild(bottoneEliminaSku);

                    riga.appendChild(info);
                    riga.appendChild(azioni);
                    wrapper.appendChild(riga);
                });
            }
        }

        if (prodotto.tipo === 'COMPOSTO') {
            wrapper.appendChild(
                creaRigaCampoProdotto('Descrizione', prodotto.descrizione || '', async (nuovoValore) => {
                    const aggiornato = await aggiornaCampoProdotto(prodotto.id, 'descrizione', nuovoValore);
                    renderDettaglioProdottoCreato(aggiornato);
                    await caricaProdottiDisponibili();
                })
            );

            wrapper.appendChild(
                creaRigaCampoProdotto('Prezzo minimo', formattaPrezzo(prodotto.prezzoMin), async (nuovoValore) => {
                    const aggiornato = await aggiornaCampoProdotto(prodotto.id, 'prezzoMin', nuovoValore);
                    renderDettaglioProdottoCreato(aggiornato);
                    await caricaProdottiDisponibili();
                })
            );

            wrapper.appendChild(
                creaRigaCampoProdotto('Prezzo massimo', formattaPrezzo(prodotto.prezzoMax), async (nuovoValore) => {
                    const aggiornato = await aggiornaCampoProdotto(prodotto.id, 'prezzoMax', nuovoValore);
                    renderDettaglioProdottoCreato(aggiornato);
                    await caricaProdottiDisponibili();
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
            } else {
                prodotto.figli.forEach((figlio) => {
                    const riga = document.createElement('div');
                    riga.className = 'tree-sku-row';

                    const info = document.createElement('div');
                    info.className = 'tree-meta';
                    info.textContent = `${figlio.nome} - ${figlio.codice} - ${figlio.tipo}`;

                    const azioni = document.createElement('div');
                    azioni.className = 'tree-actions';

                    const bottoneRimuovi = document.createElement('button');
                    bottoneRimuovi.type = 'button';
                    bottoneRimuovi.className = 'btn btn-ghost btn-sm';
                    bottoneRimuovi.textContent = 'Rimuovi';

                    bottoneRimuovi.addEventListener('click', async () => {
                        const conferma = window.confirm('Vuoi scollegare questo sottoprodotto?');
                        if (!conferma) {
                            return;
                        }

                        try {
                            const aggiornato = await rimuoviAssociazionePadreFiglio(figlio.id, prodotto.id);
                            window.appFornitore.mostraMessaggioHome('Sottoprodotto rimosso correttamente.', 'success');

                            if (aggiornato) {
                                renderDettaglioProdottoCreato(aggiornato);
                            }

                            await caricaProdottiDisponibili();
                        } catch (error) {
                            console.error('[prodotto.js] errore rimozione sottoprodotto:', error);
                            window.appFornitore.mostraMessaggioHome(
                                error.message || 'Errore durante la rimozione del sottoprodotto.',
                                'error'
                            );
                        }
                    });

                    azioni.appendChild(bottoneRimuovi);
                    riga.appendChild(info);
                    riga.appendChild(azioni);
                    wrapper.appendChild(riga);
                });
            }
        }

        const azioniFinali = document.createElement('div');
        azioniFinali.style.marginTop = '1rem';

        const bottoneElimina = document.createElement('button');
        bottoneElimina.type = 'button';
        bottoneElimina.className = 'btn btn-danger btn-sm';
        bottoneElimina.textContent = 'Elimina prodotto';

        bottoneElimina.addEventListener('click', async () => {
            const etichettaTipo = prodotto.tipo === 'COMPOSTO' ? 'COMPOSTO' : 'SEMPLICE';
            const conferma = window.confirm('Vuoi eliminare questo prodotto?');

            if (!conferma) {
                return;
            }

            try {
                await eliminaProdotto(prodotto.id, etichettaTipo);
                contenitore.innerHTML = '<p class="muted">Seleziona o crea un elemento per vedere il dettaglio.</p>';
                window.appFornitore.mostraMessaggioHome('Prodotto eliminato con successo.', 'success');
                await caricaProdottiDisponibili();
            } catch (error) {
                console.error('[prodotto.js] errore eliminazione prodotto:', error);
                window.appFornitore.mostraMessaggioHome(
                    error.message || 'Errore durante l\'eliminazione del prodotto.',
                    'error'
                );
            }
        });

        azioniFinali.appendChild(bottoneElimina);
        wrapper.appendChild(azioniFinali);

        contenitore.appendChild(wrapper);
    }

    function creaRigaCampoProdotto(etichetta, valoreIniziale, onSalva) {
        const riga = document.createElement('p');

        const label = document.createElement('strong');
        label.textContent = `${etichetta}: `;
        riga.appendChild(label);

        const spanValore = document.createElement('span');
        spanValore.textContent = valoreIniziale && String(valoreIniziale).trim() !== '' ? valoreIniziale : '-';
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
            input.select();

            let ripristinato = false;

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    ripristinato = true;
                    riga.replaceChild(spanValore, input);
                }
            });

            input.addEventListener('blur', async () => {
                if (ripristinato) {
                    return;
                }

                const nuovoValore = input.value.trim();

                try {
                    await onSalva(nuovoValore);
                } catch (error) {
                    riga.replaceChild(spanValore, input);
                }
            }, { once: true });
        });

        return riga;
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
                'Accept': 'application/json'
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
                'Accept': 'application/json'
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
                'Accept': 'application/json'
            },
            body: body.toString()
        });

        return window.appFornitore.parseJsonResponse(response);
    }

    async function eliminaProdotto(id, tipo) {
        const body = new URLSearchParams();
        body.append('id', id);
        body.append('tipo', tipo);

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

    async function eliminaSkuNelDettaglio(skuId, returnProdottoId) {
        const body = new URLSearchParams();
        body.append('id', skuId);
        body.append('tipo', 'SKU');
        body.append('returnProdottoId', returnProdottoId);

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

    function stampaFormData(formData) {
        for (const [chiave, valore] of formData.entries()) {
            console.log(`[prodotto.js] ${chiave} =`, valore);
        }
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
        renderDettaglioProdottoCreato
    };
})();