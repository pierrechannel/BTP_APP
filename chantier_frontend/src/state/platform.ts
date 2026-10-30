import { useEffect, useState } from "react";
import { api } from "../api/client";
import { errorMessage } from "../api/workspace";

export type PlatformOverview = {
  status: string; database: string; checked_at: string;
  tenants: number; active_tenants: number; users: number; active_users: number;
  projects: number; audit_events: number; sync_pending: number; sync_failed: number;
  reports_pending: number; reports_failed: number;
  period: { days: number; start_date: string; end_date: string };
  period_summary: Record<'events' | 'users' | 'tenants' | 'projects', number>;
  previous_summary: Record<'events' | 'users' | 'tenants' | 'projects', number>;
  activity: Array<{ date: string; events: number; users: number; tenants: number; projects: number }>;
  project_statuses: Array<{ status: string; count: number }>;
  top_tenants: Array<{ id: string; name: string; is_active: boolean; projects: number; members: number; events: number }>;
  active_tenants_in_period: number;
  recent_events: Array<{ id: string; action: string; resource: string; tenant_id: string | null; tenant_name: string; user: string; created_at: string }>;
};
export function usePlatformOverview(days = 30) {
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("chantier:data-changed", refresh);
    return () => window.removeEventListener("chantier:data-changed", refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setLoading(true); setError("");
    api.get<PlatformOverview>("/auth/platform/overview/", { signal: controller.signal, params: { days } })
      .then(({ data }) => { if (!controller.signal.aborted) setData(data); }).catch((error) => {
        if (!controller.signal.aborted) { setData(null); setError(errorMessage(error)); }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, days]);
  return { data, loading, error, refresh: () => setRevision((value) => value + 1) };
}
