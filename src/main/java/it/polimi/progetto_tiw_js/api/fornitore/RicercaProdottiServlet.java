package it.polimi.progetto_tiw_js.api.fornitore;

import it.polimi.progetto_tiw_js.api.BaseApiServlet;
import it.polimi.progetto_tiw_js.beans.Prodotto;
import it.polimi.progetto_tiw_js.beans.SKU;
import it.polimi.progetto_tiw_js.dao.ProdottoDAO;
import it.polimi.progetto_tiw_js.dao.SKUDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Esegue la ricerca lato fornitore su prodotti e SKU.
 *-
 * Il frontend si aspetta un JSON del tipo:
 * {
 *   "keyword": "...",
 *   "prodotti": [...],
 *   "sku": [...]
 * }
 */
@WebServlet("/apifornitorericerca")
public class RicercaProdottiServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        // Endpoint accessibile solo a un fornitore autenticato.
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        String keyword = req.getParameter("keyword");

        // La ricerca ha senso solo se arriva una parola chiave non vuota.
        if (keyword == null || keyword.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Inserisci una parola chiave per cercare prodotti e SKU");
            return;
        }

        String keywordPulita = keyword.trim();

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
            SKUDAO skuDAO = new SKUDAO(conn);

            // Recupero prima i prodotti che matchano la keyword in forma base.
            List<Prodotto> prodottiBase = prodottoDAO.searchByKeyword(keywordPulita);
            List<Prodotto> prodottiCompleti = new ArrayList<>();

            // Per ogni prodotto trovato carico poi il dettaglio completo,
            // così il frontend ha già tutte le informazioni utili da mostrare.
            for (Prodotto prodottoBase : prodottiBase) {
                if (prodottoBase == null) {
                    continue;
                }

                Prodotto prodottoCompleto;

                if ("SEMPLICE".equalsIgnoreCase(prodottoBase.getTipo())) {
                    prodottoCompleto = prodottoDAO.findByIdConSKU(prodottoBase.getId());
                } else if ("COMPOSTO".equalsIgnoreCase(prodottoBase.getTipo())) {
                    prodottoCompleto = prodottoDAO.findByIdConDiscendenti(prodottoBase.getId());
                } else {
                    // Caso difensivo: se il tipo non è riconosciuto,
                    // restituisco comunque il prodotto base trovato.
                    prodottoCompleto = prodottoBase;
                }

                if (prodottoCompleto != null) {
                    prodottiCompleti.add(prodottoCompleto);
                }
            }

            // Anche per le SKU uso la keyword già ripulita.
            // L'eventuale logica di wildcard o LIKE resta nel DAO.
            List<SKU> risultatiSku = skuDAO.searchByKeyword(keywordPulita);

            Map<String, Object> risultato = new HashMap<>();
            risultato.put("keyword", keywordPulita);
            risultato.put("prodotti", prodottiCompleti);
            risultato.put("sku", risultatiSku);

            sendJson(resp, risultato);

        } catch (SQLException e) {
            throw new ServletException("Errore durante la ricerca di prodotti e SKU", e);
        }
    }
}