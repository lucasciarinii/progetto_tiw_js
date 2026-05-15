package it.polimi.progetto_tiw_js.beans;

public class Utente {

    private int id;
    private String username;
    private String password;
    private String nome;
    private String cognome;
    private String ruolo; // "FORNITORE" oppure "CLIENTE"

    public Utente() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }

    public String getCognome() { return cognome; }
    public void setCognome(String cognome) { this.cognome = cognome; }

    public String getRuolo() { return ruolo; }
    public void setRuolo(String ruolo) { this.ruolo = ruolo; }

    // comodo per i template Thymeleaf: mostra "Mario Rossi"
    public String getNomeCompleto() {
        return nome + " " + cognome;
    }
}