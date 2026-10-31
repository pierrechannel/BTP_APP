import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, LinearProgress, Paper, Skeleton, Stack, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { api } from '../api/client';
import { ApiRecord } from '../api/types';
import { errorMessage, formatValue } from '../api/workspace';
import { StatusBadge } from './StatusBadge';
import { useWorkspace } from '../state/workspace';

type Task = { id: string; name: string; status: string; planned_end_date: string; progress_percent: number };
type Overview = {
  date: string;
  planning: null | { count: number; completed: number; progress: number | null; overdue: number; blocked: number; tasks: Task[] };
  budget: null | { budget_id: string | null; currency?: string; planned?: string; spent?: string; committed?: string; paid?: string; available?: string; pending?: number };
  qhse: null | { open: number; recent: Array<{ id: string; title: string; status: string }> };
  workforce: null | { assigned: number };
  activity: Array<{ id: string; kind: string; title: string; updated_at: string; status?: string }>;
};
type BudgetKey = keyof NonNullable<Overview['budget']>;

// Colour tones: text colours all keep a contrast ratio >= 4.5:1 on their background.
const tones = {
  ok: { fg: '#1d5444', bg: '#e8f3ed' },
  warn: { fg: '#8a4b00', bg: '#fff3df' },
  danger: { fg: '#b42318', bg: '#fff0ec' },
  neutral: { fg: '#3f4d59', bg: '#eef1f4' },
};
const panel = { p: { xs: 2, md: 2.5 }, borderRadius: 2, minWidth: 0 };
const scrollPanel = { ...panel, height: { xs: 320, md: 360 }, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable', overflowWrap: 'anywhere' } as const;
const sectionTitle = { component: 'h3', variant: 'subtitle1', fontWeight: 700 } as const;
const activityLabel: Record<string, string> = { report: 'Rapport journalier', photo: 'Photo', document: 'Document' };
const activityPath = (kind: string, id: string) => `${kind === 'report' ? '/progress' : kind === 'photo' ? '/progress/photos' : '/documents'}/${id}`;

function OverviewSkeleton() {
  return (
    <Stack spacing={2.5} aria-busy="true" aria-label="Chargement de la situation du chantier">
      <Skeleton variant="text" width={240} height={32} />
      <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: 'minmax(190px, 1fr)', md: 'minmax(0, 1fr)' }, gap: 1.5, overflowX: 'auto' }}>
        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} variant="rounded" height={120} />)}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
        <Skeleton variant="rounded" height={320} />
        <Skeleton variant="rounded" height={320} />
      </Box>
    </Stack>
  );
}

