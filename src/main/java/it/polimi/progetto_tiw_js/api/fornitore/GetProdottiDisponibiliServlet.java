package it.polimi.progetto_tiw_js.api.fornitore;

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
 * Restituisce i prodotti attualmente disponibili per essere agganciati
 * come figli durante la creazione di un prodotto composto.
 *
 * Al frontend basta ricevere i dati essenziali del prodotto,
 * come id, nome, codice e tipo.
 */
@WebServlet("/apifornitoreprodotti-disponibili")
public class GetProdottiDisponibiliServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        // Endpoint accessibile solo a un fornitore autenticato.
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);

            // Recupero solo i prodotti che possono essere proposti
            // nella lista dei figli disponibili lato frontend.
            List<Prodotto> prodottiDisponibili = prodottoDAO.findDisponibili();

            sendJson(resp, prodottiDisponibili);

        } catch (SQLException e) {
            throw new ServletException(
                    "Errore durante il caricamento dei prodotti disponibili", e
            );
        }
    }
}