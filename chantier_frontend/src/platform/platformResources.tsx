import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import BusinessIcon from "@mui/icons-material/Business";
import HistoryIcon from "@mui/icons-material/History";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeart";
import PaymentsIcon from "@mui/icons-material/Payments";
import PeopleIcon from "@mui/icons-material/People";

export const platformMenu = [
  { label: "Vue plateforme", path: "/platform", icon: <AdminPanelSettingsIcon /> },
  { label: "Tenants", path: "/platform/tenants", icon: <BusinessIcon /> },
  { label: "Utilisateurs", path: "/platform/users", icon: <PeopleIcon /> },
  { label: "Abonnements", path: "/platform/billing", icon: <PaymentsIcon /> },
  { label: "Audit", path: "/platform/audit", icon: <HistoryIcon /> },
  { label: "Sante systeme", path: "/platform/health", icon: <MonitorHeartIcon /> },
];
