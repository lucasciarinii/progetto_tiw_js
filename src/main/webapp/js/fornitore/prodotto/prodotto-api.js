window.prodottoApi = (function () {
    function getState() {
        // Recupera lo stato condiviso definito nel modulo principale prodotto.js.
        // In questo modo anche questo file lavora sugli stessi dati degli altri moduli.
        return window.prodottoPage.getState();
    }

    async function postFormUrlEncoded(url, params) {
        // Utility generica per tutte le POST "semplici" del modulo.
        // Prepara il body nel formato application/x-www-form-urlencoded,
        // che è comodo per gli aggiornamenti puntuali e per le operazioni di rimozione/eliminazione.
        const body = new URLSearchParams();

        // Inserisco nel body solo i parametri valorizzati.
        // Se un valore è null o undefined, lo salto.
        Object.entries(params).forEach(([chiave, valore]) => {
            if (valore != null) {
                body.append(chiave, valore);
            }
        });

        // Eseguo la chiamata POST verso la servlet indicata.
        // credentials: 'same-origin' serve a inviare automaticamente cookie e sessione.
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json'
            },
            body: body.toString()
        });

        // La risposta viene delegata al parser comune dell'app fornitore,
        // che gestisce sia i casi di successo sia gli errori HTTP/JSON.
        return window.appFornitore.parseJsonResponse(response);
    }

    async function caricaSkuDisponibili() {
        // Carica dal server tutte le SKU disponibili per il fornitore.
        // Queste SKU servono, ad esempio, per la creazione dei prodotti semplici
        // e per eventuali associazioni nel builder del prodotto composto.
        const state = getState();

        const response = await fetch('apifornitoresku', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });

        const data = await window.appFornitore.parseJsonResponse(response);

        // Salvo in cache locale i dati ricevuti.
        // Se il server non restituisce un array valido, uso un array vuoto.
        state.skuDisponibiliCache = Array.isArray(data) ? data : [];

        // Aggiorno subito la UI del form con la lista corrente delle SKU.
        window.prodottoForm.aggiornaListaSku(state.skuDisponibiliCache);
    }

    async function caricaProdottiDisponibili() {
        // Carica i prodotti disponibili che possono essere usati come sottoprodotti
        // durante la costruzione di un prodotto composto.
        const state = getState();

        const response = await fetch('apifornitoreprodotti-disponibili', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });

        const data = await window.appFornitore.parseJsonResponse(response);

        // Tengo solo i prodotti validi, con id presente e senza padre.
        // In pratica qui considero solo i prodotti top-level disponibili per l'associazione iniziale.
        state.prodottiDisponibiliCache = Array.isArray(data)
            ? data.filter((prodotto) => prodotto && prodotto.id != null && prodotto.padreId == null)
            : [];

        // Aggiorno la lista mostrata nel form del prodotto composto.
        window.prodottoForm.renderProdottiDisponibili(state.prodottiDisponibiliCache);
    }

    async function caricaDettaglioProdotto(idProdotto, tipoProdotto) {
        // Recupera dal server il dettaglio completo di un prodotto.
        // Questo serve soprattutto quando devo ricostruire un sottoalbero
        // oppure quando apro un prodotto composto nel builder o nel pannello dettaglio.
        const response = await fetch(
            `apifornitoreprodotto-dettaglio?id=${encodeURIComponent(idProdotto)}&tipo=${encodeURIComponent(String(tipoProdotto || '').trim().toUpperCase())}`,
            {
                method: 'GET',
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            }
        );

        return window.appFornitore.parseJsonResponse(response);
    }

    async function aggiornaCampoProdotto(id, campo, valore) {
        // Aggiornamento inline di un singolo campo prodotto.
        // La servlet lato server capisce quale campo aggiornare leggendo "campo" e "valore".
        return postFormUrlEncoded('apifornitoreprodottoaggiorna', { id, campo, valore });
    }

    async function aggiornaCampoSku(id, campo, valore) {
        // Aggiornamento inline di un singolo campo SKU.
        // La logica è identica a quella del prodotto, ma punta alla servlet SKU.
        return postFormUrlEncoded('apifornitoreskuaggiorna', { id, campo, valore });
    }

    async function rimuoviAssociazioneProdottoSku(prodottoId, skuId) {
        // Rimuove l'associazione tra un prodotto semplice e una SKU,
        // senza necessariamente eliminare la SKU dal database.
        return postFormUrlEncoded('apifornitoreassociazionerimuovi', {
            tipoRelazione: 'PRODOTTO_SKU',
            prodottoId,
            skuId
        });
    }

    async function rimuoviAssociazionePadreFiglio(figlioId, padreId) {
        // Rimuove la relazione gerarchica tra padre e figlio.
        // In pratica il figlio viene sganciato dal prodotto composto padre.
        return postFormUrlEncoded('apifornitoreassociazionerimuovi', {
            tipoRelazione: 'PADRE_FIGLIO',
            figlioId,
            padreId
        });
    }

    async function eliminaOggetto(id, tipo, returnProdottoId = null) {
        // Elimina un oggetto dal sistema.
        // "tipo" serve alla servlet per capire se deve eliminare una SKU oppure un prodotto.
        // returnProdottoId viene passato quando può essere utile al server
        // per restituire il contesto corretto dopo l'eliminazione.
        return postFormUrlEncoded('apifornitoreoggettoelimina', {
            id,
            tipo,
            returnProdottoId
        });
    }

    return {
        // Espongo i metodi del modulo API, così gli altri file possono richiamarli.
        postFormUrlEncoded,
        caricaSkuDisponibili,
        caricaProdottiDisponibili,
        caricaDettaglioProdotto,
        aggiornaCampoProdotto,
        aggiornaCampoSku,
        rimuoviAssociazioneProdottoSku,
        rimuoviAssociazionePadreFiglio,
        eliminaOggetto
    };
})();