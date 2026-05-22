package it.polimi.progetto_tiw_js.api.cliente;

import it.polimi.progetto_tiw_js.api.BaseApiServlet;
import it.polimi.progetto_tiw_js.beans.Prodotto;
import it.polimi.progetto_tiw_js.dao.ProdottoDAO;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@WebServlet("/api/cliente/prodotti")
public class GetProdotti extends BaseApiServlet {

    private static final long serialVersionUID = 1L;
    private static final int PAGE_SIZE = 10;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "CLIENTE")) return;

        int pagina = 0;
        try {
            String p = req.getParameter("pagina");
            if (p != null && !p.isBlank()) pagina = Integer.parseInt(p);
        } catch (NumberFormatException ignored) {}

        try {
            ProdottoDAO dao = new ProdottoDAO(conn);
            int totale = dao.countTopLevelComposti();
            int totalePagine = (int) Math.ceil((double) totale / PAGE_SIZE);
            if (pagina < 0) pagina = 0;
            if (totalePagine > 0 && pagina >= totalePagine) pagina = totalePagine - 1;

            List<Prodotto> prodotti = dao.findTopLevelComposti(pagina * PAGE_SIZE, PAGE_SIZE);
            Map<String, Object> risposta = new HashMap<>();
            risposta.put("prodotti", prodotti);
            risposta.put("paginaCorrente", pagina);
            risposta.put("totalePagine", totalePagine);
            sendJson(resp, risposta);
        } catch (SQLException e) {
            throw new ServletException("Errore DB in GetProdotti", e);
        }
    }
}
