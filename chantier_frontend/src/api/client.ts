import axios, { InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://185.98.128.176:8020/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export function clearSession() {
  for (const key of ["accessToken", "refreshToken", "tenantId"]) {
    localStorage.removeItem(`chantier.${key}`);
  }
  window.dispatchEvent(new Event("chantier:logout"));
}

let refreshRequest: Promise<string> | null = null;
let sessionGeneration = 0;
export const getSessionGeneration = () => sessionGeneration;
window.addEventListener("chantier:logout", () => {
  sessionGeneration += 1;
  refreshRequest = null;
});

type SessionRequestConfig = InternalAxiosRequestConfig & {
  retried?: boolean;
  sessionGeneration?: number;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as SessionRequestConfig | undefined;
    if (config?.sessionGeneration !== undefined && config.sessionGeneration !== sessionGeneration) {
      return Promise.reject(error);
    }
    if (error.response?.status !== 401 || !config || config.retried || config.url?.startsWith("/auth/token/")) {
      return Promise.reject(error);
    }
    const refresh = localStorage.getItem("chantier.refreshToken");
    if (!refresh) {
      clearSession();
      return Promise.reject(error);
    }
    config.retried = true;
    const generation = sessionGeneration;
    try {
      refreshRequest ??= axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh })
        .then(({ data }) => {
          if (generation !== sessionGeneration || refresh !== localStorage.getItem("chantier.refreshToken")) {
            throw new Error("Session terminee.");
          }
          localStorage.setItem("chantier.accessToken", data.access);
          if (data.refresh) localStorage.setItem("chantier.refreshToken", data.refresh);
          return data.access as string;
        })
        .finally(() => { if (generation === sessionGeneration) refreshRequest = null; });
      const access = await refreshRequest;
      config.headers.Authorization = `Bearer ${access}`;
      return api.request(config);
    } catch (refreshError) {
      if (generation === sessionGeneration) clearSession();
      return Promise.reject(refreshError);
    }
  },
);

api.interceptors.request.use((config) => {
  (config as SessionRequestConfig).sessionGeneration ??= sessionGeneration;
  const accessToken = localStorage.getItem("chantier.accessToken");
  const tenantId = localStorage.getItem("chantier.tenantId");

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (tenantId) {
    config.headers["X-Tenant-ID"] = tenantId;
  }

  return config;
});
