import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Chip, Drawer, IconButton, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection, formatValue, notifyChange, versionHeaders } from "../api/workspace";
import { resourceByModel } from "../resources";
import { useWorkspace } from "../state/workspace";
import { dataTableSx, tableLocale } from "./DataTableTools";
import { RelatedValue } from "./RelatedValue";
import { RecordEditor } from "./RecordEditor";
import { StatusBadge } from "./StatusBadge";

export function BudgetWorkspace({ budget, revision, mode = "lines" }: { budget: ApiRecord; revision: number; mode?: "lines" | "expenses" }) {
  const { can } = useWorkspace();
  const lineResource = resourceByModel["budget.budgetline"];
  const expenseResource = resourceByModel["budget.expense"];
  const [lines, setLines] = useState<ApiRecord[]>([]);
  const [expenses, setExpenses] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [lot, setLot] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<ApiRecord | null>(null);
  const [lineEditor, setLineEditor] = useState<ApiRecord | true | null>(null);
  const [expenseEditor, setExpenseEditor] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    Promise.all([
      fetchCollection(lineResource.endpoint, { budget: budget.id }, controller.signal),
      fetchCollection(expenseResource.endpoint, { budget: budget.id }, controller.signal),
    ]).then(([lines, expenses]) => {
      setLines(lines); setExpenses(expenses);
      setSelected((current) => current ? lines.find((row) => row.id === current.id) ?? null : null);
    }).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [budget.id, revision, refresh]);
  const saved = () => { setRefresh((value) => value + 1); setMessage("Enregistrement effectué."); };
  const validate = async (row: ApiRecord) => {
    setBusy(true); setError("");
    try { await api.post(`${expenseResource.endpoint}${row.id}/validate/`, {}, { headers: versionHeaders(row) }); notifyChange(); saved(); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  };
  const moneyColumn = (field: string, headerName: string): GridColDef => ({ field, headerName, minWidth: 145, flex: 1, align: "right", headerAlign: "right", renderCell: ({ value }) => <Typography variant="body2" fontWeight={600} color={field === "remaining" && Number(value) < 0 ? "error.main" : "text.primary"}>{formatValue(value, "amount")} {String(budget.currency)}</Typography> });
  const columns: GridColDef[] = [
    { field: "label", headerName: "Poste budgétaire", minWidth: 200, flex: 1.4 },
    { field: "lot", headerName: "Lot", minWidth: 140, flex: 1, renderCell: ({ value }) => value ? <RelatedValue model="projects.lot" id={value} /> : <Typography variant="body2">Général</Typography> },
    { field: "category", headerName: "Catégorie", minWidth: 140, flex: 1 },
    moneyColumn("amount", "Prévu"), moneyColumn("spent", "Consommé TTC"), moneyColumn("remaining", "Disponible"),
    { field: "actions", headerName: "Actions", minWidth: 210, sortable: false, renderCell: ({ row }) => <Stack direction="row" gap={.5}>
      <Button size="small" onClick={() => setSelected(row)}>Dépenses</Button>{can("budget", "update") && <Button size="small" onClick={() => setLineEditor(row)}>Modifier</Button>}
    </Stack> },
  ];
  const expenseColumns: GridColDef[] = [
    { field: "date", headerName: "Date", minWidth: 110, valueFormatter: (value) => formatValue(value, "date") },
    { field: "supplier_name", headerName: "Fournisseur", minWidth: 150, flex: 1 },
    { field: "budget_line", headerName: "Poste", minWidth: 150, flex: 1, renderCell: ({ value }) => <Typography variant="body2" noWrap>{String(lines.find((line) => line.id === value)?.label ?? "Poste indisponible")}</Typography> },
    { field: "status", headerName: "Statut", minWidth: 125, renderCell: ({ value }) => <StatusBadge value={value} /> },
    moneyColumn("amount_including_tax", "Montant TTC"),
    { field: "actions", headerName: "Actions", minWidth: 160, sortable: false, renderCell: ({ row }) => <Stack direction="row"><Button size="small" component={RouterLink} to={`${expenseResource.path}/${row.id}`}>Ouvrir</Button>{can("budget", "validate") && ["draft", "submitted"].includes(String(row.status)) && <Button size="small" disabled={busy} onClick={() => validate(row)}>Valider</Button>}</Stack> },
  ];
  const visibleLines = lines.filter((row) => (!search || `${row.label} ${row.category}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"))) && (!lot || String(row.lot ?? "general") === lot) && (!category || row.category === category));
  const grid = (rows: ApiRecord[], columns: GridColDef[]) => <Box sx={{ minWidth: 0, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}><DataGrid rows={rows} columns={columns} autoHeight loading={loading} disableRowSelectionOnClick localeText={tableLocale} rowHeight={52} columnHeaderHeight={42} initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }} pageSizeOptions={[10, 25, 50]} sx={dataTableSx} /></Box>;
  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
    <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={2} mb={2}>
      <Box><Typography variant="h6">{mode === "lines" ? "Lignes budgétaires" : "Dépenses du budget"} <Chip size="small" label={mode === "lines" ? lines.length : expenses.length} /></Typography><Typography variant="caption" color="text.secondary">Devise héritée : {String(budget.currency)} · Consommé = dépenses validées et payées, en TTC.</Typography></Box>
      {can("budget", "create") && <Button variant="contained" startIcon={<AddIcon />} onClick={() => mode === "lines" ? setLineEditor(true) : setExpenseEditor(true)}>{mode === "lines" ? "Ajouter un poste budgétaire" : "Ajouter une dépense"}</Button>}
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={() => setRefresh((value) => value + 1)}>Réessayer</Button>}>{error}</Alert>}
    {message && <Alert severity="success" onClose={() => setMessage("")} sx={{ mb: 2 }}>{message}</Alert>}
    {loading && <LinearProgress sx={{ mb: 2 }} />}
    {mode === "lines" ? <>
      <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} mb={2}>
        <TextField size="small" label="Rechercher un poste" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ flex: 1 }} />
        <TextField select size="small" label="Lot" value={lot} onChange={(event) => setLot(event.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">Tous les lots</MenuItem>{[...new Set(lines.map((row) => String(row.lot ?? "general")))].map((id) => <MenuItem key={id} value={id}>{id === "general" ? "Général" : String(lines.find((line) => String(line.lot) === id)?.lot_name ?? "Lot")}</MenuItem>)}</TextField>
        <TextField select size="small" label="Catégorie" value={category} onChange={(event) => setCategory(event.target.value)} sx={{ minWidth: 170 }}><MenuItem value="">Toutes les catégories</MenuItem>{[...new Set(lines.map((row) => String(row.category)))].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
      </Stack>
      <Box sx={{ display: { xs: "none", md: "block" } }}>{grid(visibleLines, columns)}</Box>
      <Stack sx={{ display: { xs: "flex", md: "none" } }} spacing={1.5}>{visibleLines.map((line) => <Paper variant="outlined" key={line.id} sx={{ p: 2 }}>
        <Typography fontWeight={700}>{String(line.label)}</Typography><Typography variant="caption" color="text.secondary">{String(line.category)}</Typography>
        <Stack gap={.75} mt={1}>{[["amount", "Prévu"], ["spent", "Consommé TTC"], ["remaining", "Disponible"]].map(([field, label]) => <Stack direction="row" justifyContent="space-between" key={field}><Typography variant="caption">{label}</Typography><Typography variant="body2" color={field === "remaining" && Number(line[field]) < 0 ? "error.main" : "text.primary"}>{formatValue(line[field], "amount")} {String(budget.currency)}</Typography></Stack>)}</Stack>
        <Stack direction="row" mt={1}><Button onClick={() => setSelected(line)}>Voir les dépenses</Button>{can("budget", "update") && <Button onClick={() => setLineEditor(line)}>Modifier</Button>}</Stack>
      </Paper>)}{!loading && !visibleLines.length && <Typography color="text.secondary">Aucun poste ne correspond à ces filtres.</Typography>}</Stack>
    </> : grid(expenses, expenseColumns)}
    <Typography variant="caption" color="text.secondary" display="block" mt={2}>Les prévisions doivent être saisies sur la même base que les dépenses TTC. Le disponible n’est pas un solde bancaire.</Typography>
    <RecordEditor resource={lineResource} record={lineEditor && lineEditor !== true ? lineEditor : undefined} open={Boolean(lineEditor)} defaults={{ budget: budget.id, currency: budget.currency, project: budget.project }} fixedFields={["budget", "currency"]} compact allowRepeat onClose={() => setLineEditor(null)} onSaved={saved} />
    <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)} PaperProps={{ sx: { width: { xs: "100%", md: 780 }, maxWidth: "100vw" } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2.5, bgcolor: "primary.dark", color: "#fff" }}><Box><Typography variant="subtitle2">Dépenses du poste</Typography><Typography fontWeight={700}>{String(selected?.label ?? "")}</Typography></Box><IconButton aria-label="Fermer les dépenses" sx={{ color: "inherit" }} onClick={() => setSelected(null)}><CloseIcon /></IconButton></Stack>
      <Box sx={{ p: 2.5, overflowY: "auto" }}>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack direction="row" gap={2} flexWrap="wrap" mb={2}>{[["amount", "Prévu"], ["spent", "Consommé TTC"], ["remaining", "Disponible"]].map(([field, label]) => <Box key={field}><Typography variant="caption">{label}</Typography><Typography fontWeight={700}>{formatValue(selected?.[field], "amount")} {String(budget.currency)}</Typography></Box>)}</Stack>
        {can("budget", "create") && <Button variant="contained" startIcon={<AddIcon />} sx={{ mb: 2 }} onClick={() => setExpenseEditor(true)}>Ajouter une dépense</Button>}
        {grid(expenses.filter((row) => row.budget_line === selected?.id), expenseColumns.filter((column) => column.field !== "budget_line"))}
      </Box>
    </Drawer>
    <RecordEditor resource={expenseResource} open={expenseEditor} defaults={{ ...(selected ? { budget_line: selected.id } : {}), currency: budget.currency, project: budget.project }} fixedFields={selected ? ["budget_line", "currency"] : ["currency"]} onClose={() => setExpenseEditor(false)} onSaved={saved} />
  </Paper>;
}
