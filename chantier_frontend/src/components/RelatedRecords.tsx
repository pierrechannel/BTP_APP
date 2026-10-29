import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Alert, Box, Button, Divider, LinearProgress, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection, fieldLabel, formatValue, recordTitle } from "../api/workspace";
import { relatedWorkflows } from "../api/workflows";
import { resourceByModel } from "../resources";
import { useWorkspace } from "../state/workspace";
import { useAuth } from "../state/auth";
import { RecordEditor } from "./RecordEditor";
import { StatusBadge } from "./StatusBadge";
import { RelatedValue } from "./RelatedValue";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { dataTableSx, tableLocale } from "./DataTableTools";

const relationModels: Record<string, string> = {
  project: "projects.project", worker: "workforce.worker", equipment: "equipment.equipment",
  material: "resources.material", task: "planning.task", certification: "workforce.certification",
  reviewer: "accounts.user", user: "accounts.user", role: "accounts.role", document: "documents.document",
  predecessor: "planning.task", successor: "planning.task", template: "reports.reporttemplate",
};

export function RelatedRecords({ model, record, revision, onlyModel }: { model: string; record: ApiRecord; revision: number; onlyModel?: string }) {
  const { can } = useWorkspace();
  const { user, tenantId } = useAuth();
  const navigate = useNavigate();
  const links = relatedWorkflows(model).filter((link) => {
    const resource = resourceByModel[link.model];
    return resource && (onlyModel ? link.model === onlyModel : link.model !== "projects.lot") && can(resource.group);
  });
  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localRevision, setRevision] = useState(0);
  const [limit, setLimit] = useState(8);
  const link = links[Math.min(tab, Math.max(0, links.length - 1))];
  const resource = link ? resourceByModel[link.model] : undefined;
  const field = link?.field;
  useEffect(() => {
    if (!resource || !field) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setRows([]); setLimit(8);
    fetchCollection(resource.endpoint, { [field]: record.id }, controller.signal)
      .then(setRows).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource?.endpoint, field, record.id, revision, localRevision]);
  if (!resource || !field) return null;
  const defaults: Record<string, unknown> = { [field]: record.id };
  if (record.project) defaults.project = record.project;
  if (record.currency) defaults.currency = record.currency;
  if (model === "equipment.maintenanceplan") defaults.equipment = record.equipment;
  const documentAdmin = user?.is_superuser || user?.memberships.some((item) => item.tenant.id === tenantId && item.role === "admin" && item.is_active);
  const sharingAllowed = resource.model !== "documents.documentacl" || documentAdmin || String(record.created_by) === String(user?.id);
  const canCreate = sharingAllowed && !resource.readOnly && can(resource.group, "create") && (!resource.platformWrite || user?.is_superuser);
  const columns: GridColDef[] = resource.columns.filter((name) => name !== field).slice(0, 5).map((name) => ({
    field: name, headerName: fieldLabel(name), minWidth: 140, flex: 1,
    renderCell: ({ value }) => relationModels[name] ? <RelatedValue model={name === "template" && resource.group === "qhse" ? "qhse.inspectiontemplate" : relationModels[name]} id={value} />
      : ["status", "state"].includes(name) ? <StatusBadge value={value} />
        : <Typography variant="body2" noWrap title={formatValue(value, name)}>{formatValue(value, name)}</Typography>,
  }));
  columns.push({ field: "open", headerName: "Actions", sortable: false, filterable: false, width: 110, renderCell: ({ row }) => <Button component={RouterLink} to={`${resource.path}/${row.id}`} size="small" aria-label={`Ouvrir ${recordTitle(row)}`} onClick={(event) => event.stopPropagation()}>Ouvrir</Button> });
  return <Paper variant="outlined" sx={{ overflow: "hidden" }}>
    <Box px={{ xs: 2, sm: 3 }} pt={2.5}><Typography variant="h6">{onlyModel ? resource.label : "Données associées"}</Typography>
      <Typography variant="body2" color="text.secondary" mb={1}>Consultez et complétez ce dossier sans perdre son contexte.</Typography>
      {!onlyModel && <Tabs value={Math.min(tab, links.length - 1)} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Données associées">
        {links.map((item) => <Tab key={`${item.model}:${item.field}`} label={item.label ?? (item.model === "workforce.assignment" ? "Affectations du personnel" : item.model === "equipment.equipmentassignment" ? "Affectations du matériel" : resourceByModel[item.model].label)} />)}
      </Tabs>}
    </Box><Divider />
    <Box p={{ xs: 2, sm: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} mb={2} flexWrap="wrap">
        <Typography variant="subtitle2">{resource.label}{!loading && ` · ${rows.length}`}</Typography>
        {canCreate && <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing(true)}>Ajouter · {resource.singular}</Button>}
      </Stack>
      {loading && <LinearProgress aria-label="Chargement des données associées" />}
      {error && <Alert severity="error" action={<Button onClick={() => setRevision((value) => value + 1)}>Réessayer</Button>}>{error}</Alert>}
      {!loading && !error && !rows.length && <Typography color="text.secondary" py={2}>Aucun élément associé pour le moment.</Typography>}
      {rows.length > 0 && <Box sx={{ display: { xs: "none", md: "block" }, border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
        <DataGrid key={`${resource.model}:${field}`} rows={rows} columns={columns} autoHeight loading={loading} rowHeight={52} columnHeaderHeight={42} disableRowSelectionOnClick disableColumnFilter localeText={tableLocale}
          initialState={{ pagination: { paginationModel: { pageSize: 8, page: 0 } } }} pageSizeOptions={[8, 25, 50]}
          onRowClick={({ id }) => navigate(`${resource.path}/${id}`)} sx={{ ...dataTableSx, "& .MuiDataGrid-row": { cursor: "pointer" } }} />
      </Box>}
      <Stack divider={<Divider />} sx={{ display: { xs: "flex", md: "none" } }}>
        {rows.slice(0, limit).map((row) => <Stack key={row.id} direction={{ xs: "column", sm: "row" }} gap={2} py={1.5} alignItems={{ sm: "center" }}>
          <Box flex={1} minWidth={0}>
            <Button component={RouterLink} to={`${resource.path}/${row.id}`} sx={{ px: 0, justifyContent: "flex-start", textAlign: "left" }}>{recordTitle(row)}</Button>
            <Stack direction="row" gap={2} flexWrap="wrap">
              {resource.columns.filter((name) => ![field, "status", "state"].includes(name)).slice(0, 3).map((name) => <Box key={name}>
                <Typography variant="caption" color="text.secondary">{fieldLabel(name)} : </Typography>
                {relationModels[name]
                  ? <RelatedValue model={name === "template" && resource.group === "qhse" ? "qhse.inspectiontemplate" : relationModels[name]} id={row[name]} />
                  : <Typography variant="caption">{formatValue(row[name], name)}</Typography>}
              </Box>)}
            </Stack>
          </Box>
          {Boolean(row.status || row.state) && <StatusBadge value={row.status ?? row.state} />}
          <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate(`${resource.path}/${row.id}`)}>Ouvrir</Button>
        </Stack>)}
      </Stack>
      {rows.length > limit && <Button sx={{ display: { xs: "inline-flex", md: "none" } }} onClick={() => setLimit((value) => value + 8)}>Afficher davantage</Button>}
    </Box>
    <RecordEditor resource={resource} open={editing} defaults={defaults} fixedFields={[field]} onClose={() => setEditing(false)} onSaved={() => setRevision((value) => value + 1)} />
  </Paper>;
}
