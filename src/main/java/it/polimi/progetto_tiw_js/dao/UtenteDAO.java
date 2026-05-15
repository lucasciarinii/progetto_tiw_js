package it.polimi.progetto_tiw.dao;
import it.polimi.progetto_tiw.beans.Utente;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class UtenteDAO {

    private final Connection conn;

    public UtenteDAO(Connection conn) {
        this.conn = conn;
    }

    /**
     * Verifica le credenziali: la password viene hashata SHA-256 prima del confronto.
     * Nel DB le password devono essere già memorizzate come hash esadecimale SHA-256.
     *
     * @return l'Utente loggato, oppure null se le credenziali non corrispondono
     */
    public Utente checkCredentials(String username, String password) throws SQLException {
        String hash = sha256(password);
        if (hash == null) return null;

        String query = "SELECT id, username, nome, cognome, ruolo FROM utente WHERE username = ? AND password = ? ";

        try (PreparedStatement ps = conn.prepareStatement(query)) {
            ps.setString(1, username);
            ps.setString(2, hash);

            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    Utente u = new Utente();
                    u.setId(rs.getInt("id"));
                    u.setUsername(rs.getString("username"));
                    u.setNome(rs.getString("nome"));
                    u.setCognome(rs.getString("cognome"));
                    u.setRuolo(rs.getString("ruolo"));
                    // la password non viene caricata: in sessione non serve
                    return u;
                }
            }
        }
        return null;
    }

    // SHA-256 → stringa esadecimale minuscola
    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            return null; // SHA-256 è sempre disponibile in ogni JVM standard
        }
    }
}