import { useEffect, useRef, useState } from "react";

import * as apiService from "../api/apiService";
import { AuthContext } from "./auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const authOperation = useRef(0);

  useEffect(() => {
    async function validateAuth() {
      const operation = ++authOperation.current;

      try {
        const authenticatedUser = await apiService.me();

        if (operation === authOperation.current) setUser(authenticatedUser);
      } catch {
        // Não chama /auth/logout aqui: uma validação inicial atrasada não
        // pode revogar uma sessão criada pelo formulário de login.
        if (operation === authOperation.current) setUser(null);
      } finally {
        if (operation === authOperation.current) setLoading(false);
      }
    }

    const handleUnauthorized = () => {
      authOperation.current += 1;
      setUser(null);
      setLoading(false);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    validateAuth();

    return () => {
      authOperation.current += 1;
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = async (usuario, senha) => {
    const operation = ++authOperation.current;
    setLoading(true);

    try {
      await apiService.login(usuario, senha);
      const authenticatedUser = await apiService.me();

      if (operation === authOperation.current) setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      if (operation === authOperation.current) setUser(null);
      throw error;
    } finally {
      if (operation === authOperation.current) setLoading(false);
    }
  };

  const logout = async () => {
    authOperation.current += 1;

    try {
      await apiService.logout();
    } catch {
      // Mesmo se o servidor falhar, limpamos o estado local da sessão.
    }
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
