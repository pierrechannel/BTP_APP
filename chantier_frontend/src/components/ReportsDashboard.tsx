import { FormTextField as TextField } from './FormTextField';
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Chip, LinearProgress, MenuItem, Paper, Skeleton, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import { api } from "../api/client";
import { errorMessage, statusLabels } from "../api/workspace";
import { AnalyticsLineChart, compactDashboardGrid as dashboardGrid, MetricCard, monthRange } from "./AnalyticsWidgets";
import { ReportOperationsData, ReportsOperationalOverview, ReportsAttention, ReportsExpenses } from "./ReportsOperations";

type Finance = { currency: string; planned: string | number; spent: string | number; remaining: string | number };
type ProjectSummary = { id: string; name: string; code: string; status: string; tasks: number; completed: number; progress: number; overdue: number; open_incidents: number };
type Analytics = ReportOperationsData & {
  as_of: string;
  kpis: { projects: number; tasks: number; completed: number; progress: number; overdue: number; open_incidents: number };
  statuses: Array<{ status: string; count: number }>;
  finances: Finance[];
  monthly_expenses: Array<{ month: string; currency: string; amount: string | number }>;
  projects: ProjectSummary[];
};
const colors: Record<string, string> = { todo: "#a5b8ac", in_progress: "#39775b", done: "#7aa76a", blocked: "#dc9651", cancelled: "#b46b65" };
const number = (value: number | string) => Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const card = { p: { xs: 2, md: 3 }, borderRadius: 2 };
const kpiRow = dashboardGrid;

