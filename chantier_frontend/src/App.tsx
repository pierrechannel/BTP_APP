import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { AdminLayout } from "./layout/AdminLayout";
import { PlatformLayout } from "./layout/PlatformLayout";
import { useAuth } from "./state/auth";
import { WorkspaceProvider, useWorkspace } from "./state/workspace";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ResourcePage } from "./pages/ResourcePage";
import { RecordDetailPage } from "./pages/RecordDetailPage";
import { allResources, ResourceConfig } from "./resources";
import { PlatformAuditPage } from "./pages/platform/PlatformAuditPage";
import { PlatformBillingPage } from "./pages/platform/PlatformBillingPage";
import { PlatformDashboardPage } from "./pages/platform/PlatformDashboardPage";
import { PlatformHealthPage } from "./pages/platform/PlatformHealthPage";
import { PlatformTenantsPage } from "./pages/platform/PlatformTenantsPage";
import { PlatformUsersPage } from "./pages/platform/PlatformUsersPage";

function ResourceRoute({ resource, detail = false }: { resource: ResourceConfig; detail?: boolean }) {
  const { can } = useWorkspace();
  if (!can(resource.group) && !can(resource.group, "create")) return <Alert severity="info">Votre rôle ne donne pas accès à ce module.</Alert>;
  return detail ? <RecordDetailPage resource={resource} /> : <ResourcePage resource={resource} />;
}
export function App() {
  const { user, tenantId } = useAuth();
  const location = useLocation();
  const hasToken = Boolean(localStorage.getItem("chantier.accessToken"));
  if (!hasToken) return <Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
  if (!user) return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Stack spacing={2} alignItems="center"><CircularProgress /><Typography color="text.secondary">Ouverture de votre espace…</Typography></Stack></Box>;
  if (location.pathname.startsWith("/platform")) {
    if (!user.is_superuser) return <Navigate to="/" replace />;
    return <PlatformLayout><Routes>
      <Route path="/platform" element={<PlatformDashboardPage />} /><Route path="/platform/tenants" element={<PlatformTenantsPage />} />
      <Route path="/platform/users" element={<PlatformUsersPage />} /><Route path="/platform/billing" element={<PlatformBillingPage />} />
      <Route path="/platform/audit" element={<PlatformAuditPage />} /><Route path="/platform/health" element={<PlatformHealthPage />} />
      <Route path="*" element={<Navigate to="/platform" replace />} />
    </Routes></PlatformLayout>;
  }
  return <WorkspaceProvider key={tenantId}><AdminLayout><Routes>
    <Route path="/" element={<DashboardPage />} />
    {allResources.flatMap((resource) => [
      <Route key={resource.path} path={resource.path} element={<ResourceRoute key={resource.path} resource={resource} />} />,
      <Route key={`${resource.path}/:id`} path={`${resource.path}/:id`} element={<ResourceRoute key={`${resource.path}/detail`} resource={resource} detail />} />,
    ])}
    <Route path="/login" element={<Navigate to="/" replace />} /><Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AdminLayout></WorkspaceProvider>;
}
