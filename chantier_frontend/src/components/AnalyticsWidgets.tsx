import { ReactNode, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Stack, Typography } from '@mui/material';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import QueryStatsIcon from '@mui/icons-material/QueryStats';

export const dashboardGrid = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 2 };
export const panelSx = { p: { xs: 2, md: 3 }, borderRadius: 2.5, minWidth: 0 };
export const formatNumber = (value: number | string | null | undefined) => Number(value ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
export function monthRange(values: string[]) {
  const sorted = values.map((value) => value.slice(0, 7)).sort();
  if (!sorted.length) return [];
  const result: string[] = [];
  const cursor = new Date(`${sorted[0]}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 7) <= sorted[sorted.length - 1]) {
    result.push(cursor.toISOString().slice(0, 7)); cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

export function MetricCard({ label, value, detail, icon, color = '#216e58', to }: { label: string; value: ReactNode; detail: string; icon?: ReactNode; color?: string; to?: string }) {
  const content = <><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontSize={13} color="text.secondary" fontWeight={600}>{label}</Typography><Box sx={{ display: 'grid', placeItems: 'center', color, bgcolor: `${color}12`, width: 38, height: 38, borderRadius: 2 }}>{icon ?? (to ? <ArrowOutwardIcon fontSize="small" /> : <QueryStatsIcon fontSize="small" />)}</Box></Stack><Typography fontSize={{ xs: 28, md: 32 }} fontWeight={750} lineHeight={1.25} sx={{ mt: 1.75, mb: 1, color }}>{value}</Typography><Typography fontSize={12} color="text.secondary">{detail}</Typography></>;
  return to ? <Paper variant="outlined" component={RouterLink} to={to} sx={{ ...panelSx, color: 'inherit', textDecoration: 'none', transition: 'border-color .2s', '&:hover': { borderColor: color } }}>{content}</Paper> : <Paper variant="outlined" sx={panelSx}>{content}</Paper>;
}

type Series = { name: string; color: string; values: number[] };
export function AnalyticsLineChart({ labels, series, title, unit = '' }: { labels: string[]; series: Series[]; title: string; unit?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const w = 760, h = 260, left = 58, right = 22, top = 20, bottom = 42;
  const max = Math.max(1, ...series.flatMap((item) => item.values));
  const x = (i: number) => labels.length === 1 ? w / 2 : left + i * (w - left - right) / Math.max(labels.length - 1, 1);
  const y = (v: number) => h - bottom - v / max * (h - top - bottom);
  if (!labels.length) return <Box sx={{ py: 7, textAlign: 'center', bgcolor: '#f8faf9', borderRadius: 2 }}><Typography color="text.secondary" fontSize={13}>Aucune donnée pour cette période.</Typography></Box>;
  return <>
    <Stack direction="row" gap={2} flexWrap="wrap" mb={2}>{series.map((s) => <Stack key={s.name} direction="row" gap={.75} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} /><Typography fontSize={12} color="text.secondary">{s.name}</Typography></Stack>)}</Stack>
    <Box sx={{ overflowX: 'auto' }}><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={title} style={{ display: 'block', width: '100%', minWidth: 380 }}>
      <title>{title}</title>
      {[0, .25, .5, .75, 1].map((r) => <g key={r}><line x1={left} x2={w - right} y1={y(max * r)} y2={y(max * r)} stroke="#e4eae6" strokeDasharray="4 4" /><text x={left - 10} y={y(max * r) + 4} textAnchor="end" fill="#6c7b72" fontSize="11">{Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(max * r)}</text></g>)}
      {series.map((s) => <g key={s.name}>
        {series.length === 1 && <polygon points={`${x(0)},${y(0)} ${s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} ${x(labels.length - 1)},${y(0)}`} fill={s.color} opacity=".07" />}
        <polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={active === i || labels.length < 15 ? 4 : 2} fill={s.color} stroke="#fff" strokeWidth="1.5" tabIndex={0} aria-label={`${labels[i]} · ${s.name} : ${formatNumber(v)} ${unit}`} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}><title>{labels[i]} · {s.name} : {formatNumber(v)} {unit}</title></circle>)}
      </g>)}
      {labels.map((label, i) => (i % Math.ceil(labels.length / 7) === 0 || i === labels.length - 1) && <text key={i} x={x(i)} y={h - 14} textAnchor="middle" fill="#6c7b72" fontSize="10">{label}</text>)}
    </svg></Box>
    <Typography aria-live="polite" fontSize={12} color="text.secondary" sx={{ minHeight: 22, mt: 1 }}>{active !== null && labels[active] ? `${labels[active]} · ${series.map((s) => `${s.name} : ${formatNumber(s.values[active])} ${unit}`).join(' · ')}` : 'Survolez un point ou utilisez le clavier pour afficher les valeurs.'}</Typography>
  </>;
}
