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
import java.util.List;

@WebServlet("/api/cliente/configurazioni")
public class GetConfigurazioni extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "CLIENTE")) return;

        try {
            int clienteId = getUtenteInSessione(req).getId();
            ConfigurazioneDAO dao = new ConfigurazioneDAO(conn);
            List<Configurazione> configurazioni = dao.findByCliente(clienteId);
            sendJson(resp, configurazioni);
        } catch (SQLException e) {
            throw new ServletException("Errore DB in GetConfigurazioni", e);
        }
    }
}
