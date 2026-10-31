import { ReactNode, useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import { api } from '../api/client';
import { downloadFile, errorMessage } from '../api/workspace';

export type JournalPhoto = { id: string };
export function PhotoTile({ id, file, onRemove, imageHeight = 130, actions }: { id?: string; file?: File; onRemove?: () => void; imageHeight?: number; actions?: ReactNode }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = '';
    (file ? Promise.resolve(file) : api.get<Blob>(`/progress/photos/${id}/download/`, { responseType: 'blob', signal: controller.signal }).then(result => result.data)).then(blob => {
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, file]);
  return <Box sx={{ minWidth: 0 }}>
    {error ? <Alert severity="error">{error}</Alert> : <Box component="button" type="button" onClick={() => setOpen(true)} disabled={!url} aria-label="Agrandir la photo" sx={{ width: '100%', p: 0, border: 0, cursor: 'pointer', bgcolor: '#edf2ef', borderRadius: 1, overflow: 'hidden', height: imageHeight }}>{url && <Box component="img" src={url} alt={file?.name || 'Photo du rapport'} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</Box>}
    <Stack direction="row" alignItems="center" gap={.5} flexWrap="nowrap" mt={.5}>
      <Tooltip title="Agrandir"><span><IconButton size="small" disabled={!url} aria-label="Agrandir la photo" onClick={() => setOpen(true)}><ZoomInIcon fontSize="small" /></IconButton></span></Tooltip>
      {id && <Tooltip title="Télécharger"><IconButton size="small" aria-label="Télécharger la photo" onClick={() => downloadFile(`/progress/photos/${id}/download/`, 'photo.jpg').catch(e => setError(errorMessage(e)))}><DownloadIcon fontSize="small" /></IconButton></Tooltip>}
      {actions}
      {onRemove && <Tooltip title="Retirer"><IconButton size="small" color="error" aria-label="Retirer la photo" onClick={onRemove}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>}
    </Stack>
    {file && <Typography variant="caption">À enregistrer</Typography>}
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md" aria-label="Aperçu de la photo"><DialogContent><Box display="flex" justifyContent="flex-end"><Tooltip title="Fermer"><IconButton aria-label="Fermer l’aperçu" onClick={() => setOpen(false)}><CloseIcon /></IconButton></Tooltip></Box><Box component="img" src={url} alt="Photo du chantier" sx={{ width: '100%', maxHeight: '75vh', objectFit: 'contain' }} /></DialogContent></Dialog>
  </Box>;
}
export function JournalPhotos({ photos = [], files = [], removed = [], onFiles, onRemoved, disabled = false }: {
  photos?: JournalPhoto[]; files?: File[]; removed?: string[]; onFiles?: (files: File[]) => void; onRemoved?: (ids: string[]) => void; disabled?: boolean;
}) {
  const [error, setError] = useState('');
  const visible = photos.filter(photo => !removed.includes(photo.id));
  return <Stack spacing={1.5}><Typography component="h2" fontSize={16} fontWeight={700}>Photos et observations du terrain</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: '180px', md: '220px' }, overflowX: 'auto', gap: 1.5 }}>
      {visible.map(photo => <PhotoTile key={photo.id} id={photo.id} onRemove={onRemoved && !disabled ? () => onRemoved([...removed, photo.id]) : undefined} />)}
      {files.map((file, index) => <PhotoTile key={`file-${index}`} file={file} onRemove={onFiles && !disabled ? () => onFiles(files.filter((_, i) => i !== index)) : undefined} />)}
    </Box>
    {!visible.length && !files.length && <Typography variant="body2" color="text.secondary">Aucune photo jointe à ce rapport.</Typography>}
    {onFiles && <Button component="label" variant="outlined" disabled={disabled || visible.length + files.length >= 30}>Ajouter des photos<input hidden type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={event => {
      const additions = Array.from(event.target.files || []); event.target.value = ''; setError('');
      if (additions.some(file => file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Utilisez des images JPG, PNG ou WebP de 10 Mo maximum.'); return; }
      if (visible.length + files.length + additions.length > 30) { setError('Maximum 30 photos par rapport.'); return; }
      onFiles([...files, ...additions]);
    }} /></Button>}
    {onFiles && <Typography variant="caption" color="text.secondary">Les ajouts et retraits sont appliqués lors de l’enregistrement du brouillon.</Typography>}
    {!!removed.length && onRemoved && <Button disabled={disabled} onClick={() => onRemoved([])}>Annuler les retraits</Button>}
  </Stack>;
}
