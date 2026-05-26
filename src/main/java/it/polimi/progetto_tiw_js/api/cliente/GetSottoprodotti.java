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
import java.util.List;

@WebServlet("/api/cliente/sottoprodotti")
public class GetSottoprodotti extends BaseApiServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        if (!isLogged(req, resp)) return;
        if (!hasRole(req, resp, "CLIENTE")) return;

        int prodottoId;
        try {
            prodottoId = Integer.parseInt(req.getParameter("id"));
        } catch (NumberFormatException e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Parametro 'id' non valido.");
            return;
        }

        try {
            ProdottoDAO dao = new ProdottoDAO(conn);
            List<Prodotto> figli = dao.findFigliDirettiConSku(prodottoId);
            sendJson(resp, figli);
        } catch (SQLException e) {
            throw new ServletException("Errore DB in GetSottoprodotti", e);
        }
    }
}
