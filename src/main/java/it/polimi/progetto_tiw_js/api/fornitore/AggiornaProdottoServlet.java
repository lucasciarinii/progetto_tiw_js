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

@WebServlet("/apifornitoreprodottoaggiorna")
public class AggiornaProdottoServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        String idParam = req.getParameter("id");
        String campo = req.getParameter("campo");
        String valore = req.getParameter("valore");

        if (isBlank(idParam) || isBlank(campo) || valore == null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Parametri mancanti");
            return;
        }

        int id;
        try {
            id = Integer.parseInt(idParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Id non valido");
            return;
        }

        if (id <= 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Id non valido");
            return;
        }

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
            Prodotto prodotto = prodottoDAO.findById(id);

            if (prodotto == null) {
                sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Prodotto non trovato");
                return;
            }

            String tipoProdotto = prodotto.getTipo() == null
                    ? ""
                    : prodotto.getTipo().trim().toUpperCase();

            String campoPulito = campo.trim().toLowerCase();

            switch (campoPulito) {
                case "nome" -> {
                    String nome = valore.trim();

                    if (nome.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il nome non può essere vuoto");
                        return;
                    }

                    prodottoDAO.updateNome(id, nome);
                }

                case "codice" -> {
                    int codice;
                    try {
                        codice = Integer.parseInt(valore.trim());
                    } catch (NumberFormatException e) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Codice non valido");
                        return;
                    }

                    if (codice < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il codice deve essere maggiore o uguale a 0");
                        return;
                    }

                    if (prodottoDAO.existsByCodiceExceptId(codice, id)) {
                        sendError(resp, HttpServletResponse.SC_CONFLICT,
                                "Esiste già un prodotto con questo codice");
                        return;
                    }

                    prodottoDAO.updateCodice(id, codice);
                }

                case "descrizione" -> {
                    if (!"COMPOSTO".equals(tipoProdotto)) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "La descrizione è modificabile solo per i prodotti composti");
                        return;
                    }

                    String descrizione = valore.trim();

                    if (descrizione.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "La descrizione non può essere vuota");
                        return;
                    }

                    prodottoDAO.updateDescrizione(id, descrizione);
                }

                case "prezzomin" -> {
                    if (!"COMPOSTO".equals(tipoProdotto)) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo minimo è modificabile solo per i prodotti composti");
                        return;
                    }

                    double prezzoMin;
                    try {
                        prezzoMin = Double.parseDouble(valore.trim());
                    } catch (NumberFormatException e) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Prezzo minimo non valido");
                        return;
                    }

                    if (prezzoMin < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo minimo deve essere maggiore o uguale a 0");
                        return;
                    }

                    if (prezzoMin > prodotto.getPrezzoMax()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo minimo non può superare il prezzo massimo");
                        return;
                    }

                    prodottoDAO.updatePrezzoMin(id, prezzoMin);
                }

                case "prezzomax" -> {
                    if (!"COMPOSTO".equals(tipoProdotto)) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo massimo è modificabile solo per i prodotti composti");
                        return;
                    }

                    double prezzoMax;
                    try {
                        prezzoMax = Double.parseDouble(valore.trim());
                    } catch (NumberFormatException e) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Prezzo massimo non valido");
                        return;
                    }

                    if (prezzoMax < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo massimo deve essere maggiore o uguale a 0");
                        return;
                    }

                    if (prezzoMax < prodotto.getPrezzoMin()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo massimo non può essere minore del prezzo minimo");
                        return;
                    }

                    prodottoDAO.updatePrezzoMax(id, prezzoMax);
                }

                default -> {
                    sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                            "Campo non aggiornabile");
                    return;
                }
            }

            Prodotto prodottoAggiornato;
            if ("SEMPLICE".equals(tipoProdotto)) {
                prodottoAggiornato = prodottoDAO.findByIdConSKU(id);
            } else {
                prodottoAggiornato = prodottoDAO.findByIdConDiscendenti(id);
            }

            if (prodottoAggiornato == null) {
                sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Impossibile ricaricare il prodotto aggiornato");
                return;
            }

            sendJson(resp, prodottoAggiornato);

        } catch (SQLException e) {
            throw new ServletException("Errore durante l'aggiornamento del prodotto", e);
        }
    }

    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }
}