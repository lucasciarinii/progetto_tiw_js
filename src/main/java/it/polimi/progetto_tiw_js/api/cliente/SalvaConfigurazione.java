package it.polimi.progetto_tiw_js.api.cliente;

import it.polimi.progetto_tiw_js.api.BaseApiServlet;
import it.polimi.progetto_tiw_js.beans.Configurazione;
import it.polimi.progetto_tiw_js.beans.Prodotto;
import it.polimi.progetto_tiw_js.dao.ConfigurazioneDAO;
import it.polimi.progetto_tiw_js.dao.ProdottoDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.*;

@WebServlet("/api/cliente/configurazione/salva")
public class SalvaConfigurazione extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "CLIENTE")) return;
        req.setCharacterEncoding("UTF-8");

        String nomeConf = req.getParameter("nomeConf");
        if (nomeConf == null || nomeConf.isBlank()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Inserisci un nome per la configurazione.");
            return;
        }

        int prodottoId;
        try {
            prodottoId = Integer.parseInt(req.getParameter("prodottoId"));
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Parametro prodottoId non valido.");
            return;
        }

        Integer configurazioneId = null;
        try {
            String confParam = req.getParameter("configurazioneId");
            if (confParam != null && !confParam.isBlank()) configurazioneId = Integer.parseInt(confParam);
        } catch (NumberFormatException ignored) {}

        try {
            ProdottoDAO prodottoDAO = new ProdottoDAO(conn);
            ConfigurazioneDAO confDAO = new ConfigurazioneDAO(conn);
            Prodotto prodotto = prodottoDAO.findByIdConDiscendenti(prodottoId);
            if (prodotto == null) {
                sendError(resp, HttpServletResponse.SC_NOT_FOUND, "Prodotto non trovato.");
                return;
            }

            List<Integer> sempliciIds = raccogliSemplici(prodotto);
            Map<Integer, Integer> skuScelte = new LinkedHashMap<>();
            for (int sempliceId : sempliciIds) {
                String param = req.getParameter("sku_" + sempliceId);
                if (param == null || param.isBlank()) {
                    sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Seleziona una SKU per ogni componente prima di salvare.");
                    return;
                }
                try {
                    skuScelte.put(sempliceId, Integer.parseInt(param));
                } catch (NumberFormatException e) {
                    sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Valore SKU non valido.");
                    return;
                }
            }

            int idConfSalvata;
            int clienteId = getUtenteInSessione(req).getId();
            if (configurazioneId == null) {
                idConfSalvata = confDAO.createConfigurazione(nomeConf.trim(), clienteId, prodottoId, skuScelte);
            } else {
                Configurazione conf = confDAO.findById(configurazioneId);
                if (conf == null || conf.getClienteId() != clienteId) {
                    sendError(resp, HttpServletResponse.SC_FORBIDDEN, "Configurazione non trovata.");
                    return;
                }
                confDAO.updateConfigurazione(configurazioneId, nomeConf.trim(), skuScelte);
                idConfSalvata = configurazioneId;
            }

            sendJson(resp, Map.of("id", idConfSalvata));
        } catch (SQLException e) {
            throw new ServletException("Errore DB in SalvaConfigurazione", e);
        }
    }

    // Raccoglie ricorsivamente gli ID dei prodotti semplici discendenti, o dell'attuale se è semplice
    private List<Integer> raccogliSemplici(Prodotto prodotto) {
        List<Integer> ids = new ArrayList<>();
        if (prodotto.isSemplice()) ids.add(prodotto.getId());
        else for (Prodotto figlio : prodotto.getFigli()) ids.addAll(raccogliSemplici(figlio));
        return ids;
    }
}
