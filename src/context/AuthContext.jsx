import { useState, useEffect } from "react";

import * as apiService from "../api/apiService";
import { AuthContext } from "./auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);

  async function loadUser() {
    try {
      const data = await apiService.me();

      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function validateAuth() {
      try {
        const user = await apiService.me();

        setUser(user);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    }

    const handleUnauthorized = () => setUser(null);
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    validateAuth();

    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = async () => {
    const authenticatedUser = await loadUser();
    if (!authenticatedUser) {
      throw new Error("Não foi possível validar a sessão.");
    }
    return authenticatedUser;
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch {
      // Mesmo se o servidor falhar, limpamos o estado local da sessão.
    }
    setUser(null);
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
