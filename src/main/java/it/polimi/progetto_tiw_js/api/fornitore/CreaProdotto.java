package it.polimi.progetto_tiw_js.api.fornitore;

import com.google.gson.Gson;
import it.polimi.progetto_tiw_js.api.BaseApiServlet;
import it.polimi.progetto_tiw_js.beans.Prodotto;
import it.polimi.progetto_tiw_js.dao.ProdottoDAO;
import it.polimi.progetto_tiw_js.dao.SKUDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@WebServlet("/api/fornitore/prodotto/crea")
@MultipartConfig
public class CreaProdotto extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    // Profondità massima ammessa dalla traccia.
    // Convenzione del progetto:
    // livello 1 = radice del prodotto composto che stiamo creando.
    private static final int MAX_PROFONDITA = 4;

    // Gson serve per leggere il payload JSON inviato dal builder lato frontend.
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        // Accesso consentito solo a un fornitore autenticato.
        if (!isLogged(req, resp)) {
            return;
        }
        if (!hasRole(req, resp, "FORNITORE")) {
            return;
        }

        try {
            String contentType = req.getContentType();

            // La servlet gestisce due flussi:
            // 1) richiesta classica con parametri form
            // 2) richiesta JSON del builder dei prodotti composti
            if (contentType != null && contentType.toLowerCase().contains("application/json")) {
                gestisciCreazioneCompostoDaJson(req, resp);
                return;
            }

            // Se non arriva JSON, uso il flusso tradizionale del form.
            gestisciCreazioneDaParametri(req, resp);
        } catch (SQLException e) {
            throw new ServletException("Errore durante la creazione del prodotto", e);
        }
    }

    /**
     * Flusso classico:
     * - prodotto semplice creato da form tradizionale
     * - prodotto composto "flat" creato da form tradizionale
     */
    private void gestisciCreazioneDaParametri(HttpServletRequest req, HttpServletResponse resp)
            throws SQLException, IOException {

        // Parametri comuni ai due tipi di prodotto.
        String tipo = req.getParameter("tipo");
        String codiceParam = req.getParameter("codice");
        String nome = req.getParameter("nome");

        // Controllo dei campi minimi obbligatori.
        if (isBlank(tipo) || isBlank(codiceParam) || isBlank(nome)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Parametri obbligatori mancanti");
            return;
        }

        int codice;
        try {
            codice = Integer.parseInt(codiceParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Codice non valido");
            return;
        }

        // Il codice non può essere negativo.
        if (codice < 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il codice deve essere maggiore o uguale a 0");
            return;
        }

        ProdottoDAO prodottoDAO = new ProdottoDAO(conn);

        // Il codice prodotto deve essere univoco.
        if (prodottoDAO.existsByCodice(codice)) {
            sendError(resp, HttpServletResponse.SC_CONFLICT,
                    "Esiste già un prodotto con questo codice");
            return;
        }

        String tipoPulito = normalize(tipo);

        // Smistamento in base al tipo richiesto.
        if ("SEMPLICE".equals(tipoPulito)) {
            creaProdottoSemplice(req, resp, prodottoDAO, codice, nome.trim());
            return;
        }
        if ("COMPOSTO".equals(tipoPulito)) {
            creaProdottoCompostoFlat(req, resp, prodottoDAO, codice, nome.trim());
            return;
        }

        sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Tipo prodotto non valido");
    }

    /**
     * Creazione tradizionale di un prodotto semplice.
     *-
     * Il prodotto viene creato subito nel DB e poi collegato
     * alle SKU selezionate dal form.
     */
    private void creaProdottoSemplice(HttpServletRequest req, HttpServletResponse resp,
                                      ProdottoDAO prodottoDAO, int codice, String nome)
            throws SQLException, IOException {

        // Per un semplice serve almeno una SKU.
        String[] skuIdParams = req.getParameterValues("skuIds");

        if (skuIdParams == null || skuIdParams.length == 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Seleziona almeno una SKU");
            return;
        }

        List<Integer> skuIds = new ArrayList<>();

        // Parsing e validazione degli id delle SKU selezionate.
        for (String skuIdParam : skuIdParams) {
            try {
                skuIds.add(Integer.parseInt(skuIdParam.trim()));
            } catch (NumberFormatException e) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Una delle SKU selezionate non è valida");
                return;
            }
        }

        // Creo il prodotto semplice e poi salvo le associazioni con le SKU.
        int prodottoId = prodottoDAO.createProdottoSemplice(codice, nome);

        for (Integer skuId : skuIds) {
            prodottoDAO.addSKUToProdotto(prodottoId, skuId);
        }

        // Ritorno al frontend il dettaglio completo del prodotto appena creato.
        Prodotto prodottoCreato = prodottoDAO.findByIdConSKU(prodottoId);
        sendJson(resp, prodottoCreato);
    }

    /**
     * Creazione tradizionale di un composto "flat".
     *-
     * Il composto è nuovo, mentre i figli selezionati sono prodotti
     * già esistenti e senza padre.
     */
    private void creaProdottoCompostoFlat(HttpServletRequest req, HttpServletResponse resp,
                                          ProdottoDAO prodottoDAO, int codice, String nome)
            throws SQLException, IOException {

        // Campi specifici del prodotto composto.
        String descrizione = req.getParameter("descrizione");
        String prezzoMinParam = req.getParameter("prezzoMin");
        String prezzoMaxParam = req.getParameter("prezzoMax");
        String[] figlioIdParams = req.getParameterValues("figlioIds");

        // Tutti questi campi devono essere presenti.
        if (isBlank(descrizione) || isBlank(prezzoMinParam) || isBlank(prezzoMaxParam)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Compila tutti i campi del prodotto composto");
            return;
        }

        // Un composto deve avere almeno un sottoprodotto.
        if (figlioIdParams == null || figlioIdParams.length == 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Seleziona almeno un sottoprodotto");
            return;
        }

        double prezzoMin;
        double prezzoMax;
        try {
            prezzoMin = Double.parseDouble(prezzoMinParam.trim());
            prezzoMax = Double.parseDouble(prezzoMaxParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Fascia di prezzo non valida");
            return;
        }

        // Controllo della fascia di prezzo.
        if (prezzoMin < 0 || prezzoMax < 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "I prezzi devono essere maggiori o uguali a 0");
            return;
        }
        if (prezzoMin > prezzoMax) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il prezzo minimo non può essere maggiore del massimo");
            return;
        }

        Set<Integer> figlioIds = new LinkedHashSet<>();

        // LinkedHashSet evita duplicati e mantiene un ordine stabile.
        for (String figlioIdParam : figlioIdParams) {
            try {
                figlioIds.add(Integer.parseInt(figlioIdParam.trim()));
            } catch (NumberFormatException e) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati non è valido");
                return;
            }
        }

        // Prima della creazione verifico che ogni figlio sia valido.
        for (Integer figlioId : figlioIds) {
            Prodotto figlio = prodottoDAO.findById(figlioId);

            if (figlio == null) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati non esiste");
                return;
            }

            // Nel flusso flat il figlio deve essere top-level.
            if (figlio.getPadreId() != null) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati ha già un padre");
                return;
            }

            // Verifico che il sottoalbero del figlio, una volta collegato,
            // non faccia superare la profondità massima consentita.
            int altezzaSottoalbero = prodottoDAO.getSubtreeHeight(figlioId);
            if (altezzaSottoalbero + 1 > MAX_PROFONDITA) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Profondità massima superata");
                return;
            }
        }

        // Creo il composto e poi collego i figli.
        int prodottoId = prodottoDAO.createProdottoComposto(
                codice,
                nome,
                descrizione.trim(),
                prezzoMin,
                prezzoMax
        );

        for (Integer figlioId : figlioIds) {
            prodottoDAO.setPadre(figlioId, prodottoId);
        }

        // Restituisco il composto con i discendenti già caricati.
        Prodotto prodottoCreato = prodottoDAO.findByIdConDiscendenti(prodottoId);
        sendJson(resp, prodottoCreato);
    }

    /**
     * Flusso nuovo del builder JS.
     *-
     * Il body JSON può contenere:
     * - nodi nuovi da creare
     * - nodi esistenti da collegare
     * - SKU nuove
     * - SKU esistenti
     * - richieste di eliminazione
     *-
     * Regola chiave:
     * se un nodo ha id != null, è un riferimento a un oggetto
     * già esistente nel database.
     */
    private void gestisciCreazioneCompostoDaJson(HttpServletRequest req, HttpServletResponse resp)
            throws SQLException, IOException {

        // Deserializzo il body JSON nel DTO usato dal builder.
        BuilderProdottoDto root = gson.fromJson(req.getReader(), BuilderProdottoDto.class);

        if (root == null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Body JSON mancante o non valido");
            return;
        }

        // La radice del builder deve sempre essere un prodotto composto.
        if (!"COMPOSTO".equals(normalize(root.tipo))) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il payload JSON deve rappresentare un prodotto composto");
            return;
        }

        // Prima faccio una validazione strutturale del payload.
        String errore = validaNodoBuilder(root, 1);
        if (errore != null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, errore);
            return;
        }

        ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
        SKUDAO skuDAO = new SKUDAO(conn);

        // La radice del builder rappresenta sempre un nuovo composto,
        // quindi il suo codice non deve già esistere.
        if (prodottoDAO.existsByCodice(root.codice)) {
            sendError(resp, HttpServletResponse.SC_CONFLICT,
                    "Esiste già un prodotto con codice " + root.codice);
            return;
        }

        // Raccolgo tutti gli id già presenti nel payload.
        // Mi serve per verificare che il client non chieda di eliminare
        // qualcosa che risulta ancora nell'albero inviato.
        Set<Integer> prodottiNelPayload = new HashSet<>();
        Set<Integer> skuNelPayload = new HashSet<>();
        raccogliIdProdottiNelPayload(root, prodottiNelPayload);
        raccogliIdSkuNelPayload(root, skuNelPayload);

        String erroreEliminazioni = validaEliminazioni(root, prodottiNelPayload, skuNelPayload);
        if (erroreEliminazioni != null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, erroreEliminazioni);
            return;
        }

        boolean autoCommitPrecedente = conn.getAutoCommit();

        try {
            conn.setAutoCommit(false);

            // Prima applico eventuali eliminazioni richieste dal builder.
            applicaEliminazioni(root, prodottoDAO, skuDAO);

            // Poi persisto l'albero finale del prodotto composto.
            int rootId = persistiNodoBuilder(root, null, prodottoDAO);

            conn.commit();

            // Ricarico il prodotto completo appena creato per allineare il frontend.
            Prodotto prodottoCreato = prodottoDAO.findByIdConDiscendenti(rootId);
            sendJson(resp, prodottoCreato);

        } catch (BusinessValidationException e) {
            if (!conn.getAutoCommit()) {
                conn.rollback();
            }
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            if (!conn.getAutoCommit()) {
                conn.rollback();
            }
            throw e;
        } finally {
            conn.setAutoCommit(autoCommitPrecedente);
        }
    }

    private void applicaEliminazioni(BuilderProdottoDto root, ProdottoDAO prodottoDAO, SKUDAO skuDAO)
            throws SQLException, BusinessValidationException {

        // Eliminazione dei prodotti indicati dal builder.
        if (root.eliminaProdotti != null && !root.eliminaProdotti.isEmpty()) {
            Set<Integer> prodottiDaEliminare = new LinkedHashSet<>(root.eliminaProdotti);

            for (Integer prodottoId : prodottiDaEliminare) {
                if (prodottoId == null || prodottoId <= 0) {
                    throw new BusinessValidationException("Id prodotto da eliminare non valido");
                }
                prodottoDAO.deleteProdottoConDiscendenti(prodottoId);
            }
        }

        // Eliminazione delle SKU indicate dal builder.
        if (root.eliminaSku != null && !root.eliminaSku.isEmpty()) {
            Set<Integer> skuDaEliminare = new LinkedHashSet<>(root.eliminaSku);

            for (Integer skuId : skuDaEliminare) {
                if (skuId == null || skuId <= 0) {
                    throw new BusinessValidationException("Id SKU da eliminare non valido");
                }
                if (skuDAO.findById(skuId) == null) {
                    throw new BusinessValidationException("SKU da eliminare non trovata");
                }

                // Non posso eliminare una SKU se questo lascia almeno
                // un prodotto semplice senza nessuna SKU associata.
                if (prodottoDAO.existsProdottoSempliceCheResterebbeSenzaSku(skuId)) {
                    throw new BusinessValidationException(
                            "Non puoi eliminare la SKU " + skuId + " perché lascerebbe senza SKU almeno un prodotto"
                    );
                }

                skuDAO.deleteSKU(skuId);
            }
        }
    }

    private String validaEliminazioni(BuilderProdottoDto root,
                                      Set<Integer> prodottiNelPayload,
                                      Set<Integer> skuNelPayload) {

        // Non posso eliminare un prodotto che compare ancora nel payload.
        if (root.eliminaProdotti != null && !root.eliminaProdotti.isEmpty()) {
            for (Integer prodottoId : root.eliminaProdotti) {
                if (prodottoId != null && prodottiNelPayload.contains(prodottoId)) {
                    return "Non puoi eliminare un prodotto ancora presente nel payload";
                }
            }
        }

        // Stessa regola per le SKU.
        if (root.eliminaSku != null && !root.eliminaSku.isEmpty()) {
            for (Integer skuId : root.eliminaSku) {
                if (skuId != null && skuNelPayload.contains(skuId)) {
                    return "Non puoi eliminare una SKU ancora presente nel payload";
                }
            }
        }

        return null;
    }

    private void raccogliIdProdottiNelPayload(BuilderProdottoDto nodo, Set<Integer> ids) {
        if (nodo == null) {
            return;
        }

        // Mi interessano solo gli id dei prodotti già esistenti
        // che compaiono nel payload del builder.
        if (nodo.id != null) {
            ids.add(nodo.id);
        }

        if (nodo.figli != null && !nodo.figli.isEmpty()) {
            for (BuilderProdottoDto figlio : nodo.figli) {
                raccogliIdProdottiNelPayload(figlio, ids);
            }
        }
    }

    private void raccogliIdSkuNelPayload(BuilderProdottoDto nodo, Set<Integer> ids) {
        if (nodo == null) {
            return;
        }

        if (nodo.skuList != null && !nodo.skuList.isEmpty()) {
            // Raccolgo gli id delle SKU già esistenti presenti nel payload.
            for (BuilderSkuDto sku : nodo.skuList) {
                if (sku != null && sku.id != null) {
                    ids.add(sku.id);
                }
            }
        }

        if (nodo.figli != null && !nodo.figli.isEmpty()) {
            for (BuilderProdottoDto figlio : nodo.figli) {
                raccogliIdSkuNelPayload(figlio, ids);
            }
        }
    }

    private int persistiNodoBuilder(BuilderProdottoDto nodo, Integer padreId, ProdottoDAO prodottoDAO)
            throws SQLException, BusinessValidationException {

        // Smisto la persistenza in base al tipo del nodo.
        String tipo = normalize(nodo.tipo);

        if ("SEMPLICE".equals(tipo)) {
            return persistiNodoSemplice(nodo, padreId, prodottoDAO);
        }
        if ("COMPOSTO".equals(tipo)) {
            return persistiNodoComposto(nodo, padreId, prodottoDAO);
        }

        throw new BusinessValidationException("Tipo prodotto non valido");
    }

    /**
     * Persistenza di un nodo semplice del builder.
     *-
     * Il nodo può rappresentare:
     * - un semplice già esistente
     * - un semplice nuovo da creare
     */
    private int persistiNodoSemplice(BuilderProdottoDto nodo, Integer padreId, ProdottoDAO prodottoDAO)
            throws SQLException, BusinessValidationException {

        int sempliceId;
        boolean prodottoNuovo = false;

        if (nodo.id != null) {
            // Se c'è un id, sto referenziando un prodotto già presente nel DB.
            Prodotto esistente = prodottoDAO.findById(nodo.id);

            if (esistente == null) {
                throw new BusinessValidationException("Prodotto semplice referenziato non trovato");
            }
            if (!"SEMPLICE".equals(normalize(esistente.getTipo()))) {
                throw new BusinessValidationException("Il prodotto referenziato non è di tipo semplice");
            }

            // Il prodotto non può essere riagganciato a un padre diverso
            // se ha già un padre assegnato.
            Integer padreAttuale = esistente.getPadreId();
            if (padreAttuale != null && (padreId == null || !padreAttuale.equals(padreId))) {
                throw new BusinessValidationException("Un prodotto semplice selezionato ha già un padre");
            }

            sempliceId = nodo.id;
        } else {
            // Se l'id manca, il nodo rappresenta un nuovo semplice.
            if (prodottoDAO.existsByCodice(nodo.codice)) {
                throw new BusinessValidationException("Esiste già un prodotto con codice " + nodo.codice);
            }

            sempliceId = prodottoDAO.createProdottoSemplice(nodo.codice, nodo.nome);
            prodottoNuovo = true;
        }

        // Se il nodo ha un padre, lo collego al composto corrente.
        if (padreId != null) {
            prodottoDAO.setPadre(sempliceId, padreId);
        }

        // Ogni semplice deve avere almeno una SKU nel payload.
        if (nodo.skuList == null || nodo.skuList.isEmpty()) {
            throw new BusinessValidationException(
                    "Il prodotto semplice \"" + nodo.nome + "\" deve avere almeno una SKU"
            );
        }

        Set<Integer> skuDaAssociare = new LinkedHashSet<>();
        SKUDAO skuDAO = new SKUDAO(conn);

        // Per ogni SKU capisco se devo collegare una esistente
        // oppure crearne una nuova.
        for (BuilderSkuDto skuDto : nodo.skuList) {
            Integer skuIdDaAssociare;

            if (skuDto.id != null) {
                if (skuDAO.findById(skuDto.id) == null) {
                    throw new BusinessValidationException("Una SKU selezionata non esiste");
                }
                skuIdDaAssociare = skuDto.id;
            } else {
                skuIdDaAssociare = creaNuovaSkuDaBuilder(skuDto, skuDAO);
            }

            skuDaAssociare.add(skuIdDaAssociare);
        }

        // Se il prodotto è nuovo, inserisco direttamente tutte le associazioni.
        if (prodottoNuovo) {
            for (Integer skuId : skuDaAssociare) {
                prodottoDAO.addSKUToProdotto(sempliceId, skuId);
            }
            return sempliceId;
        }

        // Se il prodotto esiste già, riallineo le SKU allo stato del payload.
        List<Integer> skuAttuali = prodottoDAO.findSkuIdsForProduct(sempliceId);
        Set<Integer> skuAttualiSet = new LinkedHashSet<>(skuAttuali);

        // Rimuovo le SKU non più presenti.
        for (Integer skuId : skuAttualiSet) {
            if (!skuDaAssociare.contains(skuId)) {
                prodottoDAO.removeSKUDaProdotto(sempliceId, skuId);
            }
        }

        // Aggiungo le nuove SKU mancanti.
        for (Integer skuId : skuDaAssociare) {
            if (!skuAttualiSet.contains(skuId)) {
                prodottoDAO.addSKUToProdotto(sempliceId, skuId);
            }
        }

        return sempliceId;
    }

    /**
     * Persistenza di un nodo composto del builder.
     *-
     * Anche qui il nodo può essere:
     * - un composto già esistente
     * - un composto nuovo da creare
     */
    private int persistiNodoComposto(BuilderProdottoDto nodo, Integer padreId, ProdottoDAO prodottoDAO)
            throws SQLException, BusinessValidationException {

        int compostoId;
        boolean prodottoEsistente = nodo.id != null;

        if (prodottoEsistente) {
            // Se c'è id, il composto è già presente nel DB.
            Prodotto esistente = prodottoDAO.findById(nodo.id);

            if (esistente == null) {
                throw new BusinessValidationException("Prodotto composto referenziato non trovato");
            }
            if (!"COMPOSTO".equals(normalize(esistente.getTipo()))) {
                throw new BusinessValidationException("Il prodotto referenziato non è di tipo composto");
            }

            // Anche qui controllo la coerenza del padre.
            Integer padreAttuale = esistente.getPadreId();
            if (padreAttuale != null && (padreId == null || !padreAttuale.equals(padreId))) {
                throw new BusinessValidationException("Un prodotto composto selezionato ha già un padre");
            }

            // Se riaggancio un composto esistente, devo rispettare la profondità massima.
            int altezzaSottoalbero = prodottoDAO.getSubtreeHeight(nodo.id);
            if (padreId != null && altezzaSottoalbero + 1 > MAX_PROFONDITA) {
                throw new BusinessValidationException("Profondità massima superata");
            }

            compostoId = nodo.id;
        } else {
            // Se l'id non c'è, creo un nuovo composto.
            if (prodottoDAO.existsByCodice(nodo.codice)) {
                throw new BusinessValidationException("Esiste già un prodotto con codice " + nodo.codice);
            }

            compostoId = prodottoDAO.createProdottoComposto(
                    nodo.codice,
                    nodo.nome,
                    nodo.descrizione.trim(),
                    nodo.prezzoMin,
                    nodo.prezzoMax
            );
        }

        // Se esiste un padre, collego il composto al nodo superiore.
        if (padreId != null) {
            prodottoDAO.setPadre(compostoId, padreId);
        }

        Set<Integer> figliPersistiti = new LinkedHashSet<>();
        if (nodo.figli != null && !nodo.figli.isEmpty()) {
            // Persisto ricorsivamente tutti i figli e salvo gli id risultanti.
            for (BuilderProdottoDto figlio : nodo.figli) {
                int figlioId = persistiNodoBuilder(figlio, compostoId, prodottoDAO);
                figliPersistiti.add(figlioId);
            }
        }

        if (prodottoEsistente) {
            // Se il composto esisteva già, il payload rappresenta il nuovo stato desiderato.
            // Quindi i figli che non compaiono più vengono scollegati.
            List<Prodotto> figliAttuali = prodottoDAO.findFigliDiretti(compostoId);
            for (Prodotto figlio : figliAttuali) {
                if (!figliPersistiti.contains(figlio.getId())) {
                    prodottoDAO.removePadre(figlio.getId());
                }
            }
        }

        return compostoId;
    }

    /**
     * Crea una nuova SKU definita nel builder.
     */
    private int creaNuovaSkuDaBuilder(BuilderSkuDto skuDto, SKUDAO skuDAO)
            throws SQLException, BusinessValidationException {

        // Anche il codice della SKU deve essere univoco.
        if (skuDAO.existsByCodice(skuDto.codice)) {
            throw new BusinessValidationException("Esiste già una SKU con codice " + skuDto.codice);
        }

        return skuDAO.createSKU(
                skuDto.codice,
                skuDto.nome,
                null,
                skuDto.descrizioneTecnica,
                skuDto.prezzo
        );
    }

    /**
     * Validazione preliminare del payload del builder.
     *-
     * Qui verifico:
     * - struttura dell'albero
     * - dati minimi obbligatori
     * - profondità massima
     * - regole base per semplici, composti e nuove SKU
     */
    private String validaNodoBuilder(BuilderProdottoDto nodo, int profondita) {
        if (nodo == null) {
            return "Nodo prodotto mancante";
        }
        if (profondita > MAX_PROFONDITA) {
            return "Profondità massima superata";
        }

        String tipo = normalize(nodo.tipo);

        // I soli tipi ammessi sono semplice e composto.
        if (!"SEMPLICE".equals(tipo) && !"COMPOSTO".equals(tipo)) {
            return "Tipo prodotto non valido";
        }

        // Validazioni comuni a ogni nodo prodotto.
        if (isBlank(nodo.nome)) {
            return "Il nome del prodotto è obbligatorio";
        }
        if (nodo.codice == null || nodo.codice < 0) {
            return "Il codice del prodotto non è valido";
        }

        if ("SEMPLICE".equals(tipo)) {
            // Ogni semplice deve avere almeno una SKU nel payload.
            if (nodo.skuList == null || nodo.skuList.isEmpty()) {
                return "Ogni prodotto semplice deve avere almeno una SKU";
            }

            for (BuilderSkuDto sku : nodo.skuList) {
                if (sku == null) {
                    return "Una SKU non è valida";
                }

                // Se la SKU non ha id, significa che è nuova
                // e quindi devo validarne tutti i campi di creazione.
                if (sku.id == null) {
                    if (sku.codice == null || sku.codice < 0) {
                        return "Il codice di una nuova SKU non è valido";
                    }
                    if (isBlank(sku.nome) || isBlank(sku.descrizioneTecnica)) {
                        return "Compila tutti i campi della nuova SKU";
                    }
                    if (sku.prezzo == null || sku.prezzo < 0) {
                        return "Il prezzo di una nuova SKU non è valido";
                    }
                }
            }

            return null;
        }

        // Se non sono nel caso semplice, qui sono nel caso composto.
        if (isBlank(nodo.descrizione)) {
            return "La descrizione del prodotto composto è obbligatoria";
        }
        if (nodo.prezzoMin == null || nodo.prezzoMin < 0 ||
                nodo.prezzoMax == null || nodo.prezzoMax < 0) {
            return "La fascia di prezzo del prodotto composto non è valida";
        }
        if (nodo.prezzoMin > nodo.prezzoMax) {
            return "Il prezzo minimo non può superare il massimo";
        }

        // Ogni composto deve avere almeno un figlio.
        if (nodo.figli == null || nodo.figli.isEmpty()) {
            return "Ogni prodotto composto deve avere almeno un sottoprodotto";
        }

        // La validazione prosegue ricorsivamente su tutto l'albero.
        for (BuilderProdottoDto figlio : nodo.figli) {
            String errore = validaNodoBuilder(figlio, profondita + 1);
            if (errore != null) {
                return errore;
            }
        }

        return null;
    }

    /**
     * Normalizza una stringa per fare confronti robusti.
     */
    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase();
    }

    /**
     * Utility per controllare stringhe vuote o fatte solo di spazi.
     */
    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }

    /**
     * DTO del nodo prodotto inviato dal builder.
     *-
     * Nota: questi campi vengono popolati da Gson tramite deserializzazione JSON.
     * Li inizializzo comunque per evitare falsi positivi dell'IDE sulle collection.
     */
    private static class BuilderProdottoDto {
        Integer id;
        Integer codice;
        String nome;
        String tipo;
        String descrizione;
        Double prezzoMin;
        Double prezzoMax;
        List<BuilderProdottoDto> figli = new ArrayList<>();
        List<BuilderSkuDto> skuList = new ArrayList<>();
        List<Integer> eliminaProdotti = new ArrayList<>();
        List<Integer> eliminaSku = new ArrayList<>();
    }

    /**
     * DTO della SKU inviato dal builder.
     */
    private static class BuilderSkuDto {
        Integer id;
        Integer codice;
        String nome;
        String descrizioneTecnica;
        Double prezzo;
    }

    /**
     * Eccezione applicativa usata per segnalare errori di dominio o validazione.
     *-
     * In questo modo posso interrompere il flusso anche in profondità
     * nei metodi ricorsivi e riportare al frontend un messaggio pulito.
     */
    private static class BusinessValidationException extends Exception {
        private BusinessValidationException(String message) {
            super(message);
        }
    }
}