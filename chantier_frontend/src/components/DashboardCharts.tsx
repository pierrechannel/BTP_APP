import { FormTextField as TextField } from './FormTextField';
import { useState } from "react";
import { Box, Button, MenuItem, Paper, Stack, Typography } from "@mui/material";
import { statusLabels } from "../api/workspace";

type MonthlyAmount = { month: string; currency: string; amount: string | number };
const palette: Record<string, string> = { todo: "#9eafa5", in_progress: "#4882ad", done: "#39775b", blocked: "#db9950", cancelled: "#b66c68" };
const format = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export function SpendingLineChart({ rows, currency }: { rows: MonthlyAmount[]; currency: string }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 720, height = 290, left = 70, right = 25, top = 35, bottom = 50;
  const max = Math.max(...rows.map((row) => Number(row.amount)), 1);
  const point = (index: number) => ({ x: left + index * (width - left - right) / Math.max(rows.length - 1, 1), y: height - bottom - Number(rows[index].amount) / max * (height - bottom - top) });
  const points = rows.map((_, index) => { const p = point(index); return `${p.x},${p.y}`; }).join(" ");
  const label = (month: string) => new Date(`${month.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  return <>
    <Box sx={{ overflowX: "auto" }}>
      <svg role="img" aria-label={`Évolution des dépenses en ${currency}`} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", width: "100%", minWidth: 580 }}>
        <title>Dépenses mensuelles validées et payées en {currency}</title>
        {[0, .25, .5, .75, 1].map((ratio) => { const y = height - bottom - ratio * (height - bottom - top); return <g key={ratio}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#e1e9e4" strokeDasharray="4 4" /><text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#65776c">{Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(max * ratio)}</text></g>; })}
        {rows.length > 0 && <><polygon points={`${left},${height - bottom} ${points} ${point(rows.length - 1).x},${height - bottom}`} fill="#39775b" opacity=".08" /><polyline points={points} fill="none" stroke="#39775b" strokeWidth="3" strokeLinejoin="round" /></>}
        {rows.map((row, index) => { const p = point(index); return <g key={row.month}>
          <text x={p.x} y={height - 22} textAnchor="middle" fontSize="10" fill="#65776c">{label(row.month)}</text>
          <circle cx={p.x} cy={p.y} r={active === index ? 7 : 5} fill="#39775b" stroke="white" strokeWidth="2" tabIndex={0} aria-label={`${label(row.month)} : ${format(Number(row.amount))} ${currency}`} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}><title>{label(row.month)} : {format(Number(row.amount))} {currency}</title></circle>
        </g>; })}
      </svg>
    </Box>
    <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ minHeight: 24 }}>{active !== null && rows[active] ? `${label(rows[active].month)} : ${format(Number(rows[active].amount))} ${currency}` : "Survolez un point ou sélectionnez-le au clavier pour voir son montant."}</Typography>
    <Box component="details" sx={{ mt: 1 }}><Box component="summary" sx={{ cursor: "pointer", fontSize: 12, color: "text.secondary" }}>Afficher les valeurs</Box><Stack direction="row" flexWrap="wrap" gap={2} mt={1}>{rows.map((row) => <Typography key={row.month} variant="caption">{label(row.month)} : {format(Number(row.amount))} {currency}</Typography>)}</Stack></Box>
  </>;
}

export function DashboardCharts({ statuses, monthly }: { statuses?: Array<{ status: string; count: number }>; monthly?: MonthlyAmount[] }) {
  const [selectedCurrency, setCurrency] = useState("");
  const [selectedStatus, setStatus] = useState("");
  const currencies = [...new Set((monthly ?? []).map((row) => row.currency))];
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? "";
  const rows = (monthly ?? []).filter((row) => row.currency === currency);
  const total = (statuses ?? []).reduce((sum, row) => sum + row.count, 0);
  const selected = statuses?.find((row) => row.status === selectedStatus);
  const radius = 75, perimeter = 2 * Math.PI * radius;
  let offset = 0;
  if (!statuses && !monthly) return null;
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: statuses && monthly ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }, gap: 3 }}>
    {statuses && <Paper variant="outlined" tabIndex={0} sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0, height: { xs: 320, md: 360 }, overflowY: "auto", overscrollBehavior: "contain", scrollbarGutter: "stable" }}>
      <Typography variant="h6">Répartition des tâches</Typography><Typography variant="body2" color="text.secondary">Situation actuelle par statut</Typography>
      {!total ? <Typography color="text.secondary" py={5}>Aucune tâche dans ce périmètre.</Typography> : <>
        <Box sx={{ maxWidth: 260, mx: "auto" }}><svg viewBox="0 0 220 220" role="img" aria-label={`Répartition de ${total} tâches`} style={{ display: "block", width: "100%" }}><title>Répartition des tâches par statut</title>
          {(statuses ?? []).map((row) => { const length = row.count / total * perimeter; const start = offset; offset += length; return <circle key={row.status} cx="110" cy="110" r={radius} fill="none" stroke={palette[row.status] ?? "#39775b"} strokeWidth={selectedStatus === row.status ? 28 : 23} strokeDasharray={`${length} ${perimeter - length}`} strokeDashoffset={-start} transform="rotate(-90 110 110)"><title>{statusLabels[row.status] ?? row.status} : {row.count}</title></circle>; })}
          <text x="110" y="110" textAnchor="middle" fontSize="30" fontWeight="700" fill="#234f3d">{selected?.count ?? total}</text><text x="110" y="132" textAnchor="middle" fontSize="12" fill="#65776c">{selected ? statusLabels[selected.status] ?? selected.status : "tâches au total"}</text>
        </svg></Box>
        <Stack spacing={.5}>{statuses.map((row) => <Button key={row.status} aria-pressed={selectedStatus === row.status} onClick={() => setStatus((current) => current === row.status ? "" : row.status)} sx={{ justifyContent: "space-between", color: "text.primary", bgcolor: selectedStatus === row.status ? "#edf4ef" : undefined }}><Stack direction="row" alignItems="center" gap={1}><Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: palette[row.status] ?? "#39775b" }} />{statusLabels[row.status] ?? row.status}</Stack><span>{row.count} · {Math.round(row.count / total * 100)} %</span></Button>)}</Stack>
      </>}
    </Paper>}
    {monthly && <Paper variant="outlined" tabIndex={0} sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0, height: { xs: 320, md: 360 }, overflowY: "auto", overscrollBehavior: "contain", scrollbarGutter: "stable" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} mb={2}><Box><Typography variant="h6">Évolution des dépenses</Typography><Typography variant="body2" color="text.secondary">12 derniers mois · TTC validé ou payé · mois en cours partiel</Typography></Box>{currencies.length > 0 && <TextField select size="small" label="Devise" value={currency} onChange={(event) => setCurrency(event.target.value)} sx={{ minWidth: 95 }}>{currencies.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>}</Stack>
      {!rows.length ? <Typography color="text.secondary" py={5}>Aucune dépense validée dans ce périmètre.</Typography> : <SpendingLineChart key={currency} rows={rows} currency={currency} />}
    </Paper>}
  </Box>;
}
