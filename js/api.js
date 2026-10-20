// =====================================================================
// COMUNICAÇÃO COM A API
// Todas as telas chamam a API por aqui. Nenhum outro arquivo usa fetch.
// =====================================================================

// Função única que faz a chamada, trata os erros e devolve o JSON já pronto.
let requisicoesPendentes = 0;

async function requisicao(caminho, opcoes = {}) {
    let resposta;
    const token = sessionStorage.getItem("accessToken");
    requisicoesPendentes++;
    const overlay = document.getElementById("api-loading-overlay");
    if (overlay) {
        overlay.hidden = false;
        overlay.setAttribute("aria-hidden", "false");
    }

    try {
        try {
            resposta = await fetch(API_URL + caminho, {
                ...opcoes,
                headers: {
                    "Content-Type": "application/json",
                    ...(opcoes.headers || {}),
                    ...(token ? { Authorization: "Bearer " + token } : {})
                }
            });
        } catch (erroDeRede) {
            // fetch só "falha" aqui quando nem chegou na API (desligada, sem internet ou CORS)
            throw new Error("Não foi possível conectar à API. Verifique se ela está ligada e se o CORS está liberado.");
        }

        // 204 = deu certo e não há corpo (acontece no DELETE)
        if (resposta.status === 204) {
            return null;
        }

        // A API sempre responde JSON; se não vier JSON, usamos null
        const corpo = await resposta.json().catch(() => null);

        if (!resposta.ok) {
            if (resposta.status === 401 && token && !caminho.endsWith("/login")) {
                sessionStorage.removeItem("accessToken");
                sessionStorage.removeItem("perfil");
                sessionStorage.removeItem("clienteId");
                window.location.assign("login.html");
            }
            // Erros da API vêm como { status, erro, mensagem, campos? }
            let mensagem = (corpo && corpo.mensagem) || "Erro " + resposta.status;
            if (corpo && corpo.campos) {
                mensagem += " (" + Object.values(corpo.campos).join("; ") + ")";
            }
            const erro = new Error(mensagem);
            erro.status = resposta.status;   // permite tratar 404, 409... na tela
            throw erro;
        }
        return corpo;
    } finally {
        requisicoesPendentes--;
        if (requisicoesPendentes === 0 && overlay) {
            overlay.hidden = true;
            overlay.setAttribute("aria-hidden", "true");
        }
    }
}

// Uma função por ação do sistema. Os nomes dizem o que cada uma faz.
const api = {
    listarClientes: () => requisicao("/api/usuarios"),

    buscarCliente: id => requisicao("/api/usuarios/" + encodeURIComponent(id)),

    autenticar: credenciais => requisicao("/api/usuarios/login", {
        method: "POST",
        body: JSON.stringify(credenciais)
    }),

    atualizarCliente: (id, dados) => requisicao("/api/usuarios/" + encodeURIComponent(id), {
        method: "PUT",
        body: JSON.stringify(dados)
    }),

    excluirCliente: id => requisicao("/api/usuarios/" + encodeURIComponent(id), {
        method: "DELETE"
    }),

    criarCliente: dados => requisicao("/api/usuarios", {
        method: "POST",
        body: JSON.stringify(dados)
    }),

    listarCartoes: () => requisicao("/api/cartoes"),

    listarEmpresas: () => requisicao("/api/empresas"),

    cartoesDoCliente: id => requisicao("/api/cartoes/usuario/" + encodeURIComponent(id)),

    carimbosDoCartao: (carId, usuId) => requisicao(
        "/api/carimbos/cartao/" + encodeURIComponent(carId) + "/usuario/" + encodeURIComponent(usuId)
    ),

    entregarPremio: (carId, usuId) => requisicao(
        "/api/cartoes/" + carId + "/usuario/" + usuId + "/entregar-premio",
        { method: "PUT" }
    ),

    darCarimbo: (usuId, empresaId) => requisicao(
        "/api/carimbos/usuario/" + encodeURIComponent(usuId) + "?empresaId=" + encodeURIComponent(empresaId),
        { method: "POST" }
    )
};
