window.prodottoApi = (function () {
    function getState() {
        // Recupera lo stato condiviso del modulo prodotto.
        return window.prodottoPage.getState();
    }

    async function postFormUrlEncoded(url, params) {
        const body = new URLSearchParams();

        Object.entries(params).forEach(([chiave, valore]) => {
            if (valore != null) {
                body.append(chiave, String(valore));
            }
        });

        const response = await fetch(url, {
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

    async function caricaSkuDisponibili() {
        // Carica tutte le SKU disponibili e aggiorna il form del prodotto semplice.
        const state = getState();

        const response = await fetch('api/fornitore/sku', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });

        const data = await window.appFornitore.parseJsonResponse(response);

        state.skuDisponibiliCache = Array.isArray(data) ? data : [];
        window.prodottoForm.aggiornaListaSku(state.skuDisponibiliCache);
    }

    async function caricaProdottiDisponibili() {
        // Carica i prodotti top-level che possono essere agganciati
        // come figli iniziali di un composto.
        const state = getState();

        const response = await fetch('api/fornitore/prodotti-disponibili', {
            method: 'GET',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });

        const data = await window.appFornitore.parseJsonResponse(response);

        state.prodottiDisponibiliCache = Array.isArray(data)
            ? data.filter((prodotto) => prodotto && prodotto.id != null && prodotto.padreId == null)
            : [];

        window.prodottoForm.renderProdottiDisponibili(state.prodottiDisponibiliCache);
    }

    async function caricaDettaglioProdotto(idProdotto, tipoProdotto) {
        // Carica il dettaglio completo di un prodotto.
        const response = await fetch(
            `api/fornitore/prodotto-dettaglio?id=${encodeURIComponent(idProdotto)}&tipo=${encodeURIComponent(String(tipoProdotto || '').trim().toUpperCase())}`,
            {
                method: 'GET',
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            }
        );

        return window.appFornitore.parseJsonResponse(response);
    }

    async function aggiornaCampoProdotto(id, campo, valore) {
        // Aggiornamento inline di un singolo attributo prodotto.
        return postFormUrlEncoded('api/fornitore/prodotto/aggiorna', { id, campo, valore });
    }

    async function aggiornaCampoSku(id, campo, valore) {
        // Aggiornamento inline di un singolo attributo SKU.
        return postFormUrlEncoded('api/fornitore/sku/aggiorna', { id, campo, valore });
    }

    async function rimuoviAssociazioneProdottoSku(prodottoId, skuId) {
        // Rimuove l'associazione tra prodotto semplice e SKU.
        return postFormUrlEncoded('api/fornitore/associazione/rimuovi', {
            tipoRelazione: 'PRODOTTO_SKU',
            prodottoId,
            skuId
        });
    }

    async function rimuoviAssociazionePadreFiglio(figlioId, padreId) {
        // Rimuove la relazione gerarchica tra padre e figlio.
        return postFormUrlEncoded('api/fornitore/associazione/rimuovi', {
            tipoRelazione: 'PADRE_FIGLIO',
            figlioId,
            padreId
        });
    }

    async function eliminaOggetto(id, tipo, returnProdottoId = null) {
        // Elimina una SKU o un prodotto.
        return postFormUrlEncoded('api/fornitore/oggetto/elimina', {
            id,
            tipo,
            returnProdottoId
        });
    }

    return {
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