import { Box, Button, IconButton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

type Line = { label: string; quantity: string; unit_price: string };
export function ExpenseDetailsView({ rows }: { rows: Line[] }) {
  return <TableContainer><Table size="small" aria-label="Détails de la dépense"><TableHead><TableRow><TableCell>Libellé</TableCell><TableCell align="right">Quantité</TableCell><TableCell align="right">Prix unitaire</TableCell><TableCell align="right">Total HT</TableCell></TableRow></TableHead><TableBody>
    {rows.map((row, index) => <TableRow key={index}><TableCell>{row.label}</TableCell><TableCell align="right">{row.quantity}</TableCell><TableCell align="right">{Number(row.unit_price).toLocaleString('fr-FR')}</TableCell><TableCell align="right">{(Number(row.quantity) * Number(row.unit_price)).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</TableCell></TableRow>)}
    {!rows.length && <TableRow><TableCell colSpan={4}>Aucune ligne de détail.</TableCell></TableRow>}
  </TableBody></Table></TableContainer>;
}
export function ExpenseDetails({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  let rows: Line[] = [];
  try { const parsed = JSON.parse(value || "[]"); if (Array.isArray(parsed)) rows = parsed; } catch { /* Empty initial value */ }
  const change = (next: Line[]) => onChange(JSON.stringify(next));
  return <Box sx={{ gridColumn: "1 / -1" }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} mb={1.25}><Typography fontWeight={700} fontSize={14}>Lignes de dépense <Box component="span" color="#66707d">({rows.length})</Box></Typography><Typography fontSize={12} color="#66707d">Une ligne par article ou prestation</Typography></Stack>
    <Box sx={{ border: '1px solid #e0e4e9', borderRadius: 1.5, overflow: 'hidden' }}>
    <TableContainer><Table aria-label="Lignes de dépense" sx={{ minWidth: 650, '& th': { bgcolor: '#f3f4f6', color: '#535d68', fontSize: 12, fontWeight: 700, py: 1.25, borderColor: '#e2e5e9' }, '& td': { bgcolor: '#fff', py: 1.5, px: 1, borderColor: '#e2e5e9' }, '& td:first-of-type': { pl: 2 }, '& .MuiOutlinedInput-root': { minHeight: 40 } }}><TableHead><TableRow>
      <TableCell sx={{ width: '46%', pl: 2 }}>DESCRIPTION</TableCell><TableCell sx={{ width: '12%' }}>QTÉ</TableCell><TableCell sx={{ width: '20%' }}>PRIX UNIT.</TableCell><TableCell align="right">MONTANT HT</TableCell><TableCell sx={{ width: 48 }}><Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Actions</Box></TableCell>
    </TableRow></TableHead><TableBody>{rows.map((row, index) => <TableRow key={index}>
      {([['label', 'Libellé'], ['quantity', 'Quantité'], ['unit_price', 'Prix unitaire']] as const).map(([field, label]) =>
        <TableCell key={field}><TextField disabled={disabled} size="small" required fullWidth placeholder={field === 'label' ? 'Description de la dépense' : undefined} value={row[field]} type={field === 'label' ? 'text' : 'number'} inputProps={{ 'aria-label': `${label} · ligne ${index + 1}`, min: field === 'quantity' ? 0.001 : 0, step: field === 'quantity' ? .001 : field === 'unit_price' ? .01 : undefined, maxLength: field === 'label' ? 255 : undefined, style: field === 'label' ? undefined : { textAlign: 'right' } }} onChange={(event) => change(rows.map((item, i) => i === index ? { ...item, [field]: event.target.value } : item))} /></TableCell>)}
      <TableCell align="right" sx={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{Number.isFinite(Number(row.quantity) * Number(row.unit_price)) ? (Number(row.quantity) * Number(row.unit_price)).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}</TableCell>
      <TableCell><Tooltip title="Retirer la ligne"><IconButton disabled={disabled} size="small" onClick={() => change(rows.filter((_, i) => i !== index))} aria-label={`Retirer la ligne ${index + 1}`} sx={{ color: '#626c78' }}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip></TableCell>
    </TableRow>)}
    {!rows.length && <TableRow><TableCell colSpan={5}><Typography fontSize={13} color="#66707d" py={2}>Ajoutez vos articles ou prestations, ou renseignez directement le montant HT ci-dessous.</Typography></TableCell></TableRow>}
    </TableBody></Table></TableContainer>
    <Button disabled={disabled || rows.length >= 500} startIcon={<AddIcon />} onClick={() => change([...rows, { label: '', quantity: '1', unit_price: '0' }])} sx={{ m: 1, color: '#216e58', fontWeight: 700 }}>Ajouter une ligne</Button>
    </Box>
  </Box>;
}
