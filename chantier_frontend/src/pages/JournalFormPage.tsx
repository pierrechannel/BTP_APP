import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, Typography } from '@mui/material';
import { FormTextField as TextField } from '../components/FormTextField';
import { JournalPhotos, JournalPhoto } from '../components/JournalPhotos';
import { PageHeading } from '../components/PageHeading';
import { api } from '../api/client';
import { ApiRecord } from '../api/types';
import { errorMessage, notifyChange, versionHeaders } from '../api/workspace';
import { useWorkspace } from '../state/workspace';

export function JournalFormPage() {
  const { id } = useParams(); const [params] = useSearchParams(); const navigate = useNavigate(); const location = useLocation();
  const { projects, projectId, can } = useWorkspace();
  const [record, setRecord] = useState<ApiRecord>();
  const [values, setValues] = useState({ project: params.get('project') || projectId || '', report_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Bujumbura', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), weather: '', work_done: '', difficulties: '' });
  const [files, setFiles] = useState<File[]>([]); const [removed, setRemoved] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(id)); const [saving, setSaving] = useState(false); const [dirty, setDirty] = useState(false); const [error, setError] = useState('');
  const allowed = can('progress', id ? 'update' : 'create');
  const origin = (location.state as { returnTo?: string } | null)?.returnTo;
  const back = origin?.startsWith('/progress') ? origin : id ? `/progress/${id}` : '/progress';
  useEffect(() => {
    if (!id || !allowed) return;
    const controller = new AbortController();
    api.get<ApiRecord>(`/progress/daily-reports/${id}/`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setRecord(data); setValues({ project: String(data.project), report_date: String(data.report_date), weather: String(data.weather || ''), work_done: String(data.work_done || ''), difficulties: String(data.difficulties || '') });
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, allowed]);
  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  const update = (name: string, value: string) => { setValues(current => ({ ...current, [name]: value })); setDirty(true); };
  const close = () => { if (!dirty || window.confirm('Abandonner les modifications du rapport ?')) navigate(back); };
  if (!allowed) return <Alert severity="info">Votre rôle ne permet pas cette action.</Alert>;
  if (loading) return <CircularProgress />;
  if (id && !record) return <Alert severity="error">{error || 'Rapport indisponible.'}</Alert>;
  if (record && record.status !== 'draft') return <Alert severity="info">Le rapport doit être en brouillon pour être modifié.</Alert>;
  const photos = (record?.photos || []) as JournalPhoto[];
  return <Box component="form" onSubmit={async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const body = new FormData(); Object.entries(values).forEach(([key, value]) => body.append(key, value));
      files.forEach(file => body.append('photo_files', file)); removed.forEach(photo => body.append('removed_photos', photo));
      const config = { headers: { ...(record ? versionHeaders(record) : {}), 'Content-Type': 'multipart/form-data' } };
      const response = id ? await api.patch<ApiRecord>(`/progress/daily-reports/${id}/`, body, config) : await api.post<ApiRecord>('/progress/daily-reports/', body, config);
      setDirty(false); notifyChange(); navigate(`/progress/${response.data.id}`);
    } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  }}>
    <Button onClick={close} disabled={saving} sx={{ mb: 1 }}>‹ Retour au journal</Button>
    <PageHeading eyebrow="JOURNAL DE CHANTIER" title={id ? 'Modifier le rapport journalier' : 'Nouveau rapport journalier'} subtitle="Enregistrez votre brouillon, puis soumettez-le depuis sa fiche." />
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    {Boolean(record?.correction_reason) && <Alert severity="warning" sx={{ mt: 2 }}>Correction demandée : {String(record?.correction_reason)}</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(250px, 1fr)' }, gap: 2, mt: 2 }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2.5 }}><TextField fullWidth multiline minRows={6} label="Travaux réalisés" value={values.work_done} disabled={saving} onChange={e => update('work_done', e.target.value)} helperText="Décrivez les travaux et les tâches concernés. Ce champ est nécessaire pour soumettre le rapport." /></Paper>
        <Paper variant="outlined" sx={{ p: 2.5 }}><TextField fullWidth multiline minRows={4} label="Difficultés et observations" value={values.difficulties} disabled={saving} onChange={e => update('difficulties', e.target.value)} /></Paper>
        <Paper variant="outlined" sx={{ p: 2.5 }}><JournalPhotos photos={photos} files={files} removed={removed} disabled={saving} onFiles={value => { setFiles(value); setDirty(true); }} onRemoved={value => { setRemoved(value); setDirty(true); }} /></Paper>
      </Stack>
      <Paper variant="outlined" sx={{ p: 2.5, alignSelf: 'start' }}><Stack spacing={2}>
        <Typography fontWeight={700}>Informations du rapport</Typography><Chip label="Brouillon" sx={{ alignSelf: 'start' }} />
        <TextField select required label="Chantier" value={values.project} disabled={saving || photos.length > 0} onChange={e => update('project', e.target.value)}>{projects.map(project => <MenuItem key={project.id} value={String(project.id)}>{String(project.name)}</MenuItem>)}</TextField>
        <TextField type="date" required label="Date du rapport" value={values.report_date} disabled={saving} onChange={e => update('report_date', e.target.value)} />
        <TextField label="Météo" value={values.weather} disabled={saving} onChange={e => update('weather', e.target.value)} placeholder="Ex. : Ensoleillé, pluie en après-midi" />
        <Typography variant="caption" color="text.secondary">Brouillon → Soumis → Validé. Plusieurs comptes rendus peuvent être saisis pour une même journée.</Typography>
      </Stack></Paper>
    </Box>
    <Stack direction="row" gap={1.5} justifyContent="flex-end" mt={2}><Button variant="outlined" disabled={saving} onClick={close}>Annuler</Button><Button variant="contained" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</Button></Stack>
  </Box>;
}
