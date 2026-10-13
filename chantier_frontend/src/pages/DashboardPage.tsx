import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import { api } from "../api/client";
import { Paginated } from "../api/types";

const kpis = [
  { label: "Chantiers", endpoint: "/projects/" },
  { label: "Taches", endpoint: "/planning/tasks/" },
  { label: "Depenses", endpoint: "/budget/expenses/" },
  { label: "Incidents", endpoint: "/qhse/incidents/" },
];

export function DashboardPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const results = await Promise.all(
        kpis.map(async (item) => {
          const response = await api.get<Paginated<unknown>>(item.endpoint);
          return [item.label, response.data.results.length] as const;
        }),
      );
      setCounts(Object.fromEntries(results));
    } catch {
      setError("Impossible de charger les indicateurs.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" sx={{ fontSize: { xs: 28, sm: 34 } }}>
            Dashboard
          </Typography>
          <Typography color="text.secondary">Vue d'ensemble du tenant courant.</Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={load}
          sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
        >
          Actualiser
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        {kpis.map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.label}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                border: 1,
                borderColor: "divider",
                minHeight: 124,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="h4" sx={{ mt: 1 }}>
                {counts[item.label] ?? "-"}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
