import { FormTextField as TextField } from './FormTextField';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, ButtonGroup, Chip, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { errorMessage, notifyChange } from '../api/workspace';
import { useWorkspace } from '../state/workspace';

type Row = { worker: string; name: string; job_title: string; team: string; entry_id: string | null; version: number | null; normal_hours: string; overtime_hours: string; attendance_status: string; arrival_time: string | null; departure_time: string | null; is_validated: boolean; is_archived: boolean; original?: string };
const snapshot = (r: Row) => JSON.stringify([r.attendance_status, r.arrival_time, r.departure_time, r.normal_hours, r.overtime_hours]);
const minutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
const duration = (r: Row) => r.attendance_status === 'absent' ? 0 : r.arrival_time && r.departure_time ? minutes(r.departure_time) - minutes(r.arrival_time) : Math.round((Number(r.normal_hours || 0) + Number(r.overtime_hours || 0)) * 60);
const format = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`;
const statuses = [{ value: 'present', label: 'Présent', color: '#216c55', bg: '#e2f1eb' }, { value: 'late', label: 'Retard', color: '#925b00', bg: '#fff0d7' }, { value: 'absent', label: 'Absent', color: '#ad292c', bg: '#f9e1e3' }];
export function AttendanceSheetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { projects, projectId, can } = useWorkspace();
  const [project, setProject] = useState(params.get('project') || projectId || '');
  const [date, setDate] = useState(params.get('date') || new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Bujumbura', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [revision, setRevision] = useState(0);
  const dirty = rows.some(r => snapshot(r) !== r.original);
  const editable = (r: Row) => !r.is_validated && can('workforce', r.entry_id ? 'update' : 'create');
  useEffect(() => {
    const controller = new AbortController();
    setRows([]); setError(''); setTeam('');
    if (!project || !date || !can('workforce', 'read')) return;
    setLoading(true);
    api.get<{ rows: Row[] }>('/workforce/time-entries/sheet/', { params: { project, work_date: date }, signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setRows(data.rows.map(r => ({ ...r, original: snapshot(r) })));
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project, date, revision]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  const update = (r: Row, patch: Partial<Row>) => {
    const next = { ...r, ...patch };
    if (next.attendance_status === 'absent') { next.arrival_time = null; next.departure_time = null; next.normal_hours = '0'; next.overtime_hours = '0'; }
    else if (next.arrival_time && next.departure_time) {
      const total = Math.max(0, duration(next) / 60);
      const overtime = Math.min(Number(r.overtime_hours || 0), total);
      next.normal_hours = (total - overtime).toFixed(2); next.overtime_hours = overtime.toFixed(2);
    }
    setRows(current => current.map(item => (item.entry_id || item.worker) === (r.entry_id || r.worker) ? next : item));
    setSuccess(false);
  };
  const mark = (r: Row, status: string) => update(r, { attendance_status: status, ...(status !== 'absent' ? { arrival_time: r.arrival_time || '07:00', departure_time: r.departure_time || '16:00' } : {}) });
  const visible = rows.filter(r => (!team || r.team === team) && `${r.name} ${r.job_title}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const invalid = rows.some(r => snapshot(r) !== r.original && r.attendance_status !== 'absent' && (!r.arrival_time || !r.departure_time || duration(r) <= 0));
  const leave = () => { if (!dirty || window.confirm('Abandonner les modifications du pointage ?')) navigate('/workforce'); };
  const save = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      await api.post('/workforce/time-entries/save-sheet/', { project, work_date: date, entries: rows.filter(r => snapshot(r) !== r.original).map(r => ({ worker: r.worker, ...(r.entry_id ? { entry_id: r.entry_id, version: r.version } : {}), attendance_status: r.attendance_status, arrival_time: r.arrival_time, departure_time: r.departure_time, normal_hours: r.normal_hours || '0', overtime_hours: r.overtime_hours || '0' })) });
      notifyChange(); setSuccess(true); setRevision(v => v + 1);
    } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  };
  if (!can('workforce', 'read')) return <Alert severity="info">Votre rôle ne donne pas accès au pointage.</Alert>;
  return <Box sx={{ bgcolor: '#fff', border: '1px solid #e1e5e9', borderRadius: 2, overflow: 'hidden', '& .MuiButton-root': { textTransform: 'none' } }}>
    <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #e2e5e9' }}><Typography component="h1" fontSize={20} fontWeight={750}>Pointage du personnel</Typography><Typography fontSize={13} color="text.secondary">Marquez la présence de chaque ouvrier pour la journée</Typography></Box>
    <Box sx={{ p: { xs: 2, md: 3.5 }, minHeight: 460 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 2, mb: 2.5 }}>
        <TextField select size="small" label="Chantier" value={project} disabled={dirty || saving} onChange={e => { setProject(e.target.value); setSuccess(false); }}>{projects.map(p => <MenuItem key={p.id} value={String(p.id)}>{String(p.name)}</MenuItem>)}</TextField>
        <TextField size="small" label="Date" type="date" value={date} disabled={dirty || saving} onChange={e => { setDate(e.target.value); setSuccess(false); }} InputLabelProps={{ shrink: true }} />
        <TextField select size="small" label="Équipe (rôle d’affectation)" value={team} onChange={e => setTeam(e.target.value)}><MenuItem value="">Toutes les équipes</MenuItem>{[...new Set(rows.map(r => r.team).filter(Boolean))].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} action={!dirty ? <Button onClick={() => setRevision(v => v + 1)}>Réessayer</Button> : undefined}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>Le pointage a été enregistré.</Alert>}
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      <Stack direction={{ xs: 'column', lg: 'row' }} gap={2} justifyContent="space-between" mb={2}>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">{statuses.map(s => <Chip key={s.value} label={`${rows.filter(r => r.attendance_status === s.value).length} ${s.value === 'present' ? 'présents' : s.value === 'late' ? 'en retard' : 'absents'}`} sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700 }} />)}<Typography fontSize={13} color="text.secondary">· {format(rows.reduce((sum, r) => sum + Math.max(0, duration(r)), 0))} au total</Typography></Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25}><TextField size="small" placeholder="Rechercher un ouvrier" inputProps={{ 'aria-label': 'Rechercher un ouvrier' }} value={search} onChange={e => setSearch(e.target.value)} /><Button variant="outlined" disabled={saving || loading || !visible.some(editable)} onClick={() => visible.filter(editable).forEach(r => mark(r, 'present'))} sx={{ color: '#216c55', borderColor: '#216c55', whiteSpace: 'nowrap' }}>Tout marquer présent</Button></Stack>
      </Stack>
      {!loading && !rows.length && <Alert severity="info">{project ? 'Aucun ouvrier affecté à ce chantier à cette date.' : 'Choisissez un chantier pour charger les ouvriers.'}</Alert>}
      {!!rows.length && <TableContainer sx={{ border: '1px solid #e0e4e9', borderRadius: 1.5 }}><Table sx={{ minWidth: 820, '& th': { bgcolor: '#f3f4f6', fontSize: 12, color: '#535d68' }, '& td': { py: 1.1 } }} aria-label="Pointage du personnel"><TableHead><TableRow>{['OUVRIER', 'STATUT', 'ARRIVÉE', 'DÉPART', 'HEURES'].map(t => <TableCell key={t}>{t}</TableCell>)}</TableRow></TableHead><TableBody>
        {visible.map(r => <TableRow key={r.entry_id || r.worker} sx={{ bgcolor: r.attendance_status === 'absent' ? '#fdf6f6' : '#fff' }}><TableCell sx={{ width: '38%' }}><Typography fontSize={13} fontWeight={700}>{r.name}</Typography><Typography fontSize={12} color="text.secondary">{r.job_title}</Typography>{(r.is_validated) && <Chip size="small" label={'Validé'} />}</TableCell>
          <TableCell><ButtonGroup size="small" disabled={saving || !editable(r)}>{statuses.map(s => <Button key={s.value} onClick={() => mark(r, s.value)} aria-pressed={r.attendance_status === s.value} sx={{ minWidth: '82px !important', py: 1.1, borderColor: '#bbc3ce', fontWeight: r.attendance_status === s.value ? 700 : 500, color: r.attendance_status === s.value ? '#fff' : s.color, bgcolor: r.attendance_status === s.value ? s.color : s.bg, '&:hover': { bgcolor: s.color, color: '#fff' }, '&.Mui-disabled': { color: r.attendance_status === s.value ? '#fff' : s.color, bgcolor: r.attendance_status === s.value ? s.color : s.bg, opacity: .65 } }}>{r.attendance_status === s.value ? '✓ ' : ''}{s.label}</Button>)}</ButtonGroup></TableCell>
          {(['arrival_time', 'departure_time'] as const).map(field => <TableCell key={field}>{r.attendance_status === 'absent' ? '—' : <TextField size="small" type="time" value={r[field]?.slice(0, 5) || ''} disabled={saving || !editable(r)} error={!!r.attendance_status && duration(r) <= 0} inputProps={{ 'aria-label': `${field === 'arrival_time' ? 'Arrivée' : 'Départ'} de ${r.name}` }} sx={{ width: 115 }} onChange={e => update(r, { [field]: e.target.value, attendance_status: r.attendance_status || 'present' })} />}</TableCell>)}
          <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{format(Math.max(0, duration(r)))}</TableCell></TableRow>)}
        {!visible.length && <TableRow><TableCell colSpan={5}>Aucun ouvrier ne correspond aux filtres.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>}
      {invalid && <Alert severity="warning" sx={{ mt: 2 }}>Renseignez une arrivée et un départ après l’arrivée pour chaque ouvrier présent ou en retard.</Alert>}
    </Box>
    <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap" sx={{ px: 3.5, py: 2, bgcolor: '#f9fafb', borderTop: '1px solid #e2e5e9' }}><Button disabled={saving} onClick={leave} sx={{ mr: 'auto', color: '#626c78' }}>Annuler</Button><Typography fontSize={12} color="text.secondary">{new Set(rows.filter(r => r.attendance_status || r.entry_id).map(r => r.worker)).size} ouvriers pointés sur {new Set(rows.map(r => r.worker)).size}</Typography><Button variant="contained" disabled={!dirty || saving || loading || invalid} onClick={save} sx={{ bgcolor: '#216c55', px: 3, py: 1.3, '&:hover': { bgcolor: '#18563f' } }}>{saving ? 'Enregistrement…' : 'Valider le pointage'}</Button></Stack>
  </Box>;
}
