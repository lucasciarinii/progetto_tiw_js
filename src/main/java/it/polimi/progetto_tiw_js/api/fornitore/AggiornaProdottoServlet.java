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

        // Questa servlet viene chiamata dall'inline edit del frontend fornitore.
        // L'idea è molto semplice: arriva id del prodotto, nome del campo da modificare
        // e nuovo valore da salvare. La servlet aggiorna solo QUEL campo.
        // Prima di tutto però controllo che l'utente sia autenticato
        // e che abbia davvero ruolo FORNITORE.
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "FORNITORE")) return;

        // Parametri attesi dal frontend:
        // - id: id del prodotto da aggiornare
        // - campo: nome logico del campo da modificare
        // - valore: nuovo valore inserito dall'utente
        String idParam = req.getParameter("id");
        String campo = req.getParameter("campo");
        String valore = req.getParameter("valore");

        // Normalizzo subito il nome del campo così uso sempre
        // una forma coerente per i controlli successivi.
        String campoPulito = campo == null ? null : campo.trim().toLowerCase();

        // Se manca anche solo uno dei parametri indispensabili,
        // la richiesta non è valida e viene rifiutata subito.
        if (isBlank(idParam) || isBlank(campoPulito) || valore == null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Parametri mancanti");
            return;
        }

        // L'id deve essere un intero positivo.
        // Uso un parser "safe" che restituisce null se il valore non è numerico.
        Integer id = parseInt(idParam);
        if (id == null || id <= 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Id non valido");
            return;
        }

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);

            // Prima di aggiornare devo verificare che il prodotto esista davvero.
            // Recupero quindi la versione base del prodotto dal database.
            Prodotto prodotto = prodottoDAO.findById(id);

            if (prodotto == null) {
                sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Prodotto non trovato");
                return;
            }

            // Normalizzo i valori che mi servono per i controlli:
            // - tipoProdotto lo porto in maiuscolo per confrontarlo in modo stabile
            // - campoPulito è già stato pulito all'inizio del metodo
            String tipoProdotto = normalizeUpper(prodotto.getTipo());

            // Gestisco un campo alla volta.
            // Ogni case si occupa di:
            // 1) validare il nuovo valore
            // 2) verificare eventuali vincoli di business
            // 3) chiamare il metodo DAO specifico di update
            switch (campoPulito) {
                case "nome" -> {
                    String nome = trimToEmpty(valore);

                    // Il nome è obbligatorio per qualsiasi tipo di prodotto.
                    if (nome.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il nome non può essere vuoto");
                        return;
                    }

                    prodottoDAO.updateNome(id, nome);
                }

                case "codice" -> {
                    Integer codice = parseInt(valore);

                    // Il codice deve essere numerico.
                    if (codice == null) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Codice non valido");
                        return;
                    }

                    // Nel progetto consideriamo validi solo codici >= 0.
                    if (codice < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il codice deve essere maggiore o uguale a 0");
                        return;
                    }

                    // Il codice prodotto deve restare univoco.
                    // Controllo quindi che non esista già su un altro prodotto.
                    if (prodottoDAO.existsByCodiceExceptId(codice, id)) {
                        sendError(resp, HttpServletResponse.SC_CONFLICT,
                                "Esiste già un prodotto con questo codice");
                        return;
                    }

                    prodottoDAO.updateCodice(id, codice);
                }

                case "descrizione" -> {
                    // La descrizione ha senso solo per i prodotti composti.
                    if (!"COMPOSTO".equals(tipoProdotto)) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "La descrizione è modificabile solo per i prodotti composti");
                        return;
                    }

                    String descrizione = trimToEmpty(valore);

                    // Anche la descrizione non può essere lasciata vuota.
                    if (descrizione.isBlank()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "La descrizione non può essere vuota");
                        return;
                    }

                    prodottoDAO.updateDescrizione(id, descrizione);
                }

                case "prezzomin" -> {
                    // I campi di fascia prezzo appartengono solo ai prodotti composti.
                    if (!"COMPOSTO".equals(tipoProdotto)) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo minimo è modificabile solo per i prodotti composti");
                        return;
                    }

                    Double prezzoMin = parseDouble(valore);

                    // Il valore deve essere un numero valido.
                    if (prezzoMin == null) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Prezzo minimo non valido");
                        return;
                    }

                    if (prezzoMin < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo minimo deve essere maggiore o uguale a 0");
                        return;
                    }

                    // Mantengo coerente la fascia di prezzo:
                    // il minimo non può superare il massimo attuale.
                    if (prezzoMin > prodotto.getPrezzoMax()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo minimo non può superare il prezzo massimo");
                        return;
                    }

                    prodottoDAO.updatePrezzoMin(id, prezzoMin);
                }

                case "prezzomax" -> {
                    // Anche il prezzo massimo è un campo valido solo per i composti.
                    if (!"COMPOSTO".equals(tipoProdotto)) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo massimo è modificabile solo per i prodotti composti");
                        return;
                    }

                    Double prezzoMax = parseDouble(valore);

                    if (prezzoMax == null) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Prezzo massimo non valido");
                        return;
                    }

                    if (prezzoMax < 0) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo massimo deve essere maggiore o uguale a 0");
                        return;
                    }

                    // Anche qui mantengo la coerenza della fascia:
                    // il massimo non può finire sotto il minimo attuale.
                    if (prezzoMax < prodotto.getPrezzoMin()) {
                        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                                "Il prezzo massimo non può essere minore del prezzo minimo");
                        return;
                    }

                    prodottoDAO.updatePrezzoMax(id, prezzoMax);
                }

                default -> {
                    // Se il frontend invia un campo non previsto, non provo nemmeno
                    // a interpretarlo: rispondo con errore esplicito.
                    sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Campo non aggiornabile");
                    return;
                }
            }

            // Dopo l'update non restituisco solo "ok": ricarico il prodotto completo.
            // Questo è utile perché il frontend, dopo il blur, può ricevere subito
            // un JSON coerente e aggiornare il pannello di dettaglio senza altre chiamate.
            //
            // In più il caricamento completo dipende dal tipo:
            // - prodotto semplice -> serve il prodotto con la lista SKU
            // - prodotto composto -> serve il prodotto con i discendenti/figli
            Prodotto prodottoAggiornato;
            if (isSemplice(tipoProdotto)) {
                prodottoAggiornato = prodottoDAO.findByIdConSKU(id);
            } else {
                prodottoAggiornato = prodottoDAO.findByIdConDiscendenti(id);
            }

            // Se per qualche motivo l'update è andato a buon fine ma il prodotto
            // non riesce a essere ricaricato, segnalo un errore server.
            if (prodottoAggiornato == null) {
                sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                        "Impossibile ricaricare il prodotto aggiornato");
                return;
            }

            // Risposta finale: JSON del prodotto aggiornato.
            sendJson(resp, prodottoAggiornato);

        } catch (SQLException e) {
            // Gli errori SQL vengono incapsulati in una ServletException
            // così restano gestiti a livello server come errore applicativo.
            throw new ServletException("Errore durante l'aggiornamento del prodotto", e);
        }
    }

    // Parser "tollerante": se il valore non è un intero valido,
    // invece di lanciare eccezione restituisce null.
    private Integer parseInt(String valore) {
        try {
            return Integer.parseInt(trimToEmpty(valore));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // Stessa idea del parseInt, ma per i double.
    // Torna utile per i campi di prezzo.
    private Double parseDouble(String valore) {
        try {
            return Double.parseDouble(trimToEmpty(valore));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String trimToEmpty(String valore) {
        return valore == null ? "" : valore.trim();
    }

    // Mi serve solo nel punto finale, per capire quale metodo DAO usare
    // quando ricarico il prodotto completo da restituire al frontend.
    private boolean isSemplice(String tipoProdotto) {
        return "SEMPLICE".equals(tipoProdotto);
    }

    // Utility di normalizzazione: evita problemi se dal database
    // il tipo arriva con spazi o con maiuscole/minuscole diverse.
    private String normalizeUpper(String valore) {
        return valore == null ? "" : valore.trim().toUpperCase();
    }

    // Utility comoda per trattare nello stesso modo null, stringa vuota
    // e stringa fatta solo di spazi.
    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }
}