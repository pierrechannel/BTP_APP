import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
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

export function PlatformTable({
  title,
  subtitle,
  endpoint,
  columns,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  columns: string[];
}) {
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<Paginated<ApiRecord>>(endpoint);
      setRecords(response.data.results);
    } catch {
      setError(`Impossible de charger ${title}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [endpoint]);

  const gridColumns = useMemo<GridColDef[]>(
    () =>
      columns.map((column, index) => ({
        field: column,
        headerName: column,
        flex: index === 0 ? 1.2 : 1,
        minWidth: 150,
        valueGetter: (_value, row) => row[column],
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={formatValue(params.value)} sx={{ width: "100%" }}>
            {formatValue(params.value)}
          </Typography>
        ),
      })),
    [columns],
  );

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, sm: 34 } }}>
            {title}
          </Typography>
          <Typography color="text.secondary">{subtitle}</Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading} sx={{ alignSelf: { xs: "stretch", sm: "center" } }}>
          Actualiser
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", height: { xs: 540, sm: 640 }, overflow: "hidden" }}>
        <DataGrid
          rows={records}
          columns={gridColumns}
          loading={loading}
          disableRowSelectionOnClick
          slots={{ toolbar: PlatformToolbar }}
          slotProps={{
            toolbar: {
              csvOptions: { fileName: `chantier-platform-${title.toLowerCase()}`, utf8WithBom: true },
              printOptions: { disableToolbarButton: false },
              showQuickFilter: true,
              quickFilterProps: { debounceMs: 300 },
            },
          }}
          initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
          pageSizeOptions={[10, 25, 50, 100]}
          sx={{
            border: 0,
            "& .MuiDataGrid-columnHeaders": { bgcolor: "background.default" },
            "& .MuiDataGrid-toolbarContainer": { p: 1, gap: 1, borderBottom: 1, borderColor: "divider" },
          }}
        />
      </Paper>
    </Stack>
  );
}

function PlatformToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarQuickFilter sx={{ minWidth: { xs: "100%", sm: 280 } }} />
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
