package it.polimi.progetto_tiw_js.api;

import it.polimi.progetto_tiw_js.beans.SKU;
import it.polimi.progetto_tiw_js.dao.SKUDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Part;

import java.io.File;
import java.nio.file.Paths;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.SQLException;

/**
 * Crea una nuova SKU e restituisce il dettaglio completo in JSON.
 *
 * Nota:
 * qui la request arriva come multipart/form-data perché la form contiene
 * anche il campo file della fotografia. Anche se la foto è opzionale,
 * i campi testuali vanno comunque letti tramite Part.
 */
@WebServlet("/apifornitoreskucrea")
@MultipartConfig
public class CreaSKUServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        req.setCharacterEncoding("UTF-8");

        String codiceParam = leggiCampoTestuale(req, "codice");
        String nome = leggiCampoTestuale(req, "nome");
        String descrizioneTecnica = leggiCampoTestuale(req, "descrizioneTecnica");
        String prezzoParam = leggiCampoTestuale(req, "prezzo");

        Part fotoPart = req.getPart("fotografia");

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

        // Per ora la fotografia è opzionale.
        // Se non c'è file caricato, resta null.
        String fotografia = null;

        if (fotoPart != null && fotoPart.getSize() > 0) {
            fotografia = salvaFoto(fotoPart);

            if (fotografia == null) {
                sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Errore durante il salvataggio della fotografia");
                return;
            }
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

    /**
     * Legge un campo testuale da una request multipart.
     */
    private String leggiCampoTestuale(HttpServletRequest req, String nomeCampo)
            throws IOException, ServletException {

        Part part = req.getPart(nomeCampo);
        if (part == null) {
            return null;
        }

        byte[] contenuto = part.getInputStream().readAllBytes();
        return new String(contenuto, StandardCharsets.UTF_8);
    }

    /**
     * Estrae il nome del file inviato dal browser.
     */
    private String estraiNomeFile(Part part) {
        String submitted = part.getSubmittedFileName();
        if (submitted == null) {
            return null;
        }

        // Difesa minima: alcuni browser/path vecchi possono includere cartelle.
        int slash = submitted.lastIndexOf('/');
        int backslash = submitted.lastIndexOf('\\');
        int indice = Math.max(slash, backslash);

        return (indice >= 0) ? submitted.substring(indice + 1) : submitted;
    }

    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }
    private String salvaFoto(Part part) {
        try {
            String nomeOriginale = estraiNomeFile(part);

            if (isBlank(nomeOriginale)) {
                return null;
            }

            String nomePulito = Paths.get(nomeOriginale).getFileName().toString();

            int punto = nomePulito.lastIndexOf('.');
            String estensione = punto >= 0 ? nomePulito.substring(punto) : "";

            String nomeGenerato = "sku_" + System.currentTimeMillis() + estensione;

            String uploadDirPath = getServletContext().getRealPath("/uploads");
            if (uploadDirPath == null) {
                return null;
            }

            File uploadDir = new File(uploadDirPath);
            if (!uploadDir.exists() && !uploadDir.mkdirs()) {
                return null;
            }

            String filePathAssoluto = uploadDir.getAbsolutePath() + File.separator + nomeGenerato;
            part.write(filePathAssoluto);

            return "uploads/" + nomeGenerato;
        } catch (Exception e) {
            return null;
        }
    }
}