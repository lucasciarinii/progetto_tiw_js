window.prodottoPage = (function () {
    // Stato interno condiviso tra i vari file del modulo prodotto.
    // Qui salvo sia riferimenti al DOM sia dati temporanei usati dal builder.
    const state = {
        // Form per la creazione di un prodotto semplice.
        formProdottoSemplice: null,

        // Form per l'avvio della creazione di un prodotto composto.
        formProdottoComposto: null,

        // Contenitore della lista di SKU disponibili da selezionare nel form del prodotto semplice.
        listaSkuDisponibili: null,

        // Messaggio mostrato quando non ci sono SKU disponibili.
        hintSkuVuote: null,

        // Contenitore della lista di prodotti disponibili da usare come figli
        // iniziali di un prodotto composto.
        listaFigliDisponibili: null,

        // Messaggio mostrato quando non ci sono prodotti disponibili.
        hintProdottiVuoti: null,

        // Contenitore del pannello di destra:
        // qui viene mostrato o il dettaglio prodotto oppure il builder del composto.
        dettaglioContent: null,

        // Cache locale delle SKU caricate dal server.
        // Serve per evitare di perdere i dati dopo il primo fetch e per riusarli nel builder.
        skuDisponibiliCache: [],

        // Cache locale dei prodotti disponibili caricati dal server.
        prodottiDisponibiliCache: [],

        // Stato della bozza del builder per il prodotto composto.
        // Quando è null significa che non sto costruendo nessun composto lato client.
        builderState: null,

        // Contatori progressivi usati per generare id client-side dei nodi del builder.
        builderNodeSeq: 0,
        builderSkuSeq: 0
    };

    function getState() {
        // Espone lo stato interno agli altri moduli.
        // In questo modo prodottoApi, prodottoForm, prodottoBuilder e prodottoDettaglio
        // lavorano tutti sugli stessi dati condivisi.
        return state;
    }

    function mostraMessaggioGlobale(testo, tipo) {
        // Wrapper minimale per centralizzare l'invio dei messaggi all'interfaccia.
        // Al momento delega tutto al messaggio della home fornitore.
        window.appFornitore.mostraMessaggioHome(testo, tipo);
    }

    async function init() {
        // Recupero tutti gli elementi del DOM che mi servono nella sezione home.
        // Lo faccio una volta sola all'inizializzazione, così poi gli altri moduli
        // trovano i riferimenti già pronti dentro state.
        state.formProdottoSemplice = document.getElementById('form-crea-semplice');
        state.formProdottoComposto = document.getElementById('form-crea-composto');
        state.listaSkuDisponibili = document.getElementById('lista-sku-disponibili');
        state.hintSkuVuote = document.getElementById('hint-sku-vuote');
        state.listaFigliDisponibili = document.getElementById('lista-prodotti-disponibili');
        state.hintProdottiVuoti = document.getElementById('hint-prodotti-vuoti');
        state.dettaglioContent = document.getElementById('dettaglio-content');

        // Collego gli event listener dei form.
        // La logica concreta dei submit sta nel modulo prodottoForm.
        window.prodottoForm.bindEvents();

        // Carico in parallelo:
        // 1) le SKU disponibili
        // 2) i prodotti disponibili
        // Così appena la pagina è pronta, le checkbox nei form sono già popolati.
        await Promise.all([
            window.prodottoApi.caricaSkuDisponibili(),
            window.prodottoApi.caricaProdottiDisponibili()
        ]);
    }

    // Espongo solo quello che serve davvero all'esterno.
    // Il resto resta privato dentro la IIFE.
    return {
        init,
        getState,
        mostraMessaggioGlobale,

        // Shortcut verso il modulo API, utile se da fuori voglio forzare il refresh delle SKU.
        caricaSkuDisponibili: () => window.prodottoApi.caricaSkuDisponibili(),

        // Shortcut verso il modulo dettaglio, utile per delegare il rendering del dettaglio prodotto.
        renderDettaglioProdottoInContainer: (prodotto, container) =>
            window.prodottoDettaglio.renderDettaglioProdottoInContainer(prodotto, container)
    };
})();