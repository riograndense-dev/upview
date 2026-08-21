/**
 * Serviços de autenticação.
 *
 * Re-exportados de apiService.js para manter compatibilidade histórica
 * com imports antigos (ex: `import { login, me } from "../api/authServices"`).
 */
export { login, logout, me } from "./apiService";