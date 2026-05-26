package it.polimi.progetto_tiw_js.beans;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class Configurazione {

    private int id;
    private String nome;
    private LocalDateTime dataCreazione;
    private LocalDateTime dataUltimaModifica; // null se non è mai stata modificata
    private double prezzoTotale;
    private int clienteId;
    private int prodottoId; // prodotto composto di primo livello a cui si riferisce

    // popolato dal DAO solo quando serve mostrare il dettaglio completo:
    // chiave = id del prodotto semplice, valore = la SKU scelta per quel prodotto
    private Map<Integer, SKU> skuScelte = new LinkedHashMap<>();

    public Configurazione() {}

    // -- getter e setter --

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }

    public LocalDateTime getDataCreazione() { return dataCreazione; }
    public void setDataCreazione(LocalDateTime dataCreazione) {
        this.dataCreazione = dataCreazione;
    }

    public LocalDateTime getDataUltimaModifica() { return dataUltimaModifica; }
    public void setDataUltimaModifica(LocalDateTime dataUltimaModifica) {
        this.dataUltimaModifica = dataUltimaModifica;
    }

    public double getPrezzoTotale() { return prezzoTotale; }
    public void setPrezzoTotale(double prezzoTotale) { this.prezzoTotale = prezzoTotale; }

    public int getClienteId() { return clienteId; }
    public void setClienteId(int clienteId) { this.clienteId = clienteId; }

    public int getProdottoId() { return prodottoId; }
    public void setProdottoId(int prodottoId) { this.prodottoId = prodottoId; }

    public Map<Integer, SKU> getSkuScelte() { return skuScelte; }
    public void setSkuScelte(Map<Integer, SKU> skuScelte) { this.skuScelte = skuScelte; }
}
