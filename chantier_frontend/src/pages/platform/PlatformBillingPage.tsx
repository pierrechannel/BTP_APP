import { Box, Button, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

const plans = [
  { name: "Starter", tenants: "1 tenant", projects: "5 chantiers actifs", status: "Pret UI" },
  { name: "Business", tenants: "Multi-tenant", projects: "Chantiers illimites", status: "Pret UI" },
  { name: "Enterprise", tenants: "SLA dedie", projects: "Support prioritaire", status: "Pret UI" },
];

export function PlatformBillingPage() {
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, sm: 34 } }}>
            Abonnements
          </Typography>
          <Typography color="text.secondary">Espace de preparation pour la facturation SaaS.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} disabled sx={{ alignSelf: { xs: "stretch", sm: "center" } }}>
          Nouveau plan
        </Button>
      </Stack>

      <Grid container spacing={2}>
        {plans.map((plan) => (
          <Grid item xs={12} md={4} key={plan.name}>
            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider", minHeight: 188 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                  <Typography variant="h6">{plan.name}</Typography>
                  <Chip size="small" label={plan.status} />
                </Stack>
                <Typography color="text.secondary">{plan.tenants}</Typography>
                <Typography color="text.secondary">{plan.projects}</Typography>
                <Typography variant="body2">
                  API abonnement a connecter plus tard : plans, limites, factures, paiements et statut client.
                </Typography>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
