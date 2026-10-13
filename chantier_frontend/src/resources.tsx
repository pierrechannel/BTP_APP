import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentIcon from "@mui/icons-material/Assignment";
import BadgeIcon from "@mui/icons-material/Badge";
import BuildIcon from "@mui/icons-material/Build";
import ConstructionIcon from "@mui/icons-material/Construction";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import InventoryIcon from "@mui/icons-material/Inventory";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PaidIcon from "@mui/icons-material/Paid";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import SecurityIcon from "@mui/icons-material/Security";
import SyncIcon from "@mui/icons-material/Sync";

export type ResourceConfig = {
  label: string;
  path: string;
  endpoint: string;
  icon: JSX.Element;
  columns: string[];
  detailTitleField?: string;
};

export const resources: ResourceConfig[] = [
  {
    label: "Chantiers",
    path: "/projects",
    endpoint: "/projects/",
    icon: <ConstructionIcon />,
    columns: ["code", "name", "client_name", "status", "currency"],
    detailTitleField: "name",
  },
  {
    label: "Lots",
    path: "/lots",
    endpoint: "/projects/lots/",
    icon: <AccountTreeIcon />,
    columns: ["code", "name", "subcontractor_name"],
    detailTitleField: "name",
  },
  {
    label: "Planning",
    path: "/planning",
    endpoint: "/planning/tasks/",
    icon: <AssignmentIcon />,
    columns: ["name", "status", "progress_percent", "planned_start_date", "planned_end_date"],
    detailTitleField: "name",
  },
  {
    label: "Budget",
    path: "/budget",
    endpoint: "/budget/expenses/",
    icon: <PaidIcon />,
    columns: ["supplier_name", "date", "status", "amount_including_tax", "currency"],
    detailTitleField: "supplier_name",
  },
  {
    label: "Ressources",
    path: "/resources",
    endpoint: "/resources/materials/",
    icon: <InventoryIcon />,
    columns: ["reference", "name", "unit", "unit_price", "currency"],
    detailTitleField: "name",
  },
  {
    label: "Personnel",
    path: "/workforce",
    endpoint: "/workforce/workers/",
    icon: <BadgeIcon />,
    columns: ["first_name", "last_name", "job_title", "hourly_rate", "currency"],
    detailTitleField: "last_name",
  },
  {
    label: "Materiel",
    path: "/equipment",
    endpoint: "/equipment/equipment/",
    icon: <BuildIcon />,
    columns: ["name", "equipment_type", "serial_number", "state", "daily_cost"],
    detailTitleField: "name",
  },
  {
    label: "Avancement",
    path: "/progress",
    endpoint: "/progress/daily-reports/",
    icon: <QueryStatsIcon />,
    columns: ["report_date", "weather", "status", "work_done"],
    detailTitleField: "report_date",
  },
  {
    label: "QHSE",
    path: "/qhse",
    endpoint: "/qhse/incidents/",
    icon: <SecurityIcon />,
    columns: ["title", "status", "occurred_at", "description"],
    detailTitleField: "title",
  },
  {
    label: "Documents",
    path: "/documents",
    endpoint: "/documents/documents/",
    icon: <FolderIcon />,
    columns: ["title", "status"],
    detailTitleField: "title",
  },
  {
    label: "Notifications",
    path: "/notifications",
    endpoint: "/notifications/notifications/",
    icon: <NotificationsIcon />,
    columns: ["title", "body", "read_at"],
    detailTitleField: "title",
  },
  {
    label: "Rapports",
    path: "/reports",
    endpoint: "/reports/templates/",
    icon: <DescriptionIcon />,
    columns: ["code", "name"],
    detailTitleField: "name",
  },
  {
    label: "Sync",
    path: "/sync",
    endpoint: "/sync/mutations/",
    icon: <SyncIcon />,
    columns: ["resource_type", "operation", "status"],
  },
];

export const resourceByPath = Object.fromEntries(
  resources.map((resource) => [resource.path, resource]),
) as Record<string, ResourceConfig>;
