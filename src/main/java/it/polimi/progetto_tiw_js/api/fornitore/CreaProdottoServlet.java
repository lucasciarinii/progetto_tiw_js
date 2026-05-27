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

@WebServlet("/apifornitoreprodottocrea")
@MultipartConfig
public class CreaProdottoServlet extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    // Profondità massima ammessa dalla traccia.
    // Convenzione usata nel progetto:
    // livello 1 = radice del composto che stiamo creando.
    private static final int MAX_PROFONDITA = 4;

    // Gson ci serve per leggere il payload JSON inviato dal builder JS.
    private final Gson gson = new Gson();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {

        // Controllo login.
        if (!isLogged(req, resp)) {
            return;
        }

        // Solo il fornitore può creare prodotti.
        if (!hasRole(req, resp, "FORNITORE")) {
            return;
        }

        try {
            String contentType = req.getContentType();

            // Se arriva JSON, siamo nel flusso nuovo del builder dei composti.
            if (contentType != null && contentType.toLowerCase().contains("application/json")) {
                gestisciCreazioneCompostoDaJson(req, resp);
                return;
            }

            // Altrimenti teniamo il comportamento classico del form tradizionale.
            gestisciCreazioneDaParametri(req, resp);

        } catch (SQLException e) {
            throw new ServletException("Errore durante la creazione del prodotto", e);
        }
    }

    /**
     * Flusso classico:
     * - prodotto semplice creato via form tradizionale
     * - prodotto composto flat creato via form tradizionale
     */
    private void gestisciCreazioneDaParametri(HttpServletRequest req, HttpServletResponse resp)
            throws SQLException, IOException {

        String tipo = req.getParameter("tipo");
        String codiceParam = req.getParameter("codice");
        String nome = req.getParameter("nome");

        if (isBlank(tipo) || isBlank(codiceParam) || isBlank(nome)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Parametri obbligatori mancanti");
            return;
        }

        int codice;
        try {
            codice = Integer.parseInt(codiceParam.trim());
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Codice non valido");
            return;
        }

        if (codice < 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il codice deve essere maggiore o uguale a 0");
            return;
        }

        ProdottoDAO prodottoDAO = new ProdottoDAO(conn);

        if (prodottoDAO.existsByCodice(codice)) {
            sendError(resp, HttpServletResponse.SC_CONFLICT,
                    "Esiste già un prodotto con questo codice");
            return;
        }

        String tipoPulito = normalize(tipo);

        if ("SEMPLICE".equals(tipoPulito)) {
            creaProdottoSemplice(req, resp, prodottoDAO, codice, nome.trim());
            return;
        }

        if ("COMPOSTO".equals(tipoPulito)) {
            creaProdottoCompostoFlat(req, resp, prodottoDAO, codice, nome.trim());
            return;
        }

        sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                "Tipo prodotto non valido");
    }

    /**
     * Creazione tradizionale di un prodotto semplice.
     * In questo caso il prodotto nasce già persistito e poi gli associamo le SKU.
     */
    private void creaProdottoSemplice(HttpServletRequest req, HttpServletResponse resp,
                                      ProdottoDAO prodottoDAO, int codice, String nome)
            throws SQLException, IOException {

        String[] skuIdParams = req.getParameterValues("skuIds");

        if (skuIdParams == null || skuIdParams.length == 0) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Seleziona almeno una SKU");
            return;
        }

        List<Integer> skuIds = new ArrayList<>();

        for (String skuIdParam : skuIdParams) {
            try {
                skuIds.add(Integer.parseInt(skuIdParam.trim()));
            } catch (NumberFormatException e) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Una delle SKU selezionate non è valida");
                return;
            }
        }

        int prodottoId = prodottoDAO.createProdottoSemplice(codice, nome);

        for (Integer skuId : skuIds) {
            prodottoDAO.addSKUToProdotto(prodottoId, skuId);
        }

        Prodotto prodottoCreato = prodottoDAO.findByIdConSKU(prodottoId);
        sendJson(resp, prodottoCreato);
    }

    /**
     * Creazione tradizionale di un composto "flat":
     * il composto è nuovo e i figli selezionati sono prodotti già esistenti senza padre.
     */
    private void creaProdottoCompostoFlat(HttpServletRequest req, HttpServletResponse resp,
                                          ProdottoDAO prodottoDAO, int codice, String nome)
            throws SQLException, IOException {

        String descrizione = req.getParameter("descrizione");
        String prezzoMinParam = req.getParameter("prezzoMin");
        String prezzoMaxParam = req.getParameter("prezzoMax");
        String[] figlioIdParams = req.getParameterValues("figlioIds");

        if (isBlank(descrizione) || isBlank(prezzoMinParam) || isBlank(prezzoMaxParam)) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Compila tutti i campi del prodotto composto");
            return;
        }

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
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Fascia di prezzo non valida");
            return;
        }

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

        for (String figlioIdParam : figlioIdParams) {
            try {
                figlioIds.add(Integer.parseInt(figlioIdParam.trim()));
            } catch (NumberFormatException e) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati non è valido");
                return;
            }
        }

        // Validiamo i figli prima di creare il nuovo composto.
        for (Integer figlioId : figlioIds) {
            Prodotto figlio = prodottoDAO.findById(figlioId);

            if (figlio == null) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati non esiste");
                return;
            }

            if (figlio.getPadreId() != null) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Uno dei sottoprodotti selezionati ha già un padre");
                return;
            }

            int altezzaSottoalbero = prodottoDAO.getSubtreeHeight(figlioId);
            if (altezzaSottoalbero + 1 > MAX_PROFONDITA) {
                sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Profondità massima superata");
                return;
            }
        }

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

        Prodotto prodottoCreato = prodottoDAO.findByIdConDiscendenti(prodottoId);
        sendJson(resp, prodottoCreato);
    }

    /**
     * Flusso nuovo del builder JS.
     * Qui riceviamo un albero JSON che può contenere:
     * - nodi nuovi da creare
     * - nodi esistenti da collegare
     *
     * Regola chiave:
     * se un nodo ha id != null, per noi è un riferimento a un prodotto già esistente.
     * In quel caso i figli presenti nel JSON servono solo al frontend per mostrare
     * l'albero completo nel builder, ma non devono essere ripersistiti.
     */
    private void gestisciCreazioneCompostoDaJson(HttpServletRequest req, HttpServletResponse resp)
            throws SQLException, IOException {

        BuilderProdottoDto root = gson.fromJson(req.getReader(), BuilderProdottoDto.class);

        if (root == null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Body JSON mancante o non valido");
            return;
        }

        if (!"COMPOSTO".equals(normalize(root.tipo))) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "Il payload JSON deve rappresentare un prodotto composto");
            return;
        }

        String errore = validaNodoBuilder(root, 1);
        if (errore != null) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, errore);
            return;
        }

        ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
        SKUDAO skuDAO = new SKUDAO(conn);

        // La radice del builder è sempre un nuovo composto.
        if (prodottoDAO.existsByCodice(root.codice)) {
            sendError(resp, HttpServletResponse.SC_CONFLICT,
                    "Esiste già un prodotto con questo codice");
            return;
        }

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
            applicaEliminazioni(root, prodottoDAO, skuDAO);

            conn.setAutoCommit(false);

            int rootId = persistiNodoBuilder(root, null, prodottoDAO);

            conn.commit();

            // Restituiamo il prodotto completo appena salvato, così il frontend
            // può ricaricare subito il dettaglio corretto.
            Prodotto prodottoCreato = prodottoDAO.findByIdConDiscendenti(rootId);
            sendJson(resp, prodottoCreato);

        } catch (BusinessValidationException e) {
            conn.rollback();
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, e.getMessage());
        } catch (Exception e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(autoCommitPrecedente);
        }
    }

    private void applicaEliminazioni(BuilderProdottoDto root, ProdottoDAO prodottoDAO, SKUDAO skuDAO)
            throws SQLException, BusinessValidationException {

        if (root.eliminaProdotti != null) {
            Set<Integer> prodottiDaEliminare = new LinkedHashSet<>(root.eliminaProdotti);
            for (Integer prodottoId : prodottiDaEliminare) {
                if (prodottoId == null || prodottoId <= 0) {
                    throw new BusinessValidationException("Id prodotto da eliminare non valido");
                }

                prodottoDAO.deleteProdottoConDiscendenti(prodottoId);
            }
        }

        if (root.eliminaSku != null) {
            Set<Integer> skuDaEliminare = new LinkedHashSet<>(root.eliminaSku);
            for (Integer skuId : skuDaEliminare) {
                if (skuId == null || skuId <= 0) {
                    throw new BusinessValidationException("Id SKU da eliminare non valido");
                }

                if (skuDAO.findById(skuId) == null) {
                    throw new BusinessValidationException("SKU da eliminare non trovata");
                }

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

        if (root.eliminaProdotti != null) {
            for (Integer prodottoId : root.eliminaProdotti) {
                if (prodottoId != null && prodottiNelPayload.contains(prodottoId)) {
                    return "Non puoi eliminare un prodotto ancora presente nel payload";
                }
            }
        }

        if (root.eliminaSku != null) {
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

        if (nodo.id != null) {
            ids.add(nodo.id);
        }

        if (nodo.figli != null) {
            for (BuilderProdottoDto figlio : nodo.figli) {
                raccogliIdProdottiNelPayload(figlio, ids);
            }
        }
    }

    private void raccogliIdSkuNelPayload(BuilderProdottoDto nodo, Set<Integer> ids) {
        if (nodo == null || nodo.skuList == null) {
            if (nodo != null && nodo.figli != null) {
                for (BuilderProdottoDto figlio : nodo.figli) {
                    raccogliIdSkuNelPayload(figlio, ids);
                }
            }
            return;
        }

        for (BuilderSkuDto sku : nodo.skuList) {
            if (sku != null && sku.id != null) {
                ids.add(sku.id);
            }
        }

        if (nodo.figli != null) {
            for (BuilderProdottoDto figlio : nodo.figli) {
                raccogliIdSkuNelPayload(figlio, ids);
            }
        }
    }
    private int persistiNodoBuilder(BuilderProdottoDto nodo, Integer padreId, ProdottoDAO prodottoDAO)
            throws SQLException, BusinessValidationException {

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
     * Gestione del nodo semplice del builder.
     */
    private int persistiNodoSemplice(BuilderProdottoDto nodo, Integer padreId, ProdottoDAO prodottoDAO)
            throws SQLException, BusinessValidationException {

        int sempliceId;
        boolean prodottoNuovo = false;

        if (nodo.id != null) {
            // Caso prodotto semplice già esistente: lo referenziamo e basta.
            Prodotto esistente = prodottoDAO.findById(nodo.id);

            if (esistente == null) {
                throw new BusinessValidationException("Prodotto semplice referenziato non trovato");
            }

            if (!"SEMPLICE".equals(normalize(esistente.getTipo()))) {
                throw new BusinessValidationException("Il prodotto referenziato non è di tipo semplice");
            }

            Integer padreAttuale = esistente.getPadreId();
            if (padreAttuale != null && (padreId == null || !padreAttuale.equals(padreId))) {
                throw new BusinessValidationException("Un prodotto semplice selezionato ha già un padre");
            }

            sempliceId = nodo.id;
        } else {
            // Caso prodotto semplice nuovo creato nel builder.
            if (prodottoDAO.existsByCodice(nodo.codice)) {
                throw new BusinessValidationException("Esiste già un prodotto con codice " + nodo.codice);
            }

            sempliceId = prodottoDAO.createProdottoSemplice(nodo.codice, nodo.nome);
            prodottoNuovo = true;
        }

        // Se c'è un padre, colleghiamo il semplice al composto corrente.
        if (padreId != null) {
            prodottoDAO.setPadre(sempliceId, padreId);
        }

        // Ogni semplice deve avere almeno una SKU nel payload.
        // Anche per gli esistenti pretendiamo che ci sia, perché il builder
        // ci manda comunque la situazione visualizzata.
        if (nodo.skuList == null || nodo.skuList.isEmpty()) {
            throw new BusinessValidationException(
                    "Il prodotto semplice \"" + nodo.nome + "\" deve avere almeno una SKU"
            );
        }

        Set<Integer> skuDaAssociare = new LinkedHashSet<>();
        SKUDAO skuDAO = new SKUDAO(conn);

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

        if (prodottoNuovo) {
            for (Integer skuId : skuDaAssociare) {
                prodottoDAO.addSKUToProdotto(sempliceId, skuId);
            }
            return sempliceId;
        }

        List<Integer> skuAttuali = prodottoDAO.findSkuIdsForProduct(sempliceId);
        Set<Integer> skuAttualiSet = new LinkedHashSet<>(skuAttuali);

        for (Integer skuId : skuAttualiSet) {
            if (!skuDaAssociare.contains(skuId)) {
                prodottoDAO.removeSKUDaProdotto(sempliceId, skuId);
            }
        }

        for (Integer skuId : skuDaAssociare) {
            if (!skuAttualiSet.contains(skuId)) {
                prodottoDAO.addSKUToProdotto(sempliceId, skuId);
            }
        }

        return sempliceId;
    }

    /**
     * Gestione del nodo composto del builder.
     */
    private int persistiNodoComposto(BuilderProdottoDto nodo, Integer padreId, ProdottoDAO prodottoDAO)
            throws SQLException, BusinessValidationException {

        int compostoId;
        boolean prodottoEsistente = nodo.id != null;

        if (prodottoEsistente) {
            // Caso composto già presente nel DB.
            Prodotto esistente = prodottoDAO.findById(nodo.id);

            if (esistente == null) {
                throw new BusinessValidationException("Prodotto composto referenziato non trovato");
            }

            if (!"COMPOSTO".equals(normalize(esistente.getTipo()))) {
                throw new BusinessValidationException("Il prodotto referenziato non è di tipo composto");
            }

            Integer padreAttuale = esistente.getPadreId();
            if (padreAttuale != null && (padreId == null || !padreAttuale.equals(padreId))) {
                throw new BusinessValidationException("Un prodotto composto selezionato ha già un padre");
            }

            int altezzaSottoalbero = prodottoDAO.getSubtreeHeight(nodo.id);
            if (padreId != null && altezzaSottoalbero + 1 > MAX_PROFONDITA) {
                throw new BusinessValidationException("Profondità massima superata");
            }

            compostoId = nodo.id;
        } else {
            // Caso composto nuovo creato nel builder.
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

        // Colleghiamo il nodo al padre corrente, se esiste.
        if (padreId != null) {
            prodottoDAO.setPadre(compostoId, padreId);
        }

        Set<Integer> figliPersistiti = new LinkedHashSet<>();
        if (nodo.figli != null) {
            for (BuilderProdottoDto figlio : nodo.figli) {
                int figlioId = persistiNodoBuilder(figlio, compostoId, prodottoDAO);
                figliPersistiti.add(figlioId);
            }
        }

        if (prodottoEsistente) {
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
     * Passiamo SKUDAO come parametro così evitiamo di istanziarlo più volte inutilmente.
     */
    private int creaNuovaSkuDaBuilder(BuilderSkuDto skuDto, SKUDAO skuDAO)
            throws SQLException, BusinessValidationException {

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
     * Validazione preliminare lato server del payload del builder.
     *
     * Regola importante:
     * se il nodo ha id != null, è un riferimento a un prodotto già esistente.
     * Quindi:
     * - controlliamo i campi base
     * - NON validiamo ricorsivamente i figli come se fossero nuovi nodi da creare
     *
     * Questo è coerente con il frontend, che ora può mandare l'albero completo
     * di un prodotto esistente solo per visualizzarlo nel builder.
     */
    private String validaNodoBuilder(BuilderProdottoDto nodo, int profondita) {
        if (nodo == null) {
            return "Nodo prodotto mancante";
        }

        if (profondita > MAX_PROFONDITA) {
            return "Profondità massima superata";
        }

        String tipo = normalize(nodo.tipo);

        if (!"SEMPLICE".equals(tipo) && !"COMPOSTO".equals(tipo)) {
            return "Tipo prodotto non valido";
        }

        if (isBlank(nodo.nome)) {
            return "Il nome del prodotto è obbligatorio";
        }

        if (nodo.codice == null || nodo.codice < 0) {
            return "Il codice del prodotto non è valido";
        }

        if ("SEMPLICE".equals(tipo)) {
            if (nodo.skuList == null || nodo.skuList.isEmpty()) {
                return "Ogni prodotto semplice deve avere almeno una SKU";
            }

            for (BuilderSkuDto sku : nodo.skuList) {
                if (sku == null) {
                    return "Una SKU non è valida";
                }

                // Se la SKU è già esistente, non c'è altro da validare qui:
                // la sua esistenza reale verrà verificata in persistenza.
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

        if ("COMPOSTO".equals(tipo)) {
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

            if (nodo.figli == null || nodo.figli.isEmpty()) {
                return "Ogni prodotto composto deve avere almeno un sottoprodotto";
            }

            for (BuilderProdottoDto figlio : nodo.figli) {
                String errore = validaNodoBuilder(figlio, profondita + 1);
                if (errore != null) {
                    return errore;
                }
            }
        }

        return null;
    }

    /**
     * Normalizza una stringa per confronti robusti.
     */
    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase();
    }

    /**
     * Utility per controllare stringhe vuote o solo whitespace.
     */
    private boolean isBlank(String valore) {
        return valore == null || valore.isBlank();
    }

    /**
     * DTO del nodo prodotto inviato dal builder.
     */
    private static class BuilderProdottoDto {
        Integer id;
        Integer codice;
        String nome;
        String tipo;
        String descrizione;
        Double prezzoMin;
        Double prezzoMax;
        List<BuilderProdottoDto> figli;
        List<BuilderSkuDto> skuList;
        List<Integer> eliminaProdotti;
        List<Integer> eliminaSku;
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
     * Eccezione applicativa per errori di validazione del dominio.
     * La usiamo per mandare al frontend messaggi chiari senza sporcare
     * la logica con mille return intermedi.
     */
    private static class BusinessValidationException extends Exception {
        private BusinessValidationException(String message) {
            super(message);
        }
    }
}