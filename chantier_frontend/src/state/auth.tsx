import { createContext, ReactNode, useContext, useMemo, useState } from "react";

import { api } from "../api/client";
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

  const setTenantId = (tenantId: string) => {
    localStorage.setItem("chantier.tenantId", tenantId);
    setTenantIdState(tenantId);
  };

  const refreshMe = async () => {
    const response = await api.get<Me>("/auth/me/");
    setUser(response.data);
    if (!tenantIdState && response.data.memberships.length > 0) {
      setTenantId(response.data.memberships[0].tenant.id);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const tokenResponse = await api.post<{ access: string; refresh: string }>("/auth/token/", {
        email,
        password,
      });
      localStorage.setItem("chantier.accessToken", tokenResponse.data.access);
      localStorage.setItem("chantier.refreshToken", tokenResponse.data.refresh);
      await refreshMe();
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("chantier.accessToken");
    localStorage.removeItem("chantier.refreshToken");
    localStorage.removeItem("chantier.tenantId");
    setUser(null);
    setTenantIdState(null);
  };

  const value = useMemo(
    () => ({ user, tenantId: tenantIdState, loading, login, logout, refreshMe, setTenantId }),
    [user, tenantIdState, loading],
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
