package it.polimi.progetto_tiw.beans;

public class SKU {

    private int id;
    private int codice;        // numero intero inserito dal fornitore
    private String nome;
    private String fotografia; // percorso del file sul server
    private String descrizioneTecnica;
    private double prezzo;

    public SKU() {}

    // -- getter e setter --

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getCodice() { return codice; }
    public void setCodice(int codice) { this.codice = codice; }

    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }

    public String getFotografia() { return fotografia; }
    public void setFotografia(String fotografia) { this.fotografia = fotografia; }

    public String getDescrizioneTecnica() { return descrizioneTecnica; }
    public void setDescrizioneTecnica(String descrizioneTecnica) {
        this.descrizioneTecnica = descrizioneTecnica;
    }

    public double getPrezzo() { return prezzo; }
    public void setPrezzo(double prezzo) { this.prezzo = prezzo; }
}
