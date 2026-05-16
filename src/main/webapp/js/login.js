document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-login');
    const erroreBox = document.getElementById('errore-login');
    const username = document.getElementById('username');
    const password = document.getElementById('password');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        erroreBox.style.display = 'none';
        erroreBox.textContent = 'Username o password non validi. Riprova.'

        if (!username.value.trim() || !password.value.trim()) {
            erroreBox.style.display = 'block';
            return;
        }

        try {
            const resp = await fetch('api/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    username: username.value.trim(),
                    password: password.value.trim()
                }).toString()
            });

            const data = await resp.json();

            if (!resp.ok) {
                erroreBox.textContent = data.errore || 'Username o password non validi. Riprova.';
                erroreBox.style.display = 'block';
                return;
            }

            if (data.ruolo === 'FORNITORE') {
                window.location.href = 'fornitore.html';
            } else if (data.ruolo === 'CLIENTE') {
                window.location.href = 'cliente.html';
            } else {
                erroreBox.textContent = 'Ruolo non riconosciuto.';
                erroreBox.style.display = 'block';
            }
        } catch (err) {
            erroreBox.textContent = 'Errore di connessione al server.';
            erroreBox.style.display = 'block';
        }
    });
});