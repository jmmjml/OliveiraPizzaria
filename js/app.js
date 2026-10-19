// =====================================================================
// APP.JS - uma única lógica para todas as páginas.
// Ele olha quais elementos existem no HTML e ativa só o que a página usa.
// Ordem dos scripts no HTML: config.js -> api.js -> app.js
// =====================================================================

// ---------------------------------------------------------------------
// 1. UTILITÁRIOS
// ---------------------------------------------------------------------
const byId = id => document.getElementById(id);

// Atualiza o texto de um elemento, se ele existir na página atual.
function showText(id, text) {
    byId(id) && (byId(id).textContent = text);
}

const perfilSessao = (sessionStorage.getItem("perfil") || "").trim().toLowerCase();
const isAdmin = perfilSessao === "admin" || perfilSessao === "administrador";
const isAuthenticated = isAdmin || perfilSessao === "cliente";

// Faixa de aviso no topo da página: "Carregando...", erros e confirmações.
// tipo: "secondary" (cinza), "danger" (vermelho) ou "success" (verde).
function mostrarStatus(texto, tipo) {
    const faixa = byId("api-status");
    if (!faixa) return;
    faixa.className = "alert alert-" + tipo;
    faixa.textContent = texto;
    faixa.hidden = false;
}

function esconderStatus() {
    byId("api-status") && (byId("api-status").hidden = true);
}

// A API devolve datas como "2026-10-18T17:37:31.123456" -> "18/10/2026".
function formatarData(iso) {
    return iso ? new Date(iso.slice(0, 19)).toLocaleDateString("pt-BR") : "";
}

// { ddd: "18", numero: "900000000" } -> "(18) 90000-0000"
function formatarTelefone(celular) {
    const n = celular.numero;
    const corte = n.length > 8 ? 5 : 4;
    return "(" + celular.ddd + ") " + n.slice(0, corte) + "-" + n.slice(corte);
}

// "(18) 90000-0000" -> { ddd: "18", numero: "900000000" } (ou null se estiver incompleto)
function separarTelefone(texto) {
    const digitos = texto.replace(/\D/g, "");
    if (digitos.length < 10 || digitos.length > 11) return null;
    return { ddd: digitos.slice(0, 2), numero: digitos.slice(2) };
}

function formatarEntradaTelefone(texto) {
    const digitos = texto.replace(/\D/g, "").slice(0, 11);
    if (digitos.length <= 2) return digitos ? "(" + digitos : "";

    const ddd = digitos.slice(0, 2);
    const numero = digitos.slice(2);
    const tamanhoPrefixo = numero.length > 8 ? 5 : 4;
    return "(" + ddd + ") " + numero.slice(0, tamanhoPrefixo) +
        (numero.length > tamanhoPrefixo ? "-" + numero.slice(tamanhoPrefixo) : "");
}

// O ID validado no login vem da sessão, não dos parâmetros da URL.
function clienteIdDaSessao() {
    return sessionStorage.getItem("clienteId");
}

// Escolhe o visual do cartão pelo texto do imgCartao (ou usa a empresa padrão).
function empresaDoCartao(cartao) {
    return EMPRESAS[cartao && cartao.imgCartao] || EMPRESAS[EMPRESA_PADRAO];
}

async function incluirTotalCarimbos(cartoes, clienteId) {
    return Promise.all(cartoes.map(async cartao => {
        const carimbos = await api.carimbosDoCartao(cartao.carId, clienteId);
        return { ...cartao, totalCarimbos: carimbos.length };
    }));
}

// ---------------------------------------------------------------------
// 2. MENU E PERMISSÕES
// ---------------------------------------------------------------------
function configurarNavegacao(clienteId) {
    document.querySelectorAll(".admin-link").forEach(l => l.hidden = !isAdmin);
    document.querySelectorAll(".login-link").forEach(l => l.hidden = isAuthenticated);
    document.querySelectorAll(".logout-link").forEach(l => l.hidden = !isAuthenticated);
    byId("admin-content") && (byId("admin-content").hidden = !isAdmin);
    byId("admin-denied") && (byId("admin-denied").hidden = isAdmin);

    // Links do menu mantêm o cliente aberto
    if (clienteId) {
        const id = encodeURIComponent(clienteId);
        document.querySelectorAll(".account-link").forEach(l => l.href = "conta.html?id=" + id);
        byId("back-to-card") && (byId("back-to-card").href = "index.html?id=" + id);
    }
}

