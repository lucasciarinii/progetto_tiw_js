package it.polimi.progetto_tiw_js.api;

import it.polimi.progetto_tiw_js.beans.Prodotto;
import it.polimi.progetto_tiw_js.dao.ProdottoDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@WebServlet("/apifornitoreprodottocrea")
@MultipartConfig
public class CreaProdottoServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;
    private static final int MAX_PROFONDITA = 3;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        String tipo = req.getParameter("tipo");
        String codiceParam = req.getParameter("codice");
        String nome = req.getParameter("nome");

        if (isBlank(tipo) || isBlank(codiceParam) || isBlank(nome)) {
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

            String tipoPulito = tipo.trim().toUpperCase();

            if ("SEMPLICE".equals(tipoPulito)) {
                creaProdottoSemplice(req, resp, prodottoDAO, codice, nome.trim());
                return;
            }

            if ("COMPOSTO".equals(tipoPulito)) {
                creaProdottoComposto(req, resp, prodottoDAO, codice, nome.trim());
                return;
            }

            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Tipo prodotto non valido");

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

        if (isBlank(descrizione) || isBlank(prezzoMinParam) || isBlank(prezzoMaxParam)) {
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

        Set<Integer> figlioIds = new LinkedHashSet<>();

        for (String figlioIdParam : figlioIdParams) {
            try {
                figlioIds.add(Integer.parseInt(figlioIdParam.trim()));
            } catch (NumberFormatException e) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati non è valido");
                return;
            }
        }

        for (Integer figlioId : figlioIds) {
            Prodotto figlio = prodottoDAO.findById(figlioId);

            if (figlio == null) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati non esiste");
                return;
            }

            if (figlio.getPadreId() != null) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati ha già un padre");
                return;
            }

            int altezzaSottoalbero = prodottoDAO.getSubtreeHeight(figlioId);
            if (altezzaSottoalbero + 1 > MAX_PROFONDITA) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Profondità massima superata");
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
            prodottoDAO.setPadre(figlioId, prodottoId);
        }

        Prodotto prodottoCreato = prodottoDAO.findByIdConDiscendenti(prodottoId);
        sendJson(resp, prodottoCreato);
    }

    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }
}