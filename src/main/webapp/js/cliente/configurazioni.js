window.configurazioniPage = (function () {

    let tabellaBody;
    let statoVuoto;

    async function init() {
        tabellaBody = document.getElementById('configurazioni-tbody');
        statoVuoto  = document.getElementById('configurazioni-vuoto');
    }

    // ricarica i dati ogni volta che la sezione diventa visibile
    async function onMostra() {
        await caricaConfigurazioni();
    }

    // Carica le configurazioni del cliente dall'API e le passa alla funzione di rendering
    async function caricaConfigurazioni() {
        try {
            const resp = await fetch('api/cliente/configurazioni', {
                method: 'GET',
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            });
            const data = await window.appCliente.parseJsonResponse(resp);
            renderTabella(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('[configurazioni.js] errore caricamento:', err);
            window.appCliente.mostraMessaggio(
                err.message || 'Errore durante il caricamento delle configurazioni.', 'error'
            );
        }
    }

    function renderTabella(configurazioni) {
        if (!tabellaBody) return;
        tabellaBody.innerHTML = '';

        if (configurazioni.length === 0) {
            // Se non ci sono configurazioni, mostra messaggio di "nessuna configurazione" e nascondi la tabella per evitare di mostrare intestazioni vuote (nome, data, ecc..)
            if (statoVuoto)
                statoVuoto.hidden = false;
            if (tabellaBody.closest('.table-wrapper')) {
                tabellaBody.closest('.table-wrapper').hidden = true;
            }
            return;
        }

        // Se ci sono configurazioni, nascondi l'eventuale messaggio di "nessuna configurazione" e mostra la tabella (nel caso fosse nascosta)
        if (statoVuoto)
            statoVuoto.hidden = true;
        if (tabellaBody.closest('.table-wrapper')) {
            tabellaBody.closest('.table-wrapper').hidden = false;
        }

        // Nota: il closest('.table-wrapper') serve per trovare il div di classe .table-wrapper appena sopra al body della tabella in modo da nascondere anche le intestazioni e non lasciare una tabella vuota con solo le intestazioni visibili

        // Per ogni configurazione, crea una riga con i dati e le azioni disponibili (modifica, clona, cancella)
        configurazioni.forEach(conf => {
            const tr = document.createElement('tr');

            // Nome cliccabile → apre dettaglio
            const tdNome = document.createElement('td');
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = conf.nome;
            link.addEventListener('click', e => {
                e.preventDefault();
                if (window.dettaglioPage?.apriConfigurazione) {
                    window.dettaglioPage.apriConfigurazione(conf.id);
                }
            });
            tdNome.appendChild(link);

            const tdCreata= document.createElement('td');
            tdCreata.textContent = formattaData(conf.dataCreazione);

            const tdModifica= document.createElement('td');
            tdModifica.textContent = conf.dataUltimaModifica ? formattaData(conf.dataUltimaModifica) : '—';

            const tdPrezzo= document.createElement('td');
            tdPrezzo.textContent = '€ ' + formattaPrezzo(conf.prezzoTotale);

            // Azioni
            const tdAzioni= document.createElement('td');
            const divAzioni= document.createElement('div');
            divAzioni.style.cssText = 'display:flex; gap:0.5rem; flex-wrap: wrap;';

            // Modifica → torna alla scelta SKU con i dati precaricati
            const btnModifica = document.createElement('a');
            btnModifica.href = '#';
            btnModifica.className = 'btn btn-outline btn-sm';
            btnModifica.textContent = 'Modifica';
            btnModifica.addEventListener('click', e => {
                e.preventDefault();
                if (window.sceltaSkuPage?.apriProdotto) {
                    window.sceltaSkuPage.apriProdotto(conf.prodottoId, conf.prodottoNome || '', conf.id, conf.nome);
                }
            });

            // Clona
            const btnClona = document.createElement('button');
            btnClona.type = 'button';
            btnClona.className = 'btn btn-ghost btn-sm';
            btnClona.textContent = 'Clona';
            btnClona.addEventListener('click', () => clonaConfigurazione(conf.id));

            // Cancella
            const btnCancella = document.createElement('button');
            btnCancella.type = 'button';
            btnCancella.className = 'btn btn-danger btn-sm';
            btnCancella.textContent = 'Cancella';
            btnCancella.addEventListener('click', () => cancellaConfigurazione(conf.id));

            divAzioni.append(btnModifica, btnClona, btnCancella);
            tdAzioni.appendChild(divAzioni);

            tr.append(tdNome, tdCreata, tdModifica, tdPrezzo, tdAzioni);

            // Aggiunge la riga alla tabella
            tabellaBody.appendChild(tr);
        });
    }

    async function clonaConfigurazione(id) {
        if (!window.confirm('Clonare questa configurazione?')) return;
        try {
            const corpo = new URLSearchParams({ configurazioneId: id });
            const resp = await fetch('api/cliente/configurazione/clona', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: corpo.toString()
            });
            await window.appCliente.parseJsonResponse(resp);
            window.appCliente.mostraMessaggio('Configurazione clonata con successo.', 'success');
            await caricaConfigurazioni();
        } catch (err) {
            console.error('[configurazioni.js] errore clona:', err);
            window.appCliente.mostraMessaggio(err.message || 'Errore durante la clonazione.', 'error');
        }
    }

    async function cancellaConfigurazione(id) {
        if (!window.confirm('Eliminare questa configurazione?')) return;
        try {
            const corpo = new URLSearchParams({ configurazioneId: id });
            const resp = await fetch('api/cliente/configurazione/cancella', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: corpo.toString()
            });
            await window.appCliente.parseJsonResponse(resp);
            window.appCliente.mostraMessaggio('Configurazione eliminata.', 'success');
            await caricaConfigurazioni();
        } catch (err) {
            console.error('[configurazioni.js] errore cancella:', err);
            window.appCliente.mostraMessaggio(err.message || 'Errore durante la cancellazione.', 'error');
        }
    }

    // Formattazione data dd/MM/yyyy HH:mm (in MySQL è memorizzata come ISO 8601, es. 2024-05-31T14:30:000Z)
    function formattaData(isoString) {
        if (!isoString)
            return '—';
        try {
            const d = new Date(isoString); // trasforma in oggetto Date nativo JS in modo da poter estrarre giorno, mese, anno, ore e minuti
            const pad = n => String(n).padStart(2, '0'); // arrow function di utilità per aggiungere uno zero davanti a numeri < 10 (es. 9 → 09)

            // per il mese aggiungo 1 perché in JavaScript i mesi partono da 0
            return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} `
                 + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch { return isoString; }
    }

    function formattaPrezzo(prezzo) {
        const n = Number(prezzo);
        return Number.isNaN(n) ? '0,00' : n.toFixed(2).replace('.', ',');
    }

    return { init, onMostra };
})();