// ---------------------------------------------------------------------
// 3. PÁGINA DO CARTÃO (index.html)
// ---------------------------------------------------------------------
async function paginaCartao(clienteId) {
    if (!clienteId) {
        throw new Error("Não encontramos o seu cartão. Abra o link que a loja te entregou (exemplo: index.html?id=5).");
    }
    mostrarStatus("Carregando seu cartão... (se a API estiver 'dormindo', a primeira vez pode levar cerca de 1 minuto)", "secondary");

    // As duas consultas rodam ao mesmo tempo
    const [cliente, cartoesRecebidos] = await Promise.all([
        api.buscarCliente(clienteId),
        api.cartoesDoCliente(clienteId)
    ]);
    const cartoes = await incluirTotalCarimbos(cartoesRecebidos, clienteId);
    esconderStatus();

    // Cartão exibido = o mais recente que ainda não foi resgatado (a API ordena do mais antigo ao mais novo)
    const naoResgatados = cartoes.filter(c => c.entregue !== "S");
    const cartaoAtual = naoResgatados.length ? naoResgatados[naoResgatados.length - 1] : null;

    renderCard(cliente, cartaoAtual);
    renderHistoricoCliente(cartoes);
}

function renderCard(cliente, cartao) {
    const empresa = empresaDoCartao(cartao);
    const totalCarimbos = Number(cartao && cartao.totalCarimbos);
    const conquistados = Number.isFinite(totalCarimbos)
        ? Math.min(Math.max(totalCarimbos, 0), CARIMBOS_POR_CARTAO)
        : 0;
    const stamps = byId("stamp-grid");

    document.documentElement.style.setProperty("--brand-color", empresa.corTema);
    document.documentElement.style.setProperty("--brand-dark", empresa.corFundo);

    let subtitulo = empresa.empresa;
    if (!cartao) subtitulo += " · nenhum cartão ativo ainda";
    else if (cartao.completo === "S") subtitulo += " · cartão completo! Peça seu prêmio na loja";
    showText("company-name", subtitulo);

    showText("header-person-name", cliente.nome);
    showText("card-customer-name", cliente.nome);
    showText("stamp-progress", conquistados + " de " + CARIMBOS_POR_CARTAO);
    byId("stamp-progress-bar").setAttribute("aria-valuenow", conquistados);
    byId("stamp-progress-bar").setAttribute("aria-valuemax", CARIMBOS_POR_CARTAO);
    byId("stamp-progress-fill").style.width = (conquistados / CARIMBOS_POR_CARTAO) * 100 + "%";

    // Um marcador por posição; só os conquistados ficam visíveis
    stamps.replaceChildren();
    empresa.posicoesCarimbos.forEach((posicao, indice) => {
        const marker = document.createElement("span");
        const seal = document.createElement("span");
        const logo = document.createElement("img");

        marker.className = "stamp-marker";
        marker.style.left = posicao.x + "%";
        marker.style.top = posicao.y + "%";
        marker.hidden = indice >= conquistados;
        marker.setAttribute("role", "img");
        marker.setAttribute("aria-label", "Carimbo " + (indice + 1) + " conquistado");
        seal.className = "stamp-logo";
        logo.className = "stamp-logo-art";
        logo.src = empresa.logo;
        logo.alt = "";
        seal.append(logo);
        marker.append(seal);
        stamps.append(marker);
    });

    // Alterna entre frente e verso
    const showSide = lado => {
        const verso = lado === "costas";
        byId("card-art").src = verso ? empresa.costas : empresa.frente;
        byId("card-art").alt = (verso ? "Verso" : "Frente") + " do cartão fidelidade de " + empresa.empresa;
        stamps.hidden = !verso;
        byId("card-customer-name").hidden = !verso;
        showText("card-side-label", (verso ? "Verso" : "Frente") + " do cartão");
        byId("show-front").classList.toggle("active", !verso);
        byId("show-back").classList.toggle("active", verso);
        byId("show-front").setAttribute("aria-pressed", String(!verso));
        byId("show-back").setAttribute("aria-pressed", String(verso));
    };
    byId("show-front").addEventListener("click", () => showSide("frente"));
    byId("show-back").addEventListener("click", () => showSide("costas"));
    showSide("frente");
}

