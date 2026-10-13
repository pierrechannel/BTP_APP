import { useEffect, useState } from "react";
import { Alert, Box, Button, Grid, Paper, Stack, Typography } from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import HistoryIcon from "@mui/icons-material/History";
import PeopleIcon from "@mui/icons-material/People";
import RefreshIcon from "@mui/icons-material/Refresh";

import { api } from "../../api/client";
import { Paginated } from "../../api/types";

const cards = [
  { label: "Tenants", endpoint: "/auth/tenants/", icon: <BusinessIcon color="primary" /> },
  { label: "Utilisateurs tenant", endpoint: "/auth/users/", icon: <PeopleIcon color="secondary" /> },
  { label: "Evenements audit", endpoint: "/auth/audit-logs/", icon: <HistoryIcon color="warning" /> },
];

export function PlatformDashboardPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const nextCounts: Record<string, number> = {};

    await Promise.all(
      cards.map(async (item) => {
        try {
          const response = await api.get<Paginated<unknown>>(item.endpoint);
          nextCounts[item.label] = response.data.results.length;
        } catch {
          nextCounts[item.label] = 0;
          setError("Certains indicateurs plateforme ne sont pas disponibles avec les droits courants.");
        }
      }),
    );

    setCounts(nextCounts);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, sm: 34 } }}>
            Vue plateforme
          </Typography>
          <Typography color="text.secondary">Pilotage global des espaces clients et de l'exploitation.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} sx={{ alignSelf: { xs: "stretch", sm: "center" } }}>
          Actualiser
        </Button>
      </Stack>

      {error && <Alert severity="warning">{error}</Alert>}

      <Grid container spacing={2}>
        {cards.map((item) => (
          <Grid item xs={12} md={4} key={item.label}>
            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider", minHeight: 140 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {counts[item.label] ?? "-"}
                  </Typography>
                </Box>
                {item.icon}
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: "divider" }}>
        <Typography variant="h6">Responsabilites Superadmin</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Cet espace est reserve a l'equipe plateforme : creation et suivi des tenants, controle des acces,
          surveillance des actions sensibles et preparation de la facturation SaaS.
        </Typography>
      </Paper>
    </Stack>
  );
}
