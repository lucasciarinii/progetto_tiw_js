package it.polimi.progetto_tiw_js.api.fornitore;

import it.polimi.progetto_tiw_js.api.BaseApiServlet;
import it.polimi.progetto_tiw_js.beans.SKU;
import it.polimi.progetto_tiw_js.dao.SKUDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;

/**
 * Aggiorna un singolo campo di una SKU tramite inline editing
 * e restituisce il dettaglio aggiornato in JSON.
 */
@WebServlet("/apifornitoreskuaggiorna")
public class AggiornaSKUServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        req.setCharacterEncoding("UTF-8");

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
            SKUDAO skuDAO = new SKUDAO(conn);
            SKU sku = skuDAO.findById(id);

            if (sku == null) {
                sendError(resp, HttpServletResponse.SC_NOT_FOUND, "SKU non trovata");
                return;
            }

            String campoPulito = campo.trim();

            switch (campoPulito) {
                case "nome" -> {
                    String nome = valore.trim();

                    if (nome.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il nome non può essere vuoto");
                        return;
                    }

                    skuDAO.updateNome(id, nome);
                }

                case "descrizioneTecnica" -> {
                    String descrizione = valore.trim();

                    if (descrizione.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "La descrizione tecnica non può essere vuota");
                        return;
                    }

                    skuDAO.updateDescrizioneTecnica(id, descrizione);
                }

                case "prezzo" -> {
                    double prezzo;

                    try {
                        prezzo = Double.parseDouble(valore.trim());
                    } catch (NumberFormatException e) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Prezzo non valido");
                        return;
                    }

                    if (prezzo < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo deve essere maggiore o uguale a 0");
                        return;
                    }

                    skuDAO.updatePrezzo(id, prezzo);
                }

                default -> {
                    sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                            "Campo non aggiornabile");
                    return;
                }
            }

            SKU skuAggiornata = skuDAO.findById(id);
            sendJson(resp, skuAggiornata);

        } catch (SQLException e) {
            throw new ServletException("Errore durante l'aggiornamento della SKU", e);
        }
    }

    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }
}