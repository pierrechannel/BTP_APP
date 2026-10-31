import { FormTextField as TextField } from '../components/FormTextField';
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarFilterButton,
  GridToolbarQuickFilter,
} from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";

import { ApiRecord } from "../api/types";
import { fieldLabel, errorMessage } from "../api/workspace";
import { api } from "../api/client";
import { useAuth } from "../state/auth";
import { PlatformField, PlatformRecordEditor } from "./PlatformRecordEditor";
import { dataTableSx } from "../components/DataTableTools";
import { frFR } from "@mui/x-data-grid/locales";

export function PlatformTable({
  title,
  subtitle,
  endpoint,
  columns,
  editableFields,
  tenantScoped = false,
  rowActions,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  columns: string[];
  editableFields?: PlatformField[];
  tenantScoped?: boolean;
  rowActions?: (record: ApiRecord, refresh: () => void) => ReactNode;
}) {
  const { tenantId } = useAuth();
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(true);
  const [editor, setEditor] = useState(false);
  const [record, setRecord] = useState<ApiRecord | undefined>();
  const refresh = () => setRevision((value) => value + 1);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPagination((current) => ({ ...current, page: 0 })); }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => { setPagination((current) => ({ ...current, page: 0 })); }, [tenantId, selectedOnly, endpoint]);
  useEffect(() => {
    const controller = new AbortController();
    setRecords([]); setLoading(true); setError("");
    api.get<{ results: ApiRecord[]; count: number }>(endpoint, { signal: controller.signal, params: { page: pagination.page + 1, page_size: pagination.pageSize, search: search || undefined, ...(tenantScoped && selectedOnly && tenantId ? { tenant: tenantId } : {}) } })
      .then(({ data }) => { if (!controller.signal.aborted) { setRecords(data.results); setCount(data.count); } })
      .catch((err) => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, tenantId, tenantScoped, selectedOnly, pagination.page, pagination.pageSize, search, revision]);

  const baseColumns = useMemo<GridColDef[]>(
    () =>
      columns.map((column, index) => ({
        field: column,
        headerName: ({ members_count: "Accès actifs", projects_count: "Chantiers", memberships_count: "Entreprises", is_superuser: "Superadministrateur" } as Record<string, string>)[column] ?? fieldLabel(column),
        flex: index === 0 ? 1.2 : 1,
        minWidth: 150,
        sortable: false,
        valueGetter: (_value, row) => row[column],
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={formatValue(params.value)} sx={{ width: "100%" }}>
            {formatValue(params.value)}
          </Typography>
        ),
      })),
    [columns],
  );
  const gridColumns = [...baseColumns];
  if (editableFields || rowActions) gridColumns.push({ field: "actions", headerName: "Actions", width: rowActions ? 230 : 120, sortable: false, filterable: false,
    renderCell: ({ row }) => <Stack direction="row" gap={1}>
      {editableFields && <Button size="small" onClick={() => { setRecord(row); setEditor(true); }}>Modifier</Button>}
      {rowActions?.(row, refresh)}
    </Stack> });

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 20, sm: 22 }, lineHeight: 1.3 }}>
            {title}
          </Typography>
          <Typography color="text.secondary">{subtitle}</Typography>
        </Box>
        <Stack direction="row" gap={1}>
        {editableFields && <Button variant="contained" onClick={() => { setRecord(undefined); setEditor(true); }}>Créer</Button>}
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refresh} disabled={loading} sx={{ alignSelf: { xs: "stretch", sm: "center" } }}>
          Actualiser
        </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
        <TextField size="small" label="Rechercher" value={query} onChange={(event) => setQuery(event.target.value)} />
        {tenantScoped && tenantId && <Button variant={selectedOnly ? "contained" : "outlined"} onClick={() => setSelectedOnly((value) => !value)}>{selectedOnly ? "Entreprise sélectionnée" : "Toute la plateforme"}</Button>}
        <Chip variant="outlined" size="small" label={loading ? "Chargement…" : `${count} résultat(s)`} />
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", height: { xs: 540, sm: 640 }, overflow: "hidden" }}>
        <DataGrid
          rows={records}
          columns={gridColumns}
          loading={loading}
          rowHeight={52}
          columnHeaderHeight={42}
          localeText={frFR.components.MuiDataGrid.defaultProps.localeText}
          disableRowSelectionOnClick
          disableColumnFilter
          paginationMode="server"
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          rowCount={count}
          slots={{ toolbar: PlatformToolbar }}
          slotProps={{
            toolbar: {
              csvOptions: { fileName: `chantier-platform-${title.toLowerCase()}`, utf8WithBom: true },
              printOptions: { disableToolbarButton: false },
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
            },
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          sx={{
            ...dataTableSx,
          }}
        />
      </Paper>
      <Typography variant="caption" color="text.secondary">Les exports portent sur la page affichée.</Typography>
      {editableFields && <PlatformRecordEditor title={title} fields={editableFields} endpoint={endpoint} record={record} open={editor} onClose={() => setEditor(false)} onSaved={refresh} />}
    </Stack>
  );
}

function PlatformToolbar() {
  return (
    <GridToolbarContainer>
      <Box sx={{ flexGrow: 1 }} />
      <GridToolbarColumnsButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
    </GridToolbarContainer>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
