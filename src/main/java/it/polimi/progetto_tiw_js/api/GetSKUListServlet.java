package it.polimi.progetto_tiw_js.api;

import it.polimi.progetto_tiw_js.api.BaseApiServlet;
import it.polimi.progetto_tiw_js.beans.SKU;
import it.polimi.progetto_tiw_js.dao.SKUDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;

/**
 * Restituisce tutte le SKU presenti nel sistema.
 */
@WebServlet("/apifornitoresku")
public class GetSKUListServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        try {
            SKUDAO skuDAO = new SKUDAO(conn);
            List<SKU> listaSku = skuDAO.findAll();
            sendJson(resp, listaSku);
        } catch (SQLException e) {
            throw new ServletException("Errore durante il caricamento delle SKU", e);
        }
    }
}