export function ProjectOverview({ project, revision }: { project: ApiRecord; revision: number }) {
  const { can } = useWorkspace();
  // Keep the previous data on screen while refreshing (no flash back to the skeleton).
  const [state, setState] = useState<{ projectId: string; overview: Overview }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(''); setLoading(true);
    api.get<Overview>(`/projects/${project.id}/overview/`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setState({ projectId: String(project.id), overview: data }); })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project.id, revision, retry]);

  const data = state && state.projectId === String(project.id) ? state.overview : undefined;

  if (error && !data) return <Alert severity="error" action={<Button color="inherit" onClick={() => setRetry(v => v + 1)}>Réessayer</Button>}>{error}</Alert>;
  if (!data) return <OverviewSkeleton />;

  const scoped = (path: string) => `${path}?project=${project.id}`;
  const hasBudget = Boolean(data.budget?.budget_id);
  const budgetPath = hasBudget ? `/budget/${data.budget!.budget_id}` : scoped('/budget');
  const budgetValue = (key: BudgetKey) => hasBudget ? `${formatValue(data.budget![key], 'amount')} ${data.budget!.currency ?? ''}`.trim() : 'Non défini';
  const available = hasBudget && data.budget!.available != null ? Number(data.budget!.available) : null;
  const negativeBudget = available !== null && available < 0;
  const overdueProject = Boolean(project.planned_end_date && String(project.planned_end_date) < data.date && project.status !== 'closed');

  const overdue = data.planning?.overdue ?? 0;
  const blocked = data.planning?.blocked ?? 0;
  const pending = data.budget?.pending ?? 0;
  const openIncidents = data.qhse?.open ?? 0;

  const cards = [
    ...(data.planning ? [
      { label: 'Avancement', value: data.planning.progress === null ? 'Non renseigné' : `${Math.round(data.planning.progress)} %`, detail: `${data.planning.completed} / ${data.planning.count} tâches terminées`, icon: <TrendingUpIcon />, tone: tones.ok, path: scoped('/planning') },
      { label: 'Tâches en retard', value: String(overdue), detail: `${blocked} tâche(s) bloquée(s)`, icon: <EventBusyIcon />, tone: overdue ? tones.warn : tones.neutral, path: scoped('/planning') },
    ] : []),
    ...(data.budget ? [
      { label: 'Disponible budgétaire', value: budgetValue('available'), detail: hasBudget ? 'Après dépenses et engagements' : 'Créez un budget pour suivre les dépenses', icon: <AccountBalanceWalletIcon />, tone: !hasBudget ? tones.neutral : negativeBudget ? tones.danger : tones.ok, path: budgetPath },
      { label: 'Dépenses TTC', value: budgetValue('spent'), detail: 'Dépenses validées et payées', icon: <AccountBalanceWalletIcon />, tone: hasBudget ? tones.ok : tones.neutral, path: hasBudget ? `${budgetPath}?tab=expenses` : budgetPath },
    ] : []),
    ...(data.qhse ? [{ label: 'Incidents ouverts', value: String(openIncidents), detail: openIncidents ? 'Signalements à suivre' : 'Aucun signalement en cours', icon: <HealthAndSafetyIcon />, tone: openIncidents ? tones.danger : tones.neutral, path: scoped('/qhse') }] : []),
  ];

  // Priority list, most severe first.
  const alerts: Array<{ key: string; severity: 'error' | 'warning' | 'info'; text: string; to?: string; action?: string }> = [
    ...(negativeBudget ? [{ key: 'budget', severity: 'error' as const, text: `Le budget disponible est négatif : ${budgetValue('available')}.`, to: budgetPath, action: 'Voir le budget' }] : []),
    ...(openIncidents ? [{ key: 'qhse', severity: 'warning' as const, text: `${openIncidents} incident(s) ouvert(s).`, to: scoped('/qhse'), action: 'Voir les incidents' }] : []),
    ...(overdueProject ? [{ key: 'project', severity: 'warning' as const, text: `La date de fin prévue du chantier est dépassée : ${formatValue(project.planned_end_date, 'date')}.` }] : []),
    ...(overdue ? [{ key: 'overdue', severity: 'warning' as const, text: `${overdue} tâche(s) en retard.`, to: scoped('/planning'), action: 'Voir le planning' }] : []),
    ...(blocked ? [{ key: 'blocked', severity: 'warning' as const, text: `${blocked} tâche(s) bloquée(s).`, to: scoped('/planning'), action: 'Voir le planning' }] : []),
    ...(pending ? [{ key: 'pending', severity: 'info' as const, text: `${pending} dépense(s) soumise(s) à valider.`, to: `${budgetPath}?tab=expenses&status=submitted`, action: 'Examiner' }] : []),
  ];

  return <Stack spacing={2.5} aria-busy={loading}>
    {loading && <LinearProgress aria-label="Actualisation en cours" sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }} />}

    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'baseline' }} gap={.5}>
      <Typography component="h2" variant="h6">Situation du chantier</Typography>
      <Typography variant="caption" color="text.secondary">Au {formatValue(data.date, 'date')} (heure de Bujumbura)</Typography>
    </Stack>

    {error && <Alert severity="warning" action={<Button color="inherit" onClick={() => setRetry(v => v + 1)}>Réessayer</Button>}>Actualisation impossible : {error}. Les données affichées peuvent être obsolètes.</Alert>}

    {!cards.length && <Alert severity="info">Aucun module n’est accessible pour afficher la situation de ce chantier.</Alert>}

    {!!cards.length && <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: 'minmax(190px, 1fr)', md: 'minmax(0, 1fr)' }, gap: 1.5, overflowX: 'auto', p: .5, m: -.5 }}>
      {cards.map(card => <Paper key={card.label} component={RouterLink} to={card.path} variant="outlined" aria-label={`${card.label} : ${card.value}. ${card.detail}`}
        sx={{ ...panel, p: 1.5, textDecoration: 'none', color: 'inherit', display: 'block', transition: 'border-color .15s', '&:hover': { borderColor: card.tone.fg }, '&:focus-visible': { outline: `3px solid ${card.tone.fg}`, outlineOffset: 2 }, '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Box aria-hidden sx={{ p: .65, borderRadius: 1, bgcolor: card.tone.bg, color: card.tone.fg, display: 'flex', '& .MuiSvgIcon-root': { fontSize: 19 } }}>{card.icon}</Box>
          <ArrowForwardIcon aria-hidden sx={{ color: 'text.secondary', fontSize: 16 }} />
        </Stack>
        <Typography fontSize={12} color="text.secondary">{card.label}</Typography>
        <Typography component="p" fontSize={21} fontWeight={750} color={card.tone.fg} sx={{ overflowWrap: 'anywhere', my: .25 }}>{card.value}</Typography>
        <Typography fontSize={11} color="text.secondary">{card.detail}</Typography>
      </Paper>)}
    </Box>}

    {!!alerts.length && <Paper variant="outlined" sx={panel} component="section" aria-labelledby="priority-title">
      <Typography id="priority-title" {...sectionTitle} mb={1.5}>À traiter en priorité</Typography>
      <Stack spacing={1} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {alerts.map(a => <li key={a.key}>
          <Alert severity={a.severity} action={a.to && <Button color="inherit" size="small" component={RouterLink} to={a.to}>{a.action}</Button>}>{a.text}</Alert>
        </li>)}
      </Stack>
    </Paper>}

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
        {data.planning && <Paper variant="outlined" sx={scrollPanel} tabIndex={0} component="section" aria-labelledby="planning-title">
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography id="planning-title" {...sectionTitle}>Planning et échéances</Typography>
            <Button component={RouterLink} to={scoped('/planning')} size="small">Voir tout le planning</Button>
          </Stack>
          {data.planning.progress !== null && <Box mb={2}>
            <LinearProgress variant="determinate" aria-label="Avancement global" value={Math.min(100, Math.max(0, data.planning.progress))} sx={{ height: 8, borderRadius: 4, mb: 1 }} />
            <Typography variant="caption" color="text.secondary">Moyenne des tâches finales actives, hors tâches annulées, sans pondération par coût ou durée.</Typography>
          </Box>}
          <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {data.planning.tasks.map(task => {
              const late = task.planned_end_date < data.date;
              return <Box component="li" key={task.id} sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Typography component={RouterLink} to={`/planning/${task.id}`} variant="body2" fontWeight={600} color="primary.main" sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, overflowWrap: 'anywhere' }}>{task.name}</Typography>
                  <StatusBadge value={task.status} />
                </Stack>
                <Typography variant="caption" color={late ? 'warning.dark' : 'text.secondary'} fontWeight={late ? 600 : 400} display="block" mt={.5}>
                  {late ? 'En retard · ' : ''}Échéance : {formatValue(task.planned_end_date, 'date')}
                </Typography>
              </Box>;
            })}
            {!data.planning.tasks.length && <Typography component="li" variant="body2" color="text.secondary">{data.planning.count ? 'Aucune échéance à venir.' : 'Aucune tâche active. Ajoutez des tâches au planning pour suivre l’avancement.'}</Typography>}
          </Stack>
        </Paper>}

        <Paper variant="outlined" sx={scrollPanel} tabIndex={0} component="section" aria-labelledby="activity-title">
          <Typography id="activity-title" {...sectionTitle} mb={2}>Activité récente</Typography>
          <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {data.activity.map(item => <Stack component="li" key={`${item.kind}-${item.id}`} direction="row" gap={1.5} alignItems="flex-start">
              <Box aria-hidden sx={{ mt: .8, width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography component={RouterLink} to={activityPath(item.kind, item.id)} variant="body2" color="primary.main" sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, overflowWrap: 'anywhere' }}>{item.title}</Typography>
                <Typography variant="caption" color="text.secondary" display="block">{activityLabel[item.kind] ?? 'Document'} · {formatValue(item.updated_at, 'updated_at')}</Typography>
              </Box>
            </Stack>)}
            {!data.activity.length && <Typography component="li" variant="body2" color="text.secondary">Aucune activité récente dans les modules accessibles.</Typography>}
          </Stack>
        </Paper>
        {data.budget && <Paper variant="outlined" sx={scrollPanel} tabIndex={0} component="section" aria-labelledby="finance-title">
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography id="finance-title" {...sectionTitle}>Situation financière</Typography>
            <Button component={RouterLink} to={budgetPath} size="small">{hasBudget ? 'Ouvrir le budget' : 'Créer un budget'}</Button>
          </Stack>
          {hasBudget ? <Stack component="dl" spacing={1.25} sx={{ m: 0 }}>
            {([['planned', 'Budget prévu TTC'], ['committed', 'Engagé (soumis)'], ['spent', 'Consommé TTC'], ['paid', 'Dont payé'], ['available', 'Disponible']] as Array<[BudgetKey, string]>).map(([key, label]) => {
              const isAvailable = key === 'available';
              return <Stack key={key} direction="row" justifyContent="space-between" gap={2} sx={isAvailable ? { borderTop: '1px solid', borderColor: 'divider', pt: 1.25 } : undefined}>
                <Typography component="dt" variant="body2" color={key === 'paid' ? 'text.secondary' : 'text.primary'} sx={key === 'paid' ? { pl: 1.5 } : undefined}>{label}</Typography>
                <Typography component="dd" variant="body2" fontWeight={isAvailable ? 800 : 600} color={isAvailable && negativeBudget ? 'error.main' : 'text.primary'} sx={{ m: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{budgetValue(key)}</Typography>
              </Stack>;
            })}
          </Stack> : <Typography variant="body2" color="text.secondary">Aucun budget défini pour ce chantier.</Typography>}
          <Typography variant="caption" display="block" color="text.secondary" mt={2}>Le payé est inclus dans le consommé. Le disponible tient compte des engagements soumis.</Typography>
        </Paper>}

        <Paper variant="outlined" sx={scrollPanel} tabIndex={0} component="section" aria-labelledby="landmarks-title">
          <Typography id="landmarks-title" {...sectionTitle} mb={2}>Repères du chantier</Typography>
          <Stack component="dl" spacing={1.5} sx={{ m: 0 }}>
            <Box><Typography component="dt" variant="caption" color="text.secondary">Client</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{String(project.client_name || 'Non renseigné')}</Typography></Box>
            {Boolean(project.address) && <Box><Typography component="dt" variant="caption" color="text.secondary">Adresse</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{String(project.address)}</Typography></Box>}
            <Box><Typography component="dt" variant="caption" color="text.secondary">Dates prévues</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>Du {formatValue(project.planned_start_date, 'date')} au {formatValue(project.planned_end_date, 'date')}</Typography></Box>
            {data.budget && <Box><Typography component="dt" variant="caption" color="text.secondary">Montant du marché (distinct du budget)</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{project.contract_amount == null ? 'Non renseigné' : `${formatValue(project.contract_amount, 'amount')} ${String(project.currency ?? '')}`.trim()}</Typography></Box>}
          </Stack>
          {data.workforce && <Chip sx={{ mt: 2, maxWidth: '100%' }} variant="outlined" label={`${data.workforce.assigned} collaborateur(s) affecté(s) aujourd’hui`} />}
          <Stack direction="row" flexWrap="wrap" gap={1} mt={2}>
            {can('workforce') && <Button component={RouterLink} to={scoped('/workforce/assignments')} size="small" variant="outlined">Affectations</Button>}
            {can('progress') && <Button component={RouterLink} to={scoped('/progress')} size="small" variant="outlined">Rapports journaliers</Button>}
            {can('documents') && <Button component={RouterLink} to={scoped('/documents/folders')} size="small" variant="outlined">Documents</Button>}
          </Stack>
        </Paper>
    </Box>
  </Stack>;
}
