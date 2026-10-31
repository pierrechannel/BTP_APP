import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { api } from '../api/client';
import { downloadFile, errorMessage, formatValue } from '../api/workspace';

export type Receipt = { id: string; original_name: string; size: number };
type Preview = { name: string; file?: File; id?: string };
export function ExpenseReceipts({ expenseId, receipts = [], files = [], removed = [], onFiles, onRemoved, disabled = false, downloadUrl, title = 'Justificatifs', description = 'Reçus, factures scannées et preuves de paiement. L’ajout d’un justificatif ne marque pas la dépense comme payée.' }: {
  expenseId?: string; receipts?: Receipt[]; files?: File[]; removed?: string[];
  onFiles?: (files: File[]) => void; onRemoved?: (ids: string[]) => void; disabled?: boolean;
  downloadUrl?: string; title?: string; description?: string;
}) {
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const editable = Boolean(onFiles && onRemoved);
  const visible = receipts.filter(item => !removed.includes(item.id));
  const endpoint = (id: string) => downloadUrl || `/budget/expenses/${expenseId}/receipts/${id}/download/`;
  useEffect(() => {
    setUrl('');
    if (!preview) return;
    const controller = new AbortController();
    let objectUrl = '';
    setBusy(true); setError('');
    const request = preview.file ? Promise.resolve(preview.file) : api.get<Blob>(endpoint(preview.id!), { responseType: 'blob', signal: controller.signal }).then(result => result.data);
    request.then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [preview, expenseId, downloadUrl]);
  const download = async (item: Receipt) => {
    setBusy(true); setError('');
    try { await downloadFile(endpoint(item.id), item.original_name); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 1.5, borderColor: '#dce1e9' }}>
    <Typography component="h2" fontSize={16} fontWeight={700} mb={1}>{title}</Typography>
    <Typography variant="body2" color="text.secondary" mb={2}>{description}</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack spacing={1}>
      {visible.map(item => <Stack key={item.id} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1} sx={{ p: 1.25, bgcolor: '#f6f7f9', borderRadius: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontSize={13} fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{item.original_name}</Typography><Typography variant="caption" color="text.secondary">{formatValue(item.size, 'size')}</Typography></Box>
        <Stack direction="row" flexWrap="wrap"><Button disabled={busy || disabled} onClick={() => setPreview({ id: item.id, name: item.original_name })}>Consulter</Button><Button disabled={busy || disabled} onClick={() => download(item)}>Télécharger</Button>{editable && <Button color="error" disabled={disabled} onClick={() => onRemoved?.([...removed, item.id])}>Retirer</Button>}</Stack>
      </Stack>)}
      {files.map((file, index) => <Stack key={index} direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }} sx={{ p: 1.25, border: '1px dashed #b7c4bc', borderRadius: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontSize={13} sx={{ overflowWrap: 'anywhere' }}>{file.name}</Typography><Typography variant="caption" color="text.secondary">{formatValue(file.size, 'size')} · À enregistrer</Typography></Box>
        <Stack direction="row"><Button disabled={disabled} onClick={() => setPreview({ name: file.name, file })}>Consulter</Button><Button color="error" disabled={disabled} onClick={() => onFiles?.(files.filter((_, i) => i !== index))}>Retirer</Button></Stack>
      </Stack>)}
      {!visible.length && !files.length && <Typography variant="body2" color="text.secondary">Aucun justificatif joint.</Typography>}
    </Stack>
    {editable && <>
      <Button component="label" variant="outlined" startIcon={<AttachFileIcon />} disabled={disabled || visible.length + files.length >= 20} sx={{ mt: 2 }}>Ajouter des justificatifs
        <input hidden type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" aria-label="Ajouter des justificatifs" disabled={disabled} onChange={event => {
          const additions = Array.from(event.target.files || []); event.target.value = ''; setError('');
          if (files.length + visible.length + additions.length > 20) { setError('Maximum 20 justificatifs par dépense.'); return; }
          if (additions.some(file => file.size > 10 * 1024 * 1024 || !/\.(pdf|jpe?g|png|webp)$/i.test(file.name))) { setError('Choisissez des PDF ou images JPG, PNG ou WebP de 10 Mo maximum.'); return; }
          onFiles?.([...files, ...additions]);
        }} />
      </Button>
      <Typography variant="caption" display="block" color="text.secondary" mt={1}>PDF, JPG, PNG ou WebP · 10 Mo par fichier · 20 fichiers maximum. Les ajouts et retraits seront appliqués à l’enregistrement du brouillon.</Typography>
      {!!removed.length && <Button disabled={disabled} onClick={() => onRemoved?.([])}>Annuler les retraits ({removed.length})</Button>}
    </>}
    <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} fullWidth maxWidth="md"><DialogTitle>{preview?.name}</DialogTitle><DialogContent>
      {busy ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : url && (/\.pdf$/i.test(preview?.name || '') ? <Box component="iframe" title="Aperçu du justificatif" src={url} sx={{ width: '100%', height: '65vh', border: 0 }} /> : <Box component="img" src={url} alt={preview?.name} sx={{ width: '100%', maxHeight: '65vh', objectFit: 'contain' }} />)}
    </DialogContent><DialogActions><Button onClick={() => setPreview(null)}>Fermer</Button></DialogActions></Dialog>
  </Paper>;
}
