/**
 * login.js
 * Gestisce il form di login: validazione lato client, chiamata fetch
 * all'API e redirect alla pagina del ruolo corretto.
 */

document.addEventListener("DOMContentLoaded", () => {
    const form= document.getElementById("form-login");
    const erroreBox= document.getElementById("errore-login");
    const errUsername= document.getElementById("err-username");
    const errPassword= document.getElementById("err-password");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // puliamo eventuali errori precedenti
        nascondiErrori();

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();

        // validazione lato client prima di fare la chiamata
        let valido = true;

        if (!username) {
            errUsername.textContent = "Inserisci il tuo username";
            errUsername.style.display = "block";
            valido = false;
        }
        if (!password) {
            errPassword.textContent = "Inserisci la tua password";
            errPassword.style.display = "block";
            valido = false;
        }
        if (!valido) return;

        try {
            const body = new URLSearchParams({ username, password });

            const risposta = await fetch("api/login", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString()
            });

            const dati = await risposta.json();

            if (!risposta.ok) {
                // il server ha risposto con un errore (401, 400, ecc.)
                mostraErrore(dati.errore || "Credenziali non valide");
                return;
            }

            // login riuscito: redirect in base al ruolo
            if (dati.ruolo === "FORNITORE") {
                window.location.href = "fornitore.html";
            } else if (dati.ruolo === "CLIENTE") {
                window.location.href = "cliente.html";
            } else {
                mostraErrore("Ruolo non riconosciuto. Contattare l'amministratore.");
            }

        } catch (err) {
            // errore di rete o parsing JSON fallito
            mostraErrore("Errore di connessione al server. Riprova.");
        }
    });

    function mostraErrore(messaggio) {
        erroreBox.textContent = messaggio;
        erroreBox.style.display = "block";
    }

    function nascondiErrori() {
        erroreBox.style.display = "none";
        erroreBox.textContent = "";
        errUsername.style.display = "none";
        errUsername.textContent = "";
        errPassword.style.display = "none";
        errPassword.textContent = "";
    }
});
