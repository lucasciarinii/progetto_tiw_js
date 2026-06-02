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

        // Accesso consentito solo al fornitore autenticato.
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        // Lettura parametri richiesti per aggiornare un campo.
        String idParam = req.getParameter("id");
        String campo = req.getParameter("campo");
        String valore = req.getParameter("valore");

        // Validazione base della richiesta.
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

        // Id non valido o non positivo: blocchiamo l'operazione.
        if (id <= 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Id non valido");
            return;
        }

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
            Prodotto prodotto = prodottoDAO.findById(id);

            // Se il prodotto non esiste, non possiamo aggiornarlo.
            if (prodotto == null) {
                sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Prodotto non trovato");
                return;
            }

            // Normalizziamo il tipo per vincolare i campi aggiornabili.
            String tipoProdotto = prodotto.getTipo() == null
                    ? ""
                    : prodotto.getTipo().trim().toUpperCase();

            // Normalizzazione del campo da aggiornare.
            String campoPulito = campo.trim().toLowerCase();

            // Applichiamo l'aggiornamento con le relative validazioni.
            switch (campoPulito) {
                case "nome" -> {
                    String nome = valore.trim();

                    // Nome obbligatorio.
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

                    // Codice non negativo e univoco.
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
                    // La descrizione è modificabile solo per i composti.
                    if (!"COMPOSTO".equals(tipoProdotto)) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "La descrizione è modificabile solo per i prodotti composti");
                        return;
                    }

                    String descrizione = valore.trim();

                    // Descrizione obbligatoria.
                    if (descrizione.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "La descrizione non può essere vuota");
                        return;
                    }

                    prodottoDAO.updateDescrizione(id, descrizione);
                }

                case "prezzomin" -> {
                    // Prezzo minimo valido solo per i composti.
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

                    // Range prezzo minimo coerente.
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
                    // Prezzo massimo valido solo per i composti.
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

                    // Range prezzo massimo coerente.
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
                    // Campo non gestito dal backend.
                    sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                            "Campo non aggiornabile");
                    return;
                }
            }

            // Ricarico del prodotto aggiornato per restituire un JSON coerente.
            Prodotto prodottoAggiornato;
            if ("SEMPLICE".equals(tipoProdotto)) {
                prodottoAggiornato = prodottoDAO.findByIdConSKU(id);
            } else {
                prodottoAggiornato = prodottoDAO.findByIdConDiscendenti(id);
            }

            // Se il prodotto non si riesce a ricaricare, segnaliamo errore.
            if (prodottoAggiornato == null) {
                sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Impossibile ricaricare il prodotto aggiornato");
                return;
            }

            // Risposta JSON con il prodotto aggiornato.
            sendJson(resp, prodottoAggiornato);

        } catch (SQLException e) {
            throw new ServletException("Errore durante l'aggiornamento del prodotto", e);
        }
    }

    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }
}