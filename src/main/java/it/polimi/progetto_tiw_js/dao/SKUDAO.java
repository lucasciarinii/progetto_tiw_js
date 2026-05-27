package it.polimi.progetto_tiw_js.dao;

import it.polimi.progetto_tiw_js.beans.SKU;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class SKUDAO {

    private final Connection conn;

    public SKUDAO(Connection conn) {
        this.conn = conn;
    }

    // Legge la riga corrente del ResultSet e costruisce il bean SKU.
    private SKU mapRow(ResultSet rs) throws SQLException {
        SKU sku = new SKU();
        sku.setId(rs.getInt("id"));
        sku.setCodice(rs.getInt("codice"));
        sku.setNome(rs.getString("nome"));
        sku.setFotografia(rs.getString("fotografia"));
        sku.setDescrizioneTecnica(rs.getString("descrizione_tecnica"));
        sku.setPrezzo(rs.getDouble("prezzo"));
        return sku;
    }

    // Inserisce una nuova SKU e restituisce l'id generato dal database.
    // Il campo fotografia può essere null se il fornitore non carica alcun file.
    public int createSKU(int codice, String nome, String fotografia,
                         String descrizioneTecnica, double prezzo) throws SQLException {
        String sql = "INSERT INTO sku (codice, nome, fotografia, descrizione_tecnica, prezzo) " +
                "VALUES (?, ?, ?, ?, ?)";

        try (PreparedStatement stmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            stmt.setInt(1, codice);
            stmt.setString(2, nome);
            stmt.setString(3, fotografia);
            stmt.setString(4, descrizioneTecnica);
            stmt.setDouble(5, prezzo);
            stmt.executeUpdate();

            try (ResultSet generatedKeys = stmt.getGeneratedKeys()) {
                if (generatedKeys.next()) {
                    return generatedKeys.getInt(1);
                }
            }

            throw new SQLException("Creazione SKU fallita: id non restituito dal database");
        }
    }

    // Restituisce tutte le SKU ordinate per codice decrescente.
    // Questo ordine serve per la lista mostrata nei form del fornitore.
    public List<SKU> findAll() throws SQLException {
        String sql = "SELECT * FROM sku ORDER BY codice DESC";
        List<SKU> result = new ArrayList<>();

        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            while (rs.next()) {
                result.add(mapRow(rs));
            }
        }

        return result;
    }

    // Cerca una SKU tramite chiave primaria.
    // Restituisce null se l'id non esiste.
    public SKU findById(int id) throws SQLException {
        String sql = "SELECT * FROM sku WHERE id = ?";

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

    // Ricerca case-insensitive su nome e descrizione tecnica.
    // La parola chiave viene cercata anche come match parziale tramite wildcard.
    public List<SKU> searchByKeyword(String keyword) throws SQLException {
        String sql = "SELECT * FROM sku WHERE LOWER(nome) LIKE ? OR LOWER(descrizione_tecnica) LIKE ?";
        String searchPattern = "%" + keyword.toLowerCase() + "%";

        List<SKU> result = new ArrayList<>();

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, searchPattern);
            stmt.setString(2, searchPattern);

            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    result.add(mapRow(rs));
                }
            }
        }

        return result;
    }

    // Elimina una SKU tramite id.
    // Prima rimuove le configurazioni che la contengono,
    // poi elimina la SKU vera e propria.
    public void deleteSKU(int id) throws SQLException {
        boolean oldAutoCommit = conn.getAutoCommit();
        conn.setAutoCommit(false);

        try {
            String deleteConfigurazioni = """
                DELETE FROM configurazione
                WHERE id IN (
                    SELECT DISTINCT configurazione_id
                    FROM configurazione_sku
                    WHERE sku_id = ?
                )
                """;

            try (PreparedStatement stmt = conn.prepareStatement(deleteConfigurazioni)) {
                stmt.setInt(1, id);
                stmt.executeUpdate();
            }

            String deleteSku = "DELETE FROM sku WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(deleteSku)) {
                stmt.setInt(1, id);
                stmt.executeUpdate();
            }

            conn.commit();
        } catch (SQLException e) {
            conn.rollback();
            throw e;
        } finally {
            conn.setAutoCommit(oldAutoCommit);
        }
    }

    // Controlla se esiste già una SKU con il codice indicato.
    // Serve per intercettare il duplicato prima dell'inserimento.
    public boolean existsByCodice(int codice) throws SQLException {
        String sql = "SELECT COUNT(*) FROM sku WHERE codice = ?";

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

    // Verifica l'unicita del codice escludendo una SKU specifica.
    public boolean existsByCodiceExceptId(int codice, int id) throws SQLException {
        String sql = "SELECT COUNT(*) FROM sku WHERE codice = ? AND id <> ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, codice);
            stmt.setInt(2, id);

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
            }
        }

        return false;
    }

    // Aggiorna il nome della SKU.
    public void updateNome(int id, String nome) throws SQLException {
        String sql = "UPDATE sku SET nome = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, nome);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }

    // Aggiorna il codice della SKU.
    public void updateCodice(int id, int codice) throws SQLException {
        String sql = "UPDATE sku SET codice = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, codice);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }

    // Aggiorna la descrizione tecnica della SKU.
    public void updateDescrizioneTecnica(int id, String descrizioneTecnica) throws SQLException {
        String sql = "UPDATE sku SET descrizione_tecnica = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, descrizioneTecnica);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }

    // Aggiorna il prezzo della SKU.
    public void updatePrezzo(int id, double prezzo) throws SQLException {
        String sql = "UPDATE sku SET prezzo = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setDouble(1, prezzo);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }

    // Aggiorna la fotografia della SKU.
    public void updateFotografia(int id, String fotografia) throws SQLException {
        String sql = "UPDATE sku SET fotografia = ? WHERE id = ?";

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, fotografia);
            stmt.setInt(2, id);
            stmt.executeUpdate();
        }
    }
}