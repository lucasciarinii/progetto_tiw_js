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

/**
 * Restituisce il dettaglio completo di un prodotto.
 *
 * Questa servlet viene usata sia nella home del fornitore sia nella ricerca:
 * - per un prodotto semplice serve anche la lista delle SKU associate;
 * - per un prodotto composto serve l'intero sottoalbero dei figli.
 */
@WebServlet("/apifornitoreprodotto-dettaglio")
public class GetDettaglioProdottoServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        // accesso consentito solo al fornitore autenticato
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        String idParam = req.getParameter("id");
        String tipoParam = req.getParameter("tipo");

        // entrambi i parametri sono obbligatori
        if (isBlank(idParam) || isBlank(tipoParam)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametri id e tipo obbligatori");
            return;
        }

        int idProdotto;
        try {
            idProdotto = Integer.parseInt(idParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Id prodotto non valido");
            return;
        }

        if (idProdotto <= 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Id prodotto non valido");
            return;
        }

        String tipo = tipoParam.trim().toUpperCase();

        if (!"SEMPLICE".equals(tipo) && !"COMPOSTO".equals(tipo)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Tipo prodotto non valido");
            return;
        }

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
            Prodotto prodotto;

            // se è semplice carico anche la lista SKU,
            // se è composto carico tutto il sottoalbero
            if ("SEMPLICE".equals(tipo)) {
                prodotto = prodottoDAO.findByIdConSKU(idProdotto);
            } else {
                prodotto = prodottoDAO.findByIdConDiscendenti(idProdotto);
            }

            if (prodotto == null) {
                sendError(resp, HttpServletResponse.SC_NOT_FOUND,
                        "Prodotto non trovato");
                return;
            }

            // controllo extra: il tipo richiesto deve coincidere con quello reale
            if (!tipo.equalsIgnoreCase(prodotto.getTipo())) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Il tipo richiesto non corrisponde al prodotto");
                return;
            }

            sendJson(resp, prodotto);

        } catch (SQLException e) {
            throw new ServletException(
                    "Errore durante il caricamento del dettaglio prodotto", e
            );
        }
    }

    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }
}