// Histórico que o CLIENTE vê:
//  - cartão ainda não resgatado -> mostra os detalhes
//  - cartão já resgatado        -> mostra SÓ a data do resgate
function renderHistoricoCliente(cartoes) {
    const lista = byId("client-history");
    lista.replaceChildren();

    // Mais novo primeiro
    [...cartoes].sort((a, b) => b.carId - a.carId).forEach(cartao => {
        const item = document.createElement("div");
        item.className = "history-item";

        if (cartao.entregue === "S") {
            item.classList.add("history-item-done");
            item.textContent = "Cartão resgatado em " + formatarData(cartao.dataEntregue);
        } else {
            const completo = cartao.completo === "S";
            const titulo = document.createElement("span");
            const selo = document.createElement("span");
            const detalhe = document.createElement("span");

            titulo.className = "history-title";
            titulo.textContent = "Cartão " + cartao.carId;
            selo.className = "badge " + (completo ? "text-bg-success" : "text-bg-secondary");
            selo.textContent = completo ? "Pronto para resgatar" : "Em andamento";
            detalhe.className = "small text-secondary w-100";
            detalhe.textContent = "Carimbos: " + cartao.totalCarimbos + " de " + CARIMBOS_POR_CARTAO +
                " · Criado em " + formatarData(cartao.dataCriacao) +
                (completo ? " · Completo em " + formatarData(cartao.dataCompleto) : "");

            item.append(titulo, selo, detalhe);
        }
        lista.append(item);
    });

    byId("client-history-empty").hidden = cartoes.length > 0;
}

// ---------------------------------------------------------------------
// 4. PÁGINA DA CONTA (conta.html)
// ---------------------------------------------------------------------
async function paginaConta(clienteId) {
    if (!clienteId) {
        throw new Error("Não encontramos a sua conta. Abra o link que a loja te entregou (exemplo: conta.html?id=5).");
    }
    mostrarStatus("Carregando seus dados...", "secondary");
    const cliente = await api.buscarCliente(clienteId);
    esconderStatus();

    showText("header-person-name", cliente.nome);
    showText("account-name", cliente.nome);
    showText("account-full-name", cliente.nome);
    showText("account-cpf", cliente.cpf || "—");
    showText("account-email", cliente.email);
    showText("account-contacts", cliente.celulares.map(formatarTelefone).join(" · ") || "—");
}

// ---------------------------------------------------------------------
// 5. LISTA DE CLIENTES (clientes.html) - só administrador
// ---------------------------------------------------------------------
async function paginaClientes() {
    mostrarStatus("Carregando clientes... (se a API estiver 'dormindo', a primeira vez pode levar cerca de 1 minuto)", "secondary");
    const [usuarios, cartoes] = await Promise.all([api.listarClientes(), api.listarCartoes()]);
    esconderStatus();

    // Conta quantos cartões cada cliente tem
    const cartoesPorCliente = {};
    cartoes.forEach(c => cartoesPorCliente[c.usuId] = (cartoesPorCliente[c.usuId] || 0) + 1);

    // Administradores não aparecem na lista de clientes
    const clientes = usuarios.filter(u => u.cargo !== "admin");
    renderCustomers(clientes, cartoesPorCliente);
}

