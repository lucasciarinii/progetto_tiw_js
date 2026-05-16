package it.polimi.progetto_tiw_js.api;

import it.polimi.progetto_tiw_js.api.BaseApiServlet;
import it.polimi.progetto_tiw_js.beans.Prodotto;
import it.polimi.progetto_tiw_js.dao.ProdottoDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;

/**
 * Restituisce i prodotti di primo livello disponibili
 * per il form di creazione del prodotto composto.
 */
@WebServlet("/apifornitoreprodotti-disponibili")
public class GetProdottiDisponibiliServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
            List<Prodotto> prodottiDisponibili = prodottoDAO.findDisponibili();
            sendJson(resp, prodottiDisponibili);
        } catch (SQLException e) {
            throw new ServletException("Errore durante il caricamento dei prodotti disponibili", e);
        }
    }
}