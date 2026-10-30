import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, LinearProgress, MenuItem, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import { usePlatformOverview } from '../../state/platform';
import { useAuth } from '../../state/auth';
import { statusLabels } from '../../api/workspace';
import { AnalyticsLineChart, dashboardGrid, formatNumber as n, MetricCard, panelSx } from '../../components/AnalyticsWidgets';

export function PlatformDashboardPage() {
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<'events' | 'users' | 'tenants' | 'projects'>('events');
  const [search, setSearch] = useState('');
  const { data, loading, error, refresh } = usePlatformOverview(days);
  const { setTenantId } = useAuth();
  const navigate = useNavigate();
  const scope = (id: string, path: string) => { setTenantId(id); navigate(path); };
  const date = (value: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', timeZone: 'Africa/Bujumbura' }).format(new Date(value));
  const labels = { events: 'Événements d’audit', users: 'Nouveaux comptes', tenants: 'Nouvelles entreprises', projects: 'Nouveaux chantiers' };
  const failures = (data?.sync_failed ?? 0) + (data?.reports_failed ?? 0);
  return <Stack spacing={3}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
      <Box><Typography variant="overline" color="primary.main">ADMINISTRATION PLATEFORME</Typography><Typography variant="h4" component="h1">Tableau de bord</Typography><Typography variant="body2" color="text.secondary" mt={1}>Adoption, activité des entreprises et suivi des traitements, sur toute la plateforme.</Typography></Box>
      <Stack direction="row" gap={1} alignItems="center"><TextField select size="small" label="Période d’activité" value={days} onChange={(e) => setDays(Number(e.target.value))} sx={{ minWidth: 160 }}>{[7, 30, 90].map((value) => <MenuItem key={value} value={value}>{value} derniers jours</MenuItem>)}</TextField><Button variant="outlined" startIcon={<RefreshIcon />} disabled={loading} onClick={refresh}>Actualiser</Button></Stack>
    </Stack>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={refresh}>Réessayer</Button>}>{error}</Alert>}
    {loading ? <Box sx={dashboardGrid}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={170} />)}</Box> : data && <>
      <Box sx={dashboardGrid}>
        <MetricCard label="Entreprises" value={n(data.tenants)} detail={`${n(data.active_tenants)} actives · ${n(data.tenants - data.active_tenants)} suspendues`} icon={<BusinessOutlinedIcon />} to="/platform/tenants" />
        <MetricCard label="Utilisateurs" value={n(data.users)} detail={`${n(data.active_users)} comptes actifs sur la plateforme`} icon={<PeopleOutlineIcon />} to="/platform/users" color="#3e6d98" />
        <MetricCard label="Chantiers" value={n(data.projects)} detail="Tous les chantiers conservés, archives comprises" icon={<ConstructionOutlinedIcon />} to="/platform/tenants" color="#92702b" />
        <MetricCard label="Activité sur la période" value={n(data.period_summary.events)} detail={`${n(data.active_tenants_in_period)} entreprises avec une activité d’audit`} icon={<HistoryIcon />} to="/platform/audit" color="#7863a0" />
      </Box>
      <Paper variant="outlined" sx={{ ...panelSx, bgcolor: '#f1f7f3' }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
        <Box><Typography fontWeight={700}>{failures ? `${n(failures)} traitements en échec à examiner` : 'Connexion à la base disponible'}</Typography><Typography fontSize={12} color="text.secondary">{n(data.sync_pending)} synchronisations et {n(data.reports_pending)} rapports en attente. État actuel des files.</Typography></Box><Button component={RouterLink} to="/platform/health">Consulter l’état du système</Button>
      </Stack></Paper>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.8fr) minmax(0, 1fr)' }, gap: 3 }}>
        <Paper variant="outlined" sx={panelSx}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} mb={2}><Box><Typography variant="h6">Évolution de l’activité</Typography><Typography fontSize={12} color="text.secondary">Du {date(data.period.start_date)} au {date(data.period.end_date)} · Bujumbura</Typography></Box><TextField select size="small" label="Indicateur" value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} sx={{ minWidth: 170 }}>{Object.entries(labels).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField></Stack>
          <AnalyticsLineChart title={labels[metric]} labels={data.activity.map((row) => date(row.date))} series={[{ name: labels[metric], color: '#39775b', values: data.activity.map((row) => row[metric]) }]} />
          <Stack direction="row" gap={3} flexWrap="wrap" mt={2}><Box><Typography fontSize={12} color="text.secondary">Période sélectionnée</Typography><Typography fontWeight={700}>{n(data.period_summary[metric])}</Typography></Box><Box><Typography fontSize={12} color="text.secondary">{days} jours précédents</Typography><Typography fontWeight={700}>{n(data.previous_summary[metric])}</Typography></Box></Stack>
        </Paper>
        <Paper variant="outlined" sx={panelSx}><Typography variant="h6">Répartition des chantiers</Typography><Typography fontSize={12} color="text.secondary" mb={3}>Situation actuelle, toutes les entreprises</Typography><Stack spacing={2.5}>{data.project_statuses.map((row) => <Box key={row.status}><Stack direction="row" justifyContent="space-between" mb={.75}><Typography fontSize={13}>{statusLabels[row.status] ?? row.status}</Typography><Typography fontSize={13} fontWeight={700}>{n(row.count)}</Typography></Stack><LinearProgress variant="determinate" value={data.projects ? row.count / data.projects * 100 : 0} sx={{ height: 8, borderRadius: 2, bgcolor: '#eef2ef' }} /></Box>)}</Stack>{!data.project_statuses.length && <Typography color="text.secondary" mt={3}>Aucun chantier enregistré.</Typography>}</Paper>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.5fr) minmax(0, 1fr)' }, gap: 3 }}>
        <Paper variant="outlined" sx={panelSx}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} mb={2}><Box><Typography variant="h6">Entreprises à suivre</Typography><Typography fontSize={12} color="text.secondary">Les 10 entreprises avec le plus d’activité sur la période</Typography></Box><Button component={RouterLink} to="/platform/tenants">Toutes</Button></Stack><TextField size="small" fullWidth label="Rechercher dans cette sélection" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2 }} />
          <TableContainer><Table size="small" aria-label="Activité des entreprises"><TableHead><TableRow><TableCell>Entreprise</TableCell><TableCell align="right">Membres</TableCell><TableCell align="right">Chantiers</TableCell><TableCell align="right">Activité</TableCell><TableCell>Accès</TableCell></TableRow></TableHead><TableBody>{data.top_tenants.filter((row) => row.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((row) => <TableRow key={row.id} hover><TableCell><Typography fontSize={13} fontWeight={600}>{row.name}</Typography><Chip size="small" label={row.is_active ? 'Active' : 'Suspendue'} color={row.is_active ? 'success' : 'default'} variant="outlined" sx={{ mt: .5 }} /></TableCell><TableCell align="right">{row.members}</TableCell><TableCell align="right">{row.projects}</TableCell><TableCell align="right">{row.events}</TableCell><TableCell><Button size="small" onClick={() => scope(row.id, '/platform/users')}>Gérer</Button></TableCell></TableRow>)}{!data.top_tenants.some((row) => row.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <TableRow><TableCell colSpan={5}>Aucune entreprise dans cette sélection.</TableCell></TableRow>}</TableBody></Table></TableContainer>
        </Paper>
        <Paper variant="outlined" sx={panelSx}><Stack direction="row" justifyContent="space-between" mb={1}><Box><Typography variant="h6">Activité récente</Typography><Typography fontSize={12} color="text.secondary">Derniers événements, toutes périodes</Typography></Box><Button component={RouterLink} to="/platform/audit">Journal</Button></Stack>
          {data.recent_events.map((event) => <Box key={event.id} sx={{ py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}><Stack direction="row" alignItems="start" justifyContent="space-between" gap={1}><Typography fontSize={13} fontWeight={700}>{event.action}</Typography><Typography fontSize={11} color="text.secondary" whiteSpace="nowrap">{new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Bujumbura' }).format(new Date(event.created_at))}</Typography></Stack><Typography fontSize={12} color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{event.tenant_name} · {event.user}</Typography>{event.tenant_id && <Button size="small" sx={{ px: 0, py: .25, minWidth: 0 }} onClick={() => scope(event.tenant_id!, '/platform/audit')}>Voir le journal de l’entreprise</Button>}</Box>)}
          {!data.recent_events.length && <Typography color="text.secondary" py={4}>Aucune activité enregistrée.</Typography>}
        </Paper>
      </Box>
      <Typography fontSize={11} color="text.secondary">Actualisé le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Bujumbura' }).format(new Date(data.checked_at))}. Les compteurs globaux et les files ne dépendent pas de la période ni de l’entreprise sélectionnée.</Typography>
    </>}
  </Stack>;
}
