window.prodottoUi = (function () {
    function formattaPrezzo(valore) {
        // Converte il valore in numero e lo porta sempre a due decimali.
        // Se il valore non è numerico, restituisce "0.00".
        const numero = Number(valore);
        return Number.isNaN(numero) ? '0.00' : numero.toFixed(2);
    }

    function escapeHtml(valore) {
        // Piccola utility di sanificazione:
        // trasforma i caratteri speciali HTML nelle rispettive entità,
        // così evito injection quando uso innerHTML.
        return String(valore ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function creaRigaCampoEditabile({ etichetta, valoreIniziale, onSalva, maxWidth = '260px' }) {
        // Crea una riga del tipo:
        // <p><strong>Etichetta:</strong> <span>valore</span></p>
        // dove il valore diventa editabile al click.
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
            // Quando clicco sul valore, lo sostituisco con un input text.
            const input = document.createElement('input');
            input.type = 'text';
            input.value = valoreIniziale ?? '';
            input.className = 'form-control';
            input.style.maxWidth = maxWidth;

            riga.replaceChild(input, spanValore);
            input.focus();

            // Se possibile seleziono tutto il contenuto,
            // così l'utente può scrivere subito il nuovo valore.
            if (typeof input.select === 'function') input.select();

            let annullato = false;

            input.addEventListener('keydown', (event) => {
                // Escape annulla la modifica e ripristina il vecchio span.
                if (event.key === 'Escape') {
                    annullato = true;
                    riga.replaceChild(spanValore, input);
                }
            });

            input.addEventListener(
                'blur',
                async () => {
                    // Quando l'input perde il focus, salvo automaticamente.
                    // Se era già stato annullato con Escape, non faccio nulla.
                    if (annullato) return;

                    try {
                        await onSalva(input.value.trim());
                    } catch (error) {
                        // Se il salvataggio fallisce, ripristino la vista precedente.
                        riga.replaceChild(spanValore, input);
                    }
                },
                { once: true }
            );
        });

        return riga;
    }

    function creaRigaCampoProdotto(etichetta, valoreIniziale, onSalva) {
        // Wrapper specializzato per i campi del prodotto.
        return creaRigaCampoEditabile({ etichetta, valoreIniziale, onSalva, maxWidth: '260px' });
    }

    function creaRigaCampoSku(etichetta, valoreIniziale, onSalva) {
        // Wrapper specializzato per i campi SKU.
        // Ha una larghezza un po' più stretta.
        return creaRigaCampoEditabile({ etichetta, valoreIniziale, onSalva, maxWidth: '220px' });
    }

    function creaBottoneAzione(testo, className, title) {
        // Utility per creare velocemente un bottone azione coerente con lo stile condiviso.
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = `btn btn-action ${className}`.trim();
        bottone.textContent = testo;
        if (title) bottone.title = title;
        return bottone;
    }

    function creaVoceMenu(testo, onClick) {
        // Utility per creare una voce di menu / bottone secondario.
        const bottone = document.createElement('button');
        bottone.type = 'button';
        bottone.className = 'btn btn-ghost btn-sm';
        bottone.textContent = testo;
        bottone.addEventListener('click', onClick);
        return bottone;
    }

    return {
        // API pubblica del modulo UI.
        formattaPrezzo,
        escapeHtml,
        creaRigaCampoProdotto,
        creaRigaCampoSku,
        creaRigaCampoEditabile,
        creaBottoneAzione,
        creaVoceMenu
    };
})();