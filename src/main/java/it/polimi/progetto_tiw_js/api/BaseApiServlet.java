package it.polimi.progetto_tiw_js.api;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializer;
import it.polimi.progetto_tiw_js.beans.Utente;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.LocalDateTime;

/**
 * Classe base per tutte le servlet API della versione JavaScript.
 * Qui teniamo la connessione al DB, i controlli di sessione
 * e gli helper comuni per rispondere in JSON.
 */
public abstract class BaseApiServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    // Gson condiviso per tutte le servlet API.
    // serializeNulls serve a mantenere espliciti anche i campi null nel JSON.
    protected static final Gson gson = new GsonBuilder()
            .serializeNulls()
            .registerTypeAdapter(
                    LocalDateTime.class,
                    (JsonSerializer<LocalDateTime>) (src, type, ctx) -> new JsonPrimitive(src.toString())
            )
            .create();

    protected Connection conn;

    @Override
    public void init() throws ServletException {
        try {
            String dbUrl = getServletContext().getInitParameter("dbUrl");
            String dbUser = getServletContext().getInitParameter("dbUser");
            String dbPass = System.getenv("DB_PASSWORD");

            Class.forName("com.mysql.cj.jdbc.Driver");
            conn = DriverManager.getConnection(dbUrl, dbUser, dbPass);
        } catch (Exception e) {
            throw new ServletException("Connessione al DB fallita: " + e.getMessage(), e);
        }
    }

    @Override
    public void destroy() {
        try {
            if (conn != null && !conn.isClosed()) {
                conn.close();
            }
        } catch (SQLException ignored) {
        }

        try {
            com.mysql.cj.jdbc.AbandonedConnectionCleanupThread.checkedShutdown();
        } catch (Throwable ignored) {
        }

        try {
            java.util.Enumeration<java.sql.Driver> drivers = DriverManager.getDrivers();
            while (drivers.hasMoreElements()) {
                java.sql.Driver driver = drivers.nextElement();
                if ("com.mysql.cj.jdbc.Driver".equals(driver.getClass().getName())) {
                    DriverManager.deregisterDriver(driver);
                }
            }
        } catch (SQLException ignored) {
        }
    }

    /**
     * Legge l'utente salvato in sessione senza creare una nuova sessione.
     * Restituisce null se la sessione non esiste oppure non contiene l'utente.
     */
    protected Utente getUtenteInSessione(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        if (session == null) {
            return null;
        }
        return (Utente) session.getAttribute("utente");
    }

    /**
     * Controlla che esista un utente autenticato.
     * Se manca, risponde con 401 in JSON.
     */
    protected boolean isLogged(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        if (getUtenteInSessione(req) == null) {
            sendError(resp, HttpServletResponse.SC_UNAUTHORIZED,
                    "Sessione scaduta o utente non autenticato");
            return false;
        }
        return true;
    }

    /**
     * Controlla che l'utente autenticato abbia il ruolo richiesto.
     * Se il ruolo non coincide, risponde con 403 in JSON.
     */
    protected boolean hasRole(HttpServletRequest req, HttpServletResponse resp, String ruoloRichiesto)
            throws IOException {
        Utente utente = getUtenteInSessione(req);
        if (utente == null || !ruoloRichiesto.equals(utente.getRuolo())) {
            sendError(resp, HttpServletResponse.SC_FORBIDDEN,
                    "Accesso non consentito per questo ruolo");
            return false;
        }
        return true;
    }

    /**
     * Scrive un oggetto Java come JSON nella risposta HTTP con status 200.
     */
    protected void sendJson(HttpServletResponse resp, Object oggetto) throws IOException {
        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        PrintWriter out = resp.getWriter();
        out.print(gson.toJson(oggetto));
        out.flush();
    }

    /**
     * Risponde con uno status di errore e un body JSON del tipo:
     * { "errore": "..." }
     */
    protected void sendError(HttpServletResponse resp, int status, String messaggio) throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        PrintWriter out = resp.getWriter();
        out.print(gson.toJson(new ErroreRisposta(messaggio)));
        out.flush();
    }

    /**
     * Piccolo wrapper usato per serializzare gli errori in modo uniforme.
     */
    private static class ErroreRisposta {
        private final String errore;

        ErroreRisposta(String errore) {
            this.errore = errore;
        }
    }
}