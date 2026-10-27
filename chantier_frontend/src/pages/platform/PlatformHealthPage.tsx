import { Alert, Box, Button, Chip, Paper, Skeleton, Stack, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { usePlatformOverview } from "../../state/platform";
export function PlatformHealthPage() {
  const { data, loading, error, refresh } = usePlatformOverview();
  const cards = [
    { label: "Connexion à la base", value: data ? "Disponible" : "Indisponible", detail: "Requête de contrôle exécutée par le serveur.", warning: false },
    { label: "Synchronisation", value: data ? `${data.sync_pending} en attente` : "Indisponible", detail: data ? `${data.sync_failed} mutation(s) en échec` : "", warning: Boolean(data?.sync_failed) },
    { label: "Génération de rapports", value: data ? `${data.reports_pending} en attente` : "Indisponible", detail: data ? `${data.reports_failed} rapport(s) en échec` : "", warning: Boolean(data?.reports_failed) },
  ];
  return <Stack spacing={3}><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
    <Box><Typography variant="overline" color="primary.main">EXPLOITATION</Typography><Typography variant="h4">État du système</Typography><Typography color="text.secondary" mt={1}>État de la connexion et des files de traitement.</Typography></Box>
    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refresh} disabled={loading} sx={{ alignSelf: "flex-start" }}>Vérifier maintenant</Button></Stack>
    {error && <Alert severity="error">{error}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
      {cards.map((card) => <Paper key={card.label} variant="outlined" sx={{ p: 3 }}><Typography variant="h6" mb={2}>{card.label}</Typography>
        {loading ? <Skeleton height={32} /> : <Chip label={card.value} color={!data ? "default" : card.warning ? "warning" : "success"} variant="outlined" />}
        <Typography variant="body2" color="text.secondary" mt={2}>{card.detail}</Typography></Paper>)}
    </Box>
    {data && <Typography variant="caption" color="text.secondary">Dernière vérification : {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "medium", timeZone: "Africa/Bujumbura" }).format(new Date(data.checked_at))}</Typography>}
  </Stack>;
}
