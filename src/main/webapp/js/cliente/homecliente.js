window.homeClientePage = (function () {

    // stato locale del modulo (inizializzato ma poi cambia in base alla risposta dell'API)
    const stato = {
        paginaCorrente: 0,
        totalePagine: 1
    };

    let listaProdotti;
    let paginazioneBox;

    // chiamata una sola volta all'avvio dell'app, per inizializzare i riferimenti agli elementi HTML e caricare la prima pagina di prodotti
    // async perchè in main.js si fa il catch (che esiste solo su una Promise)
    async function init() {
        listaProdotti = document.getElementById('lista-prodotti-home');
        paginazioneBox = document.getElementById('paginazione-home');
    }

    // chiamata ogni volta che la sezione torna visibile
    async function onMostra() {
        await caricaPagina(stato.paginaCorrente);
    }

    async function caricaPagina(pagina) {
        try {
            const resp = await fetch(`api/cliente/prodotti?pagina=${pagina}`, {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            const data = await window.appCliente.parseJsonResponse(resp);

            stato.paginaCorrente = data.paginaCorrente ?? pagina;
            stato.totalePagine = data.totalePagine ?? 1;

            // renderizza nell' html la lista dei prodotti e la paginazione in base alla risposta dell'API
            renderLista(data.prodotti || []);
            renderPaginazione();
        } catch (err) {
            console.error('[homecliente.js] errore caricamento prodotti:', err);
            window.appCliente.mostraMessaggio(
                err.message || 'Errore durante il caricamento dei prodotti.', 'error'
            );
        }
    }

    // renderizza la lista dei prodotti nell' HTML, con un link per ogni prodotto che apre il modulo scelta-sku passando l'id e nome del prodotto selezionato
    function renderLista(prodotti) {
        if (!listaProdotti) return;
        listaProdotti.innerHTML = ''; // svuota la lista prima di renderizzare i nuovi prodotti

        // se non ci sono prodotti, mostra un messaggio al posto della lista
        if (prodotti.length === 0) {
            const vuoto = document.createElement('p');
            vuoto.style.cssText = 'color:var(--text-muted);text-align:center;padding:2rem 0;';
            vuoto.textContent = 'Nessun prodotto disponibile al momento.';
            listaProdotti.appendChild(vuoto);
            return;
        }

        // altrimenti, per ogni prodotto crea un elemento <li> con un link che apre il modulo scelta-sku passando l'id e nome del prodotto selezionato
        prodotti.forEach((p, i) => {
            // crea un elemento <li>
            const li = document.createElement('li');

            // aggiunge un bordo inferiore a tutti gli <li> tranne l'ultimo, per separare visivamente i prodotti
            if (i < prodotti.length - 1) {
                li.style.borderBottom = '1px solid var(--border)';
            }

            // crea un link con il nome del prodotto, che al click apre il modulo scelta-sku passando l'id e nome del prodotto selezionato
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = p.nome;
            link.style.cssText = 'display:block;padding:0.9rem 0.5rem;font-size:0.95rem;';
            link.addEventListener('click', e => {
                e.preventDefault();
                window.appCliente.nascondiMessaggi();
                // passa il prodotto selezionato al modulo scelta-sku e apre la sezione
                if (window.sceltaSkuPage?.apriProdotto) {
                    window.sceltaSkuPage.apriProdotto(p.id, p.nome, null);
                }
            });

            li.appendChild(link);
            listaProdotti.appendChild(li);
        });
    }

    // renderizza i pulsanti di paginazione (precedenti/successivi) in base alla pagina corrente e al totale delle pagine, e collega i click dei pulsanti alla funzione caricaPagina per caricare la pagina corrispondente
    function renderPaginazione() {
        if (!paginazioneBox) return;
        paginazioneBox.innerHTML = '';

        if (stato.totalePagine <= 1) {
            paginazioneBox.hidden = true;
            return;
        }

        paginazioneBox.hidden = false;

        if (stato.paginaCorrente > 0) {
            const btnPrec = document.createElement('a');
            btnPrec.href = '#';
            btnPrec.className = 'btn btn-outline btn-sm';
            btnPrec.textContent = '← Precedenti';
            btnPrec.addEventListener('click', e => { e.preventDefault(); caricaPagina(stato.paginaCorrente - 1); });
            paginazioneBox.appendChild(btnPrec);
        }

        const info = document.createElement('span');
        info.textContent = `Pagina ${stato.paginaCorrente + 1} di ${stato.totalePagine}`;
        paginazioneBox.appendChild(info);

        if (stato.paginaCorrente < stato.totalePagine - 1) {
            const btnSucc = document.createElement('a');
            btnSucc.href = '#';
            btnSucc.className = 'btn btn-outline btn-sm';
            btnSucc.textContent = 'Successivi →';
            btnSucc.addEventListener('click', e => { e.preventDefault(); caricaPagina(stato.paginaCorrente + 1); });
            paginazioneBox.appendChild(btnSucc);
        }
    }

    return { init, onMostra };
})(); // esegui immediatamente e assegna il RISULTATO a window.homeClientePage (IIFE - Immediately Invoked Function Expression)
