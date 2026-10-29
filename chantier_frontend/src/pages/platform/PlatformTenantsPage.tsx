import { PlatformTable } from "../../platform/PlatformTable";
import { Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../state/auth";

export function PlatformTenantsPage() {
  const navigate = useNavigate();
  const { setTenantId } = useAuth();
  return (
    <PlatformTable
      title="Entreprises"
      subtitle="Organisations clientes de la plateforme."
      endpoint="/auth/platform/tenants/"
      columns={["name", "slug", "country", "default_currency", "members_count", "projects_count", "is_active"]}
      rowActions={(tenant) => <Button size="small" onClick={() => { setTenantId(String(tenant.id)); navigate("/platform/users"); }}>Utilisateurs</Button>}
      editableFields={[
        { name: "name", label: "Nom de l’entreprise", required: true, maxLength: 255 },
        { name: "slug", label: "Identifiant URL", required: true, maxLength: 50 },
        { name: "country", label: "Code pays", default: "BI", required: true, maxLength: 2 },
        { name: "default_currency", label: "Devise", default: "BIF", required: true, maxLength: 3 },
        { name: "is_active", label: "Entreprise active", type: "boolean", default: true },
      ]}
    />
  );
}
