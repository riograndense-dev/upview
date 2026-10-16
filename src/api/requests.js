class ApiRequests {
    constructor() {
        this.apiUrl = import.meta.env.VITE_API_URL;
    }

    getHeaders(requireAuth = false) {
        const token = localStorage.getItem("token");

        if (requireAuth && !token) {
            throw new Error("Sessão expirada. Entre novamente para acessar o WhatsApp.");
        }

        return {
            "Content-Type": "application/json",
            ...(token && {
                "Authorization": `Bearer ${token}`
            })
        };
    }

    async handleResponse(response) {
        const contentType =
            response.headers.get("content-type") || "";

        const data =
            contentType.includes("application/json")
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

    //GET
    async getData(endpoint, params, options = {}) {

        try {

            const url = this.buildUrl(endpoint, params);

            const response =
                await fetch(url, {
                    headers:
                        this.getHeaders(options.requireAuth),
                    ...(options.signal && { signal: options.signal }),
                });

            return this.handleResponse(response);

        } catch (error) {

            console.error(error);

            throw error;
        }
    }

    // GET de conteúdo binário (PDF, imagem, etc.)
    async getBlob(endpoint, params, options = {}) {
        const response = await fetch(this.buildUrl(endpoint, params), {
            headers: this.getHeaders(options.requireAuth),
            ...(options.signal && { signal: options.signal }),
        });

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

    //POST
    async postData(endpoint, data, options = {}) {

        const response =
            await fetch(
                `${this.apiUrl}${endpoint}`,
                {
                    method: "POST",
                    headers:
                        this.getHeaders(options.requireAuth),
                    body:
                        JSON.stringify(data),
                    ...(options.signal && { signal: options.signal }),
                }
            );

        return this.handleResponse(response);
    }

    //PUT
    async putData(endpoint, data, options = {}) {

        const response =
            await fetch(
                `${this.apiUrl}${endpoint}`,
                {
                    method: "PUT",
                    headers:
                        this.getHeaders(options.requireAuth),
                    body:
                        JSON.stringify(data),
                    ...(options.signal && { signal: options.signal }),
                }
            );

        return this.handleResponse(response);
    }

    //PATCH
    async patchData(endpoint, data, options = {}) {

        const response =
            await fetch(
                `${this.apiUrl}${endpoint}`,
                {
                    method: "PATCH",
                    headers:
                        this.getHeaders(options.requireAuth),
                    body:
                        JSON.stringify(data),
                    ...(options.signal && { signal: options.signal }),
                }
            );

        return this.handleResponse(response);
    }

    //DELETE
    async deleteData(endpoint, options = {}) {

        const response =
            await fetch(
                `${this.apiUrl}${endpoint}`,
                {
                    method: "DELETE",
                    headers:
                        this.getHeaders(options.requireAuth),
                    ...(options.signal && { signal: options.signal }),
                }
            );

        return this.handleResponse(response);
    }
}
export default new ApiRequests();