export function ReportsDashboard({ project, startDate, endDate, revision, onProjectSelect, onHistory }: { project: string; startDate: string; endDate: string; revision: number; onProjectSelect: (id: string) => void; onHistory: (status?: string) => void }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("");
  const [retry, setRetry] = useState(0);
  const [tableTab, setTableTab] = useState('finances');
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(""); setLoading(true);
    if (startDate && endDate && endDate < startDate) { setLoading(false); return () => controller.abort(); }
    const timer = setTimeout(() => {
      api.get<Analytics>("/reports/templates/summary/", { signal: controller.signal, params: { project: project || undefined, start_date: startDate || undefined, end_date: endDate || undefined } })
        .then(({ data: result }) => { if (!controller.signal.aborted) { setData(result); setCurrency((current) => result.finances.some((item) => item.currency === current) ? current : result.finances[0]?.currency ?? ""); } })
        .catch((err) => { if (!controller.signal.aborted) setError(errorMessage(err)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [project, startDate, endDate, revision, retry]);
  if (loading) return <Box aria-label="Chargement des indicateurs" sx={kpiRow}>{[0, 1, 2, 3].map((item) => <Skeleton key={item} variant="rounded" height={120} />)}</Box>;
  if (error) return <Alert severity="error" action={<Button onClick={() => setRetry((value) => value + 1)}>Réessayer</Button>}>{error}</Alert>;
  if (!data) return null;
  const kpi = data.kpis;
  const selectedFinance = data.finances.find((item) => item.currency === currency);
  const monthly = data.monthly_expenses.filter((item) => item.currency === currency);
  const months = monthRange(monthly.map((item) => String(item.month)));
  const metrics = [
    { label: "Avancement moyen", value: `${number(kpi.progress)} %`, detail: `${number(kpi.projects)} chantier(s) · ${number(kpi.tasks)} tâches`, color: "#30684e" },
    { label: "Tâches terminées", value: `${number(kpi.completed)} / ${number(kpi.tasks)}`, detail: "Dans le planning sélectionné", color: "#30684e" },
    { label: "Tâches en retard", value: number(kpi.overdue), detail: "Échéance dépassée, hors tâches terminées ou annulées", color: kpi.overdue ? "#b06d20" : "#30684e" },
    { label: "Incidents ouverts", value: number(kpi.open_incidents), detail: "Incidents non clôturés de la période", color: kpi.open_incidents ? "#b44b40" : "#30684e" },
  ];
  return <Stack spacing={3}>
    <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap"><Typography variant="h5">Vue analytique</Typography><Chip size="small" label={`Situation au ${new Date(`${data.as_of}T12:00:00`).toLocaleDateString("fr-FR")}`} variant="outlined" /></Stack>
    <Box sx={kpiRow}>
      {metrics.map((item) => <MetricCard compact key={item.label} label={item.label} value={item.value} detail={item.detail} color={item.color} />)}
    </Box>
    <ReportsOperationalOverview data={data} onHistory={onHistory} />
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.5fr" }, gap: 3 }}>
      <Paper variant="outlined" sx={card}>
        <Typography variant="h6">Répartition des tâches</Typography><Typography variant="body2" color="text.secondary" mb={3}>Nombre de tâches par statut</Typography>
        {!kpi.tasks ? <Typography color="text.secondary">Aucune tâche dans ce périmètre.</Typography> : <Stack spacing={2.5}>{data.statuses.map((item) => <Box key={item.status}>
          <Stack direction="row" justifyContent="space-between" mb={.7}><Typography variant="body2">{statusLabels[item.status] ?? item.status}</Typography><Typography variant="body2" fontWeight={600}>{item.count} · {number(item.count / kpi.tasks * 100)} %</Typography></Stack>
          <Tooltip title={`${item.count} tâches ${statusLabels[item.status] ?? item.status}`}><LinearProgress aria-label={statusLabels[item.status] ?? item.status} variant="determinate" value={item.count / kpi.tasks * 100} sx={{ height: 12, borderRadius: 1, bgcolor: "#eef2ef", "& .MuiLinearProgress-bar": { bgcolor: colors[item.status] ?? "#39775b" } }} /></Tooltip>
        </Box>)}</Stack>}
      </Paper>
      <Paper variant="outlined" sx={{ ...card, minWidth: 0 }}>
        <Stack direction="row" gap={2} justifyContent="space-between" alignItems="center" mb={1}><Box><Typography variant="h6">Dépenses mensuelles</Typography><Typography variant="body2" color="text.secondary">Montants TTC validés ou payés</Typography></Box>
          {data.finances.length > 0 && <TextField select size="small" label="Devise" value={currency} onChange={(event) => setCurrency(event.target.value)} sx={{ minWidth: 100 }}>{data.finances.map((item) => <MenuItem key={item.currency} value={item.currency}>{item.currency}</MenuItem>)}</TextField>}
        </Stack>
        {selectedFinance && <Typography variant="h5" color="primary.main" mt={2}>{number(selectedFinance.spent)} <Typography component="span" variant="body2">{currency} sur la période</Typography></Typography>}
        {!monthly.length ? <Typography color="text.secondary" py={5}>Aucune dépense validée dans ce périmètre.</Typography> : <Box sx={{ overflowX: "auto" }}>
          <AnalyticsLineChart title={`Dépenses mensuelles en ${currency}`} unit={currency} labels={months.map((month) => new Date(`${month}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }))} series={[{ name: 'Dépenses TTC', color: '#39775b', values: months.map((month) => Number(monthly.find((item) => String(item.month).startsWith(month))?.amount ?? 0)) }]} />
        </Box>}
      </Paper>
    </Box>
    <ReportsAttention data={data} currency={currency} />
    <Box>
      <Tabs value={tableTab} onChange={(_, value) => setTableTab(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Tableaux des rapports" sx={{ mb: 2 }}>
        <Tab value="finances" label="Finances" id="reports-table-finances-tab" aria-controls="reports-table-finances" />
        <Tab value="projects" label="Chantiers" id="reports-table-projects-tab" aria-controls="reports-table-projects" />
        <Tab value="expenses" label="Dépenses" id="reports-table-expenses-tab" aria-controls="reports-table-expenses" />
      </Tabs>
      <Box role="tabpanel" id="reports-table-finances" aria-labelledby="reports-table-finances-tab" hidden={tableTab !== 'finances'}>    <Paper variant="outlined" sx={card}>
      <Typography variant="h6">Situation financière par devise</Typography><Typography variant="body2" color="text.secondary" mb={2}>Budget total du chantier comparé aux dépenses de la période. Chaque devise est suivie séparément.</Typography>
      <TableContainer><Table size="small" aria-label="Situation financière"><TableHead><TableRow><TableCell>Devise</TableCell><TableCell align="right">Budget prévu</TableCell><TableCell align="right">Dépenses TTC</TableCell><TableCell align="right">Solde sur période</TableCell><TableCell>Consommation du budget</TableCell></TableRow></TableHead><TableBody>
        {data.finances.map((item) => { const planned = Number(item.planned); const ratio = planned > 0 ? Number(item.spent) / planned * 100 : null; return <TableRow key={item.currency}><TableCell sx={{ fontWeight: 600 }}>{item.currency}</TableCell><TableCell align="right">{number(item.planned)}</TableCell><TableCell align="right">{number(item.spent)}</TableCell><TableCell align="right" sx={{ color: Number(item.remaining) < 0 ? "error.main" : "success.main", fontWeight: 600 }}>{number(item.remaining)}</TableCell><TableCell sx={{ minWidth: 180 }}>{ratio === null ? "Budget non défini" : <Stack direction="row" gap={1} alignItems="center"><LinearProgress variant="determinate" value={Math.min(Math.max(ratio, 0), 100)} color={ratio > 100 ? "error" : "primary"} sx={{ flex: 1, height: 7, borderRadius: 1 }} /><Typography variant="caption">{number(ratio)} %</Typography></Stack>}</TableCell></TableRow>; })}
        {!data.finances.length && <TableRow><TableCell colSpan={5}>Aucun budget ni dépense enregistré.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </Paper>
</Box>
      <Box role="tabpanel" id="reports-table-projects" aria-labelledby="reports-table-projects-tab" hidden={tableTab !== 'projects'}>    <Paper variant="outlined" sx={card}>
      <Typography variant="h6">Suivi des chantiers</Typography><Typography variant="body2" color="text.secondary" mb={2}>Comparez l’avancement et repérez les points à surveiller.</Typography>
      <TableContainer><Table size="small" aria-label="Suivi des chantiers"><TableHead><TableRow><TableCell>Chantier</TableCell><TableCell>Avancement</TableCell><TableCell align="right">Terminées / total</TableCell><TableCell align="right">Retards</TableCell><TableCell align="right">Incidents ouverts</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>
        {data.projects.map((item) => <TableRow key={item.id} hover><TableCell><Typography variant="body2" fontWeight={600}>{item.name}</Typography><Typography variant="caption" color="text.secondary">{item.code}</Typography></TableCell><TableCell sx={{ minWidth: 150 }}><Typography variant="caption">{number(item.progress)} %</Typography><LinearProgress variant="determinate" value={item.progress} sx={{ height: 6, borderRadius: 1 }} /></TableCell><TableCell align="right">{item.completed} / {item.tasks}</TableCell><TableCell align="right" sx={{ color: item.overdue ? "warning.dark" : "text.secondary" }}>{item.overdue}</TableCell><TableCell align="right" sx={{ color: item.open_incidents ? "error.main" : "text.secondary" }}>{item.open_incidents}</TableCell><TableCell><Stack direction="row" gap={1}><Button size="small" onClick={() => onProjectSelect(item.id)}>Analyser</Button><Button size="small" component={RouterLink} to={`/projects/${item.id}`}>Fiche</Button></Stack></TableCell></TableRow>)}
        {!data.projects.length && <TableRow><TableCell colSpan={6}>Aucun chantier dans ce périmètre.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </Paper>
</Box>
      <Box role="tabpanel" id="reports-table-expenses" aria-labelledby="reports-table-expenses-tab" hidden={tableTab !== 'expenses'}><ReportsExpenses data={data} /></Box>
    </Box>

    <Typography variant="caption" color="text.secondary">L’avancement est la moyenne des tâches du planning sélectionné. La période filtre les dépenses et les incidents ; les tâches sont retenues si leur planning chevauche cette période ou si leurs dates ne sont pas renseignées.</Typography>
  </Stack>;
}
