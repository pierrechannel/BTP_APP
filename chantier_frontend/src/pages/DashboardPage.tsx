import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Chip, Divider, LinearProgress, Link, Paper, Skeleton, Stack, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import HealthAndSafetyOutlinedIcon from "@mui/icons-material/HealthAndSafetyOutlined";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, formatValue } from "../api/workspace";
import { useAuth } from "../state/auth";
import { useWorkspace } from "../state/workspace";
import { StatusBadge } from "../components/StatusBadge";
import { RecordEditor } from "../components/RecordEditor";
import { resourceByPath } from "../resources";
import { DashboardCharts } from "../components/DashboardCharts";

type Dashboard = {
  date: string;
  projects: { count: number; active: number; recent: ApiRecord[] } | null;
  planning: { count: number; completed: number; progress: number; overdue: number; overdue_tasks: ApiRecord[]; statuses: { status: string; count: number }[]; upcoming: ApiRecord[] } | null;
  budget: { count: number; pending: number; drafts: number; spent: { currency: string; amount: string }[]; monthly_spent: { month: string; currency: string; amount: string | number }[] } | null;
  qhse: { count: number; open: number } | null;
};
export function DashboardPage() {
  const { user } = useAuth();
  const { projectId, projects, can } = useWorkspace();
  const [snapshot, setData] = useState<{ projectId: string; data: Dashboard } | null>(null);
  const [fetching, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [create, setCreate] = useState(false);
  const data = snapshot?.projectId === projectId ? snapshot.data : null;
  const loading = fetching || (!data && !error);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("chantier:data-changed", refresh);
    return () => window.removeEventListener("chantier:data-changed", refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setLoading(true); setError("");
    api.get<Dashboard>("/projects/dashboard/", { params: projectId ? { project: projectId } : {}, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setData({ projectId, data }); }).catch((error) => { if (!controller.signal.aborted) { setData(null); setError(errorMessage(error)); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, revision, can]);
  const cards = [
    { label: "Chantiers actifs", value: data?.projects?.active, detail: `${data?.projects?.count ?? 0} chantier(s) au total`, icon: <ConstructionOutlinedIcon />, path: "/projects", color: "#17644d", bg: "#edf5ee", visible: can("projects") },
    { label: "Tâches terminées", value: data?.planning?.completed, detail: `sur ${data?.planning?.count ?? 0} tâches planifiées`, icon: <TaskAltOutlinedIcon />, path: "/planning", color: "#4882ad", bg: "#edf3fa", visible: can("planning") },
    { label: "Dépenses à valider", value: data?.budget?.pending, detail: `${data?.budget?.drafts ?? 0} brouillon(s) à préparer`, icon: <AccountBalanceWalletOutlinedIcon />, path: "/budget/expenses", color: "#b17b34", bg: "#fcf3e5", visible: can("budget") },
    { label: "Incidents ouverts", value: data?.qhse?.open, detail: `${data?.qhse?.count ?? 0} signalement(s) au total`, icon: <HealthAndSafetyOutlinedIcon />, path: "/qhse", color: "#b85959", bg: "#faeeee", visible: can("qhse") },
  ].filter((card) => card.visible);
  const project = projects.find((row) => String(row.id) === projectId);
  return <Stack spacing={3.5}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={2}>
      <Box><Typography variant="overline" color="primary.main">TABLEAU DE BORD</Typography><Typography variant="h4">Bonjour{user?.first_name ? `, ${user.first_name}` : ""} <span style={{ color: "#df994f" }}>.</span></Typography>
        <Typography color="text.secondary" mt={1}>{project ? `Voici la situation de ${project.name}.` : "Gardez une longueur d’avance sur vos chantiers."}</Typography></Box>
      <Stack direction="row" spacing={1} alignSelf={{ xs: "flex-start", sm: "auto" }}><Button aria-label="Actualiser les indicateurs" onClick={() => setRevision((value) => value + 1)} disabled={loading}><RefreshIcon /></Button>
        {can("projects", "create") && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreate(true)}>Nouveau chantier</Button>}</Stack>
    </Stack>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => setRevision((value) => value + 1)}>Réessayer</Button>}>{error}</Alert>}
    {!error && <>
    {data?.date && <Typography variant="caption" color="text.secondary">Situation au {new Date(`${data.date}T12:00:00`).toLocaleDateString("fr-FR")} · Heure de Bujumbura</Typography>}
    {cards.length > 0 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: `repeat(${cards.length}, 1fr)` }, gap: 2.5 }}>
      {cards.map((card) => <Paper component={RouterLink} to={card.path} variant="outlined" key={card.label} sx={{ p: { xs: 2, lg: 3 }, textDecoration: "none", color: "inherit", '&:hover': { borderColor: card.color } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}><Box sx={{ display: "flex", p: 1.1, borderRadius: 2, color: card.color, bgcolor: card.bg }}>{card.icon}</Box><ArrowForwardIcon sx={{ fontSize: 16, color: "#aeb8b0" }} /></Stack>
        <Typography variant="body2" color="text.secondary">{card.label}</Typography>{loading ? <Skeleton width={80} height={55} /> : <Typography sx={{ fontSize: 35, fontWeight: 750, letterSpacing: "-.06em", my: .3 }}>{card.value ?? "—"}</Typography>}
        {loading ? <Skeleton width="75%" /> : <Typography variant="caption" color="text.secondary">{card.detail}</Typography>}
      </Paper>)}
    </Box>}
    {!loading && data && <DashboardCharts statuses={data.planning?.statuses} monthly={data.budget?.monthly_spent} />}
    {(can("planning") || can("budget") || can("qhse")) && <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" mb={2}>Alertes à traiter</Typography>
      {loading ? <Skeleton height={120} /> : <Stack spacing={2}>
        {Boolean(data?.planning?.overdue) && <Alert severity="warning">{data?.planning?.overdue} tâche(s) en retard. Jusqu’à six tâches sont présentées ci-dessous, en commençant par les plus anciennes.</Alert>}
        {data?.planning?.overdue_tasks.map((row) => <Stack key={row.id} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
          <Box><Link component={RouterLink} to={`/planning/${row.id}`} underline="hover" fontWeight={600}>{String(row.name)}</Link><Typography variant="caption" display="block" color="text.secondary">{String(row.project__name)}</Typography></Box>
          <Typography variant="body2" color="warning.dark">Échéance : {formatValue(row.planned_end_date, "planned_end_date")}</Typography>
        </Stack>)}
        {Boolean(data?.budget?.pending) && <Alert severity="info" action={<Button component={RouterLink} to="/budget/expenses">Consulter</Button>}>{data?.budget?.pending} dépense(s) soumise(s) en attente de validation.</Alert>}
        {Boolean(data?.qhse?.open) && <Alert severity="warning" action={<Button component={RouterLink} to="/qhse">Consulter</Button>}>{data?.qhse?.open} incident(s) ouvert(s) à suivre.</Alert>}
        {!data?.planning?.overdue && !data?.budget?.pending && !data?.qhse?.open && <Typography color="text.secondary">Aucune alerte dans les modules auxquels vous avez accès.</Typography>}
      </Stack>}
    </Paper>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.65fr) minmax(0, 1fr)" }, gap: 3 }}>
      {can("projects") && <Paper variant="outlined" sx={{ overflow: "hidden" }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 3 }}><Box><Typography variant="h6">Vos chantiers</Typography><Typography variant="caption" color="text.secondary">Dernières mises à jour</Typography></Box><Button component={RouterLink} to="/projects" size="small" endIcon={<ArrowForwardIcon />}>Tout voir</Button></Stack><Divider />
        {loading ? <Skeleton height={260} variant="rectangular" /> : !data?.projects?.recent.length ? <Box p={4}><Typography color="text.secondary">Aucun chantier pour le moment. Créez votre premier projet pour commencer.</Typography></Box>
          : data.projects.recent.map((row, index) => <Stack key={row.id} direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ px: 3, py: 2.5, borderBottom: index < data.projects!.recent.length - 1 ? "1px solid #edf0eb" : 0 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}><Box sx={{ bgcolor: "#f1f4ed", color: "primary.main", p: 1.3, borderRadius: 2, display: { xs: "none", sm: "flex" } }}><ConstructionOutlinedIcon fontSize="small" /></Box>
              <Box sx={{ minWidth: 0 }}><Link component={RouterLink} to={`/projects/${row.id}`} color="text.primary" underline="hover" fontWeight={600} variant="body2">{String(row.name)}</Link><Typography variant="caption" display="block" color="text.secondary" mt={.5}>{String(row.code)} · {String(row.client_name || "Maître d’ouvrage à renseigner")}</Typography></Box></Stack><StatusBadge value={row.status} />
          </Stack>)}
      </Paper>}
      {can("planning") && <Paper variant="outlined" sx={{ p: 3 }}><Typography variant="h6">Avancement global</Typography><Typography variant="caption" color="text.secondary">Moyenne des tâches du périmètre sélectionné</Typography>
        <Stack direction="row" alignItems="baseline" spacing={.5} mt={3}><Typography sx={{ fontSize: 56, fontWeight: 750, color: "primary.main", letterSpacing: "-.06em" }}>{loading ? "—" : Math.round(data?.planning?.progress ?? 0)}</Typography><Typography color="text.secondary">%</Typography></Stack>
        <LinearProgress value={data?.planning?.progress ?? 0} variant="determinate" sx={{ height: 10, borderRadius: 4, mt: 1, mb: 3, bgcolor: "#eef2e9" }} />
        <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Tâches terminées</Typography><Typography variant="body2" fontWeight={600}>{data?.planning?.completed ?? "—"} / {data?.planning?.count ?? "—"}</Typography></Stack>
        <Divider sx={{ my: 2 }} /><Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Échéances dépassées</Typography><Chip label={data?.planning?.overdue ?? 0} size="small" color={data?.planning?.overdue ? "warning" : "default"} /></Stack>
        <Button component={RouterLink} to="/planning" fullWidth variant="outlined" sx={{ mt: 3 }}>Ouvrir le planning</Button>
      </Paper>}
    </Box>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.65fr) minmax(0, 1fr)" }, gap: 3 }}>
      {can("planning") && <Paper variant="outlined" sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between" mb={2}><Typography variant="h6">Prochaines échéances</Typography><Chip size="small" label="Planning" variant="outlined" /></Stack>
        {!loading && !data?.planning?.upcoming.length && <Typography color="text.secondary" py={3}>Aucune échéance en attente.</Typography>}
        {loading ? <Skeleton height={160} /> : data?.planning?.upcoming.map((row) => <Stack key={row.id} direction="row" gap={2} alignItems="center" sx={{ py: 1.8, borderBottom: "1px solid #edf0eb" }}>
          <Box sx={{ width: 5, height: 35, bgcolor: row.status === "blocked" ? "error.light" : "secondary.main", borderRadius: 1 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}><Link component={RouterLink} to={`/planning/${row.id}`} underline="hover" color="text.primary" variant="body2" fontWeight={600}>{String(row.name)}</Link><Typography variant="caption" display="block" color="text.secondary">{String(row.project__name)}</Typography></Box><Typography variant="caption" color="text.secondary">{formatValue(row.planned_end_date, "planned_end_date")}</Typography>
        </Stack>)}
      </Paper>}
      {can("budget") && <Paper variant="outlined" sx={{ p: 3 }}><Typography variant="h6">Dépenses engagées</Typography><Typography variant="caption" color="text.secondary">Dépenses validées et payées, par devise</Typography>
        {loading ? <Skeleton height={90} /> : data?.budget?.spent.length ? data.budget.spent.map((item) => <Box key={item.currency} mt={3}><Typography sx={{ fontSize: 27, fontWeight: 700 }}>{formatValue(item.amount, "amount")} <Typography component="span" color="text.secondary" variant="body2">{item.currency}</Typography></Typography></Box>)
          : <Typography color="text.secondary" py={3}>Aucune dépense validée.</Typography>}
        <Divider sx={{ my: 3 }} /><Button component={RouterLink} to="/budget" endIcon={<ArrowForwardIcon />}>Consulter le budget</Button>
      </Paper>}
    </Box>
    </>}
    <RecordEditor resource={resourceByPath["/projects"]} open={create} onClose={() => setCreate(false)} onSaved={() => setCreate(false)} />
  </Stack>;
}
