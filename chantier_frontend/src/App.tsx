import { Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "./layout/AdminLayout";
import { PlatformLayout } from "./layout/PlatformLayout";
import { useAuth } from "./state/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { BudgetPage } from "./pages/modules/BudgetPage";
import { BudgetDetailPage } from "./pages/modules/BudgetDetailPage";
import { DocumentsDetailPage } from "./pages/modules/DocumentsDetailPage";
import { DocumentsPage } from "./pages/modules/DocumentsPage";
import { EquipmentDetailPage } from "./pages/modules/EquipmentDetailPage";
import { EquipmentPage } from "./pages/modules/EquipmentPage";
import { LotDetailPage } from "./pages/modules/LotDetailPage";
import { LotsPage } from "./pages/modules/LotsPage";
import { NotificationDetailPage } from "./pages/modules/NotificationDetailPage";
import { NotificationsPage } from "./pages/modules/NotificationsPage";
import { PlanningDetailPage } from "./pages/modules/PlanningDetailPage";
import { PlanningPage } from "./pages/modules/PlanningPage";
import { ProgressDetailPage } from "./pages/modules/ProgressDetailPage";
import { ProgressPage } from "./pages/modules/ProgressPage";
import { ProjectDetailPage } from "./pages/modules/ProjectDetailPage";
import { ProjectsPage } from "./pages/modules/ProjectsPage";
import { QhseDetailPage } from "./pages/modules/QhseDetailPage";
import { QhsePage } from "./pages/modules/QhsePage";
import { ReportsDetailPage } from "./pages/modules/ReportsDetailPage";
import { ReportsPage } from "./pages/modules/ReportsPage";
import { ResourcesDetailPage } from "./pages/modules/ResourcesDetailPage";
import { ResourcesPage } from "./pages/modules/ResourcesPage";
import { SyncDetailPage } from "./pages/modules/SyncDetailPage";
import { SyncPage } from "./pages/modules/SyncPage";
import { WorkforceDetailPage } from "./pages/modules/WorkforceDetailPage";
import { WorkforcePage } from "./pages/modules/WorkforcePage";
import { PlatformAuditPage } from "./pages/platform/PlatformAuditPage";
import { PlatformBillingPage } from "./pages/platform/PlatformBillingPage";
import { PlatformDashboardPage } from "./pages/platform/PlatformDashboardPage";
import { PlatformHealthPage } from "./pages/platform/PlatformHealthPage";
import { PlatformTenantsPage } from "./pages/platform/PlatformTenantsPage";
import { PlatformUsersPage } from "./pages/platform/PlatformUsersPage";

export function App() {
  const { user } = useAuth();
  const hasToken = Boolean(localStorage.getItem("chantier.accessToken"));

  if (!hasToken) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (window.location.pathname.startsWith("/platform")) {
    return (
      <PlatformLayout>
        <Routes>
          <Route path="/platform" element={<PlatformDashboardPage />} />
          <Route path="/platform/tenants" element={<PlatformTenantsPage />} />
          <Route path="/platform/users" element={<PlatformUsersPage />} />
          <Route path="/platform/billing" element={<PlatformBillingPage />} />
          <Route path="/platform/audit" element={<PlatformAuditPage />} />
          <Route path="/platform/health" element={<PlatformHealthPage />} />
          <Route path="/login" element={user ? <Navigate to="/platform" replace /> : <LoginPage />} />
          <Route path="*" element={<Navigate to="/platform" replace />} />
        </Routes>
      </PlatformLayout>
    );
  }

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/lots" element={<LotsPage />} />
        <Route path="/lots/:id" element={<LotDetailPage />} />
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/planning/:id" element={<PlanningDetailPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/budget/:id" element={<BudgetDetailPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/resources/:id" element={<ResourcesDetailPage />} />
        <Route path="/workforce" element={<WorkforcePage />} />
        <Route path="/workforce/:id" element={<WorkforceDetailPage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/progress/:id" element={<ProgressDetailPage />} />
        <Route path="/qhse" element={<QhsePage />} />
        <Route path="/qhse/:id" element={<QhseDetailPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentsDetailPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/notifications/:id" element={<NotificationDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:id" element={<ReportsDetailPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/sync/:id" element={<SyncDetailPage />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminLayout>
  );
}
