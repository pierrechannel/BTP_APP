import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Chip, IconButton, InputAdornment, LinearProgress, MenuItem, Paper, Skeleton, Stack, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";
import { useAuth } from "../state/auth";
import { ResourceFilters } from "../components/ResourceFilters";
import { api } from "../api/client";
import { ApiRecord, Paginated } from "../api/types";
import { errorMessage, FieldInfo, fieldLabel, formatValue, Metadata, pageEndpoint, recordTitle, statusLabels } from "../api/workspace";
import { allResources, ResourceConfig, resources } from "../resources";
import { useWorkspace } from "../state/workspace";
import { RecordEditor } from "../components/RecordEditor";
import { StatusBadge } from "../components/StatusBadge";
import { RelatedValue } from "../components/RelatedValue";
import { CursorTableToolbar, dataTableSx, tableLocale } from "../components/DataTableTools";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { RecordQuickView } from "../components/RecordQuickView";
import { isRecordLocked } from "../api/workflows";

export function ResourcePage({ resource }: { resource: ResourceConfig }) {
  const navigate = useNavigate();
  const { projectId, setProjectId, projects, can } = useWorkspace();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [fields, setFields] = useState<Record<string, FieldInfo>>({});
  const [filterNames, setFilterNames] = useState<string[]>([]);
  const [searchable, setSearchable] = useState(true);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState<{ next: string | null; previous: string | null }>({ next: null, previous: null });
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ApiRecord | undefined>();
  const [preview, setPreview] = useState<ApiRecord | null>(null);
  const startCreate = () => { setEditingRecord(undefined); setEditor(true); };
  const [view, setView] = useState(resource.group === "projects" && resource.path === "/projects" ? "cards" : "table");
  const [message, setMessage] = useState("");
  const groupResources = allResources.filter((item) => item.group === resource.group && (can(item.group) || can(item.group, "create")));
  const root = resources.find((item) => item.group === resource.group)!;
  const allowCreate = !resource.readOnly && can(resource.group, "create") && (!resource.platformWrite || user?.is_superuser);
  const statusField = resource.columns.includes("status") ? "status" : resource.columns.includes("state") ? "state" : "";
  const resetPage = useCallback(() => { setPageUrl(null); setPageNumber(1); }, []);
  useEffect(resetPage, [projectId, resetPage]);

  useEffect(() => {
    const requested = params.get("project");
    if (requested && projects.some((project) => String(project.id) === requested)) {
      setProjectId(requested); const next = new URLSearchParams(params); next.delete("project"); setParams(next, { replace: true });
    }
  }, [params, projects]);
  useEffect(() => {
    const controller = new AbortController();
    api.options<Metadata>(resource.endpoint, { signal: controller.signal }).then(({ data }) => {
      setFields(data.fields ?? {}); setSearchable(data.search_fields === undefined || data.search_fields.length > 0);
      setFilterNames((data.filters ?? []).filter((name) => name !== "project" && name !== statusField));
    }).catch(() => {});
    return () => controller.abort();
  }, [resource.endpoint]);

  useEffect(() => { const timeout = setTimeout(() => { setSearch(query.trim()); resetPage(); }, 350); return () => clearTimeout(timeout); }, [query, resetPage]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api.get<Paginated<ApiRecord>>(pageUrl ?? resource.endpoint, {
      signal: controller.signal,
      params: pageUrl ? undefined : { search: searchable ? search || undefined : undefined, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")), ...(resource.projectScoped && projectId ? { project: projectId } : {}), ...(status && statusField ? { [statusField]: status } : {}) },
    }).then(({ data }) => {
      setRecords(data.results); setPage({ next: data.next, previous: data.previous });
    }).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource.endpoint, projectId, search, status, filters, searchable, pageUrl, revision]);

  const columns: GridColDef[] = resource.columns.map((name, index) => ({
    field: name, headerName: fieldLabel(name), flex: index < 2 ? 1.4 : 1, minWidth: name === "name" || name === "title" ? 220 : 150,
    sortable: false,
    renderCell: ({ value, row }) => {
      if (fields[name]?.related_model) return <RelatedValue model={fields[name].related_model!} id={value} />;
      if (["status", "state"].includes(name)) return <StatusBadge value={value} />;
      if (name === "progress_percent") return <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: "100%" }}>
        <LinearProgress variant="determinate" value={Number(value)} sx={{ flex: 1, height: 6, borderRadius: 4 }} /><Typography variant="caption">{String(value)} %</Typography>
      </Stack>;
      if (name === "project") return projects.find((project) => String(project.id) === String(value))?.name as string ?? "—";
      return <Typography variant="body2" noWrap fontWeight={index === 0 ? 600 : 400} color={index === 0 ? "text.primary" : "text.secondary"} title={formatValue(value, name)}>
        {formatValue(value, name)}{name.includes("amount") && row.currency ? ` ${row.currency}` : ""}</Typography>;
    },
  }));
  columns.push({ field: "open", headerName: "Actions", width: 106, sortable: false, filterable: false, disableExport: true, hideable: false,
    renderCell: ({ row }) => <Stack direction="row" gap={.5} onClick={(event) => event.stopPropagation()}>
      <Tooltip title="Voir le détail"><IconButton aria-label={`Voir ${recordTitle(row)}`} size="small" onClick={() => setPreview(row)}><VisibilityOutlinedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
      {!resource.readOnly && !resource.immutable && (!resource.platformWrite || user?.is_superuser) && can(resource.group, "update") && !isRecordLocked(resource.model, row) && <Tooltip title="Modifier"><IconButton aria-label={`Modifier ${recordTitle(row)}`} size="small" onClick={() => { setEditingRecord(row); setEditor(true); }}><EditOutlinedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>}
    </Stack> });
  const availableStatuses = [...new Set([
    ...(fields[statusField]?.choices ?? []).map((choice) => String(choice.value)),
    ...(resource.model === "planning.task" ? ["todo", "in_progress", "blocked", "done", "cancelled"] : []),
    ...(resource.model === "projects.project" ? ["study", "preparation", "in_progress", "suspended", "handover", "closed"] : []),
    ...records.map((record) => String(record[statusField] ?? "")).filter(Boolean), ...(status ? [status] : []),
  ])];
  const project = projects.find((item) => String(item.id) === projectId);
  const filterCount = Object.values(filters).filter(Boolean).length;
  const hasFilters = Boolean(search || status || filterCount);
  const clearFilters = () => { setQuery(""); setStatus(""); setFilters({}); resetPage(); };

  return <Stack spacing={2} sx={{ bgcolor: "background.paper", p: { xs: 2, md: 2.5 }, borderRadius: 1, boxShadow: "0 1px 4px #103d2408" }}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2}>
      <Box><Typography variant="overline" color="primary.main">ESPACE {root.label.toUpperCase()}</Typography>
        <Typography variant="h4" sx={{ fontSize: { xs: 20, md: 23 } }}>{resource.label}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>{resource.description}</Typography></Box>
      {allowCreate && <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, whiteSpace: "nowrap" }}>Créer · {resource.singular}</Button>}
    </Stack>
    {groupResources.length > 1 && <Tabs value={resource.path} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Sections du module" sx={{ borderBottom: "1px solid", borderColor: "divider", minHeight: 44 }}>
      {groupResources.map((item) => <Tab key={item.path} component={RouterLink} to={item.path} value={item.path} label={item.tabLabel ?? item.label} sx={{ minHeight: 44 }} />)}
    </Tabs>}
    {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => setRevision((value) => value + 1)}>Réessayer</Button>}>{error}</Alert>}
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems={{ sm: "center" }}>
        {searchable && <TextField size="small" placeholder={`Rechercher dans ${resource.label.toLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)}
          inputProps={{ "aria-label": "Rechercher" }} sx={{ width: { xs: "100%", sm: 340 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />}
        {statusField && <TextField select size="small" label="Statut" value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }} sx={{ minWidth: 165 }}>
          <MenuItem value="">Tous les statuts</MenuItem>{availableStatuses.map((value) => <MenuItem key={value} value={value}>{statusLabels[value] ?? value}</MenuItem>)}
        </TextField>}
        <Box sx={{ flex: 1 }} />
        {filterNames.length > 0 && <Button startIcon={<FilterListIcon />} variant={filtersOpen || filterCount ? "outlined" : "text"} onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen}>Filtres{filterCount ? ` (${filterCount})` : ""}</Button>}
        {hasFilters && <Button size="small" onClick={clearFilters}>Réinitialiser</Button>}
        {resource.projectScoped && project && <Chip label={String(project.name)} size="small" variant="outlined" color="primary" />}
        <Stack direction="row"><Tooltip title="Vue tableau"><IconButton aria-label="Vue tableau" color={view === "table" ? "primary" : "default"} onClick={() => setView("table")}><TableRowsOutlinedIcon /></IconButton></Tooltip>
          <Tooltip title="Vue cartes"><IconButton aria-label="Vue cartes" color={view === "cards" ? "primary" : "default"} onClick={() => setView("cards")}><ViewModuleOutlinedIcon /></IconButton></Tooltip>
          <Tooltip title="Actualiser"><IconButton aria-label="Actualiser" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshIcon /></IconButton></Tooltip></Stack>
      </Stack>
      {filtersOpen && <ResourceFilters names={filterNames} fields={fields} values={filters} onChange={(name, value) => { setFilters((current) => ({ ...current, [name]: value })); resetPage(); }} />}
    </Paper>
    {!loading && !error && !records.length ? <Paper variant="outlined" sx={{ py: 8, px: 3, textAlign: "center" }}>
      <Box sx={{ display: "inline-flex", p: 2, bgcolor: "primary.50", borderRadius: 3, color: "primary.main", mb: 2 }}>{resource.icon}</Box>
      <Typography variant="h6">{hasFilters ? "Aucun résultat" : `Tout commence ici`}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{hasFilters ? "Essayez un autre filtre ou une autre recherche." : `Ajoutez votre premier élément dans ${resource.label.toLowerCase()}.`}</Typography>
      {hasFilters ? <Button onClick={clearFilters}>Effacer les filtres</Button>
        : allowCreate && <Button startIcon={<AddIcon />} variant="contained" onClick={startCreate}>Créer · {resource.singular}</Button>}
    </Paper> : view === "cards" ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" }, gap: 2.5 }}>
      {loading ? [0, 1, 2].map((item) => <Skeleton key={item} variant="rounded" height={210} />) : records.map((record) => <Paper key={record.id} component={RouterLink} to={`${resource.path}/${record.id}`} variant="outlined"
        sx={{ p: 3, textDecoration: "none", color: "inherit", transition: "border-color .2s, transform .2s", '&:hover': { borderColor: "primary.main", transform: "translateY(-3px)" } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}><Box sx={{ color: "primary.main", p: 1, bgcolor: "#edf5f1", borderRadius: 2 }}>{resource.icon}</Box>
          {Boolean(record.status || record.state) && <StatusBadge value={record.status ?? record.state} />}</Stack>
        <Typography variant="h6" noWrap>{recordTitle(record)}</Typography>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 2 }}>{String(record.client_name ?? record.description ?? record.code ?? resource.singular)}</Typography>
        {typeof record.progress_percent === "number" && <LinearProgress variant="determinate" value={record.progress_percent} sx={{ mb: 2, borderRadius: 4, height: 6 }} />}
        <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="caption" color="text.secondary">{record.planned_end_date ? `Échéance : ${formatValue(record.planned_end_date, "planned_end_date")}` : "Voir la fiche"}</Typography><ArrowForwardIcon fontSize="small" /></Stack>
      </Paper>)}
    </Box> : <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <DataGrid rows={records} columns={columns} loading={loading} autoHeight hideFooter disableColumnFilter disableRowSelectionOnClick rowHeight={52} columnHeaderHeight={42}
        localeText={tableLocale} slots={{ toolbar: CursorTableToolbar }}
        onRowClick={({ id }) => navigate(`${resource.path}/${id}`)} sx={{ ...dataTableSx, minHeight: 220, '& .MuiDataGrid-row': { cursor: "pointer" } }} />
    </Paper>}
    {(records.length > 0 || page.previous) && <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">Page {pageNumber} · {records.length} élément{records.length > 1 ? "s" : ""}{page.next ? " sur cette page" : ""}</Typography>
      <Stack direction="row" gap={1}><Button variant="outlined" disabled={!page.previous || loading} onClick={() => { setPageUrl(pageEndpoint(page.previous!)); setPageNumber((value) => value - 1); }}>Précédent</Button>
        <Button variant="outlined" disabled={!page.next || loading} onClick={() => { setPageUrl(pageEndpoint(page.next!)); setPageNumber((value) => value + 1); }}>Suivant</Button></Stack>
    </Stack>}
    <RecordQuickView resource={resource} record={preview} fields={fields} onClose={() => setPreview(null)} />
    <RecordEditor resource={resource} record={editingRecord} open={editor} onClose={() => setEditor(false)} onSaved={(row) => {
      if (!editingRecord && ["resources.purchaseorder", "budget.budget"].includes(resource.model)) { navigate(`${resource.path}/${row.id}`); return; }
      setMessage(editingRecord ? "Modifications enregistrées." : "Enregistrement créé."); resetPage(); setRevision((value) => value + 1);
    }} />
  </Stack>;
}
