import { PlatformTable } from "../../platform/PlatformTable";

export function PlatformAuditPage() {
  return (
    <PlatformTable
      title="Audit"
      subtitle="Journal global des actions sensibles."
      endpoint="/auth/audit-logs/"
      columns={["created_at", "action", "resource_type", "resource_id", "ip_address", "correlation_id"]}
    />
  );
}
