import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Breadcrumbs, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Link, LinearProgress,
  MenuItem, Paper, Skeleton, Stack, TextField, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { downloadFile, errorMessage, FieldInfo, fieldLabel, formatValue, Metadata, notifyChange, recordTitle, versionHeaders } from "../api/workspace";
import { allResources, BusinessAction, ResourceConfig } from "../resources";
import { useWorkspace } from "../state/workspace";
import { useAuth } from "../state/auth";
import { RecordEditor } from "../components/RecordEditor";
import { StatusBadge } from "../components/StatusBadge";
import { RelatedValue } from "../components/RelatedValue";
import { InspectionChecklist } from "../components/InspectionChecklist";

const transitions: Record<string, Array<[string, string]>> = {
  study: [["preparation", "Préparation"]], preparation: [["in_progress", "Démarrer le chantier"], ["suspended", "Suspendre"]],
  in_progress: [["suspended", "Suspendre"], ["handover", "Passer en réception"]], suspended: [["in_progress", "Reprendre"], ["closed", "Clôturer"]],
  handover: [["closed", "Clôturer"]], closed: [],
};

export function RecordDetailPage({ resource }: { resource: ResourceConfig }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, projectId, projects } = useWorkspace();
  const { user } = useAuth();
  const [record, setRecord] = useState<ApiRecord | null>(null);
  const [fields, setFields] = useState<Record<string, FieldInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [action, setAction] = useState<BusinessAction | null>(null);
  const [actionValue, setActionValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [stock, setStock] = useState<Array<{ location: string; name: string; quantity: string; unit: string }>>([]);
  const endpoint = `${resource.endpoint}${id}/`;
  const locked = (["budget.expense", "budget.invoice", "progress.dailyreport"].includes(resource.model) && ["validated", "paid"].includes(String(record?.status)))
    || (resource.model === "workforce.timeentry" && Boolean(record?.is_validated))
    || (resource.model === "qhse.inspection" && record?.status === "completed");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    Promise.all([api.get<ApiRecord>(endpoint, { signal: controller.signal }), api.options<Metadata>(endpoint, { signal: controller.signal })])
      .then(([record, metadata]) => { setRecord(record.data); setFields(metadata.data.fields ?? {}); })
      .catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, revision]);
  useEffect(() => {
    if (resource.model !== "resources.material") return;
    const controller = new AbortController();
    api.get(`${endpoint}stock/`, { signal: controller.signal, params: projectId ? { project: projectId } : {} })
      .then(({ data }) => setStock(data)).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); });
    return () => controller.abort();
  }, [endpoint, projectId, revision]);

  const execute = async () => {
    if (!record) return;
    setBusy(true); setError("");
    try {
      if (deleting) {
        await api.delete(endpoint, { headers: versionHeaders(record) });
        notifyChange(); navigate(resource.path, { replace: true }); return;
      }
      if (!action) return;
      if (action.download) {
        await downloadFile(`${endpoint}${action.endpoint}/`, String(record.original_name ?? `rapport-${id}.json`));
      } else {
        const body: Record<string, unknown> = action.field ? { [action.field]: action.field === "progress_percent" ? Number(actionValue) : actionValue } : {};
        if (action.endpoint === "run") {
          const project = projects.find((row) => String(row.id) === projectId);
          body.parameters = project ? { project: project.code } : {};
        }
        const response = await api.post(`${endpoint}${action.endpoint}/`, body, { headers: versionHeaders(record) });
        notifyChange();
        if (action.endpoint === "run") {
          navigate(`/reports/runs/${response.data.id}`); return;
        }
        setRecord(response.data); setRevision((value) => value + 1); setMessage("L’opération a été effectuée.");
      }
      setAction(null);
    } catch (error) { setError(errorMessage(error)); setAction(null); setDeleting(false); }
    finally { setBusy(false); }
  };
  const choices = action?.endpoint === "transition-status" ? transitions[String(record?.status)] ?? [] : action?.choices;
  const actions = (resource.actions ?? []).filter((action) => can(resource.group, action.permission)
    && (!action.visible || (record && action.visible(record)))
    && !(resource.model === "documents.approvalworkflow" && String(record?.reviewer) !== String(user?.id))
    && !(action.endpoint === "transition-status" && record?.status === "closed"));
  const related = resource.model === "projects.project"
    ? ["planning.task", "projects.lot", "progress.dailyreport"].map((model) => allResources.find((item) => item.model === model)!).filter((item) => can(item.group)) : [];

  return <Stack spacing={3}>
    <Breadcrumbs><Link component={RouterLink} to="/" underline="hover">Vue d’ensemble</Link>
      <Link component={RouterLink} to={resource.path} underline="hover">{resource.label}</Link><Typography color="text.primary">Fiche</Typography></Breadcrumbs>
    {loading ? <><Skeleton width="60%" height={70} /><Skeleton variant="rounded" height={320} /></> : <>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
        <Box><Typography variant="overline" color="primary.main">{resource.singular}</Typography><Typography variant="h4">{record ? recordTitle(record) : "Fiche indisponible"}</Typography>
          <Stack direction="row" alignItems="center" spacing={2} mt={1}>{Boolean(record?.status || record?.state) && <StatusBadge value={record?.status ?? record?.state} />}
            <Typography variant="body2" color="text.secondary">{record?.updated_at ? `Mis à jour le ${formatValue(record.updated_at, "updated_at")}` : resource.description}</Typography></Stack></Box>
        <Stack direction="row" spacing={1} alignSelf="flex-start"><Button startIcon={<ArrowBackIcon />} onClick={() => navigate(resource.path)}>Retour</Button>
          {record && !locked && !resource.readOnly && !resource.immutable && can(resource.group, "update") && <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)}>Modifier</Button>}
        </Stack>
      </Stack>
      {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => setRevision((value) => value + 1)}>Actualiser</Button>}>{error}</Alert>}
      {record && <>
        {resource.model === "qhse.inspection" && <InspectionChecklist inspection={record} revision={revision} />}
        {resource.model === "resources.material" && <Paper variant="outlined" sx={{ p: 3 }}><Typography variant="h6" mb={2}>Stock par dépôt</Typography>
          {!stock.length && <Typography color="text.secondary">Créez un dépôt, puis enregistrez un mouvement de stock.</Typography>}
          <Stack direction="row" gap={2} flexWrap="wrap">{stock.map((item) => <Box key={item.location} sx={{ p: 2, bgcolor: "#f4f7f0", borderRadius: 2, minWidth: 160 }}><Typography variant="caption" color="text.secondary">{item.name}</Typography><Typography variant="h5">{Number(item.quantity).toLocaleString("fr-FR")} <Typography component="span" variant="body2">{item.unit}</Typography></Typography></Box>)}</Stack>
        </Paper>}
        {actions.length > 0 && <Paper variant="outlined" sx={{ p: 2 }}><Stack direction="row" gap={1.5} flexWrap="wrap">{actions.map((item, index) => <Button key={item.endpoint} variant={index === 0 ? "contained" : "outlined"} onClick={() => {
          setAction(item); setActionValue(item.field === "progress_percent" ? String(record.progress_percent ?? 0) : "");
        }}>{item.label}</Button>)}</Stack></Paper>}
        {typeof record.progress_percent === "number" && <Paper variant="outlined" sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between" mb={1.5}><Typography fontWeight={600}>Avancement de la tâche</Typography><Typography fontWeight={700}>{record.progress_percent} %</Typography></Stack>
          <LinearProgress variant="determinate" value={record.progress_percent} sx={{ height: 10, borderRadius: 5 }} /></Paper>}
        <Paper variant="outlined"><Box sx={{ px: 3, py: 2.5 }}><Typography variant="h6">Informations</Typography></Box><Divider />
          <Box sx={{ p: 3, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
            {Object.entries(record).filter(([name, value]) => !["id", "tenant", "deleted_at", "created_by", "updated_by", "version", "created_at", "updated_at", "file", "result_file", "checksum"].includes(name)
              && value !== null && value !== "").map(([name, value]) => <Box key={name} sx={typeof value === "object" || ["work_done", "description", "difficulties", "body"].includes(name) ? { gridColumn: "1 / -1" } : undefined}>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: .75 }}>{fieldLabel(name)}</Typography>
              {fields[name]?.related_model ? <RelatedValue model={fields[name].related_model!} id={value} /> : ["status", "state"].includes(name) ? <StatusBadge value={value} />
                : <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: typeof value === "object" ? "monospace" : undefined }}>{formatValue(value, name)}</Typography>}
            </Box>)}
          </Box>
        </Paper>
        {related.length > 0 && <Paper variant="outlined" sx={{ p: 3 }}><Typography variant="h6" mb={2}>Poursuivre sur ce chantier</Typography><Stack direction="row" spacing={1} flexWrap="wrap">
          {related.map((item) => <Button key={item.model} component={RouterLink} to={`${item.path}?project=${record.id}`} variant="outlined">{item.label}</Button>)}</Stack></Paper>}
        {!resource.readOnly && !resource.immutable && can(resource.group, "delete") && <Box><Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setDeleting(true)}>Supprimer cet élément</Button></Box>}
        <RecordEditor resource={resource} record={record} open={editing} onClose={() => setEditing(false)} onSaved={(row) => { setRecord(row); setRevision((value) => value + 1); setMessage("Les modifications ont été enregistrées."); }} />
      </>}
    </>}
    <Dialog open={Boolean(action) || deleting} onClose={busy ? undefined : () => { setAction(null); setDeleting(false); }} fullWidth maxWidth="sm">
      <DialogTitle>{deleting ? "Supprimer cet élément ?" : action?.label}</DialogTitle>
      <DialogContent><Typography color="text.secondary" sx={{ mb: 2 }}>{deleting ? "L’élément et ses données associées seront retirés des listes. Les données seront conservées dans l’historique." : "Cette opération sera enregistrée sur le chantier."}</Typography>
        {action?.field && (choices ? <TextField select fullWidth label="Nouvel état" value={actionValue} onChange={(event) => setActionValue(event.target.value)}>{choices.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
          : <TextField autoFocus fullWidth label="Avancement (%)" type="number" value={actionValue} inputProps={{ min: 0, max: 100, step: 1 }} onChange={(event) => setActionValue(event.target.value)} />)}
      </DialogContent><DialogActions sx={{ p: 3 }}><Button disabled={busy} onClick={() => { setAction(null); setDeleting(false); }}>Annuler</Button><Button variant="contained" color={deleting ? "error" : "primary"} disabled={busy || Boolean(action?.field && actionValue === "")} onClick={execute}>{busy ? "Traitement…" : deleting ? "Supprimer" : "Confirmer"}</Button></DialogActions>
    </Dialog>
  </Stack>;
}
