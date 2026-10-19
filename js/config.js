// =====================================================================
// CONFIGURAÇÕES DO SISTEMA  (é o único arquivo que você muda ao publicar)
// =====================================================================

// Endereço da API.
//  - Testando no seu computador:  http://localhost:8080
//  - Depois de publicar no Render: https://NOME-DO-SEU-SERVICO.onrender.com
// Sem "/" no final!
const API_URL = "https://api-fidelidade.onrender.com";

// Quantos carimbos completam um cartão (deve ser igual ao valor da API).
const CARIMBOS_POR_CARTAO = 10;

// Empresa usada ao adicionar carimbos pelo botão do administrador.
// Precisa ser uma das chaves de EMPRESAS (abaixo).
const EMPRESA_PADRAO = "OliveiraPizzaria";

// Tema e posições dos carimbos por empresa. As imagens vêm da entidade Empresa na API.
const EMPRESAS = {
    OliveiraPizzaria: {
        empresa: "Pizzaria Oliveira",
        corTema: "#c9a65b",
        corFundo: "#201d19",
        frente: "img/cartoes/OliveiraPizzaria_frente.png",
        costas: "img/cartoes/OliveiraPizzaria_costas.png",
        logo: "img/logos/OliveiraPizzaria.png",
        posicoesCarimbos: [
            { x: 14.2, y: 29.6 }, { x: 31.8, y: 29.6 }, { x: 49.7, y: 29.6 },
            { x: 67.3, y: 29.6 }, { x: 83.4, y: 29.6 },
            { x: 14.2, y: 52.8 }, { x: 31.8, y: 52.8 }, { x: 49.7, y: 52.8 },
            { x: 67.3, y: 52.8 }, { x: 83.4, y: 52.8 }
        ]
    }
};
