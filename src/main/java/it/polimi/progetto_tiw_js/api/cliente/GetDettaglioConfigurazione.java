package it.polimi.progetto_tiw_js.api.cliente;

import it.polimi.progetto_tiw_js.api.BaseApiServlet;
import it.polimi.progetto_tiw_js.beans.Configurazione;
import it.polimi.progetto_tiw_js.dao.ConfigurazioneDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;

@WebServlet("/api/cliente/configurazione")
public class GetDettaglioConfigurazione extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "CLIENTE")) return;

        int configId;
        try {
            configId = Integer.parseInt(req.getParameter("id"));
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Parametro 'id' non valido.");
            return;
        }

        try {
            ConfigurazioneDAO dao = new ConfigurazioneDAO(conn);
            Configurazione conf = dao.findByIdConSKU(configId);
            if (conf == null || conf.getClienteId() != getUtenteInSessione(req).getId()) {
                sendError(resp, HttpServletResponse.SC_FORBIDDEN, "Configurazione non trovata.");
                return;
            }
            sendJson(resp, conf);
        } catch (SQLException e) {
            throw new ServletException("Errore DB in GetDettaglioConfigurazione", e);
        }
    }
}
