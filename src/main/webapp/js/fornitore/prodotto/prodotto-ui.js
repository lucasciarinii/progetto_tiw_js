window.prodottoUi = (function () {
    function formattaPrezzo(valore) {
        // Converte il valore in numero e lo mostra sempre con due decimali.
        const numero = Number(valore);
        return Number.isNaN(numero) ? '0.00' : numero.toFixed(2);
    }

    function escapeHtml(valore) {
        // Sanificazione minimale per i casi in cui uso innerHTML.
        return String(valore ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function creaRigaCampoEditabile({ etichetta, valoreIniziale, onSalva, maxWidth = '260px' }) {
        // Crea una riga con etichetta e valore cliccabile, modificabile inline.
        const riga = document.createElement('p');

        const label = document.createElement('strong');
        label.textContent = `${etichetta}: `;
        riga.appendChild(label);

        const spanValore = document.createElement('span');
        spanValore.textContent = valoreIniziale ?? '-';
        spanValore.style.cursor = 'pointer';
        spanValore.title = 'Clicca per modificare';
        riga.appendChild(spanValore);

        spanValore.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = valoreIniziale ?? '';
            input.className = 'form-control';
            input.style.maxWidth = maxWidth;

            riga.replaceChild(input, spanValore);
            input.focus();

            // Se possibile seleziono subito tutto il testo.
            if (typeof input.select === 'function') {
                input.select();
            }

            let annullato = false;

            input.addEventListener('keydown', (event) => {
                // Escape annulla la modifica e ripristina il valore precedente.
                if (event.key === 'Escape') {
                    annullato = true;
                    riga.replaceChild(spanValore, input);
                }
            });

            input.addEventListener(
                'blur',
                async () => {
                    // Al blur provo a salvare il nuovo valore.
                    if (annullato) {
                        return;
                    }

                    try {
                        await onSalva(input.value.trim());
                    } catch (error) {
                        // In caso di errore ripristino la vista precedente.
                        riga.replaceChild(spanValore, input);
                    }
                },
                { once: true }
            );
        });

        return riga;
    }

    function creaRigaCampoProdotto(etichetta, valoreIniziale, onSalva) {
        // Wrapper per i campi prodotto.
        return creaRigaCampoEditabile({
            etichetta,
            valoreIniziale,
            onSalva,
            maxWidth: '260px'
        });
    }

    function creaRigaCampoSku(etichetta, valoreIniziale, onSalva) {
        // Wrapper per i campi SKU.
        return creaRigaCampoEditabile({
            etichetta,
            valoreIniziale,
            onSalva,
            maxWidth: '220px'
        });
    }

    function creaBottoneAzione(testo, className, title) {
        // Crea un bottone azione coerente con lo stile condiviso.
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = `btn btn-action ${className}`.trim();
        bottone.textContent = testo;

        if (title) {
            bottone.title = title;
        }

        return bottone;
    }

    function creaVoceMenu(testo, onClick) {
        // Crea una voce del menu contestuale.
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = 'btn btn-ghost btn-sm';
        bottone.textContent = testo;
        bottone.addEventListener('click', onClick);
        return bottone;
    }

    return {
        formattaPrezzo,
        escapeHtml,
        creaRigaCampoProdotto,
        creaRigaCampoSku,
        creaBottoneAzione,
        creaVoceMenu
    };
})();