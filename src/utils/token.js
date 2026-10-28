import { jwtDecode } from "jwt-decode";

/**
 * Utils de sessão e tokens.
 *
 * O backend grava o refresh token em cookie HttpOnly e rotaciona a cada
 * renovação. O access token permanece no armazenamento local e é enviado no
 * cabeçalho Authorization das requisições.
 */

const ACCESS_TOKEN_KEY = "token";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "token_expires_at";

export function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token, expiresIn = null) {
    if (!token) {
        clearAccessToken();
        return;
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, token);

    if (Number.isFinite(expiresIn) && expiresIn > 0) {
        const expiresAt = Date.now() + (expiresIn * 1000);
        localStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, String(expiresAt));
    } else {
        localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
    }
}

export function clearAccessToken() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
}

/** Verifica se o access token atual está expirado. */
export function isTokenExpired(token) {
    if (!token) return true;

    const storedExpiresAt = Number(
        localStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY),
    );

    if (Number.isFinite(storedExpiresAt) && storedExpiresAt > 0) {
        return storedExpiresAt <= Date.now();
    }

    try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;
        return typeof decoded.exp !== "number" || decoded.exp <= currentTime;
    } catch {
        return true;
    }
}

/** Cria o corpo opcional do refresh, respeitando o schema RefreshTokenRequest. */
export function buildRefreshBody(refreshToken = null) {
    return refreshToken ? { refresh_token: refreshToken } : {};
}
