package it.polimi.progetto_tiw_js.api.fornitore;

import it.polimi.progetto_tiw_js.api.BaseApiServlet;
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
 * la richiesta arriva come multipart/form-data perché la form può contenere
 * anche il file della fotografia. Per questo motivo, anche i campi testuali
 * vengono letti tramite Part invece che con getParameter().
 */
@WebServlet("/api/fornitore/sku/crea")
@MultipartConfig
public class CreaSKU extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        // La creazione di SKU è permessa solo a un fornitore autenticato.
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        req.setCharacterEncoding("UTF-8");

        // Leggo i campi testuali della multipart.
        String codiceParam = leggiCampoTestuale(req, "codice");
        String nome = leggiCampoTestuale(req, "nome");
        String descrizioneTecnica = leggiCampoTestuale(req, "descrizioneTecnica");
        String prezzoParam = leggiCampoTestuale(req, "prezzo");

        // La fotografia è opzionale.
        Part fotoPart = req.getPart("fotografia");

        // Controllo dei campi obbligatori.
        if (isBlank(codiceParam) || isBlank(nome) || isBlank(descrizioneTecnica) || isBlank(prezzoParam)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Tutti i campi obbligatori devono essere compilati");
            return;
        }

        int codice;
        double prezzo;

        // Parsing dei campi numerici.
        try {
            codice = Integer.parseInt(codiceParam.trim());
            prezzo = Double.parseDouble(prezzoParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Codice o prezzo non validi");
            return;
        }

        // Il codice non può essere negativo.
        if (codice < 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il codice deve essere maggiore o uguale a 0");
            return;
        }

        // Il prezzo non può essere negativo.
        if (prezzo < 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il prezzo deve essere maggiore o uguale a 0");
            return;
        }

        // Se non viene caricata nessuna immagine, il percorso resta null.
        String fotografia = null;

        if (fotoPart != null && fotoPart.getSize() > 0) {
            fotografia = salvaFoto(fotoPart);

            // Se il file era presente ma il salvataggio fallisce,
            // restituisco un errore interno.
            if (fotografia == null) {
                sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Errore durante il salvataggio della fotografia");
                return;
            }
        }

        try {
            SKUDAO skuDAO = new SKUDAO(conn);

            // Il codice SKU deve essere univoco.
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

            // Rileggo la SKU completa dal DB e la restituisco al frontend.
            SKU skuCreata = skuDAO.findById(idGenerato);
            if (skuCreata == null) {
                sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Impossibile ricaricare la SKU appena creata");
                return;
            }

            sendJson(resp, skuCreata);

        } catch (SQLException e) {
            throw new ServletException("Errore durante la creazione della SKU", e);
        }
    }

    /**
     * Legge un campo testuale da una request multipart e lo restituisce come stringa UTF-8.
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

        // Difesa minima: alcuni browser o path vecchi possono includere
        // anche la cartella completa, quindi tengo solo il nome finale.
        int slash = submitted.lastIndexOf('/');
        int backslash = submitted.lastIndexOf('\\');
        int indice = Math.max(slash, backslash);

        return (indice >= 0) ? submitted.substring(indice + 1) : submitted;
    }

    /**
     * Utility per controllare stringhe nulle, vuote o fatte solo di spazi.
     */
    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }

    /**
     * Salva la fotografia della SKU nella cartella uploads dell'applicazione
     * e restituisce il percorso relativo da memorizzare nel database.
     *
     * Se qualcosa va storto, ritorna null.
     */
    private String salvaFoto(Part part) {
        try {
            String nomeOriginale = estraiNomeFile(part);

            if (isBlank(nomeOriginale)) {
                return null;
            }

            // Ripulisco ancora il nome file e ne ricavo l'estensione.
            String nomePulito = Paths.get(nomeOriginale).getFileName().toString();

            int punto = nomePulito.lastIndexOf('.');
            String estensione = punto >= 0 ? nomePulito.substring(punto) : "";

            // Genero un nome univoco semplice basato sul timestamp.
            String nomeGenerato = "sku_" + System.currentTimeMillis() + estensione;

            String uploadDirPath = getServletContext().getRealPath("/uploads");
            if (uploadDirPath == null) {
                return null;
            }

            // Se la cartella uploads non esiste, provo a crearla.
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