package it.polimi.progetto_tiw_js.dao;

import it.polimi.progetto_tiw_js.beans.Configurazione;
import it.polimi.progetto_tiw_js.beans.SKU;

import java.sql.*;
import java.util.*;

public class ConfigurazioneDAO {

    private final Connection conn;

    public ConfigurazioneDAO(Connection conn) {
        this.conn = conn;
    }

    /**
     * Crea una nuova configurazione con le SKU selezionate.
     *
     * @param skuScelte mappa prodotto_semplice_id → sku_id
     * @return id della configurazione appena creata
     */
    public int createConfigurazione(String nome, int clienteId, int prodottoId,
                                    Map<Integer, Integer> skuScelte) throws SQLException {
        conn.setAutoCommit(false);
        try {
            double prezzoTotale = calcolaPrezzo(skuScelte.values());

            String insConf = "INSERT INTO configurazione " +
                    "(nome, data_creazione, prezzo_totale, cliente_id, prodotto_id) " +
                    "VALUES (?, NOW(), ?, ?, ?)";

            int nuovoId;
            try (PreparedStatement ps = conn.prepareStatement(insConf, Statement.RETURN_GENERATED_KEYS)) {
                ps.setString(1, nome);
                ps.setDouble(2, prezzoTotale);
                ps.setInt(3, clienteId);
                ps.setInt(4, prodottoId);
                ps.executeUpdate();

                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (!keys.next()) throw new SQLException("Nessun id generato per la configurazione");
                    nuovoId = keys.getInt(1);
                }
            }

            inserisciSkuScelte(nuovoId, skuScelte);
            conn.commit();
            return nuovoId;

        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }
    }

    /**
     * Aggiorna nome e SKU di una configurazione già esistente.
     * Strategia: cancella tutte le righe di configurazione_sku e reinserisce da zero.
     */
    public void updateConfigurazione(int id, String nome,
                                     Map<Integer, Integer> skuScelte) throws SQLException {
        conn.setAutoCommit(false);
        try {
            double nuovoPrezzo = calcolaPrezzo(skuScelte.values());

            String upd = "UPDATE configurazione " +
                    "SET nome = ?, data_ultima_modifica = NOW(), prezzo_totale = ? " +
                    "WHERE id = ?";
            try (PreparedStatement ps = conn.prepareStatement(upd)) {
                ps.setString(1, nome);
                ps.setDouble(2, nuovoPrezzo);
                ps.setInt(3, id);
                ps.executeUpdate();
            }

            // cancello le vecchie scelte e rimetto quelle nuove
            String del = "DELETE FROM configurazione_sku WHERE configurazione_id = ?";
            try (PreparedStatement ps = conn.prepareStatement(del)) {
                ps.setInt(1, id);
                ps.executeUpdate();
            }

            inserisciSkuScelte(id, skuScelte);
            conn.commit();

        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(true);
        }
    }

    /**
     * Carica solo i dati base della configurazione, senza le SKU.
     * Usato per i controlli di ownership prima di operazioni sensibili.
     */
    public Configurazione findById(int id) throws SQLException {
        String query = "SELECT id, nome, data_creazione, data_ultima_modifica, " +
                "prezzo_totale, cliente_id, prodotto_id " +
                "FROM configurazione WHERE id = ?";

        try (PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return mapRow(rs);
            }
        }
        return null;
    }

    /**
     * Carica la configurazione con la mappa completa delle SKU scelte.
     * Usato nella pagina di dettaglio e per pre-caricare la pagina di modifica.
     */
    public Configurazione findByIdConSKU(int id) throws SQLException {
        Configurazione conf = findById(id);
        if (conf == null) return null;

        String query = "SELECT cs.prodotto_semplice_id, " +
                "s.id, s.codice, s.nome, s.fotografia, s.descrizione_tecnica, s.prezzo " +
                "FROM configurazione_sku cs " +
                "JOIN sku s ON s.id = cs.sku_id " +
                "WHERE cs.configurazione_id = ?";

        Map<Integer, SKU> skuScelte = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    skuScelte.put(rs.getInt("prodotto_semplice_id"), mapSKU(rs));
                }
            }
        }
        conf.setSkuScelte(skuScelte);
        return conf;
    }

    /**
     * Restituisce tutte le configurazioni di un cliente, dalla più recente.
     */
    public List<Configurazione> findByCliente(int clienteId) throws SQLException {
        String query = "SELECT id, nome, data_creazione, data_ultima_modifica, " +
                "prezzo_totale, cliente_id, prodotto_id " +
                "FROM configurazione WHERE cliente_id = ? " +
                "ORDER BY data_creazione DESC";

        List<Configurazione> lista = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, clienteId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) lista.add(mapRow(rs));
            }
        }
        return lista;
    }

    /**
     * Elimina la configurazione. Il CASCADE sul DB pensa a configurazione_sku.
     */
    public void deleteConfigurazione(int id) throws SQLException {
        String query = "DELETE FROM configurazione WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setInt(1, id);
            ps.executeUpdate();
        }
    }

    /**
     * Clona una configurazione: stesse SKU, nome "Copia di {nome}", data = adesso.
     * Riusa createConfigurazione per non duplicare la logica di transazione.
     *
     * @return id della configurazione clonata
     */
    public int cloneConfigurazione(int id, int clienteId) throws SQLException {
        Configurazione orig = findByIdConSKU(id);
        if (orig == null) throw new SQLException("Configurazione da clonare non trovata (id=" + id + ")");

        // ricostruisco la mappa sempliceId → skuId dai dati già caricati
        Map<Integer, Integer> skuScelte = new LinkedHashMap<>();
        for (Map.Entry<Integer, SKU> entry : orig.getSkuScelte().entrySet()) {
            skuScelte.put(entry.getKey(), entry.getValue().getId());
        }

        return createConfigurazione("Copia di " + orig.getNome(),
                clienteId, orig.getProdottoId(), skuScelte);
    }

    // ---- metodi privati di supporto ----

    // inserisce le righe in configurazione_sku via batch insert
    private void inserisciSkuScelte(int confId, Map<Integer, Integer> skuScelte)
            throws SQLException {
        String ins = "INSERT INTO configurazione_sku " +
                "(configurazione_id, prodotto_semplice_id, sku_id) VALUES (?, ?, ?)";

        try (PreparedStatement ps = conn.prepareStatement(ins)) {
            for (Map.Entry<Integer, Integer> entry : skuScelte.entrySet()) {
                ps.setInt(1, confId);
                ps.setInt(2, entry.getKey());   // prodotto_semplice_id
                ps.setInt(3, entry.getValue()); // sku_id
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    // somma i prezzi delle SKU selezionate per calcolare il prezzo totale
    private double calcolaPrezzo(Collection<Integer> skuIds) throws SQLException {
        double totale = 0.0;
        String q = "SELECT prezzo FROM sku WHERE id = ?";
        try (PreparedStatement ps = conn.prepareStatement(q)) {
            for (int skuId : skuIds) {
                ps.setInt(1, skuId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) totale += rs.getDouble("prezzo");
                }
            }
        }
        return totale;
    }

    // mappa una riga ResultSet → Configurazione (senza skuScelte)
    private Configurazione mapRow(ResultSet rs) throws SQLException {
        Configurazione c = new Configurazione();
        c.setId(rs.getInt("id"));
        c.setNome(rs.getString("nome"));
        c.setDataCreazione(rs.getTimestamp("data_creazione").toLocalDateTime());
        Timestamp tsModifica = rs.getTimestamp("data_ultima_modifica");
        c.setDataUltimaModifica(tsModifica != null ? tsModifica.toLocalDateTime() : null);
        c.setPrezzoTotale(rs.getDouble("prezzo_totale"));
        c.setClienteId(rs.getInt("cliente_id"));
        c.setProdottoId(rs.getInt("prodotto_id"));
        return c;
    }

    // mappa i campi SKU da ResultSet (usato in findByIdConSKU)
    private SKU mapSKU(ResultSet rs) throws SQLException {
        SKU s = new SKU();
        s.setId(rs.getInt("id"));
        s.setCodice(rs.getInt("codice"));
        s.setNome(rs.getString("nome"));
        s.setFotografia(rs.getString("fotografia"));
        s.setDescrizioneTecnica(rs.getString("descrizione_tecnica"));
        s.setPrezzo(rs.getDouble("prezzo"));
        return s;
    }
}