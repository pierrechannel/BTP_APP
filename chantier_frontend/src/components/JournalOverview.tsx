import { ReactNode } from 'react';
import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { ApiRecord } from '../api/types';
import { formatValue } from '../api/workspace';
import { JournalPhotos, JournalPhoto } from './JournalPhotos';

type Event = { action: string; at: string | null; actor: string; reason?: string; legacy?: boolean };
const titles: Record<string, string> = { created: 'Rapport créé', submitted: 'Rapport soumis', correction: 'Correction demandée', validated: 'Rapport validé' };
const dateTime = (value: unknown) => value && !Number.isNaN(Date.parse(String(value))) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Bujumbura' }).format(new Date(String(value))) : 'Date non enregistrée';
const panel = { p: { xs: 2, md: 2.5 }, borderRadius: 1.5, minWidth: 0 };

export function JournalOverview({ report, actions }: { report: ApiRecord; actions: ReactNode }) {
  const history = (Array.isArray(report.workflow_history) ? report.workflow_history : []) as Event[];
  const correction = report.status === 'draft' && Boolean(report.correction_reason);
  return <Stack spacing={2}>
    {correction && <Alert severity="warning"><Typography fontSize={14} fontWeight={700}>Rapport à corriger</Typography><Typography fontSize={13} sx={{ whiteSpace: 'pre-wrap' }}>{String(report.correction_reason)}</Typography></Alert>}
    {report.status === 'submitted' && <Alert severity="info">En attente de validation. Le compte rendu et les photos sont protégés pendant la vérification. Une demande de correction permet le retour en brouillon.</Alert>}
    {report.status === 'validated' && <Alert severity="success">Rapport validé. Le contenu et ses photos sont protégés contre la modification et la suppression.</Alert>}
    <Paper variant="outlined" sx={panel}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}>
        <Box><Typography fontSize={14} fontWeight={700}>{String(report.project_name || 'Chantier')} · {formatValue(report.report_date, 'report_date')}</Typography><Typography fontSize={12} color="text.secondary">Météo : {String(report.weather || 'Non renseignée')}</Typography></Box>
        {actions}
      </Stack>
    </Paper>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2fr) minmax(260px, 1fr)' }, gap: 2, alignItems: 'start' }}>
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Paper variant="outlined" component="section" aria-labelledby="journal-work-title" sx={panel}><Typography id="journal-work-title" component="h2" fontSize={16} fontWeight={700} mb={1.5}>Travaux réalisés</Typography><Typography fontSize={14} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 }}>{String(report.work_done || 'Le compte rendu des travaux reste à compléter.')}</Typography></Paper>
        <Paper variant="outlined" component="section" aria-labelledby="journal-difficulties-title" sx={panel}><Typography id="journal-difficulties-title" component="h2" fontSize={16} fontWeight={700} mb={1.5}>Difficultés et observations</Typography><Typography fontSize={14} color={report.difficulties ? 'text.primary' : 'text.secondary'} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 }}>{String(report.difficulties || 'Aucune observation renseignée.')}</Typography></Paper>
        <Paper variant="outlined" sx={panel}><JournalPhotos photos={(report.photos || []) as JournalPhoto[]} /></Paper>
      </Stack>
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Paper variant="outlined" sx={panel}><Typography component="h2" fontSize={16} fontWeight={700} mb={1.5}>Suivi du rapport</Typography><Stack spacing={1.5}>
          <Box><Typography variant="caption" color="text.secondary">Auteur</Typography><Typography fontSize={13}>{String(report.author_name || 'Non renseigné')}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Création</Typography><Typography fontSize={13}>{dateTime(report.created_at)}</Typography></Box>
          {Boolean(report.submitted_at) && <Box><Typography variant="caption" color="text.secondary">Dernière soumission</Typography><Typography fontSize={13}>{dateTime(report.submitted_at)}</Typography></Box>}
          {Boolean(report.validated_at) && <Box><Typography variant="caption" color="text.secondary">Validation</Typography><Typography fontSize={13}>{String(report.validator_name || 'Utilisateur non renseigné')}</Typography><Typography fontSize={12}>{dateTime(report.validated_at)}</Typography></Box>}
          <Chip size="small" variant="outlined" label="Heure de Bujumbura" sx={{ alignSelf: 'start' }} />
        </Stack></Paper>
        <Paper variant="outlined" component="section" aria-labelledby="journal-history-title" sx={panel}><Typography id="journal-history-title" component="h2" fontSize={16} fontWeight={700} mb={2}>Historique des validations</Typography>
          <Stack component="ol" spacing={2} sx={{ listStyle: 'none', m: 0, p: 0 }}>{history.map((event, index) => <Box component="li" key={index} sx={{ borderLeft: '2px solid', borderColor: event.action === 'correction' ? 'warning.main' : 'divider', pl: 1.5 }}>
            <Typography fontSize={13} fontWeight={700}>{titles[event.action] || event.action}</Typography><Typography fontSize={12}>{event.actor}</Typography><Typography fontSize={11} color="text.secondary">{dateTime(event.at)}</Typography>
            {event.reason && <Typography fontSize={12} mt={.5} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{event.reason}</Typography>}
            {event.legacy && <Typography fontSize={10} color="text.secondary">Informations historiques disponibles</Typography>}
          </Box>)}</Stack>
        </Paper>
      </Stack>
    </Box>
  </Stack>;
}
