import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, TextField } from "@mui/material";
import { api } from "../api/client";
import { errorMessage } from "../api/workspace";
import { useWorkspace } from "../state/workspace";

export function BusinessExports({ model, id }: { model: string; id?: string }) {
  const { projectId, can } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ url: string; filename: string; title: string } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    setPreview(null); setOpen(false); setError(''); setBusy(false);
    return () => controllerRef.current?.abort();
  }, [model, id, projectId]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const attendance = model === 'workforce.worker';
  const planning = model === 'planning.task' && !id;
  const order = model === 'resources.purchaseorder' && Boolean(id);
  if (!(attendance || planning || order) || !can(model.split('.')[0], 'read')) return null;
  const label = attendance ? (id ? 'Fiche de présence PDF' : 'Présences de tous · PDF') : planning ? 'Planning de la semaine · PDF' : 'Bon de commande · PDF';
  const close = () => { setOpen(false); setPreview(null); setError(''); };
  const generate = async () => {
    setBusy(true); setError('');
    const controller = new AbortController();
    controllerRef.current?.abort(); controllerRef.current = controller;
    try {
      const endpoint = attendance ? `/workforce/workers/${id ? `${id}/` : ''}attendance-pdf/` : planning ? '/planning/tasks/weekly-pdf/' : `/resources/purchase-orders/${id}/pdf/`;
      const response = await api.get<Blob>(endpoint, { signal: controller.signal, responseType: 'blob', params: { start_date: start || undefined, end_date: end || undefined, project: !order ? projectId || undefined : undefined } });
      const signature = await response.data.slice(0, 5).text();
      if (controller.signal.aborted) return;
      if (signature !== '%PDF-') throw new Error('Le serveur n’a pas retourné un PDF valide. Réessayez la génération.');
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setPreview({ url, filename: attendance ? 'presences.pdf' : planning ? 'planning-semaine.pdf' : 'bon-commande.pdf', title: label });
    } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err)); } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <><Button variant="outlined" onClick={() => setOpen(true)}>{label}</Button>
    <Dialog open={open} onClose={busy ? undefined : close} fullWidth maxWidth={preview ? 'xl' : 'sm'} aria-labelledby="business-pdf-title"><DialogTitle id="business-pdf-title">{preview ? `Aperçu · ${preview.title}` : label}</DialogTitle><DialogContent dividers={Boolean(preview)}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {busy && <LinearProgress aria-label="Génération du PDF" sx={{ mb: 2 }} />}
      {preview ? <Box component="iframe" title={preview.title} src={preview.url} sx={{ display: 'block', width: '100%', height: '75dvh', border: 0, bgcolor: '#e9eeeb' }} /> : !order && <Stack spacing={2} mt={1}><TextField disabled={busy} label={planning ? 'Une date dans la semaine souhaitée' : 'Du (facultatif)'} type="date" value={start} onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }} />
        {!planning && <TextField disabled={busy} label="Au (facultatif)" type="date" value={end} onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: start || undefined }} />}
        <Alert severity="info">{planning ? 'Le PDF couvre le lundi au dimanche. Sans date, la semaine actuelle est utilisée.' : 'Le PDF regroupe les pointages par collaborateur et respecte le chantier sélectionné.'}</Alert></Stack>}
    </DialogContent><DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}><Button disabled={busy} onClick={close}>Fermer</Button>
      {preview ? <><Button onClick={() => setPreview(null)}>Modifier les paramètres</Button><Button component="a" href={preview.url} target="_blank" rel="noopener noreferrer">Ouvrir / imprimer</Button><Button variant="contained" component="a" href={preview.url} download={preview.filename}>Télécharger le PDF</Button></>
        : <Button variant="contained" disabled={busy || (!planning && Boolean(start && end && end < start))} onClick={() => void generate()}>{busy ? 'Génération…' : 'Générer et visualiser le PDF'}</Button>}
    </DialogActions></Dialog>
  </>;
}
