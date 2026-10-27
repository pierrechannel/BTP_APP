import { useEffect, useState } from "react";
import { api } from "../api/client";
import { errorMessage } from "../api/workspace";

export type PlatformOverview = {
  status: string; database: string; checked_at: string;
  tenants: number; active_tenants: number; users: number; active_users: number;
  projects: number; audit_events: number; sync_pending: number; sync_failed: number;
  reports_pending: number; reports_failed: number;
};
export function usePlatformOverview() {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    api.get<PlatformOverview>("/auth/platform/overview/", { signal: controller.signal })
      .then(({ data }) => setData(data)).catch((error) => {
        if (!controller.signal.aborted) { setData(null); setError(errorMessage(error)); }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  return { data, loading, error, refresh: () => setRevision((value) => value + 1) };
}