function renderCustomers(clientes, cartoesPorCliente) {
    const lista = byId("customer-list");
    const busca = byId("customer-search");

    function atualizarLista(termo) {
        const filtro = termo.trim().toLocaleLowerCase("pt-BR");
        const filtroNumerico = filtro.replace(/\D/g, "");
        const encontrados = clientes.filter(cliente => {
            const telefones = (cliente.celulares || []).map(formatarTelefone);
            const dadosTexto = [cliente.nome, cliente.email, ...telefones]
                .join(" ").toLocaleLowerCase("pt-BR");
            const telefonesNumericos = telefones.map(telefone => telefone.replace(/\D/g, ""));
            return dadosTexto.includes(filtro) ||
                (filtroNumerico.length > 0 &&
                    telefonesNumericos.some(telefone => telefone.includes(filtroNumerico)));
        });

        lista.replaceChildren();
        encontrados.forEach(cliente => {
            const linha = document.createElement("tr");
            const id = encodeURIComponent(cliente.id);

            const celulaNome = document.createElement("th");
            const linkHistorico = document.createElement("a");
            celulaNome.scope = "row";
            linkHistorico.href = "historico.html?id=" + id;
            linkHistorico.textContent = cliente.nome;
            celulaNome.append(linkHistorico);

            const celulaTelefone = document.createElement("td");
            celulaTelefone.textContent = (cliente.celulares || []).map(formatarTelefone).join(", ") || "—";
            const celulaEmail = document.createElement("td");
            celulaEmail.textContent = cliente.email;
            const celulaQtd = document.createElement("td");
            celulaQtd.textContent = cartoesPorCliente[cliente.id] || 0;

            const celulaPagina = document.createElement("td");
            const linkCartao = document.createElement("a");
            linkCartao.href = "historico.html?id=" + id;
            linkCartao.textContent = "Abrir histórico";
            celulaPagina.append(linkCartao);

            linha.append(celulaNome, celulaTelefone, celulaEmail, celulaQtd, celulaPagina);
            lista.append(linha);
        });
        byId("empty-search").hidden = encontrados.length > 0;
    }

    busca.addEventListener("input", evento => atualizarLista(evento.currentTarget.value));
    atualizarLista("");
}

// ---------------------------------------------------------------------
// 6. HISTÓRICO DO CLIENTE PARA O ADMINISTRADOR (historico.html)
//    Aqui ficam o botão "Marcar prêmio como entregue" e o de carimbo.
// ---------------------------------------------------------------------
async function paginaHistorico() {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
        byId("customer-not-found").hidden = false;
        showText("page-title", "Cliente não encontrado");
        return;
    }

    mostrarStatus("Carregando histórico... (se a API estiver 'dormindo', a primeira vez pode levar cerca de 1 minuto)", "secondary");

    let cliente;
    try {
        cliente = await api.buscarCliente(id);
    } catch (erro) {
        if (erro.status === 404) {
            esconderStatus();
            byId("customer-not-found").hidden = false;
            showText("page-title", "Cliente não encontrado");
            return;
        }
        throw erro;
    }

    byId("customer-not-found").hidden = true;
    showText("page-title", cliente.nome);
    showText("customer-contact",
        [cliente.email].concat(cliente.celulares.map(formatarTelefone)).filter(Boolean).join(" · "));

    // Botão de adicionar carimbo (bônus)
    byId("stamp-actions").hidden = false;
    byId("add-stamp").addEventListener("click", async () => {
        const botao = byId("add-stamp");
        botao.disabled = true;
        byId("stamp-message").className = "small text-secondary";
        showText("stamp-message", "Salvando...");
        try {
            const carimbo = await api.darCarimbo(cliente.id, EMPRESA_PADRAO);
            await carregarCartoesDoHistorico(cliente.id);
            byId("stamp-message").className = "small text-success";
            showText("stamp-message", "Carimbo " + carimbo.carimId + " adicionado.");
        } catch (erro) {
            byId("stamp-message").className = "small text-danger";
            showText("stamp-message", erro.message);
        }
        botao.disabled = false;
    });

    await carregarCartoesDoHistorico(cliente.id);
    esconderStatus();
}

// Busca os cartões na API e redesenha a lista (chamada na abertura e depois de cada ação)
async function carregarCartoesDoHistorico(clienteId) {
    const cartoesRecebidos = await api.cartoesDoCliente(clienteId);
    const cartoes = await incluirTotalCarimbos(cartoesRecebidos, clienteId);
    const area = byId("loyalty-history");
    area.replaceChildren();

    [...cartoes].sort((a, b) => b.carId - a.carId).forEach(cartao => {
        area.append(criarCartaoHistorico(cartao, clienteId));
    });

    if (!cartoes.length) {
        const vazio = document.createElement("p");
        vazio.className = "text-secondary";
        vazio.textContent = "Este cliente ainda não tem cartões. Use o botão 'Adicionar carimbo'.";
        area.append(vazio);
    }
}

