package it.polimi.progetto_tiw_js.api;

import it.polimi.progetto_tiw_js.beans.Prodotto;
import it.polimi.progetto_tiw_js.dao.ProdottoDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

@WebServlet("/apifornitoreprodottocrea")
public class CreaProdottoServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        String tipo = req.getParameter("tipo");
        String codiceParam = req.getParameter("codice");
        String nome = req.getParameter("nome");

        if (tipo == null || tipo.isBlank()
                || codiceParam == null || codiceParam.isBlank()
                || nome == null || nome.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametri obbligatori mancanti");
            return;
        }

        int codice;
        try {
            codice = Integer.parseInt(codiceParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Codice non valido");
            return;
        }

        if (codice < 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il codice deve essere maggiore o uguale a 0");
            return;
        }

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);

            if (prodottoDAO.existsByCodice(codice)) {
                sendError(resp, HttpServletResponse.SC_CONFLICT,
                        "Esiste già un prodotto con questo codice");
                return;
            }

            if ("SEMPLICE".equalsIgnoreCase(tipo.trim())) {
                creaProdottoSemplice(req, resp, prodottoDAO, codice, nome.trim());
                return;
            }

            if ("COMPOSTO".equalsIgnoreCase(tipo.trim())) {
                creaProdottoComposto(req, resp, prodottoDAO, codice, nome.trim());
                return;
            }

            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Tipo prodotto non valido");

        } catch (SQLException e) {
            throw new ServletException("Errore durante la creazione del prodotto", e);
        }
    }

    private void creaProdottoSemplice(HttpServletRequest req, HttpServletResponse resp,
                                      ProdottoDAO prodottoDAO, int codice, String nome)
            throws SQLException, IOException {

        String[] skuIdParams = req.getParameterValues("skuIds");

        if (skuIdParams == null || skuIdParams.length == 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Seleziona almeno una SKU");
            return;
        }

        List<Integer> skuIds = new ArrayList<>();

        for (String skuIdParam : skuIdParams) {
            try {
                skuIds.add(Integer.parseInt(skuIdParam.trim()));
            } catch (NumberFormatException e) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Una delle SKU selezionate non è valida");
                return;
            }
        }

        int prodottoId = prodottoDAO.createProdottoSemplice(codice, nome);

        for (Integer skuId : skuIds) {
            prodottoDAO.addSKUToProdotto(prodottoId, skuId);
        }

        Prodotto prodottoCreato = prodottoDAO.findByIdConSKU(prodottoId);
        sendJson(resp, prodottoCreato);
    }

    private void creaProdottoComposto(HttpServletRequest req, HttpServletResponse resp,
                                      ProdottoDAO prodottoDAO, int codice, String nome)
            throws SQLException, IOException {

        String descrizione = req.getParameter("descrizione");
        String prezzoMinParam = req.getParameter("prezzoMin");
        String prezzoMaxParam = req.getParameter("prezzoMax");
        String[] figlioIdParams = req.getParameterValues("figlioIds");

        if (descrizione == null || descrizione.isBlank()
                || prezzoMinParam == null || prezzoMinParam.isBlank()
                || prezzoMaxParam == null || prezzoMaxParam.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Compila tutti i campi del prodotto composto");
            return;
        }

        if (figlioIdParams == null || figlioIdParams.length == 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Seleziona almeno un sottoprodotto");
            return;
        }

        double prezzoMin;
        double prezzoMax;

        try {
            prezzoMin = Double.parseDouble(prezzoMinParam.trim());
            prezzoMax = Double.parseDouble(prezzoMaxParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Fascia di prezzo non valida");
            return;
        }

        if (prezzoMin < 0 || prezzoMax < 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "I prezzi devono essere maggiori o uguali a 0");
            return;
        }

        if (prezzoMin > prezzoMax) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il prezzo minimo non può essere maggiore del massimo");
            return;
        }

        List<Integer> figlioIds = new ArrayList<>();

        for (String figlioIdParam : figlioIdParams) {
            try {
                figlioIds.add(Integer.parseInt(figlioIdParam.trim()));
            } catch (NumberFormatException e) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati non è valido");
                return;
            }
        }

        int prodottoId = prodottoDAO.createProdottoComposto(
                codice,
                nome,
                descrizione.trim(),
                prezzoMin,
                prezzoMax
        );

        for (Integer figlioId : figlioIds) {
            if (figlioId == prodottoId) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Un prodotto non può contenere se stesso");
                return;
            }

            if (prodottoDAO.isAncestor(figlioId, prodottoId)) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Operazione non consentita: ciclo nella gerarchia");
                return;
            }

            int profonditaFiglio = prodottoDAO.getDepth(figlioId);
            if (profonditaFiglio + 1 > 3) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Profondità massima superata");
                return;
            }

            prodottoDAO.setPadre(figlioId, prodottoId);
        }

        Prodotto prodottoCreato = prodottoDAO.findByIdConDiscendenti(prodottoId);
        sendJson(resp, prodottoCreato);
    }
}