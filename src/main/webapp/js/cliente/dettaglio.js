window.dettaglioPage = (function () {

    // id dell'ultima configurazione caricata
    let configurazioneIdCorrente = null;

    // riferimenti DOM
    let titolo;
    let btnModifica;
    let metaCreata;
    let metaModifica;
    let metaPrezzo;
    let skuTbody;

    function init() {
        titolo = document.getElementById('dettaglio-titolo');
        btnModifica = document.getElementById('dettaglio-btn-modifica');
        metaCreata = document.getElementById('dettaglio-data-creazione');
        metaModifica = document.getElementById('dettaglio-data-modifica');
        metaPrezzo = document.getElementById('dettaglio-prezzo');
        skuTbody = document.getElementById('dettaglio-sku-tbody');

        if (btnModifica) {
            btnModifica.addEventListener('click', e => {
                e.preventDefault();
                if (configurazioneIdCorrente && window.configurazioniPage) {
                    if (window.sceltaSkuPage?.apriProdotto && stato.configurazione) {
                        window.sceltaSkuPage.apriProdotto(
                            stato.configurazione.prodottoId,
                            stato.configurazione.prodottoNome || '',
                            configurazioneIdCorrente,
                            stato.configurazione.nome
                        );
                    }
                }
            });
        }

        return Promise.resolve();
    }

    // stato locale: configurazione correntemente mostrata
    const stato = { configurazione: null };

    // chiamato da altri moduli (sceltaSku, configurazioni) per aprire il dettaglio
    async function apriConfigurazione(id) {
        configurazioneIdCorrente = id;
        window.appCliente.nascondiMessaggi();
        window.appCliente.mostraSezione('dettaglio');
        await caricaDettaglio(id);
    }

    async function caricaDettaglio(id) {
        try {
            const resp = await fetch(`api/cliente/configurazione?id=${encodeURIComponent(id)}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            const conf = await window.appCliente.parseJsonResponse(resp);
            stato.configurazione = conf;
            renderDettaglio(conf);
        } catch (err) {
            console.error('[dettaglio.js] errore caricamento:', err);
            window.appCliente.mostraMessaggio(
                err.message || 'Errore durante il caricamento del dettaglio.', 'error'
            );
        }
    }

    function renderDettaglio(conf) {
        if (!conf)
            return;

        if (titolo)
            titolo.textContent = conf.nome || 'Configurazione';
        if (metaCreata)
            metaCreata.textContent = formattaData(conf.dataCreazione);
        if (metaModifica)
            metaModifica.textContent = conf.dataUltimaModifica ? formattaData(conf.dataUltimaModifica) : '—';
        if (metaPrezzo)
            metaPrezzo.textContent = '€ ' + formattaPrezzo(conf.prezzoTotale);

        if (!skuTbody)
            return;
        skuTbody.innerHTML = '';

        const skuScelte = normalizzaSkuScelte(conf.skuScelte);

        let totale = 0;

        skuScelte.forEach(entry => {
            const sku = entry.sku || entry;
            totale += Number(sku.prezzo || 0);

            const tr = document.createElement('tr');
            const cCodice = document.createElement('td'); cCodice.textContent  = sku.codice || '—';
            const cNome = document.createElement('td'); cNome.textContent = sku.nome || '—';
            const cDesc = document.createElement('td');
            cDesc.textContent = sku.descrizioneTecnica || '—';
            cDesc.style.cssText = 'max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
            const cPrezzo = document.createElement('td');
            cPrezzo.textContent = '€ ' + formattaPrezzo(sku.prezzo);

            tr.append(cCodice, cNome, cDesc, cPrezzo);
            skuTbody.appendChild(tr);
        });

        // riga totale nel tfoot (già presente nell'HTML statico)
        const tfootTotale = document.getElementById('dettaglio-totale');
        if (tfootTotale)
            tfootTotale.textContent = '€ ' + formattaPrezzo(totale);
    }

    function normalizzaSkuScelte(skuScelte) {
        if (skuScelte && typeof skuScelte === 'object')
            return Object.values(skuScelte);
        return [];
    }

    function formattaData(isoString) {
        if (!isoString)
            return '—';
        try {
            const d = new Date(isoString);
            const pad = n => String(n).padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} `
                 + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch { return isoString; }
    }

    function formattaPrezzo(prezzo) {
        const n = Number(prezzo);
        return Number.isNaN(n) ? '0,00' : n.toFixed(2).replace('.', ',');
    }

    return { init, apriConfigurazione };
})();
