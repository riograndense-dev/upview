import api from "./requests";

/**
 * Service layer centralizado com funções para todos os endpoints
 * definidos em docs/openapi.json.
 *
 * Cada função mapeia 1:1 para um endpoint do backend, mantendo a
 * assinatura de parâmetros alinhada ao OpenAPI spec.
 */

// ── Catálogos ─────────────────────────────────────────────────────────

/** GET / — Página inicial / health check */
export const home = () =>
    api.getData("/");

/** GET /catalog — Catálogo com imagens do iSA */
export const catalog = (params, options = {}) =>
    api.getData("/catalog", params, options);

/** GET /departments/ — Lista de departamentos paginada */
export const departments = (params, options = {}) =>
    api.getData("/departments/", params, options);

/** GET /departments/{id}/categories — Categorias de um departamento */
export const categoriesByDepartment = (id, params, options = {}) =>
    api.getData(`/departments/${id}/categories`, params, options);

/** GET /product/random — Produto aleatório */
export const productRandom = (options = {}) =>
    api.getData("/product/random", undefined, options);

// ── Comunicação ───────────────────────────────────────────────────────

/** POST /channel/mail — Envio de formulário de contato */
export const sendMail = (form, options = {}) =>
    api.postData("/channel/mail", form, options);

// ── Auth ──────────────────────────────────────────────────────────────

/** POST /auth/login — Autenticação via username/password */
export const login = async (usuario, senha) => {
    const data = await api.postData("/auth/login", { "usuario": usuario, "senha": senha });
    localStorage.setItem("token", data.access_token);
    return data;
}

/** POST /auth/logout — Encerra sessão */
export const logout = () => {
    localStorage.removeItem("token");
}

/** GET /auth/me — Dados do usuário autenticado */
export const me = () =>{
    const data = api.getData("/auth/me");
    return data;
}

// ── Clientes ──────────────────────────────────────────────────────────

/** GET /clients/ — Lista de clientes com busca e paginação */
export const listClients = (params, options = {}) =>
    api.getData("/clients/", params, options);

/** GET /clients/{codcli} — Dados de um cliente específico */
export const getClient = (codcli, options = {}) =>
    api.getData(`/clients/${codcli}`, undefined, options);

/** GET /clients/{codcli}/prestacoes — Cliente com suas prestações */
export const getClientPrestacoes = (codcli, params, options = {}) =>
    api.getData(`/clients/${codcli}/prestacoes`, params, options);

// ── Prestações ────────────────────────────────────────────────────────

/** GET /prestacoes/ — Lista de prestações com filtros e busca */
export const listPrestacoes = (params, options = {}) =>
    api.getData("/prestacoes/", params, options);

/**
 * GET /prestacoes/?codusur={codusur} — Prestações de um vendedor específico.
 * O endpoint /prestacoes/ aceita o filtro `codusur` (documentado em openapi.json);
 * não há um endpoint dedicado por vendedor.
 */
export const listPrestacoesByVendedor = (codusur, params, options = {}) =>
    api.getData("/prestacoes/", { codusur, ...params }, options);

/** GET /prestacoes/vencidas — Prestações vencidas nos últimos N dias */
export const listPrestacoesVencidas = (params, options = {}) =>
    api.getData("/prestacoes/vencidas", params, options);

/** GET /prestacoes/a-vencer — Prestações a vencer nos próximos N dias */
export const listPrestacoesAVencer = (params, options = {}) =>
    api.getData("/prestacoes/a-vencer", params, options);

/**
 * GET /prestacoes/a-vencer/por-dia — Total a receber e quantidade
 * agrupados por data de vencimento. Muito mais eficiente que paginar
 * individualmente e somar no cliente.
 */
export const listPrestacoesAVencerPorDia = (params, options = {}) =>
    api.getData("/prestacoes/a-vencer/por-dia", params, options);

/** PATCH /prestacoes/{duplic}/observacao — Cria ou atualiza observação */
export const updatePrestacaoObservacao = (duplic, observacao, options = {}) =>
    api.patchData(`/prestacoes/${duplic}/observacao`, { observacao }, options);

// ── Vendedores ─────────────────────────────────────────────────────────

/** GET /user/ — Lista de vendedores (usuários Winthor) */
export const listVendedores = (params, options = {}) =>
    api.getData("/user/", params, options);

/**
 * GET /user/?codusur={codusur} — Usuário (vendedor) específico.
 * Retorna o objeto UsuarioResponse ou null quando não encontrado.
 */
export const getVendedor = async (codusur, options = {}) => {
    const data = await api.getData("/user/", { codusur }, options);
    return (Array.isArray(data) ? data : []).find((u) => u?.CODUSUR === codusur) ?? null;
};

