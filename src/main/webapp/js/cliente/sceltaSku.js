window.sceltaSkuPage = (function () {

    // stato locale del modulo -> ovvero il prodotto corrente: id, nome e configurazione da modificare (se presente)
    const stato = {
        prodottoId:       null,
        prodottoNome:     null,
        configurazioneId: null, // null = nuova, intero = modifica
        skuPreselezionate: null // Map<prodottoSempliceId, skuId>
    };

    let titoloProdotto;
    let inputNomeConf;
    let alberoContainer;
    let btnSalva;
    let messageBox;

    // inizializza i riferimenti ai nodi DOM e collega gli event listener, viene chiamato da homecliente.js all'avvio dell'app
    async function init() {
        titoloProdotto = document.getElementById('scelta-sku-titolo');
        inputNomeConf = document.getElementById('input-nome-conf');
        alberoContainer = document.getElementById('albero-scelta-sku');
        btnSalva = document.getElementById('btn-salva-configurazione');
        messageBox = document.getElementById('message-box-scelta-sku');

        if (btnSalva) btnSalva.addEventListener('click', onClickSalva);
    }

    // chiamato da homecliente.js o da configurazioni.js al click su un prodotto
    async function apriProdotto(prodottoId, prodottoNome, configurazioneId, nomeConfPrecompilato) {
        stato.prodottoId = prodottoId;
        stato.prodottoNome = prodottoNome;

        // parametri configurazioneId e nomeConfPrecompilato sono effettivamente VALIDI solo se si sta modificando una configurazione esistente, altrimenti sono null
        stato.configurazioneId = configurazioneId || null; // null || null = null
        stato.skuPreselezionate = null;

        // controlli di sicurezza sull'esistenza degli elementi html
        if (titoloProdotto)
            titoloProdotto.textContent = 'Prodotto: ' + (prodottoNome || '');
        if (inputNomeConf)
            inputNomeConf.value = nomeConfPrecompilato || '';
        if (alberoContainer)
            alberoContainer.innerHTML = '';

        window.appCliente.nascondiMessaggi();
        window.appCliente.mostraSezione('scelta-sku');

        // se configurazioneId non è null, carica le SKU pre-selezionate per precompilare i <select> (in caso di modifica di una configurazione esistente)
        if (stato.configurazioneId) {
            stato.skuPreselezionate = await caricaSkuPreselezionate(stato.configurazioneId);
        }

        await caricaSottoprodotti(prodottoId, alberoContainer, 0);
    }

    // carica i figli diretti di un nodo e li aggiunge al contenitore passato
    // il "livello" serve solo per aggiungere una classe CSS che aumenta l'indentazione dei nodi figli
    async function caricaSottoprodotti(idProdotto, container, livello) {
        try {
            const resp = await fetch(`api/cliente/sottoprodotti?id=${encodeURIComponent(idProdotto)}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            const figli = await window.appCliente.parseJsonResponse(resp);
            renderFigli(figli, container, livello);
        } catch (err) {
            console.error('[sceltaSku.js] errore caricamento sottoprodotti:', err);
            window.appCliente.mostraMessaggio(
                err.message || 'Errore nel caricamento dei componenti.', 'error'
            );
        }
    }

    // costruisce i nodi DOM per l'elenco di figli ricevuto
    function renderFigli(figli, container, livello) {
        if (!container) return;

        (figli || []).forEach(figlio => { // se figli è null o undefined, itera su un array vuoto per evitare errori
            if (figlio.tipo === 'SEMPLICE') {
                container.appendChild(creaNodoSemplice(figlio, livello));
            } else if (figlio.tipo === 'COMPOSTO') {
                container.appendChild(creaNodoComposto(figlio, livello));
            }
        });
    }

    // nodo semplice: mostra un <select> per scegliere la SKU
    function creaNodoSemplice(prodotto, livello) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tree-nodo-semplice';
        wrapper.dataset.prodottoId = prodotto.id;
        if (livello > 0)
            wrapper.className += 'tree-nodo-figli';

        const header = document.createElement('div');
        header.className = 'tree-nodo-header';
        header.innerHTML = escapeHtml(prodotto.nome) + `<span class="codice">[${escapeHtml(prodotto.codice)}]</span>`;
        wrapper.appendChild(header);

        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = 'Scegli SKU';
        label.htmlFor = `sku-select-${prodotto.id}`;
        formGroup.appendChild(label);

        const select = document.createElement('select');
        select.id = `sku-select-${prodotto.id}`;
        select.name = `sku_${prodotto.id}`;
        select.dataset.prodottoId = prodotto.id;

        // opzione vuota iniziale
        const optVuota = document.createElement('option');
        optVuota.value = '';
        optVuota.textContent = '— Seleziona una SKU —';
        select.appendChild(optVuota);

        (prodotto.skuList || []).forEach(sku => {
            const opt = document.createElement('option');
            opt.value = sku.id;
            opt.textContent = `${sku.codice} - ${sku.nome} - €${formattaPrezzo(sku.prezzo)}`;
            select.appendChild(opt);
        });

        // Nel caso di modifica di una configurazione esistente, pre-seleziona la SKU già scelta in precedenza per questo prodotto (inserite in stato.skuPreselezionate da caricaSkuPreselezionate)
        const skuPre = stato.skuPreselezionate?.get(String(prodotto.id));
        if (skuPre != null)
            select.value = String(skuPre);

        formGroup.appendChild(select);
        wrapper.appendChild(formGroup);
        return wrapper;
    }

    // nodo composto: header cliccabile che espande i figli via fetch
    function creaNodoComposto(prodotto, livello) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tree-nodo-composto';
        wrapper.dataset.prodottoId = prodotto.id;

        const header = document.createElement('div');
        header.className = 'tree-nodo-header';
        header.style.cursor = 'pointer';
        header.innerHTML = `▶ ${escapeHtml(prodotto.nome)}` + `<span class="codice">[${escapeHtml(prodotto.codice)}]</span>`;

        const figliContainer = document.createElement('div');
        figliContainer.className = 'tree-nodo-figli';
        figliContainer.hidden = true;
        figliContainer.classList.add('tree-collapsed');

        let caricato = false;

        header.addEventListener('click', async () => {
            // Lazy Loading: carica i figli solo al primo click, poi mostra/nascondi senza rifare fetch
            if (!caricato) {
                await caricaSottoprodotti(prodotto.id, figliContainer, livello + 1);
                caricato = true;
            }

            const isOpened = figliContainer.hidden; // se hidden = true -> isOpened = true
            figliContainer.hidden = !isOpened; // inverte lo stato di visibilità
            figliContainer.classList.toggle('tree-collapsed', !isOpened); // se isOpened = true -> rimuove la classe tree-collapsed, altrimenti la aggiunge

            // ricostruisce l'header con la freccia giusta in base allo stato di apertura
            header.innerHTML = (isOpened ? '▼ ' : '▶ ')
                + escapeHtml(prodotto.nome)
                + `<span class="codice">[${escapeHtml(prodotto.codice)}]</span>`;
        });

        wrapper.appendChild(header);
        wrapper.appendChild(figliContainer);
        return wrapper;
    }

    // raccoglie tutti i <select> nell'albero e verifica che ognuno abbia un valore
    async function onClickSalva() {
        window.appCliente.nascondiMessaggi();

        const nomeConf = inputNomeConf?.value.trim();
        if (!nomeConf) {
            window.appCliente.mostraMessaggio('Inserisci un nome per la configurazione.', 'error');
            return;
        }

        const selects = alberoContainer?.querySelectorAll('select[data-prodotto-id]') || [];
        const corpo = new URLSearchParams();
        corpo.append('prodottoId', stato.prodottoId);
        corpo.append('nomeConf', nomeConf);
        if (stato.configurazioneId) corpo.append('configurazioneId', stato.configurazioneId);

        let tutteScelte = true;
        selects.forEach(sel => {
            if (!sel.value) {
                tutteScelte = false;
            } else {
                corpo.append(`sku_${sel.dataset.prodottoId}`, sel.value);
            }
        });

        if (!tutteScelte) {
            window.appCliente.mostraMessaggio(
                'Seleziona una SKU per ogni componente prima di salvare.', 'error'
            );
            return;
        }

        try {
            const resp = await fetch('api/cliente/configurazione/salva', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: corpo.toString()
            });
            const data = await window.appCliente.parseJsonResponse(resp);

            // dopo il salvataggio apriamo direttamente il dettaglio
            if (window.dettaglioPage?.apriConfigurazione) {
                window.dettaglioPage.apriConfigurazione(data.id);
            }
        } catch (err) {
            console.error('[sceltaSku.js] errore salvataggio:', err);
            window.appCliente.mostraMessaggio(
                err.message || 'Errore durante il salvataggio.', 'error'
            );
        }
    }

    // formatta un numero come prezzo con 2 decimali, se non è un numero restituisce '0.00'
    function formattaPrezzo(prezzo) {
        const n = Number(prezzo);
        return Number.isNaN(n) ? '0.00' : n.toFixed(2);
    }

    // funzione di utilità per evitare problemi di XSS (Cross-Site scripting, codice dannoso), usata quando si inserisce testo dinamico nell'HTML
    function escapeHtml(v) {
        return String(v ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    // carica la configurazione esistente (se presente) per precompilare i <select> con le SKU già scelte, restituisce una mappa prodottoSempliceId -> skuId
    async function caricaSkuPreselezionate(configurazioneId) {
        try {
            const resp = await fetch(`api/cliente/configurazione?id=${encodeURIComponent(configurazioneId)}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            const conf = await window.appCliente.parseJsonResponse(resp);
            return costruisciMappaSku(conf?.skuScelte);
        } catch (err) {
            console.error('[sceltaSku.js] errore caricamento configurazione:', err);
            window.appCliente.mostraMessaggio(
                err.message || 'Errore nel caricamento della configurazione.', 'error'
            );
            return null;
        }
    }

    // Costruisce e restituisce una mappa ID PRODOTTO SEMPLICE -> ID SKU SELEZIONATA
    function costruisciMappaSku(skuScelte) {
        const mappa = new Map();

        // skuScelte viene serializzato dal backend come oggetto
        if (skuScelte && typeof skuScelte === 'object') {
            Object.entries(skuScelte).forEach(([prodottoId, sku]) => {
                const skuId = sku?.id ?? sku?.skuId ?? sku;
                if (skuId != null) mappa.set(String(prodottoId), String(skuId));
            });
        }

        return mappa;
    }

    return { init, apriProdotto };
})();
