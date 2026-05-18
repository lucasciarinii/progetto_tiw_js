package it.polimi.progetto_tiw_js.dao;

import it.polimi.progetto_tiw_js.beans.Prodotto;
import it.polimi.progetto_tiw_js.beans.SKU;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class ProdottoDAO {

    private final Connection conn;

    public ProdottoDAO(Connection conn) {
        this.conn = conn;
    }

    // Legge la riga corrente del ResultSet e costruisce il bean base.
    // Figli e SKU non vengono caricati qui, ma solo nei metodi che ne hanno davvero bisogno.
    private Prodotto mapRow(ResultSet rs) throws SQLException {
        Prodotto prodotto = new Prodotto();
        prodotto.setId(rs.getInt("id"));
        prodotto.setCodice(rs.getInt("codice"));
        prodotto.setNome(rs.getString("nome"));
        prodotto.setTipo(rs.getString("tipo"));
        prodotto.setDescrizione(rs.getString("descrizione"));
        prodotto.setPrezzoMin(rs.getDouble("prezzo_min"));
        prodotto.setPrezzoMax(rs.getDouble("prezzo_max"));

        int padreId = rs.getInt("padre_id");
        prodotto.setPadreId(rs.wasNull() ? null : padreId);

        return prodotto;
    }

    // =========================
    // CREATE
    // =========================

    // Crea un prodotto semplice e restituisce l'id generato dal database.
    public int createProdottoSemplice(int codice, String nome) throws SQLException {
        String sql = "INSERT INTO prodotto (codice, nome, tipo) VALUES (?, ?, 'SEMPLICE')";

        try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            stmt.setInt(1, codice);
            stmt.setString(2, nome);
            stmt.executeUpdate();

            try (ResultSet rs = stmt.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }

        throw new SQLException("Creazione prodotto semplice fallita: id non restituito dal database");
    }

    // Crea un prodotto composto e restituisce l'id generato.
    // I figli vengono collegati in un secondo momento con setPadre(...).
    public int createProdottoComposto(int codice, String nome, String descrizione,
                                      double prezzoMin, double prezzoMax) throws SQLException {
        String sql = "INSERT INTO prodotto (codice, nome, tipo, descrizione, prezzo_min, prezzo_max) " +
                "VALUES (?, ?, 'COMPOSTO', ?, ?, ?)";

        try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            stmt.setInt(1, codice);
            stmt.setString(2, nome);
            stmt.setString(3, descrizione);
            stmt.setDouble(4, prezzoMin);
            stmt.setDouble(5, prezzoMax);
            stmt.executeUpdate();

            try (ResultSet rs = stmt.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }

        throw new SQLException("Creazione prodotto composto fallita: id non restituito dal database");
    }

    // Collega una SKU a un prodotto semplice tramite la tabella di join.
    public void addSKUToProdotto(int prodottoId, int skuId) throws SQLException {
        String sql = "INSERT INTO prodotto_sku (prodotto_id, sku_id) VALUES (?, ?)";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, prodottoId);
            stmt.setInt(2, skuId);
            stmt.executeUpdate();
        }
    }

    // Imposta il padre di un prodotto, usato quando un prodotto viene agganciato
    // come figlio di un nuovo composto.
    public void setPadre(int figlioId, int padreId) throws SQLException {
        String sql = "UPDATE prodotto SET padre_id = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, padreId);
            stmt.setInt(2, figlioId);
            stmt.executeUpdate();
        }
    }

    // =========================
    // READ
    // =========================

    // Ritorna il prodotto base, senza figli e senza lista SKU.
    public Prodotto findById(int id) throws SQLException {
        String sql = "SELECT * FROM prodotto WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, id);

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return mapRow(rs);
                }
            }
        }

        return null;
    }

    // Ritorna un prodotto semplice con la lista delle SKU già caricata.
    public Prodotto findByIdConSKU(int id) throws SQLException {
        Prodotto prodotto = findById(id);
        if (prodotto == null) {
            return null;
        }

        prodotto.setSkuList(fetchSkuListForProduct(id));
        return prodotto;
    }

    // Costruisce ricorsivamente il sottoalbero del prodotto richiesto.
    // Se il nodo è semplice, carica le SKU; se è composto, carica i figli completi.
    public Prodotto findByIdConDiscendenti(int id) throws SQLException {
        Prodotto prodotto = findById(id);
        if (prodotto == null) {
            return null;
        }

        if ("SEMPLICE".equals(prodotto.getTipo())) {
            prodotto.setSkuList(fetchSkuListForProduct(id));
        } else {
            List<Prodotto> figliDiretti = fetchDirectChildren(id);
            List<Prodotto> figliCompleti = new ArrayList<>();

            for (Prodotto figlio : figliDiretti) {
                figliCompleti.add(findByIdConDiscendenti(figlio.getId()));
            }

            prodotto.setFigli(figliCompleti);
        }

        return prodotto;
    }

    // Restituisce la lista paginata dei prodotti composti di primo livello.
    public List<Prodotto> findTopLevelComposti(int offset, int limit) throws SQLException {
        String sql = "SELECT * FROM prodotto " +
                "WHERE padre_id IS NULL AND tipo = 'COMPOSTO' " +
                "ORDER BY nome DESC " +
                "LIMIT ? OFFSET ?";

        List<Prodotto> risultati = new ArrayList<>();

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, limit);
            stmt.setInt(2, offset);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    risultati.add(mapRow(rs));
                }
            }
        }

        return risultati;
    }

    // Conta quanti prodotti composti di primo livello esistono.
    public int countTopLevelComposti() throws SQLException {
        String sql = "SELECT COUNT(*) FROM prodotto WHERE padre_id IS NULL AND tipo = 'COMPOSTO'";

        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            if (rs.next()) {
                return rs.getInt(1);
            }
        }

        return 0;
    }

    // Restituisce i prodotti senza padre, quindi candidati a essere scelti
    // come figli nel form di creazione di un composto.
    public List<Prodotto> findDisponibili() throws SQLException {
        String sql = "SELECT * FROM prodotto WHERE padre_id IS NULL ORDER BY nome DESC";

        List<Prodotto> risultati = new ArrayList<>();

        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            while (rs.next()) {
                risultati.add(mapRow(rs));
            }
        }

        return risultati;
    }

    // Ricerca case-insensitive su nome e descrizione.
    public List<Prodotto> searchByKeyword(String keyword) throws SQLException {
        String sql = "SELECT * FROM prodotto WHERE LOWER(nome) LIKE ? OR LOWER(descrizione) LIKE ?";
        String pattern = "%" + keyword.toLowerCase() + "%";

        List<Prodotto> risultati = new ArrayList<>();

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, pattern);
            stmt.setString(2, pattern);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    risultati.add(mapRow(rs));
                }
            }
        }

        return risultati;
    }

    // =========================
    // UPDATE / DELETE
    // =========================

    // Rimuove l'associazione tra un prodotto semplice e una SKU.
    public void removeSKUDaProdotto(int prodottoId, int skuId) throws SQLException {
        String sql = "DELETE FROM prodotto_sku WHERE prodotto_id = ? AND sku_id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, prodottoId);
            stmt.setInt(2, skuId);
            stmt.executeUpdate();
        }
    }

    // Rimuove il padre del prodotto indicato, facendolo tornare al primo livello.
    public void removePadre(int figlioId) throws SQLException {
        String sql = "UPDATE prodotto SET padre_id = NULL WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, figlioId);
            stmt.executeUpdate();
        }
    }

    /**
     * Elimina un singolo prodotto.
     *
     * Logica:
     * - se il prodotto è semplice, elimina le configurazioni che lo contengono;
     * - elimina il prodotto;
     * - controlla le SKU che erano associate;
     * - elimina solo le SKU che non risultano più usate da nessun altro prodotto semplice.
     *
     * Tutto viene eseguito in transazione, così se qualcosa va storto non lasciamo il DB a metà.
     */
    public void deleteProdotto(int id) throws SQLException {
        boolean oldAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);

        try {
            Prodotto prodotto = findById(id);
            if (prodotto == null) {
                conn.commit();
                return;
            }

            List<Integer> skuDaControllare = new ArrayList<>();

            if ("SEMPLICE".equals(prodotto.getTipo())) {
                skuDaControllare = fetchSkuIdsForProduct(id);

                String eliminaConf = """
                    DELETE FROM configurazione
                    WHERE id IN (
                        SELECT DISTINCT configurazione_id
                        FROM configurazione_sku
                        WHERE prodotto_semplice_id = ?
                    )
                    """;

                try (PreparedStatement stmt = conn.prepareStatement(eliminaConf)) {
                    stmt.setInt(1, id);
                    stmt.executeUpdate();
                }
            }

            if ("COMPOSTO".equals(prodotto.getTipo())) {
                // Se il composto viene cancellato, prima eliminiamo eventuali configurazioni
                // che contengono uno qualsiasi dei suoi prodotti semplici discendenti.
                eliminaConfigurazioniCheContengonoSottoalbero(id);
            }

            String sql = "DELETE FROM prodotto WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setInt(1, id);
                stmt.executeUpdate();
            }

            for (Integer skuId : skuDaControllare) {
                if (!skuAncoraUsata(skuId)) {
                    String deleteSku = "DELETE FROM sku WHERE id = ?";
                    try (PreparedStatement stmt = conn.prepareStatement(deleteSku)) {
                        stmt.setInt(1, skuId);
                        stmt.executeUpdate();
                    }
                }
            }

            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(oldAutoCommit);
        }
    }

    /**
     * Elimina ricorsivamente un prodotto composto e tutti i suoi discendenti.
     * Si parte dai figli, così si elimina prima il sottoalbero e poi il nodo corrente.
     */
    public void deleteProdottoConDiscendenti(int id) throws SQLException {
        boolean oldAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);

        try {
            List<Prodotto> figli = fetchDirectChildren(id);

            for (Prodotto figlio : figli) {
                deleteProdottoConDiscendenti(figlio.getId());
            }

            deleteProdotto(id);
            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(oldAutoCommit);
        }
    }

    // =========================
    // CONTROLLI VINCOLI
    // =========================
    //Prossimi due metodi aggiunti per Javascript version

    // Verifica se il prodotto possibileAntenatoId compare tra gli antenati
    // del prodotto discendenteId. Serve per evitare cicli nella gerarchia.
    public boolean isAncestor(int possibileAntenatoId, int discendenteId) throws SQLException {
        String sql = "SELECT padre_id FROM prodotto WHERE id = ?";
        Integer padreCorrente;

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            int nodoCorrente = discendenteId;

            while (true) {
                stmt.setInt(1, nodoCorrente);

                try (ResultSet rs = stmt.executeQuery()) {
                    if (!rs.next()) {
                        return false;
                    }

                    padreCorrente = (Integer) rs.getObject("padre_id");
                }

                if (padreCorrente == null) {
                    return false;
                }

                if (padreCorrente == possibileAntenatoId) {
                    return true;
                }

                nodoCorrente = padreCorrente;
            }
        }
    }

    // Calcola la profondità del nodo nella gerarchia risalendo verso la radice.
    // Un prodotto top-level ha profondità 0.
    // Un figlio diretto del top-level ha profondità 1, e così via.
    public int getDepth(int prodottoId) throws SQLException {
        String sql = "SELECT padre_id FROM prodotto WHERE id = ?";
        int profondita = 0;
        Integer padreCorrente;

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            int nodoCorrente = prodottoId;

            while (true) {
                stmt.setInt(1, nodoCorrente);

                try (ResultSet rs = stmt.executeQuery()) {
                    if (!rs.next()) {
                        return profondita;
                    }

                    padreCorrente = (Integer) rs.getObject("padre_id");
                }

                if (padreCorrente == null) {
                    return profondita;
                }

                profondita++;
                nodoCorrente = padreCorrente;
            }
        }
    }

    // Verifica se esiste già un prodotto con lo stesso codice.
    public boolean existsByCodice(int codice) throws SQLException {
        String sql = "SELECT COUNT(*) FROM prodotto WHERE codice = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, codice);

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        }

        return false;
    }

    /**
     * Misura l'altezza del sottoalbero radicato nel prodotto dato.
     * Una foglia vale 0, un nodo con figli foglia vale 1 e così via.
     */
    public int getSubtreeHeight(int id) throws SQLException {
        String sql = "SELECT id FROM prodotto WHERE padre_id = ?";
        int maxAltezzaFiglio = -1;

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, id);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    int altezzaFiglio = getSubtreeHeight(rs.getInt("id"));
                    if (altezzaFiglio > maxAltezzaFiglio) {
                        maxAltezzaFiglio = altezzaFiglio; // per ogni figlio trovato, teniamo solo il figlio più profondo (ci interessa il caso peggiore)
                    }
                }
            }
        }

        return maxAltezzaFiglio + 1;
    }

    // Conta quante SKU sono associate al prodotto semplice indicato.
    // Serve per impedire la rimozione dell'ultima SKU.
    public int countSKUDiProdotto(int prodottoId) throws SQLException {
        String sql = "SELECT COUNT(*) FROM prodotto_sku WHERE prodotto_id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, prodottoId);

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
                return 0;
            }
        }
    }

    /**
     * Controlla se eliminando una certa SKU esisterebbe almeno un prodotto semplice
     * che resterebbe senza nessuna SKU associata.
     *
     * Ci serve nel caso "Elimina SKU":
     * - prendiamo tutti i prodotti semplici collegati a quella SKU;
     * - se uno di loro ha in totale una sola SKU, allora la cancellazione va bloccata.
     *
     * Questo mantiene coerente il vincolo della traccia:
     * ogni prodotto semplice deve avere almeno una SKU.
     */
    public boolean existsProdottoSempliceCheResterebbeSenzaSku(int skuId) throws SQLException {
        String sql = """
                SELECT DISTINCT p.id AS prodotto_id
                FROM prodotto p
                JOIN prodotto_sku ps ON p.id = ps.prodotto_id
                WHERE p.tipo = 'SEMPLICE'
                  AND ps.sku_id = ?
                """;

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, skuId);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    int prodottoId = rs.getInt("prodotto_id");

                    // Se il prodotto ha una sola SKU totale,
                    // allora togliere proprio questa lo lascerebbe vuoto.
                    if (countSKUDiProdotto(prodottoId) <= 1) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // =========================
    // METODI PRIVATI
    // =========================

    // Carica solo i figli diretti del padre indicato.
    private List<Prodotto> fetchDirectChildren(int padreId) throws SQLException {
        String sql = "SELECT * FROM prodotto WHERE padre_id = ?";

        List<Prodotto> figli = new ArrayList<>();

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, padreId);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    figli.add(mapRow(rs));
                }
            }
        }

        return figli;
    }

    // Carica la lista degli id SKU associati a un prodotto semplice.
    private List<Integer> fetchSkuIdsForProduct(int prodottoId) throws SQLException {
        String sql = "SELECT sku_id FROM prodotto_sku WHERE prodotto_id = ?";
        List<Integer> skuIds = new ArrayList<>();

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, prodottoId);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    skuIds.add(rs.getInt("sku_id"));
                }
            }
        }

        return skuIds;
    }

    // Controlla se una SKU è ancora associata ad almeno un prodotto semplice.
    private boolean skuAncoraUsata(int skuId) throws SQLException {
        String sql = "SELECT COUNT(*) FROM prodotto_sku WHERE sku_id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, skuId);

            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next() && rs.getInt(1) > 0;
            }
        }
    }

    // Carica la lista delle SKU associate a un prodotto semplice.
    private List<SKU> fetchSkuListForProduct(int prodottoId) throws SQLException {
        String sql = "SELECT s.* FROM sku s " +
                "JOIN prodotto_sku ps ON s.id = ps.sku_id " +
                "WHERE ps.prodotto_id = ? " +
                "ORDER BY s.codice DESC";

        List<SKU> risultati = new ArrayList<>();

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, prodottoId);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    SKU sku = new SKU();
                    sku.setId(rs.getInt("id"));
                    sku.setCodice(rs.getInt("codice"));
                    sku.setNome(rs.getString("nome"));
                    sku.setFotografia(rs.getString("fotografia"));
                    sku.setDescrizioneTecnica(rs.getString("descrizione_tecnica"));
                    sku.setPrezzo(rs.getDouble("prezzo"));
                    risultati.add(sku);
                }
            }
        }

        return risultati;
    }

    // Elimina le configurazioni che contengono almeno un prodotto semplice del sottoalbero.
    private void eliminaConfigurazioniCheContengonoSottoalbero(int id) throws SQLException {
        List<Integer> prodottiSemplici = new ArrayList<>();
        raccogliProdottiSemplici(id, prodottiSemplici);

        if (prodottiSemplici.isEmpty()) {
            return;
        }

        StringBuilder sql = new StringBuilder();
        sql.append("DELETE FROM configurazione WHERE id IN (");
        sql.append("SELECT DISTINCT configurazione_id FROM configurazione_sku WHERE prodotto_semplice_id IN (");
        for (int i = 0; i < prodottiSemplici.size(); i++) {
            sql.append("?");
            if (i < prodottiSemplici.size() - 1) {
                sql.append(",");
            }
        }
        sql.append("))");

        try (PreparedStatement stmt = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < prodottiSemplici.size(); i++) {
                stmt.setInt(i + 1, prodottiSemplici.get(i));
            }
            stmt.executeUpdate();
        }
    }

    // Raccoglie ricorsivamente tutti i prodotti semplici presenti nel sottoalbero.
    private void raccogliProdottiSemplici(int id, List<Integer> prodottiSemplici) throws SQLException {
        Prodotto prodotto = findById(id);
        if (prodotto == null) {
            return;
        }

        if ("SEMPLICE".equals(prodotto.getTipo())) {
            prodottiSemplici.add(id);
            return;
        }

        List<Prodotto> figli = fetchDirectChildren(id);
        for (Prodotto figlio : figli) {
            raccogliProdottiSemplici(figlio.getId(), prodottiSemplici);
        }
    }
    // Aggiorna il nome del prodotto.
    public void updateNome(int id, String nome) throws SQLException {
        String sql = "UPDATE prodotto SET nome = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, nome);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }

    // Aggiorna la descrizione del prodotto composto.
    public void updateDescrizione(int id, String descrizione) throws SQLException {
        String sql = "UPDATE prodotto SET descrizione = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, descrizione);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }

    // Aggiorna il prezzo minimo del prodotto composto.
    public void updatePrezzoMin(int id, double prezzoMin) throws SQLException {
        String sql = "UPDATE prodotto SET prezzo_min = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setDouble(1, prezzoMin);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }

    // Aggiorna il prezzo massimo del prodotto composto.
    public void updatePrezzoMax(int id, double prezzoMax) throws SQLException {
        String sql = "UPDATE prodotto SET prezzo_max = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setDouble(1, prezzoMax);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }
}