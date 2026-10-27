import { PlatformTable } from "../../platform/PlatformTable";

export function PlatformAuditPage() {
  return (
    <PlatformTable
      title="Audit"
      subtitle="Actions sensibles de l’entreprise sélectionnée."
      endpoint="/auth/audit-logs/"
      columns={["created_at", "action", "resource_type", "resource_id", "ip_address", "correlation_id"]}
    />
  );
}
