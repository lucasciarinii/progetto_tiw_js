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
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.sql.SQLException;

/**
 * Aggiorna un singolo campo di una SKU tramite inline editing
 * e restituisce il dettaglio aggiornato in JSON.
 */
@WebServlet("/apifornitoreskuaggiorna")
@MultipartConfig
public class AggiornaSKUServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        // Accesso consentito solo al fornitore autenticato.
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        // Normalizziamo l'encoding per evitare problemi sui campi testuali.
        req.setCharacterEncoding("UTF-8");

        // Verifichiamo se la richiesta e' multipart (necessario per la fotografia).
        boolean multipart = isMultipart(req);

        // Lettura parametri: da multipart o da form-urlencoded.
        String idParam = multipart ? leggiCampoTestuale(req, "id") : req.getParameter("id");
        String campo = multipart ? leggiCampoTestuale(req, "campo") : req.getParameter("campo");
        String valore = multipart ? leggiCampoTestuale(req, "valore") : req.getParameter("valore");

        // Validazione base della richiesta.
        if (isBlank(idParam) || isBlank(campo) || (valore == null && !"fotografia".equalsIgnoreCase(campo))) {
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
            SKUDAO skuDAO = new SKUDAO(conn);
            SKU sku = skuDAO.findById(id);

            // La SKU deve esistere per poterla aggiornare.
            if (sku == null) {
                sendError(resp, HttpServletResponse.SC_NOT_FOUND, "SKU non trovata");
                return;
            }

            // Normalizzazione del campo da aggiornare.
            String campoPulito = campo.trim();

            // Aggiorniamo il campo richiesto con le relative validazioni.
            switch (campoPulito) {
                case "nome" -> {
                    String nome = valore.trim();

                    // Nome obbligatorio.
                    if (nome.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il nome non può essere vuoto");
                        return;
                    }

                    skuDAO.updateNome(id, nome);
                }

                case "descrizioneTecnica" -> {
                    String descrizione = valore.trim();

                    // Descrizione tecnica obbligatoria.
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

                    // Prezzo non negativo.
                    if (prezzo < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo deve essere maggiore o uguale a 0");
                        return;
                    }

                    skuDAO.updatePrezzo(id, prezzo);
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

                    if (skuDAO.existsByCodiceExceptId(codice, id)) {
                        sendError(resp, HttpServletResponse.SC_CONFLICT,
                                "Esiste già una SKU con questo codice");
                        return;
                    }

                    skuDAO.updateCodice(id, codice);
                }

                case "fotografia" -> {
                    // La fotografia richiede sempre una richiesta multipart.
                    if (!multipart) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Upload fotografia non valido");
                        return;
                    }

                    Part fotoPart = req.getPart("fotografia");

                    // Il file deve essere presente e non vuoto.
                    if (fotoPart == null || fotoPart.getSize() == 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Fotografia mancante");
                        return;
                    }

                    // Salvataggio su disco e aggiornamento del path.
                    String fotografia = salvaFoto(fotoPart);
                    if (fotografia == null) {
                        sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                                "Errore durante il salvataggio della fotografia");
                        return;
                    }

                    skuDAO.updateFotografia(id, fotografia);
                }

                default -> {
                    // Campo non gestito dal backend.
                    sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                            "Campo non aggiornabile");
                    return;
                }
            }

            // Ricarico la SKU aggiornata per restituire un JSON coerente.
            SKU skuAggiornata = skuDAO.findById(id);
            sendJson(resp, skuAggiornata);

        } catch (SQLException e) {
            throw new ServletException("Errore durante l'aggiornamento della SKU", e);
        }
    }

    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }

    private boolean isMultipart(HttpServletRequest req) {
        // Il content-type multipart indica un upload (es. fotografia).
        String contentType = req.getContentType();
        return contentType != null && contentType.toLowerCase().startsWith("multipart/");
    }

    private String leggiCampoTestuale(HttpServletRequest req, String nomeCampo)
            throws IOException, ServletException {
        Part part = req.getPart(nomeCampo);
        if (part == null) {
            return null;
        }

        // Lettura del contenuto testuale dal part multipart.
        byte[] contenuto = part.getInputStream().readAllBytes();
        return new String(contenuto, StandardCharsets.UTF_8);
    }

    private String estraiNomeFile(Part part) {
        String submitted = part.getSubmittedFileName();
        if (submitted == null) {
            return null;
        }

        // Supporto sia a path Unix che Windows.
        int slash = submitted.lastIndexOf('/');
        int backslash = submitted.lastIndexOf('\\');
        int indice = Math.max(slash, backslash);

        return (indice >= 0) ? submitted.substring(indice + 1) : submitted;
    }

    private String salvaFoto(Part part) {
        try {
            // Nome file originale e pulizia del path.
            String nomeOriginale = estraiNomeFile(part);

            if (isBlank(nomeOriginale)) {
                return null;
            }

            String nomePulito = Paths.get(nomeOriginale).getFileName().toString();

            int punto = nomePulito.lastIndexOf('.');
            String estensione = punto >= 0 ? nomePulito.substring(punto) : "";

            // Generazione nome file unico.
            String nomeGenerato = "sku_" + System.currentTimeMillis() + estensione;

            // Recupero cartella uploads dell'applicazione.
            String uploadDirPath = getServletContext().getRealPath("/uploads");
            if (uploadDirPath == null) {
                return null;
            }

            File uploadDir = new File(uploadDirPath);
            if (!uploadDir.exists() && !uploadDir.mkdirs()) {
                return null;
            }

            // Scrittura su disco e ritorno del path relativo.
            String filePathAssoluto = uploadDir.getAbsolutePath() + File.separator + nomeGenerato;
            part.write(filePathAssoluto);

            return "uploads/" + nomeGenerato;
        } catch (Exception e) {
            return null;
        }
    }
}