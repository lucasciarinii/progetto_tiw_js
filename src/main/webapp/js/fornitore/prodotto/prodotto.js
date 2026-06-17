window.prodottoPage = (function () {
    // Stato condiviso del modulo prodotto.
    // Qui teniamo riferimenti al DOM, cache locali e stato del builder.
    const state = {
        // Form di creazione prodotto semplice.
        formProdottoSemplice: null,

        // Form di avvio creazione prodotto composto.
        formProdottoComposto: null,

        // Lista delle SKU disponibili nel form del prodotto semplice.
        listaSkuDisponibili: null,

        // Messaggio mostrato quando non ci sono SKU disponibili.
        hintSkuVuote: null,

        // Lista dei prodotti disponibili come figli iniziali di un composto.
        listaFigliDisponibili: null,

        // Messaggio mostrato quando non ci sono prodotti disponibili.
        hintProdottiVuoti: null,

        // Contenitore del pannello di destra.
        // Qui mostriamo il dettaglio prodotto oppure il builder del composto.
        dettaglioContent: null,

        // Cache locale delle SKU caricate dal server.
        skuDisponibiliCache: [],

        // Cache locale dei prodotti disponibili caricati dal server.
        prodottiDisponibiliCache: [],

        // Stato corrente del builder del prodotto composto.
        // Se è null, non c'è nessuna bozza attiva.
        builderState: null,

        // Contatori progressivi per gli id client-side del builder.
        builderNodeSeq: 0,
        builderSkuSeq: 0
    };

    function getState() {
        // Espone lo stato condiviso agli altri moduli del blocco prodotto.
        return state;
    }
    async function init() {
        // Recupero dei riferimenti DOM principali della sezione home.
        state.formProdottoSemplice = document.getElementById('form-crea-semplice');
        state.formProdottoComposto = document.getElementById('form-crea-composto');
        state.listaSkuDisponibili = document.getElementById('lista-sku-disponibili');
        state.hintSkuVuote = document.getElementById('hint-sku-vuote');
        state.listaFigliDisponibili = document.getElementById('lista-prodotti-disponibili');
        state.hintProdottiVuoti = document.getElementById('hint-prodotti-vuoti');
        state.dettaglioContent = document.getElementById('dettaglio-content');

        // Collego gli eventi dei form.
        window.prodottoForm.bindEvents();

        // Carico subito i dati necessari ai form.
        await Promise.all([
            window.prodottoApi.caricaSkuDisponibili(),
            window.prodottoApi.caricaProdottiDisponibili()
        ]);
    }

    return {
        init,
        getState,
        // Shortcut utile per forzare il refresh della lista SKU.
        caricaSkuDisponibili: () => window.prodottoApi.caricaSkuDisponibili(),

        // Shortcut verso il modulo dettaglio prodotto.
        renderDettaglioProdottoInContainer: (prodotto, container) =>
            window.prodottoDettaglio.renderDettaglioProdottoInContainer(prodotto, container)
    };
})();