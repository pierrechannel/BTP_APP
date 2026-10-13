import { Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import StorageIcon from "@mui/icons-material/Storage";
import SyncIcon from "@mui/icons-material/Sync";
import VpnKeyIcon from "@mui/icons-material/VpnKey";

const checks = [
  { label: "API Django", status: "A verifier via monitoring", icon: <CheckCircleIcon color="success" /> },
  { label: "Base de donnees", status: "SQLite dev / PostgreSQL prod", icon: <StorageIcon color="primary" /> },
  { label: "JWT Auth", status: "Actif", icon: <VpnKeyIcon color="secondary" /> },
  { label: "Sync offline", status: "File mutations disponible", icon: <SyncIcon color="warning" /> },
];

export function PlatformHealthPage() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontSize: { xs: 28, sm: 34 } }}>
          Sante systeme
        </Typography>
        <Typography color="text.secondary">Vue d'exploitation pour suivre l'etat technique de la plateforme.</Typography>
      </Box>

      <Grid container spacing={2}>
        {checks.map((check) => (
          <Grid item xs={12} sm={6} lg={3} key={check.label}>
            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider", minHeight: 152 }}>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Typography variant="h6">{check.label}</Typography>
                  {check.icon}
                </Stack>
                <Chip label={check.status} variant="outlined" sx={{ alignSelf: "flex-start" }} />
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
        <Typography variant="h6">Prochaine API a ajouter</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Un endpoint backend dedie pourrait exposer uptime, version, migrations, stockage medias, file sync et erreurs recentes.
        </Typography>
      </Paper>
    </Stack>
  );
}
