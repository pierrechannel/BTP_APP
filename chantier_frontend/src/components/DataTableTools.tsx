import { Box, Typography } from "@mui/material";
import { GridToolbarColumnsButton, GridToolbarContainer, GridToolbarDensitySelector, GridToolbarExport } from "@mui/x-data-grid";
import { frFR } from "@mui/x-data-grid/locales";

export const tableLocale = {
  ...frFR.components.MuiDataGrid.defaultProps.localeText,
  toolbarExport: "Exporter la page",
  toolbarExportCSV: "Télécharger la page en CSV",
};

export const dataTableSx = {
  border: 0,
  fontSize: 12,
  "& .MuiDataGrid-columnHeader, & .MuiDataGrid-filler": { bgcolor: "#16532f", color: "#fff" },
  "& .MuiDataGrid-columnHeaderTitle": { fontSize: 11, fontWeight: 700 },
  "& .MuiDataGrid-columnHeader .MuiIconButton-root, & .MuiDataGrid-sortIcon, & .MuiDataGrid-menuIconButton": { color: "#fff" },
  "& .MuiDataGrid-columnSeparator": { color: "rgba(255,255,255,.2)" },
  "& .MuiDataGrid-cell": { display: "flex", alignItems: "center", borderColor: "#edf1eb", "& .MuiTypography-root, & a": { fontSize: 12 } },
  "& .MuiDataGrid-row:nth-of-type(even)": { bgcolor: "#f7faf5" },
  "& .MuiDataGrid-row:hover": { bgcolor: "#eaf2e6" },
  "& .MuiDataGrid-toolbarContainer": { px: 2, py: 1.25, gap: 1, borderBottom: 1, borderColor: "divider", "& .MuiButton-root": { fontSize: 12 } },
  "& .MuiDataGrid-footerContainer": { bgcolor: "#f7faf5", borderColor: "divider" },
};

export function CursorTableToolbar() {
  return <GridToolbarContainer>
    <Typography variant="caption" color="text.secondary">Personnaliser le tableau</Typography><Box flex={1} />
    <GridToolbarColumnsButton /><GridToolbarDensitySelector />
    <GridToolbarExport csvOptions={{ utf8WithBom: true, delimiter: ";", escapeFormulas: true, fileName: "chantier-page" }} printOptions={{ disableToolbarButton: true }} />
  </GridToolbarContainer>;
}
