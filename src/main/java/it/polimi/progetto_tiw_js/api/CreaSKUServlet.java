package it.polimi.progetto_tiw_js.api;

import it.polimi.progetto_tiw_js.beans.SKU;
import it.polimi.progetto_tiw_js.dao.SKUDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
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

        String codiceParam = leggiCampoMultipart(req, "codice");
        String nome = leggiCampoMultipart(req, "nome");
        String descrizioneTecnica = leggiCampoMultipart(req, "descrizioneTecnica");
        String prezzoParam = leggiCampoMultipart(req, "prezzo");

        String fotografia = null;

        if (codiceParam == null || codiceParam.isBlank()
                || nome == null || nome.isBlank()
                || descrizioneTecnica == null || descrizioneTecnica.isBlank()
                || prezzoParam == null || prezzoParam.isBlank()) {
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

    private String leggiCampoMultipart(HttpServletRequest req, String nomeCampo)
            throws IOException, ServletException {

        Part part = req.getPart(nomeCampo);
        if (part == null) {
            return null;
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(part.getInputStream(), StandardCharsets.UTF_8))) {

            StringBuilder sb = new StringBuilder();
            String riga;
            while ((riga = reader.readLine()) != null) {
                sb.append(riga);
            }
            return sb.toString();
        }
    }
}