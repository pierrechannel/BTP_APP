import { JournalOverview } from '../components/JournalOverview';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { ProjectOverview } from '../components/ProjectOverview';
import { ExpenseReceipts, Receipt } from '../components/ExpenseReceipts';
import { InvoiceAttachment } from '../components/InvoiceAttachment';
import { financialAction } from '../api/financialActions';
import { FormTextField as TextField } from '../components/FormTextField';
import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Box, Breadcrumbs, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, LinearProgress,
  MenuItem, Paper, Skeleton, Stack, Tab, Tabs, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { downloadFile, errorMessage, FieldInfo, formatValue, Metadata, notifyChange, recordTitle, versionHeaders } from "../api/workspace";
import { resourceByModel, BusinessAction, ResourceConfig } from "../resources";
import { useWorkspace } from "../state/workspace";
import { useAuth } from "../state/auth";
import { RecordEditor } from "../components/RecordEditor";
import { StatusBadge } from "../components/StatusBadge";
import { InspectionChecklist } from "../components/InspectionChecklist";
import { RelatedRecords } from "../components/RelatedRecords";
import { PurchaseOrderLines } from "../components/PurchaseOrderLines";
import { BudgetSummary } from "../components/BudgetSummary";
import { PhotoPreview } from "../components/PhotoPreview";
import { DocumentPreview } from "../components/DocumentPreview";
import { ReportPreview } from "../components/ReportPreview";
import { isDeletionLocked, isRecordLocked, relatedWorkflows } from "../api/workflows";
import { DetailInformation, RecordTracking } from "../components/DetailInformation";
import RefreshIcon from "@mui/icons-material/Refresh";
import { BudgetWorkspace } from "../components/BudgetWorkspace";
import { RelatedValue } from "../components/RelatedValue";
import { BusinessExports } from "../components/BusinessExports";

const transitions: Record<string, Array<[string, string]>> = {
  study: [["preparation", "Préparation"]], preparation: [["in_progress", "Démarrer le chantier"], ["suspended", "Suspendre"]],
  in_progress: [["suspended", "Suspendre"], ["handover", "Passer en réception"]], suspended: [["in_progress", "Reprendre"], ["closed", "Clôturer"]],
  handover: [["closed", "Clôturer"]], closed: [],
};

