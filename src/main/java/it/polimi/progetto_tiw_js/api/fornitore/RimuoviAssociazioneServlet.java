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

@WebServlet("/apifornitoreassociazionerimuovi")
public class RimuoviAssociazioneServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        // Endpoint accessibile solo a un fornitore autenticato.
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        String tipoRelazione = req.getParameter("tipoRelazione");

        // Il tipo di relazione serve per capire quale rimozione applicare.
        if (isBlank(tipoRelazione)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Tipo relazione mancante");
            return;
        }

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
            String tipoRelazionePulito = tipoRelazione.trim().toUpperCase();

            // Smistamento in base al tipo di associazione da rimuovere.
            if ("PRODOTTO_SKU".equals(tipoRelazionePulito)) {
                rimuoviAssociazioneProdottoSku(req, resp, prodottoDAO);
                return;
            }

            if ("PADRE_FIGLIO".equals(tipoRelazionePulito)) {
                rimuoviAssociazionePadreFiglio(req, resp, prodottoDAO);
                return;
            }

            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Tipo relazione non valido");

        } catch (SQLException e) {
            throw new ServletException("Errore durante la rimozione dell'associazione", e);
        }
    }

    private void rimuoviAssociazioneProdottoSku(HttpServletRequest req, HttpServletResponse resp,
                                                ProdottoDAO prodottoDAO)
            throws SQLException, IOException {

        String prodottoIdParam = req.getParameter("prodottoId");
        String skuIdParam = req.getParameter("skuId");

        // Per rimuovere una SKU da un prodotto semplice servono entrambi gli id.
        if (isBlank(prodottoIdParam) || isBlank(skuIdParam)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametri mancanti per la rimozione della SKU");
            return;
        }

        int prodottoId;
        int skuId;

        try {
            prodottoId = Integer.parseInt(prodottoIdParam.trim());
            skuId = Integer.parseInt(skuIdParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametri non validi");
            return;
        }

        if (prodottoId <= 0 || skuId <= 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametri non validi");
            return;
        }

        Prodotto prodotto = prodottoDAO.findByIdConSKU(prodottoId);

        if (prodotto == null) {
            sendError(resp, HttpServletResponse.SC_NOT_FOUND,
                    "Prodotto non trovato");
            return;
        }

        // La relazione prodotto-SKU ha senso solo per un prodotto semplice.
        if (!"SEMPLICE".equalsIgnoreCase(prodotto.getTipo())) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "La rimozione SKU è consentita solo per prodotti semplici");
            return;
        }

        if (prodotto.getSkuList() == null || prodotto.getSkuList().isEmpty()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il prodotto non ha SKU associate");
            return;
        }

        // Non posso lasciare un prodotto semplice senza nessuna SKU.
        if (prodotto.getSkuList().size() <= 1) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Non puoi rimuovere l'ultima SKU del prodotto");
            return;
        }

        boolean skuAssociata = prodotto.getSkuList().stream()
                .anyMatch(sku -> sku.getId() == skuId);

        if (!skuAssociata) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "La SKU selezionata non è associata al prodotto");
            return;
        }

        prodottoDAO.removeSKUDaProdotto(prodottoId, skuId);

        // Dopo la rimozione ricarico il prodotto completo e lo restituisco al frontend.
        Prodotto prodottoAggiornato = prodottoDAO.findByIdConSKU(prodottoId);
        if (prodottoAggiornato == null) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Impossibile ricaricare il prodotto aggiornato");
            return;
        }

        sendJson(resp, prodottoAggiornato);
    }

    private void rimuoviAssociazionePadreFiglio(HttpServletRequest req, HttpServletResponse resp,
                                                ProdottoDAO prodottoDAO)
            throws SQLException, IOException {

        String figlioIdParam = req.getParameter("figlioId");
        String padreIdParam = req.getParameter("padreId");

        // Per scollegare un figlio serve almeno l'id del figlio.
        // L'id del padre può arrivare come controllo aggiuntivo.
        if (isBlank(figlioIdParam)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametro figlioId mancante");
            return;
        }

        int figlioId;
        Integer padreIdRichiesto = null;

        try {
            figlioId = Integer.parseInt(figlioIdParam.trim());

            if (!isBlank(padreIdParam)) {
                padreIdRichiesto = Integer.parseInt(padreIdParam.trim());
            }
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametri non validi");
            return;
        }

        if (figlioId <= 0 || (padreIdRichiesto != null && padreIdRichiesto <= 0)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametri non validi");
            return;
        }

        Prodotto figlio = prodottoDAO.findById(figlioId);

        if (figlio == null) {
            sendError(resp, HttpServletResponse.SC_NOT_FOUND,
                    "Sottoprodotto non trovato");
            return;
        }

        if (figlio.getPadreId() == null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il prodotto selezionato non ha un padre");
            return;
        }

        Integer padreIdReale = figlio.getPadreId();

        // Se il client passa anche il padre atteso, verifico che la relazione
        // che vuole rimuovere sia davvero quella presente nel database.
        if (padreIdRichiesto != null && !padreIdRichiesto.equals(padreIdReale)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "La relazione padre-figlio non è coerente");
            return;
        }

        Prodotto padre = prodottoDAO.findById(padreIdReale);

        if (padre == null) {
            sendError(resp, HttpServletResponse.SC_NOT_FOUND,
                    "Prodotto padre non trovato");
            return;
        }

        // Il padre di una relazione padre-figlio deve essere un composto.
        if (!"COMPOSTO".equalsIgnoreCase(padre.getTipo())) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il padre deve essere un prodotto composto");
            return;
        }

        // Non posso staccare l'ultimo figlio di un composto.
        if (prodottoDAO.findFigliDiretti(padreIdReale).size() <= 1) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Non puoi rimuovere l'ultimo sottoprodotto del composto");
            return;
        }

        prodottoDAO.removePadre(figlioId);

        // Ricarico il padre aggiornato così il frontend può riallineare subito l'albero.
        Prodotto padreAggiornato = prodottoDAO.findByIdConDiscendenti(padreIdReale);
        if (padreAggiornato == null) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    "Impossibile ricaricare il prodotto padre aggiornato");
            return;
        }

        sendJson(resp, padreAggiornato);
    }

    /**
     * Utility per controllare stringhe nulle, vuote o fatte solo di spazi.
     */
    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }
}