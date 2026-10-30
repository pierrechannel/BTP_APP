import { ReactNode } from "react";
import { Box, Button, Chip, IconButton, Stack, SvgIcon, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { ApiRecord } from "../api/types";

export const businessDialogSx = {
  color: '#24292e', borderRadius: '14px', width: 960, maxWidth: 'calc(100vw - 32px)', m: 2,
  '& .MuiDialogTitle-root': { bgcolor: '#fff', color: '#24292e' },
  '& .MuiInputLabel-root': { position: 'static', transform: 'none', fontSize: 13, fontWeight: 500, color: '#24292e', mb: .8, maxWidth: '100%' },
  '& .MuiInputLabel-asterisk': { color: '#6b7280' },
  '& .MuiTextField-root': { minWidth: 0 },
  '& .MuiOutlinedInput-root': { color: '#24292e', fontSize: 13, borderRadius: '7px', minHeight: 43, bgcolor: '#fff' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#bac2cc', '& legend': { display: 'none' } },
  '& .MuiFormHelperText-root': { mx: 0 },
  '& .MuiButton-contained': { bgcolor: '#216e58', '&:hover': { bgcolor: '#195844' } },
  '& .MuiButton-outlined': { borderColor: '#b8c0ca', color: '#216e58' },
};

const tableSx = {
  minWidth: 680,
  '& th': { bgcolor: '#f3f4f6', color: '#535d68', fontSize: 12, fontWeight: 700, letterSpacing: '.025em', py: 1.25, borderColor: '#e2e5e9' },
  '& td': { bgcolor: '#fff', py: 2, borderColor: '#e2e5e9', verticalAlign: 'top' },
};

/* ---------- Lignes de dépense ---------- */

// Clés JSON utilisées dans le champ `details`. À ajuster si votre API en utilise d'autres.
const LINE_KEYS = { description: 'description', category: 'category', quantity: 'quantity', unitPrice: 'unit_price' } as const;
type RawLine = Record<string, unknown>;

const money = (value: number) => Number.isFinite(value) ? value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—';
const num = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const lineAmount = (line: RawLine) => num(line[LINE_KEYS.quantity]) * num(line[LINE_KEYS.unitPrice]);

function parseLines(raw: unknown): RawLine[] {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed.filter((l): l is RawLine => !!l && typeof l === 'object') : [];
  } catch { return []; /* La validation du formulaire signale les valeurs invalides. */ }
}

const TrashIcon = () => <SvgIcon fontSize="small" viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></SvgIcon>;

const cellInputSx = { '& .MuiOutlinedInput-root': { minHeight: 40 } };

function ExpenseLinesEditor({ lines, onChange }: { lines: RawLine[]; onChange: (next: RawLine[]) => void }) {
  const update = (index: number, patch: RawLine) => onChange(lines.map((l, i) => i === index ? { ...l, ...patch } : l));
  const remove = (index: number) => onChange(lines.filter((_, i) => i !== index));
  const add = () => onChange([...lines, { [LINE_KEYS.description]: '', [LINE_KEYS.category]: '', [LINE_KEYS.quantity]: 1, [LINE_KEYS.unitPrice]: 0 }]);
  const numeric = (index: number, key: string) => (e: { target: { value: string } }) => update(index, { [key]: e.target.value === '' ? 0 : num(e.target.value.replace(',', '.')) });
  return <Box>
    <Stack direction="row" alignItems="baseline" justifyContent="space-between" mb={1}>
      <Typography fontWeight={700} fontSize={14}>Lignes de dépense <Typography component="span" fontSize={14} color="#66707d">({lines.length})</Typography></Typography>
      <Typography fontSize={12} color="#66707d">Une ligne par justificatif ou par poste</Typography>
    </Stack>
    <TableContainer sx={{ border: '1px solid #e0e4e9', borderRadius: 1.5 }}>
      <Table sx={{ ...tableSx, '& td': { ...tableSx['& td'], py: 1, verticalAlign: 'middle' } }} aria-label="Lignes de dépense">
        <TableHead><TableRow>
          <TableCell>DESCRIPTION</TableCell><TableCell sx={{ width: 160 }}>CATÉGORIE</TableCell><TableCell sx={{ width: 80 }}>QTÉ</TableCell>
          <TableCell sx={{ width: 130 }}>PRIX UNIT.</TableCell><TableCell align="right" sx={{ width: 120 }}>MONTANT</TableCell><TableCell sx={{ width: 52 }} />
        </TableRow></TableHead>
        <TableBody>
          {lines.length === 0 && <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', color: '#66707d', py: '20px !important' }}>Aucune ligne. Ajoutez la première pour calculer le montant.</TableCell></TableRow>}
          {lines.map((line, i) => <TableRow key={i}>
            <TableCell><TextField fullWidth size="small" sx={cellInputSx} inputProps={{ 'aria-label': `Description ligne ${i + 1}` }}
              value={String(line[LINE_KEYS.description] ?? '')} onChange={(e) => update(i, { [LINE_KEYS.description]: e.target.value })} /></TableCell>
            <TableCell><TextField fullWidth size="small" sx={cellInputSx} inputProps={{ 'aria-label': `Catégorie ligne ${i + 1}` }}
              value={String(line[LINE_KEYS.category] ?? '')} onChange={(e) => update(i, { [LINE_KEYS.category]: e.target.value })} /></TableCell>
            <TableCell><TextField fullWidth size="small" type="number" sx={cellInputSx} inputProps={{ 'aria-label': `Quantité ligne ${i + 1}`, min: 0, style: { textAlign: 'right' } }}
              value={line[LINE_KEYS.quantity] ?? ''} onChange={numeric(i, LINE_KEYS.quantity)} /></TableCell>
            <TableCell><TextField fullWidth size="small" type="number" sx={cellInputSx} inputProps={{ 'aria-label': `Prix unitaire ligne ${i + 1}`, min: 0, style: { textAlign: 'right' } }}
              value={line[LINE_KEYS.unitPrice] ?? ''} onChange={numeric(i, LINE_KEYS.unitPrice)} /></TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{money(lineAmount(line))}</TableCell>
            <TableCell><IconButton aria-label={`Supprimer la ligne ${i + 1}`} onClick={() => remove(i)} sx={{ width: 44, height: 44, color: '#626c78' }}><TrashIcon /></IconButton></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
      <Box sx={{ px: 1, py: .5, borderTop: '1px solid #e2e5e9' }}>
        <Button onClick={add} sx={{ minHeight: 44, fontWeight: 700, color: '#216e58' }}>+ Ajouter une ligne</Button>
      </Box>
    </TableContainer>
  </Box>;
}

/* ---------- Layout ---------- */

export function BusinessFormLayout({ model, controls, values, relations, onChange }: {
  model: string; controls: Record<string, ReactNode>; values: Record<string, unknown>; relations: Record<string, ApiRecord[]>;
  /** Optionnel : permet à l'éditeur de lignes d'écrire `details` et `amount_excluding_tax`. Sans lui, le champ `details` d'origine est affiché. */
  onChange?: (name: string, value: unknown) => void;
}) {
  const expense = model === 'budget.expense';
  const lines = parseLines(values.details);
  const linesTotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  const total = Number(values.amount_excluding_tax || 0) + Number(values.tax_amount || 0);
  const normal = Number(values.normal_hours || 0);
  const overtime = Number(values.overtime_hours || 0);
  const hours = normal + overtime;
  const overLimit = hours > 24;
  const worker = relations.worker?.find((row) => String(row.id) === String(values.worker));
  const used = new Set(expense ? ['budget_line', 'date', 'currency', 'supplier_name', 'details', 'amount_excluding_tax', 'tax_amount']
    : ['project', 'work_date', 'worker', 'task', 'normal_hours', 'overtime_hours']);
  const remaining = Object.entries(controls).filter(([name]) => !used.has(name));

  const changeLines = (next: RawLine[]) => {
    onChange?.('details', JSON.stringify(next));
    // Le montant HT suit les lignes dès qu'il y en a au moins une.
    if (next.length > 0) onChange?.('amount_excluding_tax', next.reduce((s, l) => s + lineAmount(l), 0));
  };

  return <Stack spacing={3}>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: expense ? '2fr 1fr 1fr' : '2fr 1fr' }, gap: 2 }}>
      {expense ? <>{controls.budget_line}{controls.date}{controls.currency}</> : <>{controls.project}{controls.work_date}</>}
    </Box>
    {expense ? <>
      {controls.supplier_name}
      {onChange ? <ExpenseLinesEditor lines={lines} onChange={changeLines} /> : controls.details}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.8fr 1fr' }, alignItems: 'start', gap: 2.5 }}>
        <Box sx={{ border: '1px dashed #bdc6d1', borderRadius: 1.5, p: 2.5 }}>
          <Typography fontWeight={700} fontSize={13} mb={2}>Montants et taxes</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>{controls.amount_excluding_tax}{controls.tax_amount}</Box>
          <Typography color="#66707d" fontSize={12} mt={1.5}>
            {lines.length > 0 ? `Montant HT calculé à partir des lignes : ${money(linesTotal)}.` : 'Le montant HT est calculé à partir des lignes lorsqu’elles sont renseignées.'}
          </Typography>
        </Box>
        <Stack spacing={2} sx={{ bgcolor: '#f3f4f6', borderRadius: 1.5, p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between"><Typography fontSize={13} color="#626c78">{lines.length} ligne{lines.length > 1 ? 's' : ''}</Typography><Typography fontSize={13} color="#626c78">{String(values.currency || '—')}</Typography></Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}><Typography fontWeight={700} fontSize={14}>Total TTC</Typography><Typography fontWeight={750} fontSize={22} color="#216e58">{money(total)}</Typography></Stack>
        </Stack>
      </Box>
    </> : <>
      <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
        <Chip label={values.worker ? '1 collaborateur sélectionné' : 'Sélectionnez un collaborateur'} sx={{ bgcolor: '#e4f2ec', color: '#185d46', fontWeight: 700, height: 36 }} />
        <Chip label={`${money(normal)} h normales`} sx={{ bgcolor: '#f3f4f6', color: '#3a4148', fontWeight: 600, height: 36 }} />
        {overtime > 0 && <Chip label={`${money(overtime)} h suppl.`} sx={{ bgcolor: '#fbebd3', color: '#6e4100', fontWeight: 700, height: 36 }} />}
        <Typography fontSize={13} color={overLimit ? '#8a1f1f' : '#626c78'} fontWeight={overLimit ? 700 : 400} role={overLimit ? 'alert' : undefined}>
          {money(hours)} h au total{overLimit ? ' · dépasse la limite de 24 h par jour' : ''}
        </Typography>
      </Stack>
      <TableContainer sx={{ border: '1px solid #e0e4e9', borderRadius: 1.5 }}><Table sx={tableSx} aria-label="Pointage du personnel"><TableHead><TableRow>
        <TableCell sx={{ width: '36%' }}>COLLABORATEUR</TableCell><TableCell>HEURES NORMALES</TableCell><TableCell>HEURES SUPPL.</TableCell><TableCell align="right">TOTAL</TableCell>
      </TableRow></TableHead><TableBody><TableRow sx={overLimit ? { '& td': { bgcolor: '#fdf6f6' } } : undefined}>
        <TableCell>{controls.worker ?? <Typography fontSize={13}>Collaborateur de la fiche ouverte</Typography>}{Boolean(worker?.job_title) && <Typography fontSize={12} color="#66707d" mt={1}>{String(worker?.job_title)}</Typography>}</TableCell>
        <TableCell>{controls.normal_hours}</TableCell><TableCell>{controls.overtime_hours}</TableCell><TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700, pt: '46px !important', color: overLimit ? '#8a1f1f' : undefined }}>{money(hours)} h</TableCell>
      </TableRow></TableBody></Table></TableContainer>
      <Box sx={{ maxWidth: 440 }}>{controls.task}</Box>
      <Typography fontSize={12} color="#66707d">Le cumul des heures normales et supplémentaires est limité à 24 h par jour, sur tous les chantiers. La validation du pointage reste disponible depuis sa fiche.</Typography>
    </>}
    {remaining.length > 0 && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>{remaining.map(([name, node]) => <Box key={name}>{node}</Box>)}</Box>}
  </Stack>;
}