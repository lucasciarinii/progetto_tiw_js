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

        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        req.setCharacterEncoding("UTF-8");

        boolean multipart = isMultipart(req);

        String idParam = multipart ? leggiCampoTestuale(req, "id") : req.getParameter("id");
        String campo = multipart ? leggiCampoTestuale(req, "campo") : req.getParameter("campo");
        String valore = multipart ? leggiCampoTestuale(req, "valore") : req.getParameter("valore");

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

                    if (skuDAO.existsByCodiceExceptId(codice, id)) {
                        sendError(resp, HttpServletResponse.SC_CONFLICT,
                                "Esiste già una SKU con questo codice");
                        return;
                    }

                    skuDAO.updateCodice(id, codice);
                }

                case "fotografia" -> {
                    if (!multipart) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Upload fotografia non valido");
                        return;
                    }

                    Part fotoPart = req.getPart("fotografia");

                    if (fotoPart == null || fotoPart.getSize() == 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Fotografia mancante");
                        return;
                    }

                    String fotografia = salvaFoto(fotoPart);
                    if (fotografia == null) {
                        sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                                "Errore durante il salvataggio della fotografia");
                        return;
                    }

                    skuDAO.updateFotografia(id, fotografia);
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

    private boolean isMultipart(HttpServletRequest req) {
        String contentType = req.getContentType();
        return contentType != null && contentType.toLowerCase().startsWith("multipart/");
    }

    private String leggiCampoTestuale(HttpServletRequest req, String nomeCampo)
            throws IOException, ServletException {
        Part part = req.getPart(nomeCampo);
        if (part == null) {
            return null;
        }

        byte[] contenuto = part.getInputStream().readAllBytes();
        return new String(contenuto, StandardCharsets.UTF_8);
    }

    private String estraiNomeFile(Part part) {
        String submitted = part.getSubmittedFileName();
        if (submitted == null) {
            return null;
        }

        int slash = submitted.lastIndexOf('/');
        int backslash = submitted.lastIndexOf('\\');
        int indice = Math.max(slash, backslash);

        return (indice >= 0) ? submitted.substring(indice + 1) : submitted;
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