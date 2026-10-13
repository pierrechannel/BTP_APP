import { PlatformTable } from "../../platform/PlatformTable";

export function PlatformTenantsPage() {
  return (
    <PlatformTable
      title="Tenants"
      subtitle="Organisations clientes de la plateforme."
      endpoint="/auth/tenants/"
      columns={["name", "slug", "country", "default_currency", "is_active"]}
    />
  );
}