export function RecordDetailPage({ resource }: { resource: ResourceConfig }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, projectId, projects } = useWorkspace();
  const { user, refreshMe } = useAuth();
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
  const [actionComment, setActionComment] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const [localSection, setLocalSection] = useState('overview');
  const section = ['budget.budget', 'projects.project'].includes(resource.model) ? params.get('tab') || 'overview' : localSection;
  const setSection = (value: string) => {
    if (['budget.budget', 'projects.project'].includes(resource.model)) setParams(current => { const next = new URLSearchParams(current); next.set('tab', value); return next; }, { replace: true });
    else setLocalSection(value);
  };
  const [relatedVisited, setRelatedVisited] = useState(false);
  const [stock, setStock] = useState<Array<{ location: string; name: string; quantity: string; unit: string }>>([]);
  const endpoint = `${resource.endpoint}${id}/`;
  useEffect(() => {
    if (resource.model !== "reports.reportrun" || !record || record.status !== "pending") return;
    const timer = window.setInterval(() => setRevision((value) => value + 1), 3000);
    return () => window.clearInterval(timer);
  }, [resource.model, record?.status, endpoint]);
  useEffect(() => { setLocalSection("overview"); setRelatedVisited(false); }, [endpoint]);
  const locked = record ? isRecordLocked(resource.model, record) : false;
  const deletionLocked = record ? isDeletionLocked(resource.model, record) : false;
  const writable = !resource.platformWrite || user?.is_superuser;
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("chantier:data-changed", refresh);
    return () => window.removeEventListener("chantier:data-changed", refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController(); if (!record || String(record.id) !== id) { setLoading(true); setRecord(null); } setError("");
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
    setBusy(true); setError(""); setActionError("");
    try {
      if (deleting) {
        await api.delete(endpoint, { headers: versionHeaders(record) });
        if (resource.group === "administration") await refreshMe().catch(() => {});
        notifyChange(); navigate(resource.path, { replace: true }); return;
      }
      if (!action) return;
      if (action.download) {
        await downloadFile(`${endpoint}${action.endpoint}/`, String(record.original_name ?? `rapport-${id}.json`));
      } else {
        const body: Record<string, unknown> = { ...action.payload, ...(action.field ? { [action.field]: action.field === "progress_percent" ? Number(actionValue) : actionValue } : {}) };
        if (action.comment) {
          if (action.endpoint === "mark-failed") body.error = { message: actionComment };
          else body.comment = actionComment;
        }
        if (action.endpoint === "run") {
          const project = projects.find((row) => String(row.id) === projectId);
          body.parameters = project ? { project: project.code } : {};
        }
        const response = await financialAction(`${endpoint}${action.endpoint}/`, body, versionHeaders(record));
        notifyChange();
        if (action.endpoint === "run") {
          navigate(`/reports/runs/${response.data.id}`); return;
        }
        setRecord(response.data); setRevision((value) => value + 1); setMessage("L’opération a été effectuée.");
      }
      setAction(null);
    } catch (error) { setActionError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const choices = action?.endpoint === "transition-status" && resource.model === "projects.project" ? transitions[String(record?.status)] ?? [] : action?.choices?.filter(([value]) => resource.model !== "resources.purchaseorder" || record?.status !== "partially_received" || value === "received");
  const actions = (resource.actions ?? []).filter((action) => !(resource.model === "reports.reportrun" && action.download) && can(resource.group, action.permission)
    && (!action.visible || (record && action.visible(record)))
    && !(resource.model === "documents.approvalworkflow" && String(record?.reviewer) !== String(user?.id))
    && !(action.endpoint === "transition-status" && record?.status === "closed"));
  const invalidProgress = action?.field === "progress_percent" && (!Number.isInteger(Number(actionValue)) || Number(actionValue) < 0 || Number(actionValue) > 100);
  const focused = ["resources.purchaseorder", "budget.budget", "projects.project"].includes(resource.model);
  const hasRelated = !["budget.budget", "progress.dailyreport"].includes(resource.model) && relatedWorkflows(resource.model).some((link) => resourceByModel[link.model] && can(resourceByModel[link.model].group));

  const actionButtons = record && <Stack direction="row" gap={1.5} flexWrap="wrap">{actions.map((item, index) => <Button key={`${item.endpoint}:${item.label}`} disabled={busy} variant={index === 0 && !item.download ? "contained" : "outlined"} aria-label={item.label} title={item.label} sx={resource.model === "progress.dailyreport" && item.download ? { minWidth: 38, px: 1 } : undefined} onClick={async () => {
          if (item.download) {
            setBusy(true); setError("");
            try { await downloadFile(`${endpoint}${item.endpoint}/`, String(record.original_name ?? (resource.model === "progress.photo" ? String(record.image ?? "photo.jpg").split("/").at(-1) : `rapport-${id}.${resource.model === "progress.dailyreport" ? "pdf" : "json"}`))); }
            catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
            return;
          }
          setAction(item); setActionError(""); setActionComment(""); setActionValue(item.field === "progress_percent" ? String(record.progress_percent ?? 0) : "");
        }}>{resource.model === "progress.dailyreport" && item.download ? <DownloadOutlinedIcon fontSize="small" /> : item.label}</Button>)}</Stack>;

  return <Stack spacing={2}>
    <BusinessExports model={resource.model} id={id} />
    <Breadcrumbs><Link component={RouterLink} to="/" underline="hover">Vue d’ensemble</Link>
      <Link component={RouterLink} to={resource.path} underline="hover">{resource.label}</Link><Typography color="text.primary">Fiche</Typography></Breadcrumbs>
    {loading ? <><Skeleton width="60%" height={70} /><Skeleton variant="rounded" height={320} /></> : <>
      <Paper variant="outlined" sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25 }}><Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} gap={1}>
        <Stack direction="row" gap={1.25} alignItems="center" minWidth={0}><Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", justifyContent: "center", width: 32, height: 32, bgcolor: "#e3eee0", color: "primary.main", borderRadius: 1, flexShrink: 0 }}>{resource.icon}</Box><Box minWidth={0}><Stack direction="row" gap={1.25} alignItems="baseline" flexWrap="wrap"><Typography variant="overline" color="primary.main" sx={{ fontSize: 10, lineHeight: 1.4 }}>Fiche · {resource.singular}</Typography><Typography component="h1" sx={{ fontWeight: 750, fontSize: { xs: 18, sm: 20 }, lineHeight: 1.3, overflowWrap: "anywhere" }}>{record ? recordTitle(record) : "Fiche indisponible"}</Typography></Stack>
          <Stack direction="row" alignItems="center" gap={1.25} mt={.25} flexWrap="wrap">{Boolean(record?.status || record?.state || record?.is_validated) && <StatusBadge value={record?.status ?? record?.state ?? "validated"} />}
            <Typography fontSize={11} color="text.secondary">{record?.updated_at ? `Mis à jour le ${formatValue(record.updated_at, "updated_at")}` : resource.description}</Typography>{record && focused && resource.model !== "projects.project" && <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" sx={{ fontSize: 12, "& .MuiTypography-root": { fontSize: 12 } }}>
        {record.project != null && <Box sx={{ display: "flex", alignItems: "center", gap: .5 }}><Typography variant="caption" color="text.secondary">Chantier</Typography><RelatedValue model="projects.project" id={record.project} /></Box>}
        {record.supplier != null && <Box sx={{ display: "flex", alignItems: "center", gap: .5 }}><Typography variant="caption" color="text.secondary">Fournisseur</Typography><RelatedValue model="resources.supplier" id={record.supplier} /></Box>}
        {record.ordered_at != null && <Box sx={{ display: "flex", alignItems: "center", gap: .5 }}><Typography variant="caption" color="text.secondary">Commandée le</Typography><Typography variant="body2">{formatValue(record.ordered_at, "ordered_at")}</Typography></Box>}
      </Stack>}</Stack></Box></Stack>
        <Stack direction="row" spacing={1} alignSelf={{ xs: "flex-start", md: "center" }}><Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate(resource.path)}>Retour</Button>
          {record && writable && !locked && !resource.readOnly && !resource.immutable && can(resource.group, "update") && <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)}>Modifier</Button>}
          <Button aria-label="Actualiser la fiche" onClick={() => setRevision((value) => value + 1)} sx={{ minWidth: 36, px: 1 }}><RefreshIcon fontSize="small" /></Button>
        </Stack>
      </Stack></Paper>
      {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
      {error && <Alert severity="error" action={<Button color="inherit" onClick={() => setRevision((value) => value + 1)}>Actualiser</Button>}>{error}</Alert>}
      {record && <>
        <Tabs value={section} onChange={(_, value) => { setSection(value); if (value === "related") setRelatedVisited(true); }} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Sections de la fiche">
          <Tab value="overview" label={resource.model === "reports.reportrun" ? "Rapport" : resource.model === "budget.budget" ? "Postes budgétaires" : resource.model === "resources.purchaseorder" ? "Lignes de commande" : "Vue d’ensemble"} id="detail-tab-overview" aria-controls="detail-overview" />
          {resource.model === "budget.budget" && <Tab value="expenses" label="Dépenses" />}
          {resource.model === "projects.project" && can("projects") && <Tab value="lots" label="Lots" id="detail-tab-lots" aria-controls="detail-lots" />}
          {focused && <Tab value="information" label="Informations" />}
          {hasRelated && <Tab value="related" label="Données associées" id="detail-tab-related" aria-controls="detail-related" />}
          <Tab value="tracking" label="Traçabilité" id="detail-tab-tracking" aria-controls="detail-tracking" />
        </Tabs>
        {locked && resource.model !== "progress.dailyreport" && <Alert severity="info">Cette fiche est finalisée. Ses informations ne peuvent plus être modifiées.{deletionLocked && " Sa suppression est également interdite."}</Alert>}
        {resource.model === "budget.budget" && <BudgetSummary record={record} revision={revision} />}
        {resource.model === "budget.budget" && <Box hidden={!["overview", "expenses"].includes(section)}><BudgetWorkspace budget={record} revision={revision} mode={section === "expenses" ? "expenses" : "lines"} /></Box>}
        <Stack id="detail-overview" role="tabpanel" aria-labelledby="detail-tab-overview" hidden={section !== "overview"} spacing={2} sx={{ display: section === "overview" ? "flex" : "none" }}>
        {resource.model === "projects.project" && <ProjectOverview project={record} revision={revision} />}
        {resource.model === "resources.purchaseorder" && <PurchaseOrderLines order={record} revision={revision} />}
        {resource.model === "budget.expense" && <ExpenseReceipts expenseId={String(record.id)} receipts={(record.receipts || []) as Receipt[]} />}
        {resource.model === "budget.invoice" && <InvoiceAttachment invoice={record} />}
        {resource.model === "progress.dailyreport" && <JournalOverview report={record} actions={actionButtons} />}
        {resource.model === "progress.photo" && <PhotoPreview record={record} />}
        {resource.model === "reports.reportrun" && <ReportPreview record={record} />}
        {["documents.document", "documents.documentversion"].includes(resource.model) && <DocumentPreview record={record} isVersion={resource.model === "documents.documentversion"} revision={revision} />}
        {resource.model === "qhse.inspection" && <InspectionChecklist inspection={record} revision={revision} />}
        {resource.model === "resources.material" && <Paper variant="outlined" sx={{ p: 3 }}><Typography variant="h6" mb={2}>Stock par dépôt</Typography>
          {!stock.length && <Typography color="text.secondary">Créez un dépôt, puis enregistrez un mouvement de stock.</Typography>}
          <Stack direction="row" gap={2} flexWrap="wrap">{stock.map((item) => <Box key={item.location} sx={{ p: 2, bgcolor: "#f4f7f0", borderRadius: 2, minWidth: 160 }}><Typography variant="caption" color="text.secondary">{item.name}</Typography><Typography variant="h5">{Number(item.quantity).toLocaleString("fr-FR")} <Typography component="span" variant="body2">{item.unit}</Typography></Typography></Box>)}</Stack>
        </Paper>}
        {resource.model !== "progress.dailyreport" && actions.length > 0 && <Paper variant="outlined" sx={{ p: 2 }}>{actionButtons}</Paper>}
        {typeof record.progress_percent === "number" && <Paper variant="outlined" sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between" mb={1.5}><Typography fontWeight={600}>Avancement de la tâche</Typography><Typography fontWeight={700}>{record.progress_percent} %</Typography></Stack>
          <LinearProgress variant="determinate" value={record.progress_percent} sx={{ height: 10, borderRadius: 5 }} /></Paper>}
        {!focused && !["reports.reportrun", "progress.dailyreport"].includes(resource.model) && <DetailInformation record={record} model={resource.model} fields={fields} />}
        </Stack>
        {focused && <Box hidden={section !== "information"}><DetailInformation record={record} model={resource.model} fields={fields} /></Box>}
        {resource.model === "projects.project" && can("projects") && section === "lots" && <Box id="detail-lots" role="tabpanel" aria-labelledby="detail-tab-lots"><RelatedRecords model={resource.model} record={record} revision={revision} onlyModel="projects.lot" /></Box>}
        {hasRelated && <Box id="detail-related" role="tabpanel" aria-labelledby="detail-tab-related" hidden={section !== "related"}>{(relatedVisited || section === 'related') && <RelatedRecords model={resource.model} record={record} revision={revision} />}</Box>}
        <Stack id="detail-tracking" role="tabpanel" aria-labelledby="detail-tab-tracking" hidden={section !== "tracking"} spacing={2} sx={{ display: section === "tracking" ? "flex" : "none" }}>
          <RecordTracking record={record} />
          {writable && !deletionLocked && !resource.readOnly && !resource.immutable && can(resource.group, "delete") && <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="subtitle2" fontWeight={700}>Gestion de la fiche</Typography><Typography variant="body2" color="text.secondary" my={1}>La suppression retire cet élément des listes et conserve son historique.</Typography><Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={() => { setDeleting(true); setActionError(""); }}>Supprimer cet élément</Button></Paper>}
        </Stack>
        <RecordEditor resource={resource} record={record} open={editing} onClose={() => setEditing(false)} onSaved={(row) => { setRecord(row); setRevision((value) => value + 1); setMessage("Les modifications ont été enregistrées."); }} />
      </>}
    </>}
    <Dialog open={Boolean(action) || deleting} onClose={busy ? undefined : () => { setAction(null); setDeleting(false); }} fullWidth maxWidth="sm">
      <DialogTitle>{deleting ? "Supprimer cet élément ?" : action?.label}</DialogTitle>
      <DialogContent><Typography color="text.secondary" sx={{ mb: 2 }}>{deleting ? "L’élément et ses données associées seront retirés des listes. Les données seront conservées dans l’historique." : "Cette opération sera enregistrée sur le chantier."}</Typography>
        {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
        {resource.model === "resources.purchaseorder" && <Alert severity="info" sx={{ mb: 2 }}>Le suivi de statut ne crée aucun mouvement de stock et n’envoie aucun e-mail. Une commande envoyée ne peut plus être modifiée.</Alert>}
        {action?.endpoint === "run" && <Alert severity="info" sx={{ mb: 2 }}>Périmètre : {projectId ? String(projects.find((row) => String(row.id) === projectId)?.name ?? "Chantier sélectionné") : "Tous les chantiers accessibles"}.</Alert>}
        {action?.field && (choices ? <TextField select fullWidth label="Nouvel état" value={actionValue} onChange={(event) => setActionValue(event.target.value)}>{choices.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
          : <TextField autoFocus fullWidth label="Avancement (%)" type="number" value={actionValue} error={Boolean(invalidProgress)} helperText={invalidProgress ? "Saisissez un entier entre 0 et 100." : ""} inputProps={{ min: 0, max: 100, step: 1 }} onChange={(event) => setActionValue(event.target.value)} />)}
        {action?.comment && <TextField fullWidth multiline minRows={3} required={action.endpoint === "correction"} label={action.endpoint === "correction" ? "Motif de correction (obligatoire)" : action.endpoint === "mark-failed" ? "Motif de l’échec" : "Commentaire (facultatif)"} value={actionComment} onChange={(event) => setActionComment(event.target.value)} />}
      </DialogContent><DialogActions sx={{ p: 3 }}><Button disabled={busy} onClick={() => { setAction(null); setDeleting(false); }}>Annuler</Button><Button variant="contained" color={deleting ? "error" : "primary"} disabled={busy || Boolean(invalidProgress) || Boolean(action?.field && actionValue === "") || Boolean(["mark-failed", "correction"].includes(action?.endpoint || "") && !actionComment.trim())} onClick={execute}>{busy ? "Traitement…" : deleting ? "Supprimer" : "Confirmer"}</Button></DialogActions>
    </Dialog>
  </Stack>;
}
