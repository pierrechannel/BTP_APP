import { FormTextField as TextField } from './FormTextField';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../api/client';
import { ApiRecord } from '../api/types';
import { errorMessage, notifyChange } from '../api/workspace';
import { useWorkspace } from '../state/workspace';
import { businessDialogSx } from './BusinessFormLayout';

type SheetRow = { worker: string; name: string; job_title: string; entry_id: string | null; version: number | null; task_name: string; normal_hours: string; overtime_hours: string; is_validated: boolean; is_archived: boolean };
type DraftRow = SheetRow & { originalNormal: string; originalOvertime: string };
const changed = (row: DraftRow) => row.normal_hours !== row.originalNormal || row.overtime_hours !== row.originalOvertime;
const locked = (row: SheetRow) => row.is_validated;
const rowKey = (row: SheetRow) => row.entry_id || row.worker;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Bujumbura', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const hours = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const messages = (value: unknown): string => typeof value === 'string' ? value : value && typeof value === 'object' ? Object.values(value).map(messages).join(' ') : String(value ?? '');

export function AttendanceSheetDialog({ open, onClose, onSaved, initialProject, initialDate, fixedProject = false }: {
  open: boolean; onClose: () => void; onSaved: (record: ApiRecord) => void; initialProject?: string; initialDate?: string; fixedProject?: boolean;
}) {
  const { projects, projectId, can } = useWorkspace();
  const [project, setProject] = useState(initialProject || projectId || '');
  const [date, setDate] = useState(initialDate || today());
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = rows.some(changed);
  useEffect(() => {
    if (open) { setProject(initialProject || projectId || ''); setDate(initialDate || today()); setRows([]); setSearch(''); setError(''); setConfirmClose(false); }
  }, [open, initialProject, initialDate]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setRows([]); setError('');
    if (!project || !date) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    api.get<{ rows: SheetRow[] }>('/workforce/time-entries/sheet/', { params: { project, work_date: date }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setRows(data.rows.map((row) => ({ ...row, originalNormal: row.normal_hours, originalOvertime: row.overtime_hours }))); })
      .catch((err) => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, project, date, revision]);
  const editable = (row: SheetRow) => !locked(row) && (row.entry_id ? can('workforce', 'update') : can('workforce', 'create'));
  const pending = rows.filter(changed);
  const total = rows.reduce((sum, row) => sum + Number(row.normal_hours || 0) + Number(row.overtime_hours || 0), 0);
  const count = new Set(rows.map((row) => row.worker)).size;
  const filled = new Set(rows.filter((row) => row.normal_hours !== '' || row.overtime_hours !== '').map((row) => row.worker)).size;
  const update = (key: string, field: 'normal_hours' | 'overtime_hours', value: string) => setRows((current) => current.map((row) => rowKey(row) === key ? { ...row, [field]: value } : row));
  const close = () => { if (!saving) { if (dirty) setConfirmClose(true); else onClose(); } };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pending.length || loading || saving) return;
    setSaving(true); setError('');
    try {
      const { data } = await api.post<{ saved: ApiRecord[] }>('/workforce/time-entries/save-sheet/', { project, work_date: date, entries: pending.map((row) => ({
        worker: row.worker, ...(row.entry_id ? { entry_id: row.entry_id, version: row.version } : {}),
        normal_hours: row.normal_hours || '0', overtime_hours: row.overtime_hours || '0',
      })) });
      notifyChange(); if (data.saved[0]) onSaved(data.saved[0]); onClose();
    } catch (err) {
      const data = (err as { response?: { data?: { entries?: unknown } } }).response?.data;
      setError(data?.entries ? `La feuille n’a pas été enregistrée : ${messages(data.entries)}` : errorMessage(err));
    } finally { setSaving(false); }
  };
  return <><Dialog open={open} onClose={close} fullWidth maxWidth={false} PaperProps={{ sx: businessDialogSx }} sx={{ '& .MuiBackdrop-root': { bgcolor: 'rgba(35,45,60,.24)', backdropFilter: 'none' } }} aria-labelledby="attendance-sheet-title">
    <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '90dvh' }}>
      <DialogTitle sx={{ px: 3.5, py: 2.5, borderBottom: '1px solid #e2e5e9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box><Typography id="attendance-sheet-title" fontSize={20} fontWeight={750}>Pointage du personnel</Typography></Box>
        <IconButton disabled={saving} onClick={close} aria-label="Fermer le pointage"><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3.5 }, py: '24px !important', minHeight: { sm: 420 }, overflowY: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2, mb: 2.5 }}>
          <TextField select required fullWidth size="small" label="Chantier" value={project} disabled={fixedProject || saving || dirty} onChange={(e) => setProject(e.target.value)}>
            {project && !projects.some((p) => String(p.id) === project) && <MenuItem value={project}>Chantier sélectionné</MenuItem>}
            {projects.map((p) => <MenuItem key={p.id} value={String(p.id)}>{String(p.name)}</MenuItem>)}
          </TextField>
          <TextField required fullWidth size="small" label="Date" type="date" value={date} disabled={saving || dirty} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }} action={!dirty ? <Button color="inherit" onClick={() => setRevision((v) => v + 1)}>Réessayer</Button> : undefined}>{error}</Alert>}
        {loading && <LinearProgress aria-label="Chargement du personnel affecté" sx={{ mb: 2 }} />}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between" mb={2}>
          <Stack direction="row" gap={1.5} alignItems="center"><Chip label={`${filled} / ${count} renseignés`} sx={{ bgcolor: '#e4f2ec', color: '#185d46', fontWeight: 700 }} /><Typography fontSize={13} color="#66707d">{hours(total)} h au total</Typography></Stack>
          <TextField size="small" placeholder="Rechercher un collaborateur" inputProps={{ 'aria-label': 'Rechercher un collaborateur' }} value={search} onChange={(e) => setSearch(e.target.value)} />
        </Stack>
        {!loading && !rows.length && <Alert severity="info">{project && date ? 'Aucun personnel affecté à ce chantier à cette date. Ajoutez les collaborateurs dans les affectations du chantier.' : 'Choisissez un chantier et une date pour charger le personnel affecté.'}</Alert>}
        {rows.length > 0 && <TableContainer sx={{ border: '1px solid #e0e4e9', borderRadius: 1.5 }}><Table aria-label="Feuille de pointage du chantier" sx={{ minWidth: 680, '& th': { bgcolor: '#f3f4f6', color: '#535d68', fontSize: 12, py: 1.25 }, '& td': { bgcolor: '#fff', py: 1.5, borderColor: '#e2e5e9' } }}><TableHead><TableRow>
          <TableCell sx={{ width: '38%' }}>COLLABORATEUR</TableCell><TableCell>HEURES NORMALES</TableCell><TableCell>HEURES SUPPL.</TableCell><TableCell align="right">TOTAL</TableCell>
        </TableRow></TableHead><TableBody>{rows.filter((row) => `${row.name} ${row.job_title}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((row) => {
          const amount = Number(row.normal_hours || 0) + Number(row.overtime_hours || 0);
          return <TableRow key={rowKey(row)}><TableCell><Typography fontSize={13} fontWeight={700}>{row.name}</Typography><Typography fontSize={12} color="#66707d">{row.job_title}{row.task_name ? ` · ${row.task_name}` : ''}</Typography>{locked(row) && <Chip size="small" label={'Validé'} sx={{ mt: .5 }} />}</TableCell>
            {(['normal_hours', 'overtime_hours'] as const).map((field) => <TableCell key={field}><TextField size="small" type="number" fullWidth value={row[field]} disabled={saving || !editable(row)} error={amount > 24} placeholder="—" inputProps={{ min: 0, max: 24, step: .01, 'aria-label': `${field === 'normal_hours' ? 'Heures normales' : 'Heures supplémentaires'} · ${row.name}`, style: { textAlign: 'right' } }} onChange={(e) => update(rowKey(row), field, e.target.value)} /></TableCell>)}
            <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap', color: amount > 24 ? '#a42323' : '#24292e' }}>{hours(amount)} h</TableCell>
          </TableRow>;
        })}</TableBody></Table></TableContainer>}
        <Typography fontSize={12} color="#66707d" mt={2}>Seules les lignes modifiées sont enregistrées. Une ligne vide reste sans pointage. Les pointages validés sont protégés. Le cumul par collaborateur est limité à 24 h par jour, tous chantiers confondus.</Typography>
        {dirty && <Button disabled={saving} onClick={() => { setRows((current) => current.map((row) => ({ ...row, normal_hours: row.originalNormal, overtime_hours: row.originalOvertime }))); setError(''); }}>Annuler les saisies</Button>}
      </DialogContent>
      <DialogActions sx={{ px: 3.5, py: 2, bgcolor: '#f9fafb', borderTop: '1px solid #e2e5e9', flexWrap: 'wrap', gap: 1 }}><Button disabled={saving} onClick={close} sx={{ mr: 'auto', color: '#626c78' }}>Annuler</Button><Typography fontSize={12} color="#66707d">{pending.length} ligne{pending.length > 1 ? 's' : ''} à enregistrer</Typography><Button variant="contained" type="submit" disabled={saving || loading || !dirty || !project || !date || rows.some((row) => Number(row.normal_hours || 0) + Number(row.overtime_hours || 0) > 24)}>{saving ? 'Enregistrement…' : 'Enregistrer le pointage'}</Button></DialogActions>
    </Box>
  </Dialog><Dialog open={confirmClose} onClose={() => setConfirmClose(false)}><DialogTitle>Abandonner les saisies ?</DialogTitle><DialogContent>Les modifications de cette feuille ne sont pas encore enregistrées.</DialogContent><DialogActions><Button onClick={() => setConfirmClose(false)}>Continuer la saisie</Button><Button color="error" onClick={() => { setConfirmClose(false); onClose(); }}>Abandonner</Button></DialogActions></Dialog></>;
}