function criarCartaoHistorico(cartao, clienteId) {
    const completo = cartao.completo === "S";
    const entregue = cartao.entregue === "S";
    const empresa = empresaDoCartao(cartao);

    const coluna = document.createElement("div");
    const artigo = document.createElement("article");
    const topo = document.createElement("div");
    const titulo = document.createElement("h2");
    const selo = document.createElement("span");
    const linhaData = document.createElement("p");
    const linhaCarimbos = document.createElement("p");
    const linhaPremio = document.createElement("p");

    coluna.className = "col-md-6 col-xl-4";
    artigo.className = "card-preview history-card h-100 p-4";
    topo.className = "d-flex justify-content-between gap-2 mb-3";
    titulo.className = "h5";
    linhaData.className = "small text-secondary";
    linhaCarimbos.className = "mb-2";
    linhaPremio.className = "small mb-0";

    titulo.textContent = empresa.empresa + " · Cartão " + cartao.carId;
    selo.className = "badge " + (entregue ? "text-bg-dark" : completo ? "text-bg-success" : "text-bg-secondary");
    selo.textContent = entregue ? "Entregue" : completo ? "Completo" : "Incompleto";
    linhaData.textContent = "Criado em " + formatarData(cartao.dataCriacao);
    linhaCarimbos.textContent = "Carimbos: " + cartao.totalCarimbos + " de " + CARIMBOS_POR_CARTAO;
    linhaPremio.textContent = entregue
        ? "Prêmio entregue em " + formatarData(cartao.dataEntregue)
        : completo ? "Prêmio: aguardando entrega" : "Prêmio: ainda não disponível";

    topo.append(titulo, selo);
    artigo.append(topo, linhaData, linhaCarimbos, linhaPremio);

    // O botão só existe quando o cartão está completo e o prêmio ainda não foi entregue
    if (completo && !entregue) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "btn btn-dark btn-sm mt-3";
        botao.textContent = "Marcar prêmio como entregue";
        botao.addEventListener("click", async () => {
            if (!window.confirm("Confirmar que o prêmio deste cartão foi entregue?")) return;
            botao.disabled = true;
            botao.textContent = "Salvando...";
            try {
                await api.entregarPremio(cartao.carId, cartao.usuId);   // PUT na API
                await carregarCartoesDoHistorico(clienteId);            // redesenha com o dado novo
                mostrarStatus("Prêmio marcado como entregue.", "success");
            } catch (erro) {
                mostrarStatus(erro.message, "danger");
                botao.disabled = false;
                botao.textContent = "Marcar prêmio como entregue";
            }
        });
        artigo.append(botao);
    }

    coluna.append(artigo);
    return coluna;
}

