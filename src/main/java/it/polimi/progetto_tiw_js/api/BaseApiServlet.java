package it.polimi.progetto_tiw_js.api;

import it.polimi.progetto_tiw_js.beans.Utente;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
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

/**
 * Classe base per tutte le servlet API della versione JavaScript.
 * Non usa Thymeleaf: risponde sempre con JSON.
 * Gestisce connessione al DB, sessione e helper per scrivere le risposte.
 */
public abstract class BaseApiServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    // gson condiviso — serializeNulls per mandare anche i campi null al client
    protected static final Gson gson = new GsonBuilder()
            .serializeNulls()
            .create();

    protected Connection conn;

    // ── Ciclo di vita servlet ─────────────────────────────────────────────

    @Override
    public void init() throws ServletException {
        try {
            String dbUrl  = getServletContext().getInitParameter("dbUrl");
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
            java.util.Enumeration<java.sql.Driver> drivers = java.sql.DriverManager.getDrivers();
            while (drivers.hasMoreElements()) {
                java.sql.Driver driver = drivers.nextElement();
                if (driver.getClass().getName().equals("com.mysql.cj.jdbc.Driver")) {
                    java.sql.DriverManager.deregisterDriver(driver);
                }
            }
        } catch (SQLException ignored) {
        }
    }

    // ── Sessione e autenticazione ─────────────────────────────────────────

    /**
     * Legge l'utente salvato in sessione, senza creare una sessione nuova.
     * Restituisce null se la sessione non esiste o l'utente non è presente.
     */
    protected Utente getUtenteInSessione(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        if (session == null) return null;
        return (Utente) session.getAttribute("utente");
    }

    /**
     * Controlla che ci sia un utente loggato.
     * Se non c'è, risponde con 401 e restituisce false.
     * Le servlet che lo chiamano devono fare return subito se ottengono false.
     */
    protected boolean isLogged(HttpServletRequest req, HttpServletResponse resp)
            throws IOException {
        if (getUtenteInSessione(req) == null) {
            sendError(resp, HttpServletResponse.SC_UNAUTHORIZED, "Sessione scaduta o utente non autenticato");
            return false;
        }
        return true;
    }

    /**
     * Controlla che l'utente loggato abbia il ruolo richiesto.
     * Se il ruolo non corrisponde, risponde con 403 e restituisce false.
     */
    protected boolean hasRole(HttpServletRequest req, HttpServletResponse resp, String ruoloRichiesto)
            throws IOException {
        Utente utente = getUtenteInSessione(req);
        if (utente == null || !ruoloRichiesto.equals(utente.getRuolo())) {
            sendError(resp, HttpServletResponse.SC_FORBIDDEN, "Accesso non consentito per questo ruolo");
            return false;
        }
        return true;
    }

    // ── Helper risposta JSON ──────────────────────────────────────────────

    /**
     * Scrive un oggetto Java come JSON nella risposta HTTP.
     * Imposta automaticamente Content-Type e status 200.
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
     * Risponde con uno status HTTP di errore e un messaggio JSON.
     * Usato per tutti i casi di errore (400, 401, 403, 404, 500...).
     */
    protected void sendError(HttpServletResponse resp, int status, String messaggio)
            throws IOException {
        resp.setStatus(status);
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");
        PrintWriter out = resp.getWriter();
        out.print(gson.toJson(new ErroreRisposta(messaggio)));
        out.flush();
    }

    // ── Classe interna per il body degli errori ───────────────────────────

    /**
     * Semplice wrapper per serializzare gli errori come { "errore": "..." }.
     */
    private static class ErroreRisposta {
        private final String errore;
        ErroreRisposta(String errore) { this.errore = errore; }
    }
}
