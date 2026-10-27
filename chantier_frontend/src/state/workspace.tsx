import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection } from "../api/workspace";
import { useAuth } from "./auth";

type Workspace = {
  projectId: string; setProjectId: (value: string) => void; projects: ApiRecord[];
  loading: boolean; error: string; can: (resource: string, action?: string) => boolean;
  refreshProjects: () => void;
};
const Context = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, tenantId } = useAuth();
  const storageKey = `chantier.project.${tenantId}`;
  const [projectId, setProject] = useState(localStorage.getItem(storageKey) ?? "");
  const [projects, setProjects] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const membership = user?.memberships.find((item) => item.tenant.id === tenantId && item.is_active);
  const can = useCallback((resource: string, action = "read") => {
    if (user?.is_superuser) return true;
    const permissions = membership?.permissions ?? {};
    const allowed = [...(permissions[resource] ?? []), ...(permissions["*"] ?? [])];
    return allowed.includes(action) || (allowed.includes("crud") && ["create", "read", "update", "delete"].includes(action))
      || (resource === "documents" && action === "read" && allowed.includes("read_shared"));
  }, [user, membership]);
  const setProjectId = (value: string) => { setProject(value); localStorage.setItem(storageKey, value); };
  const refreshProjects = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    window.addEventListener("chantier:data-changed", refreshProjects);
    return () => window.removeEventListener("chantier:data-changed", refreshProjects);
  }, [refreshProjects]);
  useEffect(() => {
    if (!tenantId || !can("projects")) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    fetchCollection("/projects/", {}, controller.signal).then((rows) => {
      setProjects(rows);
      setProject((current) => {
        if (current && !rows.some((row) => String(row.id) === current)) {
          localStorage.removeItem(storageKey); return "";
        }
        return current;
      });
    }).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tenantId, can, revision]);
  return <Context.Provider value={{ projectId, setProjectId, projects, loading, error, can, refreshProjects }}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Espace de travail indisponible.");
  return value;
}
