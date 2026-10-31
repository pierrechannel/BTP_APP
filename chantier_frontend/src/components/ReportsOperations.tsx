import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { AnalyticsLineChart, compactDashboardGrid as dashboardGrid, formatNumber as n, MetricCard, monthRange, panelSx } from './AnalyticsWidgets';
import { StatusBadge } from './StatusBadge';
import { useWorkspace } from '../state/workspace';

export type ReportOperationsData = {
  attendance: { workers: number; entries: number; normal_hours: number | string | null; overtime_hours: number | string | null; validated: number };
  expense_statuses: Array<{ status: string; count: number }>;
  spending_categories: Array<{ budget_line__category: string; currency: string; amount: number | string }>;
  recent_expenses: Array<{ id: string; date: string; supplier_name: string; budget_line__label: string; budget_line__budget__project__name: string; amount_including_tax: number | string; currency: string; status: string; archived_at: string | null }>;
  attention_tasks: Array<{ id: string; name: string; project__name: string; planned_end_date: string; progress_percent: number | string; status: string; archived_at: string | null }>;
  report_statuses: Array<{ status: string; count: number }>;
  monthly_reports: Array<{ month: string; status: string; count: number }>;
};

export function ReportsOperationalOverview({ data, onHistory }: { data: ReportOperationsData; onHistory: (status?: string) => void }) {
  const reports = (status?: string) => data.report_statuses.filter((item) => !status || item.status === status).reduce((total, item) => total + item.count, 0);
  const pendingExpenses = data.expense_statuses.filter((item) => ['draft', 'submitted'].includes(item.status)).reduce((total, item) => total + item.count, 0);
  const months = monthRange(data.monthly_reports.map((item) => item.month));
  return <>
    <Box sx={dashboardGrid}>
      <MetricCard compact label="Heures pointées" value={`${n(Number(data.attendance.normal_hours || 0) + Number(data.attendance.overtime_hours || 0))} h`} detail={`${n(data.attendance.workers)} collaborateurs · ${n(data.attendance.validated)} pointages validés sur ${n(data.attendance.entries)}`} />
      <MetricCard compact label="Dépenses à traiter" value={n(pendingExpenses)} detail="Dépenses en brouillon ou soumises sur la période" color={pendingExpenses ? '#a8742a' : '#216e58'} />
      <MetricCard compact label="Rapports disponibles" value={n(reports('completed'))} detail={`${n(reports())} éditions créées dans le périmètre sélectionné`} color="#3e6d98" />
      <MetricCard compact label="Rapports en échec" value={n(reports('failed'))} detail={`${n(reports('pending'))} éditions en attente de génération`} color={reports('failed') ? '#ad504b' : '#216e58'} />
    </Box>
    <Paper variant="outlined" sx={panelSx}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} mb={2}><Box><Typography variant="h6">Production des rapports</Typography><Typography fontSize={12} color="text.secondary">Éditions par mois de création, selon leur statut actuel</Typography></Box><Button onClick={() => onHistory()}>Consulter l’historique</Button></Stack>
      <AnalyticsLineChart integerTicks showArea={false} title="Évolution des rapports générés" labels={months.map((month) => new Date(`${month}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }))} unit="rapport(s)" series={[
        { name: 'Disponibles', color: '#39775b', status: 'completed' }, { name: 'En attente', color: '#b78c3e', status: 'pending', dash: '7 4' }, { name: 'En échec', color: '#b65e57', status: 'failed', dash: '2 4' },
      ].map((s) => ({ name: s.name, color: s.color, dash: s.dash, values: months.map((month) => data.monthly_reports.filter((item) => item.month.startsWith(month) && item.status === s.status).reduce((sum, item) => sum + item.count, 0)) }))} />
      <Stack direction="row" gap={1} flexWrap="wrap" mt={1}><Chip label={`${reports('completed')} disponibles`} color="success" variant="outlined" onClick={() => onHistory('completed')} /><Chip label={`${reports('pending')} en attente`} color="warning" variant="outlined" onClick={() => onHistory('pending')} /><Chip label={`${reports('failed')} en échec`} color={reports('failed') ? 'error' : 'default'} variant="outlined" onClick={() => onHistory('failed')} /></Stack>
    </Paper>
  </>;
}

export function ReportsAttention({ data, currency }: { data: ReportOperationsData; currency: string }) {
  const { can } = useWorkspace();
  const categories = data.spending_categories.filter((item) => item.currency === currency);
  const sum = categories.reduce((total, item) => total + Number(item.amount), 0);
  return <>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(0, 1fr)' }, gap: 3 }}>
      <Paper variant="outlined" sx={panelSx}><Typography variant="h6">Priorités du planning</Typography><Typography fontSize={12} color="text.secondary" mb={2}>Les 8 tâches les plus anciennes encore en retard</Typography>
        {data.attention_tasks.map((task) => <Stack key={task.id} direction="row" alignItems="center" justifyContent="space-between" gap={2} py={1.5} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}><Box minWidth={0}><Typography fontSize={13} fontWeight={600}>{task.name}</Typography><Typography fontSize={12} color="text.secondary">{task.project__name} · prévue le {new Date(`${task.planned_end_date}T12:00:00`).toLocaleDateString('fr-FR')}</Typography></Box>{!task.archived_at && can('planning') && <Button component={RouterLink} to={`/planning/${task.id}`} size="small">Voir</Button>}</Stack>)}
        {!data.attention_tasks.length && <Typography color="text.secondary" fontSize={13} py={4}>Aucune tâche en retard dans ce périmètre.</Typography>}
      </Paper>
      <Paper variant="outlined" sx={panelSx}><Typography variant="h6">Dépenses par catégorie</Typography><Typography fontSize={12} color="text.secondary" mb={3}>Montants TTC validés ou payés · {currency || 'Aucune devise'}</Typography><Stack spacing={2.25}>{categories.map((item) => <Box key={item.budget_line__category}><Stack direction="row" justifyContent="space-between" mb={.75} gap={2}><Typography fontSize={13}>{item.budget_line__category || 'Non classé'}</Typography><Typography fontSize={13} fontWeight={600}>{n(item.amount)} {currency}</Typography></Stack><LinearProgress variant="determinate" value={sum > 0 ? Number(item.amount) / sum * 100 : 0} sx={{ height: 7, borderRadius: 2, bgcolor: '#eef2ef' }} /></Box>)}</Stack>{!categories.length && <Typography color="text.secondary" fontSize={13} py={4}>Aucune dépense validée dans cette devise.</Typography>}</Paper>
    </Box>

  </>;
}

export function ReportsExpenses({ data }: { data: ReportOperationsData }) {
  const { can } = useWorkspace();
  return (
    <Paper variant="outlined" sx={panelSx}><Typography variant="h6">Dernières dépenses</Typography><Typography fontSize={12} color="text.secondary" mb={2}>Les 8 dépenses les plus récentes de la période, tous statuts</Typography><TableContainer><Table size="small" aria-label="Dernières dépenses des rapports"><TableHead><TableRow><TableCell>Dépense</TableCell><TableCell>Chantier</TableCell><TableCell>Date</TableCell><TableCell align="right">Montant TTC</TableCell><TableCell>Statut</TableCell><TableCell>Action</TableCell></TableRow></TableHead><TableBody>{data.recent_expenses.map((item) => <TableRow key={item.id} hover><TableCell><Typography fontSize={13} fontWeight={600}>{item.supplier_name || item.budget_line__label}</Typography><Typography fontSize={12} color="text.secondary">{item.budget_line__label}</Typography></TableCell><TableCell>{item.budget_line__budget__project__name}</TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(`${item.date}T12:00:00`).toLocaleDateString('fr-FR')}</TableCell><TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{n(item.amount_including_tax)} {item.currency}</TableCell><TableCell><StatusBadge value={item.status} /></TableCell><TableCell>{!item.archived_at && can('budget') && <Button size="small" component={RouterLink} to={`/budget/expenses/${item.id}`}>Voir</Button>}</TableCell></TableRow>)}{!data.recent_expenses.length && <TableRow><TableCell colSpan={6}>Aucune dépense sur la période.</TableCell></TableRow>}</TableBody></Table></TableContainer></Paper>
  );
}
