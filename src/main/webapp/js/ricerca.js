
window.ricercaPage = (function () {
    const stato = {
        keywordCorrente: '',
        risultati: [],
        selezionato: null,
        dettaglioCompleto: null
    };

    let inputRicerca;
    let btnCerca;
    let risultatiContainer;
    let dettaglioContainer;
    let messageBoxRicerca;

    async function init() {
        inputRicerca = document.getElementById('input-ricerca');
        btnCerca = document.getElementById('btn-cerca');
        risultatiContainer = document.getElementById('ricerca-risultati');
        dettaglioContainer = document.getElementById('ricerca-dettaglio');
        messageBoxRicerca = document.getElementById('message-box-ricerca');

        if (btnCerca) {
            btnCerca.addEventListener('click', onClickCerca);
        }

        if (inputRicerca) {
            inputRicerca.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    onClickCerca();
                }
            });
        }

        renderStatoIniziale();
    }

    async function onClickCerca() {
        nascondiMessaggiRicerca();

        const keyword = (inputRicerca?.value || '').trim();

        if (!keyword) {
            mostraMessaggioRicerca('Inserisci una parola chiave per cercare prodotti e SKU.', 'error');
            return;
        }

        await eseguiRicerca(keyword);
    }

    async function eseguiRicerca(keyword) {
        try {
            const response = await fetch(`apifornitorericerca?keyword=${encodeURIComponent(keyword)}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            stato.keywordCorrente = data?.keyword || keyword;
            stato.risultati = normalizzaRisultati(data);
            stato.selezionato = null;
            stato.dettaglioCompleto = null;

            renderRisultati();
            renderDettaglioVuoto();
        } catch (error) {
            console.error('[ricerca.js] errore durante la ricerca:', error);
            mostraMessaggioRicerca(
                error.message || 'Errore durante la ricerca.',
                'error'
            );
        }
    }

    function normalizzaRisultati(data) {
        const risultati = [];

        const prodotti = Array.isArray(data?.prodotti) ? data.prodotti : [];
        const sku = Array.isArray(data?.sku) ? data.sku : [];

        prodotti.forEach(function (prodotto) {
            risultati.push({
                categoria: 'PRODOTTO',
                tipo: prodotto.tipo || 'PRODOTTO',
                id: prodotto.id,
                nome: prodotto.nome,
                codice: prodotto.codice,
                raw: prodotto
            });
        });

        sku.forEach(function (item) {
            risultati.push({
                categoria: 'SKU',
                tipo: 'SKU',
                id: item.id,
                nome: item.nome,
                codice: item.codice,
                prezzo: item.prezzo,
                raw: item
            });
        });

        return risultati;
    }

    function renderStatoIniziale() {
        if (!risultatiContainer) {
            return;
        }

        risultatiContainer.innerHTML = `
            <p class="empty-box">
                Inserisci una parola chiave per cercare prodotti e SKU.
            </p>
        `;

        renderDettaglioVuoto();
    }

    function renderRisultati() {
        if (!risultatiContainer) {
            return;
        }

        risultatiContainer.innerHTML = '';

        if (!stato.risultati || stato.risultati.length === 0) {
            risultatiContainer.innerHTML = `
                <p class="empty-box">
                    Nessun risultato trovato per <strong>${escapeHtml(stato.keywordCorrente)}</strong>.
                </p>
            `;
            return;
        }

        const lista = document.createElement('ul');
        lista.className = 'result-list';

        stato.risultati.forEach(function (item) {
            const li = document.createElement('li');
            li.className = 'result-item';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'result-link';

            if (stato.selezionato &&
                stato.selezionato.id === item.id &&
                stato.selezionato.categoria === item.categoria) {
                button.classList.add('is-active');
            }

            button.addEventListener('click', function () {
                selezionaRisultato(item);
            });

            const main = document.createElement('span');
            main.className = 'result-main';

            const titolo = document.createElement('span');
            titolo.textContent = item.nome || 'Senza nome';

            const codice = document.createElement('span');
            codice.className = 'result-code';
            codice.textContent = `Codice: ${item.codice ?? '-'}`;

            main.appendChild(titolo);
            main.appendChild(codice);

            const badge = document.createElement('span');
            badge.className = 'result-badge';
            badge.textContent = getEtichettaTipo(item);

            button.appendChild(main);
            button.appendChild(badge);
            li.appendChild(button);
            lista.appendChild(li);
        });

        risultatiContainer.appendChild(lista);
    }

    async function selezionaRisultato(item) {
        stato.selezionato = item;
        stato.dettaglioCompleto = null;
        renderRisultati();
        renderDettaglioCaricamento(item);

        try {
            if (item.categoria === 'SKU') {
                stato.dettaglioCompleto = item.raw || item;
                renderDettaglio(stato.dettaglioCompleto);
                return;
            }

            const dettaglio = await caricaDettaglioProdotto(item.id, item.tipo);
            stato.dettaglioCompleto = dettaglio || item.raw;
            renderDettaglio(stato.dettaglioCompleto);
        } catch (error) {
            console.error('[ricerca.js] errore caricamento dettaglio:', error);
            mostraMessaggioRicerca(
                error.message || 'Impossibile caricare il dettaglio selezionato.',
                'error'
            );
            renderDettaglio(item.raw || item);
        }
    }

    function renderDettaglio(item) {
        if (!dettaglioContainer) {
            return;
        }

        if (!item) {
            renderDettaglioVuoto();
            return;
        }

        if (stato.selezionato?.categoria === 'SKU') {
            renderDettaglioSkuRicerca(item);
            return;
        }

        renderDettaglioProdottoRicerca(item);
    }

    function renderDettaglioCaricamento(item) {
        if (!dettaglioContainer) {
            return;
        }

        dettaglioContainer.innerHTML = `
            <p class="detail-empty-box">
                Caricamento dettaglio di <strong>${escapeHtml(item?.nome || 'elemento')}</strong>...
            </p>
        `;
    }

    function renderDettaglioSkuRicerca(sku) {
        if (!window.skuPage || typeof window.skuPage.renderDettaglioSkuInContainer !== 'function') {
            dettaglioContainer.innerHTML = `
                <p class="detail-empty-box">
                    Renderer dettaglio SKU non disponibile.
                </p>
            `;
            return;
        }

        window.skuPage.renderDettaglioSkuInContainer(sku, dettaglioContainer);
    }

    function renderDettaglioProdottoRicerca(prodotto) {
        if (!window.prodottoPage || typeof window.prodottoPage.renderDettaglioProdottoInContainer !== 'function') {
            dettaglioContainer.innerHTML = `
                <p class="detail-empty-box">
                    Renderer dettaglio prodotto non disponibile.
                </p>
            `;
            return;
        }

        window.prodottoPage.renderDettaglioProdottoInContainer(prodotto, dettaglioContainer);
    }

    function renderDettaglioVuoto() {
        if (!dettaglioContainer) {
            return;
        }

        dettaglioContainer.innerHTML = `
            <p class="detail-empty-box">
                Seleziona un risultato per vedere i dettagli.
            </p>
        `;
    }

    function mostraMessaggioRicerca(messaggio, tipo) {
        if (!messageBoxRicerca) {
            return;
        }

        messageBoxRicerca.hidden = false;
        messageBoxRicerca.textContent = messaggio;
        messageBoxRicerca.className = tipo === 'success'
            ? 'alert alert-success'
            : 'alert alert-error';
    }

    function nascondiMessaggiRicerca() {
        if (!messageBoxRicerca) {
            return;
        }

        messageBoxRicerca.hidden = true;
        messageBoxRicerca.textContent = '';
        messageBoxRicerca.className = 'alert';
    }

    function getEtichettaTipo(item) {
        if (item.categoria === 'SKU') return 'SKU';
        if (item.tipo === 'SEMPLICE') return 'SEMPLICE';
        if (item.tipo === 'COMPOSTO') return 'COMPOSTO';
        return 'PRODOTTO';
    }

    async function caricaDettaglioProdotto(idProdotto, tipoProdotto) {
        const tipoNormalizzato = (tipoProdotto || '').toString().trim().toUpperCase();
        const response = await fetch(
            `apifornitoreprodotto-dettaglio?id=${encodeURIComponent(idProdotto)}&tipo=${encodeURIComponent(tipoNormalizzato)}`,
            {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json'
                }
            }
        );

        return window.appFornitore.parseJsonResponse(response);
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
        init
    };
})();
