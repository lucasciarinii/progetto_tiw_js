package it.polimi.progetto_tiw.beans;

import java.util.ArrayList;
import java.util.List;

public class Prodotto {

    private int id;
    private int codice;
    private String nome;
    private String tipo;        // "SEMPLICE" oppure "COMPOSTO"
    private String descrizione; // valorizzato solo per i COMPOSTI
    private double prezzoMin;   // valorizzato solo per i COMPOSTI
    private double prezzoMax;   // valorizzato solo per i COMPOSTI
    private Integer padreId;    // Integer (nullable): null = prodotto di primo livello

    // questi due campi non vengono dal DB direttamente:
    // li popola il DAO solo quando serve visualizzare l'albero
    private List<Prodotto> figli = new ArrayList<>();
    private List<SKU> skuList = new ArrayList<>();

    public Prodotto() {}

    // -- getter e setter --

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getCodice() { return codice; }
    public void setCodice(int codice) { this.codice = codice; }

    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }

    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }

    public String getDescrizione() { return descrizione; }
    public void setDescrizione(String descrizione) { this.descrizione = descrizione; }

    public double getPrezzoMin() { return prezzoMin; }
    public void setPrezzoMin(double prezzoMin) { this.prezzoMin = prezzoMin; }

    public double getPrezzoMax() { return prezzoMax; }
    public void setPrezzoMax(double prezzoMax) { this.prezzoMax = prezzoMax; }

    public Integer getPadreId() { return padreId; }
    public void setPadreId(Integer padreId) { this.padreId = padreId; }

    // -- utilizzati dal DAO quando serve visualizzare l'albero
    public List<Prodotto> getFigli() { return figli; }
    public void setFigli(List<Prodotto> figli) { this.figli = figli; }

    public List<SKU> getSkuList() { return skuList; }
    public void setSkuList(List<SKU> skuList) { this.skuList = skuList; }

    // utile nei template per non scrivere confronti stringa direttamente
    public boolean isSemplice() { return "SEMPLICE".equals(tipo); }
    public boolean isComposto() { return "COMPOSTO".equals(tipo); }
    public boolean isPrimoLivello() { return padreId == null; }
}