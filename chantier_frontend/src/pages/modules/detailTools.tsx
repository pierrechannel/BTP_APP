import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { api } from "../../api/client";
import { ApiRecord } from "../../api/types";

export function useDetailRecord(endpoint: string, label: string) {
  const { id } = useParams();
  const [record, setRecord] = useState<ApiRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError("");
    api
      .get<ApiRecord>(`${endpoint}${id}/`)
      .then((response) => setRecord(response.data))
      .catch(() => setError(`Impossible de charger ${label}.`))
      .finally(() => setLoading(false));
  }, [endpoint, id, label]);

  return { record, loading, error };
}

export function DetailHeader({
  title,
  subtitle,
  backTo,
}: {
  title: string;
  subtitle: string;
  backTo: string;
}) {
  const navigate = useNavigate();

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent="space-between"
      spacing={2}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: 20, sm: 22 }, lineHeight: 1.3 }} noWrap>
          {title}
        </Typography>
        <Typography color="text.secondary" noWrap>
          {subtitle}
        </Typography>
      </Box>
      <Button
        variant="outlined"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(backTo)}
        sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
      >
        Retour
      </Button>
    </Stack>
  );
}

export function DetailState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string;
  children: React.ReactNode;
}) {
  if (error) return <Alert severity="error">{error}</Alert>;
  if (loading) {
    return (
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider" }}>
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 280 }}>
          <CircularProgress />
        </Stack>
      </Paper>
    );
  }
  return <>{children}</>;
}

export function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider", overflow: "hidden" }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <Typography variant="h6">{title}</Typography>
      </Box>
      <Divider />
      <Box sx={{ p: { xs: 2, sm: 3 } }}>{children}</Box>
    </Paper>
  );
}

export function FieldGrid({ fields }: { fields: Array<[string, unknown]> }) {
  const visibleFields = useMemo(
    () => fields.filter(([, value]) => value !== null && value !== undefined && value !== ""),
    [fields],
  );

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
      }}
    >
      {visibleFields.map(([label, value]) => (
        <Box key={label} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography sx={{ overflowWrap: "anywhere" }}>{formatValue(value)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

export function asTitle(record: ApiRecord | null, ...keys: string[]) {
  if (!record) return "Detail";
  for (const key of keys) {
    const value = record[key];
    if (value) return String(value);
  }
  return String(record.name ?? record.title ?? record.code ?? record.id ?? "Detail");
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(", ") : "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
