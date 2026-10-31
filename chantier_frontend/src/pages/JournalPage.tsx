import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, LinearProgress, MenuItem, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { FormTextField as TextField } from '../components/FormTextField';
import { PageHeading } from '../components/PageHeading';
import { MetricCard, compactDashboardGrid } from '../components/AnalyticsWidgets';
import { StatusBadge } from '../components/StatusBadge';
import { ApiRecord } from '../api/types';
import { errorMessage, fetchCollection, formatValue } from '../api/workspace';
import { useWorkspace } from '../state/workspace';

export function JournalPage() {
  const { projectId, setProjectId, projects, can } = useWorkspace(); const [params, setParams] = useSearchParams();
  useEffect(() => {
    const requested = params.get('project');
    if (requested && projects.some(project => String(project.id) === requested)) {
      setProjectId(requested);
      setParams(current => { const next = new URLSearchParams(current); next.delete('project'); return next; }, { replace: true });
    }
  }, [params, projects, setProjectId, setParams]);
  const [rows, setRows] = useState<ApiRecord[]>([]); const [snags, setSnags] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0); const [limit, setLimit] = useState(20);
  const project = params.get('project') || projectId; const start = params.get('from') || ''; const end = params.get('to') || ''; const search = params.get('search') || ''; const status = params.get('status') || '';
  const view = params.get('view') || 'table';
  const invalid = !!start && !!end && start > end;
  const setFilter = (key: string, value: string) => { setLimit(20); setParams(current => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; }, { replace: true }); };
  useEffect(() => { const change = () => setRevision(value => value + 1); window.addEventListener('chantier:data-changed', change); return () => window.removeEventListener('chantier:data-changed', change); }, []);
  useEffect(() => {
    const controller = new AbortController(); setRows([]); setSnags([]); setError('');
    if (invalid) { setLoading(false); return; }
    setLoading(true);
    Promise.all([fetchCollection('/progress/daily-reports/', { project: project || undefined, start_date: start || undefined, end_date: end || undefined }, controller.signal), fetchCollection('/progress/snags/', { project: project || undefined }, controller.signal)]).then(([reports, reserves]) => {
      if (!controller.signal.aborted) { setRows(reports); setSnags(reserves); }
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project, start, end, revision, invalid]);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Bujumbura', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const visible = rows.filter(row => (!status || row.status === status) && (!search || `${row.work_done} ${row.difficulties} ${row.weather} ${row.project_name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const source = `/progress?${params}`;
  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><PageHeading eyebrow="SUIVI DU TERRAIN" title="Journal de chantier" subtitle="Travaux réalisés, observations et photos, jour après jour." />{can('progress', 'create') && <Button component={RouterLink} to={`/progress/nouveau${project ? `?project=${project}` : ''}`} state={{ returnTo: source }} variant="contained">Nouveau rapport</Button>}</Stack>
    <Tabs value="/progress" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Journal et suivi du terrain">{[['/progress', 'Rapports journaliers'], ['/progress/photos', 'Photos'], ['/progress/updates', 'Relevés d’avancement'], ['/progress/snags', 'Réserves']].map(([path, label]) => <Tab key={path} value={path} component={RouterLink} to={project ? `${path}?project=${project}` : path} label={label} />)}</Tabs>
    <Box sx={compactDashboardGrid}>{[['Brouillons', rows.filter(row => row.status === 'draft').length], ['À valider', rows.filter(row => row.status === 'submitted').length], ['Validés', rows.filter(row => row.status === 'validated').length], ['Réserves en retard', snags.filter(row => !['resolved', 'closed'].includes(String(row.status)) && row.due_date && String(row.due_date) < today).length]].map(([label, value]) => <MetricCard compact key={String(label)} label={String(label)} value={loading ? '—' : value} detail={label === 'Réserves en retard' ? 'À ce jour, sur le chantier sélectionné' : 'Rapports de la période sélectionnée'} />)}</Box>
    <Paper variant="outlined" sx={{ p: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} flexWrap="wrap">
      <TextField size="small" label="Rechercher" value={search} onChange={e => setFilter('search', e.target.value)} />
      <TextField size="small" select label="Statut" value={status} sx={{ minWidth: 150 }} onChange={e => setFilter('status', e.target.value)}><MenuItem value="">Tous les statuts</MenuItem>{[['draft', 'Brouillon'], ['submitted', 'Soumis'], ['validated', 'Validé']].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
      <TextField size="small" type="date" label="Du" value={start} onChange={e => setFilter('from', e.target.value)} /><TextField size="small" type="date" label="Au" value={end} error={invalid} onChange={e => setFilter('to', e.target.value)} />
      <Button onClick={() => setParams(project ? { project } : {})}>Réinitialiser</Button><Button onClick={() => setRevision(value => value + 1)}>Actualiser</Button>
    </Stack></Paper>
    {invalid && <Alert severity="warning">La fin doit suivre le début.</Alert>}{error && <Alert severity="error">{error}</Alert>}{loading && <LinearProgress />}
    {!loading && !error && !invalid && !visible.length && <Alert severity="info">Aucun rapport ne correspond à ce périmètre.</Alert>}
    <Stack direction="row" justifyContent="flex-end" gap={1}><Button variant={view === 'table' ? 'contained' : 'outlined'} aria-pressed={view === 'table'} onClick={() => setFilter('view', 'table')}>Tableau</Button><Button variant={view === 'cards' ? 'contained' : 'outlined'} aria-pressed={view === 'cards'} onClick={() => setFilter('view', 'cards')}>Cartes</Button></Stack>
    {view !== 'cards' ? <TableContainer component={Paper} variant="outlined"><Table size="small" aria-label="Rapports journaliers" sx={{ minWidth: 800 }}><TableHead><TableRow>{['Date', 'Chantier', 'Météo', 'Travaux réalisés', 'Statut', 'Photos', 'Actions'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>
      {visible.slice(0, limit).map(row => <TableRow key={row.id} hover><TableCell sx={{ whiteSpace: 'nowrap' }}>{formatValue(row.report_date, 'report_date')}</TableCell><TableCell>{String(row.project_name || '')}</TableCell><TableCell>{String(row.weather || '—')}</TableCell><TableCell sx={{ maxWidth: 320 }}><Typography fontSize={13} noWrap title={String(row.work_done || '')}>{String(row.work_done || 'Travaux à compléter')}</Typography></TableCell><TableCell><StatusBadge value={row.status} /></TableCell><TableCell>{Array.isArray(row.photos) ? row.photos.length : 0}</TableCell><TableCell><Stack direction="row" gap={1}><Button component={RouterLink} to={`/progress/${row.id}`} size="small">Consulter</Button>{row.status === 'draft' && can('progress', 'update') && <Button component={RouterLink} to={`/progress/${row.id}/modifier`} state={{ returnTo: source }} size="small">Modifier</Button>}</Stack></TableCell></TableRow>)}
      {!visible.length && <TableRow><TableCell colSpan={7}>Aucun rapport dans ce périmètre.</TableCell></TableRow>}
    </TableBody></Table></TableContainer> : <>
    {visible.slice(0, limit).map(row => <Paper key={row.id} variant="outlined" sx={{ p: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}><Box><Typography component={RouterLink} to={`/progress/${row.id}`} fontWeight={700} color="primary.main" sx={{ textDecoration: 'none' }}>Rapport du {formatValue(row.report_date, 'report_date')}</Typography><Typography fontSize={12} color="text.secondary">{String(row.project_name || '')}{row.weather ? ` · ${row.weather}` : ''}</Typography></Box><StatusBadge value={row.status} /></Stack>
      <Typography fontSize={13} mt={1} sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>{String(row.work_done || 'Travaux à compléter')}</Typography>
      {Boolean(row.difficulties) && <Typography fontSize={12} color="warning.dark" mt={1} noWrap>Observation : {String(row.difficulties)}</Typography>}
      <Stack direction="row" gap={1} mt={1} alignItems="center"><Chip size="small" variant="outlined" label={`${Array.isArray(row.photos) ? row.photos.length : 0} photo(s)`} /><Button component={RouterLink} to={`/progress/${row.id}`}>Consulter</Button>{row.status === 'draft' && can('progress', 'update') && <Button component={RouterLink} to={`/progress/${row.id}/modifier`} state={{ returnTo: source }}>Compléter</Button>}</Stack>
    </Paper>)}
    </>}
    {visible.length > limit && <Button onClick={() => setLimit(value => value + 20)}>Afficher plus de rapports</Button>}
  </Stack>;
}
