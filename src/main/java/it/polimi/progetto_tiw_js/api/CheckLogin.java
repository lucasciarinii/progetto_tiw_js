package it.polimi.progetto_tiw_js.api;

import com.google.gson.JsonObject;
import it.polimi.progetto_tiw_js.beans.Utente;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

/**
 * Controlla se esiste una sessione valida.
 * Serve alle SPA per capire se l'utente è autenticato
 * e recuperare i dati minimi da mostrare nella navbar.
 */
@WebServlet("/api/check-login")
public class CheckLogin extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Utente utente = getUtenteInSessione(req);

        JsonObject risposta = new JsonObject();

        if (utente == null) {
            risposta.addProperty("loggedIn", false);
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.setContentType("application/json");
            resp.setCharacterEncoding("UTF-8");
            resp.getWriter().write(gson.toJson(risposta));
            return;
        }

        risposta.addProperty("loggedIn", true);

        JsonObject utenteJson = new JsonObject();
        utenteJson.addProperty("id", utente.getId());
        utenteJson.addProperty("nome", utente.getNome());
        utenteJson.addProperty("cognome", utente.getCognome());
        utenteJson.addProperty("ruolo", utente.getRuolo());

        risposta.add("utente", utenteJson);

        sendJson(resp, risposta);
    }
}