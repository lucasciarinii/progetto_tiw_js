package it.polimi.progetto_tiw_js.api;

import com.google.gson.JsonObject;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;

/**
 * Invalida la sessione corrente e conferma al client con un JSON.
 * Il redirect verso la login viene gestito dal codice JavaScript.
 */
@WebServlet("/api/logout")
public class Logout extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        HttpSession session = req.getSession(false);
        if (session != null) {
            session.invalidate();
        }

        JsonObject risposta = new JsonObject();
        risposta.addProperty("messaggio", "Logout effettuato");

        sendJson(resp, risposta);
    }
}