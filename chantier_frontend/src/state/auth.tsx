import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, clearSession, getSessionGeneration } from "../api/client";
import { Me } from "../api/types";

type AuthContextValue = {
  user: Me | null;
  tenantId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  setTenantId: (tenantId: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [tenantIdState, setTenantIdState] = useState<string | null>(
    localStorage.getItem("chantier.tenantId"),
  );
  const [loading, setLoading] = useState(false);

  const setTenantId = useCallback((tenantId: string) => {
    localStorage.setItem("chantier.tenantId", tenantId);
    setTenantIdState(tenantId);
  }, []);

  const refreshMe = useCallback(async () => {
    const generation = getSessionGeneration();
    const response = await api.get<Me>("/auth/me/");
    if (generation !== getSessionGeneration() || !localStorage.getItem("chantier.accessToken")) return;
    setUser(response.data);
    const memberships = response.data.memberships.filter((item) => item.is_active && item.tenant.is_active);
    if (!memberships.some((item) => item.tenant.id === localStorage.getItem("chantier.tenantId"))) {
      if (memberships.length) setTenantId(memberships[0].tenant.id);
      else {
        localStorage.removeItem("chantier.tenantId");
        setTenantIdState(null);
      }
    }
  }, [setTenantId]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    clearSession();
    try {
      const tokenResponse = await api.post<{ access: string; refresh: string }>("/auth/token/", {
        email,
        password,
      });
      localStorage.setItem("chantier.accessToken", tokenResponse.data.access);
      localStorage.setItem("chantier.refreshToken", tokenResponse.data.refresh);
      await refreshMe();
    } catch (error) {
      clearSession();
      throw error;
    } finally {
      setLoading(false);
    }
  }, [refreshMe]);

  const logout = useCallback(() => {
    const refresh = localStorage.getItem("chantier.refreshToken");
    if (refresh) void api.post("/auth/token/blacklist/", { refresh }).catch(() => {});
    clearSession();
    setUser(null);
    setTenantIdState(null);
  }, []);

  useEffect(() => {
    const reset = () => { setUser(null); setTenantIdState(null); };
    window.addEventListener("chantier:logout", reset);
    return () => window.removeEventListener("chantier:logout", reset);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("chantier.accessToken")) return;
    setLoading(true);
    refreshMe().catch(() => clearSession()).finally(() => setLoading(false));
  }, [refreshMe]);

  const value = useMemo(
    () => ({ user, tenantId: tenantIdState, loading, login, logout, refreshMe, setTenantId }),
    [user, tenantIdState, loading, login, logout, refreshMe, setTenantId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
