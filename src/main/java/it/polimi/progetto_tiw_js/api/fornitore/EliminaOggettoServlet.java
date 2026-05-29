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
import java.util.HashMap;
import java.util.Map;

@WebServlet("/apifornitoreoggettoelimina")
public class EliminaOggettoServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        String idStr = req.getParameter("id");
        String tipo = req.getParameter("tipo");
        String returnProdottoIdStr = req.getParameter("returnProdottoId");

        if (isBlank(tipo)) {
            tipo = req.getParameter("type");
        }

        if (isBlank(idStr) || isBlank(tipo)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametri mancanti");
            return;
        }

        int id;
        Integer returnProdottoId = parseNullableInt(returnProdottoIdStr);

        try {
            id = Integer.parseInt(idStr.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametro id non valido");
            return;
        }

        if (id <= 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametro id non valido");
            return;
        }

        if (returnProdottoId != null && returnProdottoId <= 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametro returnProdottoId non valido");
            return;
        }

        tipo = tipo.trim().toUpperCase();

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
            SKUDAO skuDAO = new SKUDAO(conn);

            switch (tipo) {
                case "SKU" -> eliminaSku(resp, skuDAO, prodottoDAO, id, returnProdottoId);
                case "SEMPLICE" -> eliminaProdottoSemplice(resp, prodottoDAO, id);
                case "COMPOSTO" -> eliminaProdottoComposto(resp, prodottoDAO, id);
                default -> sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Tipo oggetto non valido");
            }

        } catch (SQLException e) {
            throw new ServletException("Errore durante l'eliminazione dell'oggetto", e);
        }
    }

    private void eliminaSku(HttpServletResponse resp, SKUDAO skuDAO, ProdottoDAO prodottoDAO,
                            int skuId, Integer returnProdottoId)
            throws SQLException, IOException {

        SKU sku = skuDAO.findById(skuId);

        if (sku == null) {
            sendError(resp, HttpServletResponse.SC_NOT_FOUND,
                    "SKU non trovata");
            return;
        }

        if (prodottoDAO.existsProdottoSempliceCheResterebbeSenzaSku(skuId)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Non puoi eliminare questa SKU perché lascerebbe senza SKU almeno un prodotto semplice");
            return;
        }

        skuDAO.deleteSKU(skuId);

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("ok", true);

        // se il frontend ci dice da quale prodotto semplice siamo partiti,
        // proviamo a rimandargli il dettaglio aggiornato già pronto
        if (returnProdottoId != null) {
            Prodotto prodottoAggiornato = prodottoDAO.findByIdConSKU(returnProdottoId);
            if (prodottoAggiornato != null) {
                responseBody.put("prodottoAggiornato", prodottoAggiornato);
            }
        }

        sendJson(resp, responseBody);
    }

    private void eliminaProdottoSemplice(HttpServletResponse resp, ProdottoDAO prodottoDAO, int id)
            throws SQLException, IOException {

        Prodotto prodotto = prodottoDAO.findById(id);

        if (prodotto == null) {
            sendError(resp, HttpServletResponse.SC_NOT_FOUND,
                    "Prodotto non trovato");
            return;
        }

        if (!"SEMPLICE".equalsIgnoreCase(prodotto.getTipo())) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il tipo dell'oggetto non corrisponde a un prodotto semplice");
            return;
        }

        if (prodotto.getPadreId() != null
                && prodottoDAO.findFigliDiretti(prodotto.getPadreId()).size() <= 1) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Non puoi eliminare l'ultimo sottoprodotto del composto");
            return;
        }

        prodottoDAO.deleteProdotto(id);
        sendJson(resp, createOkResponse());
    }

    private void eliminaProdottoComposto(HttpServletResponse resp, ProdottoDAO prodottoDAO, int id)
            throws SQLException, IOException {

        Prodotto prodotto = prodottoDAO.findById(id);

        if (prodotto == null) {
            sendError(resp, HttpServletResponse.SC_NOT_FOUND,
                    "Prodotto non trovato");
            return;
        }

        if (!"COMPOSTO".equalsIgnoreCase(prodotto.getTipo())) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il tipo dell'oggetto non corrisponde a un prodotto composto");
            return;
        }

        if (prodotto.getPadreId() != null
                && prodottoDAO.findFigliDiretti(prodotto.getPadreId()).size() <= 1) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Non puoi eliminare l'ultimo sottoprodotto del composto");
            return;
        }

        prodottoDAO.deleteProdottoConDiscendenti(id);
        sendJson(resp, createOkResponse());
    }

    private Object createOkResponse() {
        return new Object() {
            public final boolean ok = true;
        };
    }

    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }

    private Integer parseNullableInt(String value) {
        if (isBlank(value)) {
            return null;
        }

        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}