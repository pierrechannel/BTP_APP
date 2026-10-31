import { FormTextField as TextField } from './FormTextField';
import { useEffect, useState } from "react";
import { Alert, Box, Checkbox, Divider, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection, versionHeaders } from "../api/workspace";
import { useWorkspace } from "../state/workspace";

export function InspectionChecklist({ inspection, revision }: { inspection: ApiRecord; revision: number }) {
  const { can } = useWorkspace();
  const [items, setItems] = useState<ApiRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | number | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    fetchCollection("/qhse/inspection-items/", { inspection: inspection.id }, controller.signal)
      .then(setItems).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [inspection.id, revision]);
  const save = async (item: ApiRecord, changes: Record<string, unknown>) => {
    setBusy(item.id); setError("");
    try {
      const { data } = await api.patch(`/qhse/inspection-items/${item.id}/`, changes, { headers: versionHeaders(item) });
      setItems((rows) => rows.map((row) => row.id === item.id ? data : row));
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(null); }
  };
  const readOnly = inspection.status === "completed" || !can("qhse", "update");
  return <Paper variant="outlined"><Box px={3} py={2.5}><Typography variant="h6">Points de contrôle</Typography>
    <Typography variant="body2" color="text.secondary">Cochez les points conformes. Les autres points seront comptés comme non conformes.</Typography></Box><Divider />
    {loading && <LinearProgress />}{error && <Alert severity="error">{error}</Alert>}
    {!loading && !items.length && <Typography p={3} color="text.secondary">Aucun point de contrôle.</Typography>}
    {items.map((item) => <Stack key={`${item.id}:${item.version}`} direction={{ xs: "column", sm: "row" }} gap={2} alignItems={{ sm: "center" }} sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
      <Stack direction="row" alignItems="center" sx={{ flex: 1 }}><Checkbox inputProps={{ "aria-label": `Conforme : ${item.label}` }} checked={Boolean(item.is_compliant)} disabled={readOnly || busy !== null}
        onChange={(_, checked) => save(item, { is_compliant: checked })} /><Typography variant="body2">{String(item.label)}</Typography></Stack>
      <TextField size="small" label="Observation" defaultValue={item.comment ?? ""} disabled={readOnly || busy !== null} sx={{ width: { xs: "100%", sm: 280 } }}
        onBlur={(event) => { if (event.target.value !== String(item.comment ?? "")) void save(item, { comment: event.target.value }); }} />
    </Stack>)}
  </Paper>;
}
