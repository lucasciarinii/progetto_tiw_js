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

        // Questa servlet viene chiamata quando il fornitore modifica al volo
        // un attributo della SKU dal frontend.
        // L'idea è: arriva id della SKU, nome del campo da aggiornare
        // e nuovo valore; il backend valida, salva e poi restituisce
        // la SKU aggiornata in formato JSON.
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        // Imposto UTF-8 così evito problemi con caratteri accentati
        // o testo libero inserito nei campi descrittivi.
        req.setCharacterEncoding("UTF-8");

        // Se sto caricando una fotografia il browser invia multipart/form-data.
        // Per gli altri aggiornamenti normali basta invece form-urlencoded.
        boolean multipart = isMultipart(req);

        // I parametri vengono letti in due modi diversi:
        // - con getParameter(...) nelle richieste standard
        // - con getPart(...) nelle richieste multipart
        // In questo modo la servlet gestisce sia i campi testuali
        // sia il caso speciale dell'upload immagine.
        String idParam = multipart ? leggiCampoTestuale(req, "id") : req.getParameter("id");
        String campo = multipart ? leggiCampoTestuale(req, "campo") : req.getParameter("campo");
        String valore = multipart ? leggiCampoTestuale(req, "valore") : req.getParameter("valore");

        // Normalizzo subito il nome del campo:
        // tolgo spazi superflui e lo porto in minuscolo,
        // così da usare sempre una sola forma nel resto del metodo.
        String campoPulito = campo == null ? null : campo.trim().toLowerCase();

        // Validazione minima della richiesta:
        // id e campo devono esserci sempre;
        // valore deve esserci per tutti i casi tranne fotografia,
        // perché lì il dato vero arriva nel file uploadato.
        if (isBlank(idParam) || isBlank(campoPulito) || (valore == null && !"fotografia".equals(campoPulito))) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Parametri mancanti");
            return;
        }

        // L'id della SKU deve essere numerico e positivo.
        // Se non riesco a convertirlo, la richiesta è scorretta.
        Integer id = parseInt(idParam);
        if (id == null || id <= 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Id non valido");
            return;
        }

        try {
            SKUDAO skuDAO = new SKUDAO(conn);
            SKU sku = skuDAO.findById(id);

            // Prima di aggiornare controllo che la SKU esista davvero nel DB.
            // Se non esiste, non ha senso continuare.
            if (sku == null) {
                sendError(resp, HttpServletResponse.SC_NOT_FOUND, "SKU non trovata");
                return;
            }

            switch (campoPulito) {

                case "nome" -> {
                    // Per i campi testuali faccio trim per evitare
                    // che passi una stringa fatta solo di spazi.
                    String nome = trimToEmpty(valore);

                    if (nome.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il nome non può essere vuoto");
                        return;
                    }

                    // Se il dato è valido aggiorno solo quel campo,
                    // senza toccare il resto della SKU.
                    skuDAO.updateNome(id, nome);
                }

                case "descrizionetecnica" -> {
                    String descrizione = trimToEmpty(valore);

                    if (descrizione.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "La descrizione tecnica non può essere vuota");
                        return;
                    }

                    skuDAO.updateDescrizioneTecnica(id, descrizione);
                }

                case "prezzo" -> {
                    // Il prezzo deve essere un numero valido.
                    // Se parseDouble fallisce restituisce null.
                    Double prezzo = parseDouble(valore);

                    if (prezzo == null) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Prezzo non valido");
                        return;
                    }

                    // Non ammetto prezzi negativi.
                    if (prezzo < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo deve essere maggiore o uguale a 0");
                        return;
                    }

                    skuDAO.updatePrezzo(id, prezzo);
                }

                case "codice" -> {
                    // Anche il codice deve essere un intero valido.
                    Integer codice = parseInt(valore);

                    if (codice == null) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Codice non valido");
                        return;
                    }

                    // Nel progetto il codice non può essere negativo.
                    if (codice < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il codice deve essere maggiore o uguale a 0");
                        return;
                    }

                    // Controllo anche l'univocità:
                    // non deve esistere un'altra SKU con lo stesso codice,
                    // esclusa ovviamente quella che sto modificando.
                    if (skuDAO.existsByCodiceExceptId(codice, id)) {
                        sendError(resp, HttpServletResponse.SC_CONFLICT,
                                "Esiste già una SKU con questo codice");
                        return;
                    }

                    skuDAO.updateCodice(id, codice);
                }

                case "fotografia" -> {
                    // L'aggiornamento della foto ha senso solo se la richiesta
                    // è multipart, cioè se contiene davvero un file.
                    if (!multipart) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Upload fotografia non valido");
                        return;
                    }

                    // Recupero il file caricato dal campo "fotografia".
                    Part fotoPart = req.getPart("fotografia");

                    // Se il file manca o è vuoto, blocco tutto.
                    if (fotoPart == null || fotoPart.getSize() == 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Fotografia mancante");
                        return;
                    }

                    // Salvo il file nella cartella uploads dell'applicazione
                    // e ottengo il path relativo da memorizzare nel database.
                    String pathRelativo = salvaFoto(fotoPart);
                    if (pathRelativo == null) {
                        sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                                "Errore durante il salvataggio della fotografia");
                        return;
                    }

                    skuDAO.updateFotografia(id, pathRelativo);
                }

                default -> {
                    // Se il frontend manda un nome campo non previsto,
                    // non eseguo nessun aggiornamento.
                    sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                            "Campo non aggiornabile");
                    return;
                }
            }

            // Dopo l'update ricarico la SKU dal database.
            // Così il frontend riceve sempre un oggetto completo e aggiornato,
            // senza doversi ricostruire nulla lato client.
            SKU skuAggiornata = skuDAO.findById(id);
            sendJson(resp, skuAggiornata);

        } catch (SQLException e) {
            throw new ServletException("Errore durante l'aggiornamento della SKU", e);
        }
    }

    private Integer parseInt(String valore) {
        try {
            // trimToEmpty evita NullPointerException e rimuove spazi inutili.
            return Integer.parseInt(trimToEmpty(valore));
        } catch (NumberFormatException e) {
            // Se il valore non è un intero valido restituisco null,
            // così il chiamante decide come gestire l'errore.
            return null;
        }
    }

    private Double parseDouble(String valore) {
        try {
            // Stesso approccio usato per gli interi:
            // provo il parse e in caso di input invalido torno null.
            return Double.parseDouble(trimToEmpty(valore));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String trimToEmpty(String valore) {
        // Utility comoda: se arriva null restituisco stringa vuota,
        // altrimenti faccio trim per eliminare spazi iniziali/finali.
        return valore == null ? "" : valore.trim();
    }

    private boolean isBlank(String valore) {
        // Torna true se la stringa è null oppure vuota/fatta solo di spazi.
        return valore == null || valore.isBlank();
    }

    private boolean isMultipart(HttpServletRequest req) {
        // multipart/form-data viene usato quando il form contiene un file.
        // Qui mi serve per distinguere i normali update testuali
        // dal caso particolare della fotografia.
        String contentType = req.getContentType();
        return contentType != null && contentType.toLowerCase().startsWith("multipart/");
    }

    private String leggiCampoTestuale(HttpServletRequest req, String nomeCampo)
            throws IOException, ServletException {
        Part part = req.getPart(nomeCampo);
        if (part == null) {
            return null;
        }

        // Nelle richieste multipart anche i campi di testo
        // arrivano come Part, non come normali parameter.
        // Qui leggo il contenuto del part e lo converto in stringa UTF-8.
        byte[] contenuto = part.getInputStream().readAllBytes();
        return new String(contenuto, StandardCharsets.UTF_8);
    }

    private String estraiNomeFile(Part part) {
        String submitted = part.getSubmittedFileName();
        if (submitted == null) {
            return null;
        }

        // Alcuni browser possono mandare anche un path completo del file.
        // Qui tengo solo il nome finale, supportando sia slash Unix (/)
        // sia backslash Windows (\).
        int slash = submitted.lastIndexOf('/');
        int backslash = submitted.lastIndexOf('\\');
        int indice = Math.max(slash, backslash);

        return (indice >= 0) ? submitted.substring(indice + 1) : submitted;
    }

    private String salvaFoto(Part part) {
        try {
            // Recupero un nome file "pulito", senza path o parti strane.
            String nomePulito = costruisciNomeFilePulito(part);
            if (nomePulito == null) {
                return null;
            }

            // Genero un nome univoco lato server per evitare collisioni
            // tra file con lo stesso nome caricati in momenti diversi.
            String nomeGenerato = generaNomeFileUnico(nomePulito);

            // Recupero o creo la cartella uploads dentro l'applicazione.
            File uploadDir = getUploadDirectory();
            if (uploadDir == null) {
                return null;
            }

            // Scrivo fisicamente il file sul disco del server.
            File destinazione = new File(uploadDir, nomeGenerato);
            part.write(destinazione.getAbsolutePath());

            // Nel database salvo il path relativo, non quello assoluto,
            // così il riferimento resta portabile dentro l'applicazione.
            return "uploads/" + nomeGenerato;

        } catch (Exception e) {
            // In caso di problemi sul file system o sull'upload
            // restituisco null e lascio al chiamante la gestione dell'errore.
            return null;
        }
    }

    private String costruisciNomeFilePulito(Part part) {
        // Estraggo il nome originale del file e verifico che non sia vuoto.
        String nomeOriginale = estraiNomeFile(part);
        if (isBlank(nomeOriginale)) {
            return null;
        }

        // Uso Paths.get(...).getFileName() come ulteriore sicurezza
        // per tenere solo il nome del file senza percorsi.
        return Paths.get(nomeOriginale).getFileName().toString();
    }

    private String generaNomeFileUnico(String nomePulito) {
        // Mantengo, se presente, l'estensione originale del file.
        int punto = nomePulito.lastIndexOf('.');
        String estensione = punto >= 0 ? nomePulito.substring(punto) : "";

        // Il nome finale viene costruito con timestamp,
        // così è molto difficile avere collisioni.
        return "sku_" + System.currentTimeMillis() + estensione;
    }

    private File getUploadDirectory() {
        // Recupero il path reale della cartella uploads nell'applicazione.
        String uploadDirPath = getServletContext().getRealPath("/uploads");
        if (uploadDirPath == null) {
            return null;
        }

        File uploadDir = new File(uploadDirPath);

        // Se la cartella non esiste provo a crearla.
        // Se la creazione fallisce restituisco null.
        if (!uploadDir.exists() && !uploadDir.mkdirs()) {
            return null;
        }

        return uploadDir;
    }
}