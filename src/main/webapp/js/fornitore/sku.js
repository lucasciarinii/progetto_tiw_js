window.skuPage = (function () {

    // Modulo dedicato alla gestione delle SKU lato fornitore.
    // Qui teniamo tutta la logica relativa a:
    // - creazione della SKU dal form nella home;
    // - visualizzazione del dettaglio nel pannello di destra;
    // - modifica inline dei singoli campi;
    // - eliminazione della SKU e aggiornamento della UI collegata.
    //
    // L'idea è concentrare qui il comportamento delle SKU, così gli altri moduli
    // non devono conoscere i dettagli interni di rendering e aggiornamento.
    const stato = {
        // SKU attualmente mostrata nel pannello di dettaglio.
        // Viene mantenuta lato client per poter ridisegnare il dettaglio
        // subito dopo una modifica, senza dover sempre ricaricare tutto da zero.
        skuSelezionata: null
    };

    // Riferimenti agli elementi DOM principali usati da questo modulo.
    // Li inizializziamo in init(), quando la pagina è pronta.
    let formCreaSku;
    let dettaglioContent;

    function mostraMessaggioGlobale(testo, tipo) {
        // Punto unico per decidere dove mostrare i messaggi utente.
        //
        // Se il dettaglio della SKU è aperto dentro la sezione ricerca,
        // conviene usare il box messaggi locale della ricerca stessa,
        // così l'utente vede il feedback nel contesto giusto.
        //
        // In tutti gli altri casi usiamo la messaggistica della home fornitore.
        if (window.appFornitore.getSezioneCorrente?.() === 'ricerca'
            && window.ricercaPage
            && typeof window.ricercaPage.mostraMessaggioRicerca === 'function') {
            window.ricercaPage.mostraMessaggioRicerca(testo, tipo);
            return;
        }

        window.appFornitore.mostraMessaggioHome(testo, tipo);
    }

    async function init() {
        // Recupero degli elementi principali della sezione home fornitore.
        // Se in futuro cambia l'HTML, i primi id da controllare sono questi.
        formCreaSku = document.getElementById('form-crea-sku');
        dettaglioContent = document.getElementById('dettaglio-content');

        // Il form di creazione SKU viene gestito tutto qui:
        // submit, validazione, chiamata al server e aggiornamento della UI.
        if (formCreaSku) {
            formCreaSku.addEventListener('submit', onSubmitCreaSku);
        }

        // All'avvio il pannello di dettaglio parte in stato neutro.
        renderMessaggioDettaglioVuoto();
    }

    async function aggiornaListaSkuProdotti() {
        // Dopo create / update / delete di una SKU è bene riallineare anche prodotto.js,
        // perché il builder dei prodotti semplici o composti può dipendere
        // dalla lista aggiornata delle SKU disponibili.
        if (window.prodottoPage && typeof window.prodottoPage.caricaSkuDisponibili === 'function') {
            await window.prodottoPage.caricaSkuDisponibili();
        }
    }

    async function onSubmitCreaSku(event) {
        // Il submit del form viene gestito via JavaScript:
        // blocchiamo il submit HTML classico e facciamo una chiamata fetch alla servlet JSON.
        event.preventDefault();
        window.appFornitore.nascondiMessaggi();

        const formData = new FormData(formCreaSku);

        // Prima della chiamata al server facciamo una validazione minima lato client.
        // Questo non sostituisce i controlli server-side, ma evita richieste inutili
        // per errori banali già intercettabili nel browser.
        if (!validaFormSku(formData)) {
            return;
        }

        try {
            const response = await fetch('apifornitoreskucrea', {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            });

            const data = await window.appFornitore.parseJsonResponse(response);

            // Gestione un po' difensiva della risposta:
            // il backend potrebbe restituire direttamente la SKU,
            // oppure incapsularla in una proprietà "sku".
            const skuCreata = data && data.sku ? data.sku : data;

            // Se la creazione va a buon fine, puliamo il form
            // e mostriamo subito un feedback all'utente.
            formCreaSku.reset();
            window.appFornitore.mostraMessaggioHome('SKU creata con successo.', 'success');

            // Ricarichiamo le liste collegate usate dalla parte prodotti.
            await aggiornaListaSkuProdotti();

            // Se abbiamo davvero ricevuto l'oggetto creato con il suo id,
            // apriamo subito il dettaglio della nuova SKU.
            // In caso contrario lasciamo il pannello nello stato standard.
            if (skuCreata && skuCreata.id) {
                mostraDettaglioSku(skuCreata);
            } else {
                renderMessaggioDettaglioVuoto();
            }
        } catch (error) {
            console.error('[sku.js] errore creazione SKU:', error);

            window.appFornitore.mostraMessaggioHome(
                error.message || 'Errore durante la creazione della SKU.',
                'error'
            );
        }
    }

    function validaFormSku(formData) {
        // Estraiamo e normalizziamo tutti i campi del form.
        // Anche se arrivano come FormData, qui li trasformiamo subito
        // in stringhe pulite per semplificare i controlli.
        const codice = (formData.get('codice') || '').toString().trim();
        const nome = (formData.get('nome') || '').toString().trim();
        const descrizioneTecnica = (formData.get('descrizioneTecnica') || '').toString().trim();
        const prezzo = (formData.get('prezzo') || '').toString().trim();
        const fotografia = formData.get('fotografia');

        // Controllo sui campi obbligatori.
        if (!codice || !nome || !descrizioneTecnica || !prezzo) {
            window.appFornitore.mostraMessaggioHome('Compila tutti i campi obbligatori.', 'error');
            return false;
        }

        // Il codice della SKU deve essere un intero non negativo.
        if (!/^\d+$/.test(codice)) {
            window.appFornitore.mostraMessaggioHome('Il codice deve essere un numero intero valido.', 'error');
            return false;
        }

        // Il prezzo deve essere un numero valido e non negativo.
        if (Number.isNaN(Number(prezzo)) || Number(prezzo) < 0) {
            window.appFornitore.mostraMessaggioHome('Il prezzo inserito non è valido.', 'error');
            return false;
        }

        // La fotografia è opzionale.
        // Però, se l'utente la carica, facciamo almeno due controlli di base:
        // tipo file e dimensione massima.
        if (fotografia && fotografia.size > 0) {
            if (!fotografia.type.startsWith('image/')) {
                window.appFornitore.mostraMessaggioHome('La fotografia deve essere un file immagine valido.', 'error');
                return false;
            }

            const maxSizeBytes = 5 * 1024 * 1024;
            if (fotografia.size > maxSizeBytes) {
                window.appFornitore.mostraMessaggioHome('La fotografia non può superare 5 MB.', 'error');
                return false;
            }
        }

        return true;
    }

    function mostraDettaglioSku(sku) {
        // Quando una SKU viene selezionata o appena creata,
        // ne salviamo una copia nello stato locale
        // e ridisegniamo il pannello di dettaglio.
        stato.skuSelezionata = sku ? { ...sku } : null;
        renderDettaglioSkuInContainer(stato.skuSelezionata, dettaglioContent);
    }

    function renderDettaglioSkuInContainer(sku, container) {
        // Questa funzione costruisce tutto il dettaglio della SKU
        // dentro il contenitore passato.
        // In questo modo può essere usata sia nella home sia nella ricerca,
        // senza dipendere da un solo pannello fisso.
        if (!container) {
            return;
        }

        const aggiornaRisultatoRicerca = (patch) => {
            // Se stiamo lavorando nella sezione ricerca,
            // aggiorniamo anche la lista risultati a sinistra,
            // così nome, codice e prezzo restano coerenti senza rifare la ricerca.
            if (window.appFornitore.getSezioneCorrente?.() !== 'ricerca') {
                return;
            }

            if (window.ricercaPage && typeof window.ricercaPage.aggiornaRisultatoInLista === 'function') {
                window.ricercaPage.aggiornaRisultatoInLista(sku.id, 'SKU', patch);
            }
        };

        if (!sku) {
            renderMessaggioDettaglioVuoto(container);
            return;
        }

        // Ogni render riparte da contenitore pulito.
        container.innerHTML = '';

        const wrapper = document.createElement('div');

        const titolo = document.createElement('h3');
        titolo.className = 'section-title';
        titolo.textContent = sku.nome || 'SKU';
        wrapper.appendChild(titolo);

        // Campo "Nome" con modifica inline.
        wrapper.appendChild(creaCampoEditabile({
            etichetta: 'Nome',
            multilinea: false,
            valoreIniziale: sku.nome,
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'nome', nuovoValore);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { nome: nuovoValore }
                );

                mostraMessaggioGlobale('SKU aggiornata con successo.', 'success');
                await aggiornaListaSkuProdotti();
                aggiornaRisultatoRicerca({ nome: nuovoValore });

                // Dopo l'update rifacciamo il render completo del dettaglio,
                // così anche il titolo e gli altri punti dipendenti dal dato aggiornato restano coerenti.
                renderDettaglioSkuInContainer(stato.skuSelezionata, container);
            }
        }));

        // Campo "Codice" con validazione numerica.
        wrapper.appendChild(creaCampoEditabileNumero({
            etichetta: 'Codice',
            valoreIniziale: sku.codice,
            integerOnly: true,
            min: 0,
            step: '1',
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'codice', nuovoValore);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { codice: Number(nuovoValore) }
                );

                mostraMessaggioGlobale('SKU aggiornata con successo.', 'success');
                await aggiornaListaSkuProdotti();
                aggiornaRisultatoRicerca({ codice: Number(nuovoValore) });
                renderDettaglioSkuInContainer(stato.skuSelezionata, container);
            }
        }));

        // Gestione della fotografia: preview se presente, placeholder altrimenti,
        // e upload del nuovo file tramite input nascosto.
        wrapper.appendChild(creaCampoFotoEditabile(sku));

        const titoloDescrizione = document.createElement('h4');
        titoloDescrizione.className = 'section-title';
        titoloDescrizione.style.fontSize = '0.95rem';
        titoloDescrizione.style.marginTop = '1rem';
        titoloDescrizione.textContent = 'Descrizione tecnica';
        wrapper.appendChild(titoloDescrizione);

        // La descrizione tecnica usa una textarea,
        // perché può contenere testo più lungo su più righe.
        wrapper.appendChild(creaCampoEditabile({
            etichetta: null,
            multilinea: true,
            valoreIniziale: sku.descrizioneTecnica,
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'descrizioneTecnica', nuovoValore);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { descrizioneTecnica: nuovoValore }
                );

                mostraMessaggioGlobale('SKU aggiornata con successo.', 'success');
                await aggiornaListaSkuProdotti();
                aggiornaRisultatoRicerca({ descrizioneTecnica: nuovoValore });
                renderDettaglioSkuInContainer(stato.skuSelezionata, container);
            }
        }));

        // Campo prezzo con formattazione in vista e validazione numerica in edit.
        wrapper.appendChild(creaCampoEditabileNumero({
            etichetta: 'Prezzo',
            valoreIniziale: sku.prezzo,
            integerOnly: false,
            min: 0,
            step: '0.01',
            formatView: (valore) => `€${formattaPrezzo(valore)}`,
            onSalva: async (nuovoValore) => {
                const aggiornato = await aggiornaCampoSku(sku.id, 'prezzo', nuovoValore);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { prezzo: Number(nuovoValore) }
                );

                mostraMessaggioGlobale('Prezzo aggiornato con successo.', 'success');
                await aggiornaListaSkuProdotti();
                aggiornaRisultatoRicerca({ prezzo: Number(nuovoValore) });
                renderDettaglioSkuInContainer(stato.skuSelezionata, container);
            }
        }));

        // Riga azioni finali del pannello, al momento dedicata all'eliminazione.
        const azioni = document.createElement('div');
        azioni.className = 'actions-row';

        const bottoneElimina = document.createElement('button');
        bottoneElimina.type = 'button';
        bottoneElimina.className = 'btn btn-action btn-danger btn-sm';
        bottoneElimina.textContent = '-*';
        bottoneElimina.title = 'Elimina SKU';
        bottoneElimina.addEventListener('click', async () => {
            // Prima dell'eliminazione chiediamo conferma esplicita,
            // per evitare cancellazioni accidentali.
            const conferma = window.confirm('Vuoi eliminare definitivamente questa SKU?');
            if (!conferma) {
                return;
            }

            try {
                await eliminaSku(sku.id);

                // Se la SKU era stata aperta dalla ricerca,
                // va tolta anche dalla lista risultati corrente.
                if (window.appFornitore.getSezioneCorrente?.() === 'ricerca'
                    && window.ricercaPage
                    && typeof window.ricercaPage.rimuoviRisultatoDaLista === 'function') {
                    window.ricercaPage.rimuoviRisultatoDaLista(sku.id, 'SKU');
                }

                mostraMessaggioGlobale('SKU eliminata con successo.', 'success');

                // Dopo l'eliminazione il pannello torna allo stato vuoto
                // e ricarichiamo anche le liste collegate.
                renderMessaggioDettaglioVuoto(container);
                await aggiornaListaSkuProdotti();
            } catch (error) {
                console.error('[sku.js] errore eliminazione SKU:', error);

                mostraMessaggioGlobale(
                    error.message || 'Errore durante l\'eliminazione della SKU.',
                    'error'
                );
            }
        });

        azioni.appendChild(bottoneElimina);
        wrapper.appendChild(azioni);

        container.appendChild(wrapper);
    }

    function creaCampoEditabile({ etichetta, multilinea, valoreIniziale, onSalva }) {
        // Helper per i campi testuali modificabili inline.
        // Viene usato sia per campi semplici a una riga,
        // sia per campi più lunghi in textarea.
        const container = creaContenitoreCampo(etichetta);

        const view = creaVistaCampo(
            valoreIniziale ? valoreIniziale.toString() : '-'
        );

        attivaInlineEditor({
            container,
            view,
            creaInput: () => {
                const input = multilinea ? document.createElement('textarea') : document.createElement('input');

                if (multilinea) {
                    input.rows = 4;
                } else {
                    input.type = 'text';
                }

                input.className = 'form-control';
                input.value = valoreIniziale ?? '';
                return input;
            },
            getValore: (input) => input.value.trim(),
            onInvio: (input, event) => {
                // Sul campo singolo, Invio equivale a conferma.
                // Sulla textarea no, perché lì Invio deve restare disponibile per andare a capo.
                if (!multilinea && event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            },
            valida: (nuovoValore) => {
                // Per i campi testuali qui non imponiamo regole particolari:
                // l'eventuale validazione più forte resta a carico del server.
                return {
                    valido: true,
                    valoreDaSalvare: nuovoValore
                };
            },
            valoreOriginale: (valoreIniziale ?? '').toString().trim(),
            onSalva
        });

        container.appendChild(view);
        return container;
    }

    function creaCampoEditabileNumero({
                                          etichetta,
                                          valoreIniziale,
                                          integerOnly,
                                          min,
                                          step,
                                          formatView,
                                          onSalva
                                      }) {
        // Variante del campo inline pensata per numeri.
        // Qui aggiungiamo vincoli come intero/decimale, minimo e passo dell'input.
        const container = creaContenitoreCampo(etichetta);

        const testo = formatView
            ? formatView(valoreIniziale)
            : (valoreIniziale ?? '-').toString();

        const view = creaVistaCampo(testo);

        attivaInlineEditor({
            container,
            view,
            creaInput: () => {
                const input = document.createElement('input');
                input.type = 'number';
                input.min = min != null ? String(min) : '0';
                input.step = step || '1';
                input.className = 'form-control';
                input.style.maxWidth = '200px';
                input.value = valoreIniziale ?? '';
                return input;
            },
            getValore: (input) => input.value.trim(),
            onInvio: (input, event) => {
                // Sui campi numerici Invio conferma sempre la modifica.
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            },
            valida: (rawValue) => {
                // Qui facciamo una validazione client-side un po' più stretta,
                // perché i numeri sono facili da controllare già nel browser
                // e conviene dare feedback immediato all'utente.
                if (rawValue === '') {
                    return {
                        valido: false,
                        messaggio: 'Il valore non può essere vuoto.'
                    };
                }

                if (integerOnly && !/^\d+$/.test(rawValue)) {
                    return {
                        valido: false,
                        messaggio: 'Inserisci un numero intero valido.'
                    };
                }

                const numero = Number(rawValue);
                if (Number.isNaN(numero) || (min != null && numero < min)) {
                    return {
                        valido: false,
                        messaggio: 'Il valore inserito non è valido.'
                    };
                }

                return {
                    valido: true,
                    valoreDaSalvare: rawValue
                };
            },
            valoreOriginale: String(Number(valoreIniziale)),
            confrontaValori: (originale, nuovoValore) => Number(originale) === Number(nuovoValore),
            onSalva
        });

        container.appendChild(view);
        return container;
    }

    function creaContenitoreCampo(etichetta) {
        // Struttura base comune dei campi del dettaglio:
        // wrapper con classe form-group ed eventuale label.
        const container = document.createElement('div');
        container.className = 'form-group';

        if (etichetta) {
            const label = document.createElement('label');
            label.textContent = etichetta;
            container.appendChild(label);
        }

        return container;
    }

    function creaVistaCampo(testo) {
        // Vista "statica" del campo prima del click.
        // È un semplice paragrafo stilizzato come testo cliccabile.
        const view = document.createElement('p');
        view.className = 'muted';
        view.style.cursor = 'pointer';
        view.title = 'Clicca per modificare';
        view.textContent = testo;
        return view;
    }

    function attivaInlineEditor({
                                    container,
                                    view,
                                    creaInput,
                                    getValore,
                                    onInvio,
                                    valida,
                                    valoreOriginale,
                                    confrontaValori,
                                    onSalva
                                }) {
        // Questa è la parte comune del comportamento inline.
        // Il flusso è sempre lo stesso:
        // 1. click sul testo;
        // 2. sostituzione con un input o textarea;
        // 3. tentativo di salvataggio al blur;
        // 4. annullamento con Escape;
        // 5. gestione centralizzata di validazione ed errori.
        //
        // In questo modo evitiamo di duplicare la stessa logica
        // sia nei campi testuali sia in quelli numerici.
        view.addEventListener('click', () => {
            const input = creaInput();

            const ripristinaVista = () => {
                // Torna dalla modalità edit alla vista testuale iniziale.
                container.replaceChild(view, input);
            };

            const stessiValori = (nuovoValore) => {
                // Alcuni campi, come quelli numerici, hanno bisogno
                // di un confronto personalizzato tra valore vecchio e nuovo.
                // Se non viene passato un comparatore dedicato,
                // usiamo il confronto standard tra stringhe.
                if (typeof confrontaValori === 'function') {
                    return confrontaValori(valoreOriginale, nuovoValore);
                }
                return nuovoValore === valoreOriginale;
            };

            const salva = async () => {
                const valoreLetto = getValore(input);

                // Se il valore non è cambiato, non ha senso chiamare il server.
                if (stessiValori(valoreLetto)) {
                    ripristinaVista();
                    return;
                }

                const esitoValidazione = valida(valoreLetto);

                // Se la validazione client fallisce, mostriamo il messaggio
                // e torniamo alla vista precedente.
                if (!esitoValidazione.valido) {
                    mostraMessaggioGlobale(
                        esitoValidazione.messaggio || 'Valore non valido.',
                        'error'
                    );
                    ripristinaVista();
                    return;
                }

                try {
                    // La logica concreta di salvataggio resta delegata al chiamante,
                    // così questo helper rimane riusabile per tipi di campo diversi.
                    await onSalva(esitoValidazione.valoreDaSalvare);
                } catch (error) {
                    console.error('[sku.js] errore aggiornamento campo SKU:', error);

                    mostraMessaggioGlobale(
                        error.message || 'Aggiornamento non riuscito.',
                        'error'
                    );
                    ripristinaVista();
                }
            };

            // Il blur è il momento in cui il campo prova a salvare.
            input.addEventListener('blur', salva, { once: true });

            input.addEventListener('keydown', (event) => {
                // Escape annulla la modifica e ripristina la vista precedente.
                if (event.key === 'Escape') {
                    ripristinaVista();
                    return;
                }

                // L'eventuale comportamento sul tasto Invio
                // dipende dal tipo concreto di campo.
                if (typeof onInvio === 'function') {
                    onInvio(input, event);
                }
            });

            // Sostituiamo la vista con il campo editabile
            // e portiamo subito il focus sull'input.
            container.replaceChild(input, view);
            input.focus();
            input.select?.();
        });
    }

    function creaCampoFotoEditabile(sku) {
        // Campo speciale dedicato alla fotografia.
        // Diversamente dagli altri campi, qui non c'è testo inline da editare:
        // mostriamo invece un box cliccabile che apre il file picker.
        const container = document.createElement('div');
        container.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = 'Fotografia';
        container.appendChild(label);

        const box = document.createElement('div');
        box.className = 'detail-photo';
        box.style.cursor = 'pointer';
        box.title = 'Clicca per cambiare la fotografia';

        if (sku.fotografia) {
            // Se la SKU ha già una foto, mostriamo l'anteprima.
            const img = document.createElement('img');
            img.src = risolviPercorsoFoto(sku.fotografia);
            img.alt = `Foto SKU ${sku.nome || ''}`.trim();
            img.loading = 'lazy';
            img.decoding = 'async';
            box.appendChild(img);
        } else {
            // In assenza di fotografia mostriamo un placeholder testuale.
            const placeholder = document.createElement('p');
            placeholder.className = 'muted';
            placeholder.textContent = 'Nessuna fotografia. Clicca per caricarne una.';
            box.appendChild(placeholder);
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.hidden = true;

        // Il click sul box visuale apre l'input file nascosto.
        box.addEventListener('click', () => input.click());

        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) {
                return;
            }

            // Controlli minimi sul file selezionato.
            if (!file.type.startsWith('image/')) {
                mostraMessaggioGlobale('La fotografia deve essere un file immagine valido.', 'error');
                input.value = '';
                return;
            }

            const maxSizeBytes = 5 * 1024 * 1024;
            if (file.size > maxSizeBytes) {
                mostraMessaggioGlobale('La fotografia non può superare 5 MB.', 'error');
                input.value = '';
                return;
            }

            try {
                const aggiornato = await aggiornaFotoSku(sku.id, file);

                stato.skuSelezionata = normalizzaSkuAggiornata(
                    aggiornato,
                    stato.skuSelezionata,
                    { fotografia: aggiornato?.fotografia }
                );

                mostraMessaggioGlobale('Fotografia aggiornata con successo.', 'success');
                await aggiornaListaSkuProdotti();

                // Dopo l'upload rifacciamo il render del dettaglio
                // per mostrare subito la nuova immagine.
                mostraDettaglioSku(stato.skuSelezionata);
            } catch (error) {
                console.error('[sku.js] errore aggiornamento fotografia SKU:', error);

                mostraMessaggioGlobale(
                    error.message || 'Aggiornamento fotografia non riuscito.',
                    'error'
                );
            } finally {
                // Puliamo il valore dell'input:
                // così l'utente può eventualmente riselezionare anche lo stesso file.
                input.value = '';
            }
        });

        container.appendChild(box);
        container.appendChild(input);
        return container;
    }

    function normalizzaSkuAggiornata(aggiornato, fallback, patch) {
        // Piccolo helper difensivo per fondere:
        // - il dato restituito dal server, se presente;
        // - il vecchio stato locale;
        // - la patch appena applicata lato client.
        //
        // In questo modo il dettaglio resta consistente
        // anche se il backend restituisce una risposta parziale.
        if (aggiornato && typeof aggiornato === 'object') {
            return { ...fallback, ...aggiornato, ...patch };
        }

        return { ...fallback, ...patch };
    }

    async function aggiornaCampoSku(skuId, campo, valore) {
        // Chiamata generica per aggiornare un singolo attributo della SKU.
        // Usiamo x-www-form-urlencoded perché qui inviamo solo valori testuali.
        if (!skuId) {
            throw new Error('SKU non selezionata.');
        }

        const body = new URLSearchParams();
        body.append('id', skuId);
        body.append('campo', campo);
        body.append('valore', valore);

        const response = await fetch('apifornitoreskuaggiorna', {
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

    async function aggiornaFotoSku(skuId, file) {
        // Variante dell'update dedicata alla fotografia.
        // Qui usiamo FormData perché dobbiamo inviare un file binario.
        if (!skuId) {
            throw new Error('SKU non selezionata.');
        }

        const formData = new FormData();
        formData.append('id', skuId);
        formData.append('campo', 'fotografia');
        formData.append('fotografia', file);

        const response = await fetch('apifornitoreskuaggiorna', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });

        return window.appFornitore.parseJsonResponse(response);
    }

    async function eliminaSku(skuId) {
        // Eliminazione completa della SKU tramite endpoint condiviso.
        // Il server decide poi se bloccare o consentire l'operazione
        // in base ai vincoli applicativi.
        const body = new URLSearchParams();
        body.append('id', skuId);
        body.append('tipo', 'SKU');

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

    function renderMessaggioDettaglioVuoto(container = dettaglioContent) {
        // Stato neutro del pannello di destra quando non c'è ancora
        // nessuna SKU da mostrare o dopo una cancellazione.
        if (!container) {
            return;
        }

        container.innerHTML = `
            <p class="muted">
                Dopo una creazione o una selezione nella home, qui comparirà il dettaglio dell'oggetto.
            </p>
        `;
    }

    function formattaPrezzo(prezzo) {
        // Formattazione semplice del prezzo per la vista utente.
        // Se arriva un valore non numerico, mostriamo comunque 0.00
        // per evitare stringhe strane nell'interfaccia.
        const numero = Number(prezzo);
        return Number.isNaN(numero) ? '0.00' : numero.toFixed(2);
    }

    function risolviPercorsoFoto(fotografia) {
        // Normalizza il percorso della foto ricevuto dal backend.
        // Se è già assoluto o parte dalla root, lo lasciamo invariato.
        // Se invece arriva come semplice nome file, lo facciamo puntare sotto uploads/.
        const fotoPath = String(fotografia || '').trim();
        if (!fotoPath) {
            return '';
        }

        if (fotoPath.startsWith('http://') || fotoPath.startsWith('https://') || fotoPath.startsWith('/')) {
            return fotoPath;
        }

        if (fotoPath.startsWith('uploads/')) {
            return fotoPath;
        }

        return `uploads/${fotoPath}`;
    }

    // Espone all'esterno solo le funzioni davvero necessarie.
    // Tutto il resto rimane privato al modulo.
    return {
        init,
        renderDettaglioSkuInContainer
    };
})();