package it.polimi.progetto_tiw_js.api;

import it.polimi.progetto_tiw_js.beans.SKU;
import it.polimi.progetto_tiw_js.dao.SKUDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;

@WebServlet("/apifornitoreskucrea")
@MultipartConfig
public class CreaSKUServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        String codiceParam = req.getParameter("codice");
        String nome = req.getParameter("nome");
        String descrizioneTecnica = req.getParameter("descrizioneTecnica");
        String prezzoParam = req.getParameter("prezzo");

        String fotografia = null;

        if (isBlank(codiceParam) || isBlank(nome) || isBlank(descrizioneTecnica) || isBlank(prezzoParam)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Tutti i campi obbligatori devono essere compilati");
            return;
        }

        int codice;
        double prezzo;

        try {
            codice = Integer.parseInt(codiceParam.trim());
            prezzo = Double.parseDouble(prezzoParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Codice o prezzo non validi");
            return;
        }

        if (codice < 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il codice deve essere maggiore o uguale a 0");
            return;
        }

        if (prezzo < 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il prezzo deve essere maggiore o uguale a 0");
            return;
        }

        try {
            SKUDAO skuDAO = new SKUDAO(conn);

            if (skuDAO.existsByCodice(codice)) {
                sendError(resp, HttpServletResponse.SC_CONFLICT,
                        "Esiste già una SKU con questo codice");
                return;
            }

            int idGenerato = skuDAO.createSKU(
                    codice,
                    nome.trim(),
                    fotografia,
                    descrizioneTecnica.trim(),
                    prezzo
            );

            SKU skuCreata = skuDAO.findById(idGenerato);
            sendJson(resp, skuCreata);

        } catch (SQLException e) {
            throw new ServletException("Errore durante la creazione della SKU", e);
        }
    }

    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }
}