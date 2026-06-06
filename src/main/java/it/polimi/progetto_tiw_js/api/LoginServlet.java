package it.polimi.progetto_tiw_js.api;

import com.google.gson.JsonObject;
import it.polimi.progetto_tiw_js.beans.Utente;
import it.polimi.progetto_tiw_js.dao.UtenteDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.sql.SQLException;

/**
 * Esegue il login: verifica le credenziali, salva l'utente in sessione
 * e restituisce i dati minimi necessari al frontend.
 */
@WebServlet("/api/login")
public class LoginServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        req.setCharacterEncoding("UTF-8");

        String username = req.getParameter("username");
        String password = req.getParameter("password");

        if (isBlank(username) || isBlank(password)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Username e password sono obbligatori");
            return;
        }

        try {
            UtenteDAO utenteDAO = new UtenteDAO(conn);
            Utente utente = utenteDAO.checkCredentials(username.trim(), password.trim());

            if (utente == null) {
                sendError(resp, HttpServletResponse.SC_UNAUTHORIZED,
                        "Username o password non validi. Riprova.");
                return;
            }

            // Se esiste già una sessione, la invalido prima di crearne una nuova.
            // Così evito di riusare una sessione precedente dopo l'autenticazione.
            HttpSession oldSession = req.getSession(false);
            if (oldSession != null) {
                oldSession.invalidate();
            }

            HttpSession session = req.getSession(true);
            session.setAttribute("utente", utente);

            JsonObject risposta = new JsonObject();
            risposta.addProperty("ruolo", utente.getRuolo());
            risposta.addProperty("nome", utente.getNome());
            risposta.addProperty("cognome", utente.getCognome());

            sendJson(resp, risposta);

        } catch (SQLException e) {
            throw new ServletException("Errore DB durante il login", e);
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}