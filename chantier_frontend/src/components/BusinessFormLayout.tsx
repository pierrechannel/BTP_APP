import { expenseLinesTotal, financialTotal } from '../api/workflows';
import { ReactNode } from "react";
import { Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
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

const money = (value: number) => Number.isFinite(value) ? value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—';
function parseLines(raw: unknown): Array<Record<string, unknown>> {
  try { const rows = JSON.parse(String(raw || '[]')); return Array.isArray(rows) ? rows : []; } catch { return []; }
}
/* ---------- Layout ---------- */

export function BusinessFormLayout({ model, controls, values, relations }: {
  model: string; controls: Record<string, ReactNode>; values: Record<string, unknown>; relations: Record<string, ApiRecord[]>;
}) {
  const expense = model === 'budget.expense';
  const lines = parseLines(values.details);
  let linesTotal = 0; let total = 0;
  try { linesTotal = Number(expenseLinesTotal(lines)); total = Number(financialTotal(values.amount_excluding_tax, values.tax_amount)); } catch { /* Incomplete draft inputs */ }
  const budgetLine = relations.budget_line?.find(row => String(row.id) === String(values.budget_line));

  const normal = Number(values.normal_hours || 0);
  const overtime = Number(values.overtime_hours || 0);
  const hours = normal + overtime;
  const overLimit = hours > 24;
  const worker = relations.worker?.find((row) => String(row.id) === String(values.worker));
  const used = new Set(expense ? ['budget_line', 'date', 'currency', 'supplier_name', 'details', 'amount_excluding_tax', 'tax_amount']
    : ['project', 'work_date', 'worker', 'task', 'normal_hours', 'overtime_hours']);
  const remaining = Object.entries(controls).filter(([name]) => !used.has(name));

  return <Stack spacing={3}>
    {expense && budgetLine && <Alert severity={total > Number(budgetLine.available) ? 'warning' : 'info'}>
      {String(budgetLine.project_name || '')} · {String(budgetLine.label)} · Disponible après engagements : {money(Number(budgetLine.available))} {String(values.currency || budgetLine.currency)}.
      {total > Number(budgetLine.available) && ' Le montant dépasse le disponible ; une confirmation sera demandée à la validation.'}
    </Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: expense ? '2fr 1fr 1fr' : '2fr 1fr' }, gap: 2 }}>
      {expense ? <>{controls.budget_line}{controls.date}{controls.currency}</> : <>{controls.project}{controls.work_date}</>}
    </Box>
    {expense ? <>
      {controls.supplier_name}
      {controls.details}
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
