package it.polimi.progetto_tiw_js.api;

import it.polimi.progetto_tiw_js.beans.SKU;
import it.polimi.progetto_tiw_js.dao.SKUDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.PreparedStatement;
import java.sql.SQLException;

@WebServlet("/apifornitoreskuaggiorna")
public class AggiornaSKUServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        String idParam = req.getParameter("id");
        String campo = req.getParameter("campo");
        String valore = req.getParameter("valore");

        if (idParam == null || idParam.isBlank()
                || campo == null || campo.isBlank()
                || valore == null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Parametri mancanti");
            return;
        }

        int id;
        try {
            id = Integer.parseInt(idParam);
        } catch (NumberFormatException e) {
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

            switch (campo) {
                case "nome" -> {
                    String nome = valore.trim();
                    if (nome.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il nome non può essere vuoto");
                        return;
                    }
                    aggiornaCampoTesto("UPDATE sku SET nome = ? WHERE id = ?", nome, id);
                }

                case "descrizioneTecnica" -> {
                    String descrizione = valore.trim();
                    if (descrizione.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "La descrizione tecnica non può essere vuota");
                        return;
                    }
                    aggiornaCampoTesto(
                            "UPDATE sku SET descrizione_tecnica = ? WHERE id = ?",
                            descrizione,
                            id
                    );
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

                    aggiornaPrezzo(id, prezzo);
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

    private void aggiornaCampoTesto(String sql, String valore, int id) throws SQLException {
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, valore);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }

    private void aggiornaPrezzo(int id, double prezzo) throws SQLException {
        String sql = "UPDATE sku SET prezzo = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setDouble(1, prezzo);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }
}