import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
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

import { api } from "../api/client";
import { ApiRecord, Paginated } from "../api/types";
import { ResourceConfig } from "../resources";

export function ResourcePage({ resource }: { resource: ResourceConfig }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<Paginated<ApiRecord>>(resource.endpoint);
      setRecords(response.data.results);
    } catch {
      setError(`Impossible de charger ${resource.label}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [resource.endpoint]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return records;
    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(needle));
  }, [records, query]);

  const columns = useMemo<GridColDef[]>(
    () =>
      resource.columns.map((column, index) => ({
        field: column,
        headerName: column,
        flex: index === 0 ? 1.2 : 1,
        minWidth: isSmall ? 140 : 160,
        hideable: true,
        valueGetter: (_value, row) => row[column],
        renderCell: (params) => (
          <Typography
            variant="body2"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              width: "100%",
            }}
            title={formatValue(params.value)}
          >
            {formatValue(params.value)}
          </Typography>
        ),
      })),
    [isSmall, resource.columns],
  );

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, sm: 34 } }}>
            {resource.label}
          </Typography>
          <Typography color="text.secondary" noWrap>
            {resource.endpoint}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={load}
          disabled={loading}
          sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
        >
          Actualiser
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {/* <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, border: 1, borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField
            label="Recherche"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            fullWidth
            size="small"
          />
          <Chip label={`${filtered.length} lignes`} />
        </Stack>
      </Paper> */}

      <Paper
        elevation={0}
        sx={{
          border: 1,
          borderColor: "divider",
          height: { xs: 520, sm: 620 },
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <DataGrid
          rows={filtered}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          onRowClick={(params) => navigate(`${resource.path}/${params.id}`)}
          slots={{ toolbar: DataTableToolbar }}
          slotProps={{
            toolbar: {
              csvOptions: {
                fileName: `chantier-${resource.label.toLowerCase()}`,
                utf8WithBom: true,
              },
              printOptions: { disableToolbarButton: false },
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
            },
          }}
          initialState={{
            pagination: { paginationModel: { pageSize: 10, page: 0 } },
            columns: {
              columnVisibilityModel: isSmall
                ? Object.fromEntries(resource.columns.slice(3).map((column) => [column, false]))
                : {},
            },
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          sx={{
            border: 0,
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: "background.default",
            },
            "& .MuiDataGrid-cell": {
              alignItems: "center",
            },
            "& .MuiDataGrid-row": {
              cursor: "pointer",
            },
            "& .MuiDataGrid-toolbarContainer": {
              p: 1,
              gap: 1,
              borderBottom: 1,
              borderColor: "divider",
            },
          }}
        />
      </Paper>
    </Stack>
  );
}

function DataTableToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarQuickFilter sx={{ minWidth: { xs: "100%", sm: 260 } }} />
      <Box sx={{ flexGrow: 1 }} />
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
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
