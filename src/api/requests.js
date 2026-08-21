class ApiRequests {
    constructor() {
        this.apiUrl = import.meta.env.VITE_API_URL;
    }

    getHeaders() {
        const token = localStorage.getItem("token");

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
                data?.detail ||
                data?.message ||
                `Erro HTTP ${response.status}`
            );
        }

        return data;
    }

    //GET
    async getData(endpoint, params, options = {}) {

        try {

            const url =
                new URL(
                    `${this.apiUrl}${endpoint}`
                );

            if (params) {

                Object.keys(params)
                    .forEach(key => {
                        // Ignora valores nulos/undefined para nao enviar "null" na querystring
                        if (params[key] != null) {
                            url.searchParams.append(
                                key,
                                params[key]
                            );
                        }
                    });

            }

            const response =
                await fetch(url, {
                    headers:
                        this.getHeaders(),
                    ...(options.signal && { signal: options.signal }),
                });

            return this.handleResponse(response);

        } catch (error) {

            console.error(error);

            throw error;
        }
    }

    //POST
    async postData(endpoint, data, options = {}) {

        const response =
            await fetch(
                `${this.apiUrl}${endpoint}`,
                {
                    method: "POST",
                    headers:
                        this.getHeaders(),
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
                        this.getHeaders(),
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
                        this.getHeaders(),
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
                        this.getHeaders(),
                    ...(options.signal && { signal: options.signal }),
                }
            );

        return this.handleResponse(response);
    }
}
export default new ApiRequests();
