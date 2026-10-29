import { useEffect, useState } from "react";
import { Alert, Box, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import { api } from "../api/client";
import { errorMessage, formatValue } from "../api/workspace";
import { ApiRecord } from "../api/types";

export function BudgetSummary({ record, revision }: { record: ApiRecord; revision: number }) {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setSummary(null); setError("");
    api.get(`/budget/budgets/${record.id}/summary/`, { signal: controller.signal })
      .then(({ data }) => setSummary(data)).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); });
    return () => controller.abort();
  }, [record.id, revision]);
  return <Paper variant="outlined" sx={{ p: 3 }}><Typography variant="h6" mb={2}>Situation budgétaire</Typography>
    {error ? <Alert severity="error">{error}</Alert> : !summary ? <LinearProgress /> : <Stack direction={{ xs: "column", sm: "row" }} gap={4}>
      {[["planned", "Prévu"], ["spent", "Dépenses validées et payées"], ["remaining", "Disponible"]].map(([key, label]) => <Box flex={1} key={key}>
        <Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h5" color={key === "remaining" && Number(summary[key]) < 0 ? "error.main" : "text.primary"}>{formatValue(summary[key], "amount")} <Typography component="span" variant="body2">{String(summary.currency)}</Typography></Typography>
      </Box>)}
    </Stack>}
  </Paper>;
}
