import { Chip } from "@mui/material";
import { statusLabels } from "../api/workspace";

export function StatusBadge({ value }: { value: unknown }) {
  const status = String(value ?? "");
  const color = ["done", "completed", "validated", "approved", "paid", "applied", "operationnel", "resolved"].includes(status) ? "success"
    : ["blocked", "failed", "rejected", "refused", "en_panne", "hors_service"].includes(status) ? "error"
      : ["pending", "submitted", "review", "suspended", "declared", "maintenance"].includes(status) ? "warning"
        : ["in_progress", "preparation", "actions"].includes(status) ? "primary" : "default";
  return <Chip size="small" color={color} label={statusLabels[status] ?? (status || "—")} variant="outlined" sx={{ fontWeight: 600, borderRadius: 1.5 }} />;
}
