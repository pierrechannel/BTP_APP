import { Alert, Box, Button, Paper, Skeleton, Stack, Typography } from "@mui/material";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import HistoryIcon from "@mui/icons-material/History";
import RefreshIcon from "@mui/icons-material/Refresh";
import { usePlatformOverview } from "../../state/platform";

export function PlatformDashboardPage() {
  const { data, loading, error, refresh } = usePlatformOverview();
  const cards = [
    { label: "Entreprises", value: data?.tenants, detail: `${data?.active_tenants ?? 0} actives`, icon: <BusinessOutlinedIcon /> },
    { label: "Utilisateurs", value: data?.users, detail: `${data?.active_users ?? 0} comptes actifs`, icon: <PeopleOutlineIcon /> },
    { label: "Chantiers", value: data?.projects, detail: "Sur l’ensemble de la plateforme", icon: <ConstructionOutlinedIcon /> },
    { label: "Événements d’audit", value: data?.audit_events, detail: "Toutes les entreprises", icon: <HistoryIcon /> },
  ];
  return <Stack spacing={3}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
      <Box><Typography variant="overline" color="primary.main">ADMINISTRATION</Typography><Typography variant="h4">Vue plateforme</Typography>
        <Typography color="text.secondary" mt={1}>Les indicateurs de toutes vos entreprises, calculés sur l’ensemble des données.</Typography></Box>
      <Button variant="outlined" startIcon={<RefreshIcon />} onClick={refresh} disabled={loading} sx={{ alignSelf: "flex-start" }}>Actualiser</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
      {cards.map((card) => <Paper key={card.label} variant="outlined" sx={{ p: 3 }}><Box color="primary.main" mb={2}>{card.icon}</Box><Typography color="text.secondary" variant="body2">{card.label}</Typography>
        {loading ? <Skeleton width={90} height={60} /> : <Typography sx={{ fontWeight: 750, fontSize: 34, my: 1 }}>{card.value ?? "—"}</Typography>}<Typography color="text.secondary" variant="caption">{data ? card.detail : "Indicateur indisponible"}</Typography></Paper>)}
    </Box>
    <Alert severity="info">Les listes d’utilisateurs et d’audit sont limitées à l’entreprise choisie dans la barre supérieure. Ces indicateurs couvrent toute la plateforme.</Alert>
  </Stack>;
}
