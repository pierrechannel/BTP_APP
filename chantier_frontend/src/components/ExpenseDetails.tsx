import { FormTextField as TextField } from './FormTextField';
import { Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography, useMediaQuery } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { orderLineTotal } from '../api/workflows';

type Line = { label: string; quantity: string; unit_price: string };
const amount = (row: Line) => {
  try { return Number(orderLineTotal(row)).toLocaleString('fr-FR', { minimumFractionDigits: 2 }); }
  catch { return '—'; }
};
export function ExpenseDetailsView({ rows }: { rows: Line[] }) {
  const mobile = useMediaQuery('(max-width:599px)');
  if (mobile) return <Stack gap={1.5}>{rows.map((row, index) => <Box key={index} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><Typography fontWeight={700}>{row.label}</Typography><Typography variant="body2">{row.quantity} × {row.unit_price}</Typography><Typography>Total HT : {amount(row)}</Typography></Box>)}{!rows.length && <Typography>Aucune ligne de détail.</Typography>}</Stack>;
  return <TableContainer><Table size="small" aria-label="Détails de la dépense"><TableHead><TableRow><TableCell>Libellé</TableCell><TableCell align="right">Quantité</TableCell><TableCell align="right">Prix unitaire</TableCell><TableCell align="right">Total HT</TableCell></TableRow></TableHead><TableBody>
    {rows.map((row, index) => <TableRow key={index}><TableCell>{row.label}</TableCell><TableCell align="right">{row.quantity}</TableCell><TableCell align="right">{row.unit_price}</TableCell><TableCell align="right">{amount(row)}</TableCell></TableRow>)}
    {!rows.length && <TableRow><TableCell colSpan={4}>Aucune ligne de détail.</TableCell></TableRow>}
  </TableBody></Table></TableContainer>;
}
export function ExpenseDetails({ value, onChange, disabled = false, compact = false }: { value: string; onChange: (value: string) => void; disabled?: boolean; compact?: boolean }) {
  const mobile = useMediaQuery('(max-width:599px)');
  let rows: Line[] = [];
  try { const parsed = JSON.parse(value || '[]'); if (Array.isArray(parsed)) rows = parsed; } catch { /* Incomplete draft */ }
  const change = (next: Line[]) => onChange(JSON.stringify(next));
  const input = (row: Line, index: number, field: keyof Line, label: string) => <TextField disabled={disabled} size="small" required fullWidth label={mobile ? label : undefined} placeholder={field === 'label' ? 'Description de la dépense' : undefined} value={row[field]} type={field === 'label' ? 'text' : 'number'} inputProps={{ 'aria-label': `${label} · ligne ${index + 1}`, min: field === 'quantity' ? 0.001 : 0, max: field !== 'label' ? 999999999 : undefined, step: field === 'quantity' ? .001 : field === 'unit_price' ? .01 : undefined, maxLength: field === 'label' ? 255 : undefined }} onChange={event => change(rows.map((item, i) => i === index ? { ...item, [field]: event.target.value } : item))} />;
  const remove = (index: number) => <Tooltip title="Retirer la ligne"><IconButton disabled={disabled} onClick={() => change(rows.filter((_, i) => i !== index))} aria-label={`Retirer la ligne ${index + 1}`}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>;
  return <Box sx={{ gridColumn: '1 / -1' }}>
    {!compact && <Stack direction="row" justifyContent="space-between" gap={2} mb={1.25}><Typography fontWeight={700} fontSize={14}>Lignes de dépense ({rows.length})</Typography><Typography fontSize={12} color="text.secondary">Une ligne par article ou prestation</Typography></Stack>}
    {mobile ? <Stack gap={2}>{rows.map((row, index) => <Stack key={index} gap={2} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
      {input(row, index, 'label', 'Description')}
      <Stack direction="row" gap={1.5}>{input(row, index, 'quantity', 'Quantité')}{input(row, index, 'unit_price', 'Prix unitaire')}</Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={700}>Montant HT : {amount(row)}</Typography>{remove(index)}</Stack>
    </Stack>)}</Stack> : <TableContainer sx={{ border: '1px solid #e0e4e9', borderRadius: 1.5 }}><Table aria-label="Lignes de dépense" sx={{ minWidth: 650, '& th': { bgcolor: '#f3f4f6', color: '#535d68', fontSize: 12 }, '& td': { p: 1 } }}><TableHead><TableRow><TableCell>DESCRIPTION</TableCell><TableCell>QTÉ</TableCell><TableCell>PRIX UNIT.</TableCell><TableCell align="right">MONTANT HT</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>
      {rows.map((row, index) => <TableRow key={index}><TableCell sx={{ width: '45%' }}>{input(row, index, 'label', 'Description')}</TableCell><TableCell>{input(row, index, 'quantity', 'Quantité')}</TableCell><TableCell>{input(row, index, 'unit_price', 'Prix unitaire')}</TableCell><TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{amount(row)}</TableCell><TableCell>{remove(index)}</TableCell></TableRow>)}
    </TableBody></Table></TableContainer>}
    {!rows.length && <Typography fontSize={13} color="text.secondary" py={2}>Ajoutez vos articles ou prestations, ou renseignez directement le montant HT.</Typography>}
    <Button variant={compact ? 'outlined' : 'text'} disabled={disabled || rows.length >= 500} startIcon={<AddIcon />} onClick={() => change([...rows, { label: '', quantity: '1', unit_price: '0' }])} sx={{ mt: 1.5, mb: 1, color: '#216e58' }}>{compact ? 'Ajouter un article' : 'Ajouter une ligne'}</Button>
    <Typography variant="caption" color="text.secondary" display="block">{compact ? 'Sans article, le total HT peut être saisi manuellement.' : 'Le HT est arrondi après addition des lignes ; les montants affichés par ligne sont arrondis séparément.'}</Typography>
  </Box>;
}