// ---------------------------------------------------------------------
// 7. FORMULÁRIOS (login e cadastro)
// ---------------------------------------------------------------------
function configurarFormularios() {
    document.querySelectorAll(".logout-link").forEach(link => {
        link.addEventListener("click", evento => {
            evento.preventDefault();
            sessionStorage.removeItem("perfil");
            sessionStorage.removeItem("clienteId");
            window.location.assign("login.html");
        });
    });

    const telefone = byId("customer-phone");
    telefone?.addEventListener("input", () => {
        const posicao = telefone.selectionStart || 0;
        const digitosAntesDoCursor = telefone.value.slice(0, posicao).replace(/\D/g, "").length;
        telefone.value = formatarEntradaTelefone(telefone.value);

        let novaPosicao = 0;
        let digitosEncontrados = 0;
        while (novaPosicao < telefone.value.length && digitosEncontrados < digitosAntesDoCursor) {
            if (/\d/.test(telefone.value[novaPosicao])) digitosEncontrados++;
            novaPosicao++;
        }
        telefone.setSelectionRange(novaPosicao, novaPosicao);
    });

    [
        {
            toggle: "toggle-customer-password",
            password: "customer-password",
            eye: "password-eye-icon",
            eyeOff: "password-eye-off-icon"
        },
        {
            toggle: "toggle-login-password",
            password: "login-password",
            eye: "login-password-eye-icon",
            eyeOff: "login-password-eye-off-icon"
        }
    ].forEach(({ toggle, password, eye, eyeOff }) => {
        byId(toggle)?.addEventListener("click", evento => {
            const inputSenha = byId(password);
            const mostrar = inputSenha.type === "password";
            inputSenha.type = mostrar ? "text" : "password";
            evento.currentTarget.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
            evento.currentTarget.setAttribute("aria-pressed", String(mostrar));
            byId(eye).style.display = mostrar ? "none" : "inline";
            byId(eyeOff).style.display = mostrar ? "inline" : "none";
        });
    });

    byId("login-form")?.addEventListener("submit", async evento => {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        const botao = formulario.querySelector("button[type=submit]");
        const mensagem = byId("login-message");
        botao.disabled = true;
        mensagem.className = "small mt-3 mb-0 text-secondary";
        mensagem.textContent = "Verificando acesso...";

        try {
            const usuario = await api.autenticar({
                email: byId("login-email").value.trim(),
                senha: byId("login-password").value
            });
            const cargo = String(usuario.cargo || "").trim().toLowerCase();
            const id = usuario.id;
            const administrador = cargo === "admin" || cargo === "administrador";

            if (!id || (!administrador && cargo !== "cliente")) {
                throw new Error("A API retornou um usuário sem ID ou com cargo não reconhecido.");
            }

            sessionStorage.setItem("perfil", cargo);
            sessionStorage.setItem("clienteId", String(id));
            mensagem.className = "small mt-3 mb-0 text-success";
            mensagem.textContent = "Acesso autorizado. Redirecionando...";
            window.location.assign(administrador ? "clientes.html" : "index.html");
        } catch (erro) {
            sessionStorage.removeItem("perfil");
            sessionStorage.removeItem("clienteId");
            mensagem.className = "small mt-3 mb-0 text-danger";
            mensagem.textContent = erro.message;
            botao.disabled = false;
        }
    });

    // CADASTRO: envia o cliente para a API (POST /api/usuarios)
    byId("registration-form")?.addEventListener("submit", async evento => {
        evento.preventDefault();
        const mensagem = byId("registration-message");
        const botao = evento.currentTarget.querySelector("button[type=submit]");
        const celular = separarTelefone(byId("customer-phone").value);

        if (!celular) {
            mensagem.className = "small mt-3 mb-0 text-danger";
            mensagem.textContent = "Informe o telefone com DDD, por exemplo (18) 90000-0000.";
            return;
        }

        botao.disabled = true;
        mensagem.className = "small mt-3 mb-0 text-secondary";
        mensagem.textContent = "Salvando...";

        try {
            const novo = await api.criarCliente({
                nome: byId("customer-name").value.trim(),
                cpf: "000.000.000-00",
                email: byId("customer-email").value.trim(),
                senha: byId("customer-password").value,
                cargo: "cliente",
                celulares: [celular]
            });
            mensagem.className = "small mt-3 mb-0 text-success";
            mensagem.textContent = "Cliente cadastrado! Código do cliente: " + novo.id;
            byId("registration-form").reset();
            window.setTimeout(() => {
                window.location.assign(isAdmin ? "clientes.html" : "login.html");
            }, 800);
        } catch (erro) {
            mensagem.className = "small mt-3 mb-0 text-danger";
            mensagem.textContent = erro.message;
        }
        botao.disabled = false;
    });
}

// ---------------------------------------------------------------------
// 8. INICIALIZAÇÃO: decide o que rodar conforme os elementos da página
// ---------------------------------------------------------------------
async function iniciar() {
    configurarFormularios();

    if (byId("login-form")) {
        if (isAuthenticated) {
            window.location.replace(isAdmin ? "clientes.html" : "index.html");
        }
        return;
    }

    if (byId("show-front")) {
        if (!isAuthenticated || !sessionStorage.getItem("clienteId")) {
            sessionStorage.removeItem("perfil");
            sessionStorage.removeItem("clienteId");
            window.location.replace("login.html");
            return;
        }
        if (isAdmin) {
            window.location.replace("clientes.html");
            return;
        }
    }

    const clienteId = clienteIdDaSessao();

    configurarNavegacao(clienteId);

    try {
        byId("show-front") && await paginaCartao(clienteId);
        byId("account-full-name") && await paginaConta(clienteId);
        byId("customer-list") && isAdmin && await paginaClientes();
        byId("loyalty-history") && isAdmin && await paginaHistorico();
    } catch (erro) {
        mostrarStatus(erro.message, "danger");
    }
}

iniciar();
