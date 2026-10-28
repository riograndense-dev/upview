import {
    buildRefreshBody,
    clearAccessToken,
    getAccessToken,
    isTokenExpired,
    setAccessToken,
} from "../utils/token";

class ApiRequests {
    constructor() {
        this.apiUrl = import.meta.env.VITE_API_URL;
        this.refreshPromise = null;
    }

    getHeaders() {
        const token = getAccessToken();

        return {
            "Content-Type": "application/json",
            ...(token && { "Authorization": `Bearer ${token}` }),
        };
    }

    notifyUnauthorized() {
        clearAccessToken();

        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("auth:unauthorized"));
        }
    }

    /**
     * Renova o access token usando o refresh token HttpOnly. A mesma Promise é
     * compartilhada entre chamadas simultâneas para que um token rotativo nunca
     * seja utilizado mais de uma vez.
     */
    async refreshAccessToken(refreshToken = null) {
        if (this.refreshPromise) return this.refreshPromise;

        this.refreshPromise = (async () => {
            try {
                const response = await fetch(`${this.apiUrl}/auth/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(buildRefreshBody(refreshToken)),
                });

                if (!response.ok) {
                    // Somente uma rejeição de autenticação do próprio
                    // endpoint de refresh confirma que a sessão acabou. Erros
                    // transitórios (rede/5xx) não devem expulsar o usuário.
                    if (response.status === 401 || response.status === 403) {
                        this.notifyUnauthorized();
                    }
                    return null;
                }

                const data = await response.json();
                if (!data?.access_token) {
                    return null;
                }

                setAccessToken(data.access_token, data.expires_in);
                return data;
            } catch {
                return null;
            } finally {
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    async fetchWithAuth(url, init = {}, options = {}) {
        const skipAuthRefresh = options.skipAuthRefresh === true;
        const refreshOnUnauthorized = options.refreshOnUnauthorized !== false;
        const token = getAccessToken();
        let refreshAttempted = false;

        const shouldRefreshBeforeRequest =
            (token && isTokenExpired(token)) ||
            (options.requireAuth && !token);

        if (!skipAuthRefresh && shouldRefreshBeforeRequest) {
            await this.refreshAccessToken();
            refreshAttempted = true;
        }

        const request = () => fetch(url, {
            ...init,
            credentials: "include",
            headers: this.getHeaders(),
            ...(options.signal && { signal: options.signal }),
        });

        let response = await request();

        if (
            response.status !== 401 ||
            skipAuthRefresh ||
            refreshAttempted ||
            !refreshOnUnauthorized
        ) {
            return response;
        }

        const refreshed = await this.refreshAccessToken();
        if (!refreshed) return response;

        // Se apenas este endpoint continuar retornando 401 depois de um refresh
        // bem-sucedido, deixamos o erro chegar ao componente. A sessão global
        // continua válida e /auth/me permanece como fonte de verdade.
        return request();
    }

    async handleResponse(response) {
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : null;

        if (!response.ok) {
            throw new Error(
                this.getErrorMessage(data?.detail) ||
                data?.message ||
                `Erro HTTP ${response.status}`
            );
        }

        return data;
    }

    getErrorMessage(detail) {
        if (!detail) return "";
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail)) {
            return detail
                .map((item) => item?.msg || item?.message || String(item))
                .join("; ");
        }
        return detail.message || JSON.stringify(detail);
    }

    buildUrl(endpoint, params) {
        const url = new URL(`${this.apiUrl}${endpoint}`);

        if (params) {
            Object.keys(params).forEach((key) => {
                if (params[key] != null) url.searchParams.append(key, params[key]);
            });
        }

        return url;
    }

    async getData(endpoint, params, options = {}) {
        try {
            const response = await this.fetchWithAuth(
                this.buildUrl(endpoint, params),
                {},
                options,
            );
            return this.handleResponse(response);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    // GET de conteúdo binário (PDF, imagem, etc.)
    async getBlob(endpoint, params, options = {}) {
        const response = await this.fetchWithAuth(
            this.buildUrl(endpoint, params),
            {},
            options,
        );

        if (!response.ok) {
            const contentType = response.headers.get("content-type") || "";
            const data = contentType.includes("application/json")
                ? await response.json()
                : null;
            throw new Error(
                this.getErrorMessage(data?.detail) ||
                data?.message ||
                `Erro HTTP ${response.status}`
            );
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const data = await response.json();
            throw new Error(
                this.getErrorMessage(data?.detail) ||
                data?.message ||
                "A API não retornou o arquivo solicitado."
            );
        }

        return {
            blob: await response.blob(),
            contentDisposition: response.headers.get("content-disposition") || "",
        };
    }

    async postData(endpoint, data, options = {}) {
        const response = await this.fetchWithAuth(
            `${this.apiUrl}${endpoint}`,
            { method: "POST", body: JSON.stringify(data) },
            options,
        );
        return this.handleResponse(response);
    }

    async putData(endpoint, data, options = {}) {
        const response = await this.fetchWithAuth(
            `${this.apiUrl}${endpoint}`,
            { method: "PUT", body: JSON.stringify(data) },
            options,
        );
        return this.handleResponse(response);
    }

    async patchData(endpoint, data, options = {}) {
        const response = await this.fetchWithAuth(
            `${this.apiUrl}${endpoint}`,
            { method: "PATCH", body: JSON.stringify(data) },
            options,
        );
        return this.handleResponse(response);
    }

    async deleteData(endpoint, options = {}) {
        const response = await this.fetchWithAuth(
            `${this.apiUrl}${endpoint}`,
            { method: "DELETE" },
            options,
        );
        return this.handleResponse(response);
    }
}

export default new ApiRequests();
