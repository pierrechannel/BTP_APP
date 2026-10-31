import { ReactNode } from 'react';
import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { ApiRecord } from '../api/types';
import { financialTotal } from '../api/workflows';
import { formatValue } from '../api/workspace';

const card = { p: { xs: 2, md: 2.5 }, borderRadius: 1.5, borderColor: '#dce1e9', boxShadow: 'none' };
const caption = { fontSize: 12, fontWeight: 700, color: '#667085' };
const cents = (value: unknown) => {
  const match = /^(-?)(\d+)(?:\.(\d{0,2}))?$/.exec(String(value ?? '0'));
  if (!match) throw new Error('Invalid amount');
  return BigInt(match[2] + (match[3] || '').padEnd(2, '0')) * (match[1] ? -1n : 1n);
};
const decimal = (value: bigint) => `${value < 0n ? '-' : ''}${(value < 0n ? -value : value) / 100n}.${String((value < 0n ? -value : value) % 100n).padStart(2, '0')}`;

export function ExpensePageLayout({ controls, values, relations, receipts }: {
  controls: Record<string, ReactNode>; values: Record<string, unknown>; relations: Record<string, ApiRecord[]>;
  receipts?: ReactNode;
}) {
  const line = relations.budget_line?.find(row => String(row.id) === String(values.budget_line));
  const currency = String(line?.currency || values.currency || '');
  let hasArticles = false;
  try { hasArticles = JSON.parse(String(values.details || '[]')).length > 0; } catch { /* Draft */ }
  let total: string | null = null;
  let after: string | null = null;
  try {
    total = financialTotal(values.amount_excluding_tax, values.tax_amount);
    if (line) after = decimal(cents(line.available) - cents(total));
  } catch { /* Incomplete fields */ }
  const overrun = after !== null && after.startsWith('-');
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2.5fr) minmax(260px, 1fr)' }, gap: 3, alignItems: 'start' }}>
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Paper variant="outlined" sx={card}>
        <Typography component="h2" fontSize={16} fontWeight={700} mb={2}>Informations</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {controls.budget_line}{controls.date}{controls.supplier_name}{controls.invoice}
        </Box>
      </Paper>
      <Paper variant="outlined" sx={card}>
        <Typography component="h2" fontSize={16} fontWeight={700} mb={2}>Articles ou prestations</Typography>
        {controls.details}
      </Paper>
      <Paper variant="outlined" sx={{ ...card, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 3, alignItems: 'center' }}>
        <Box>{hasArticles ? <><Typography fontSize={13} mb={.75}>Total HT</Typography><Typography fontSize={20} fontWeight={700}>{formatValue(values.amount_excluding_tax, 'amount')}</Typography></> : controls.amount_excluding_tax}</Box>
        {controls.tax_amount}
        <Box><Typography fontSize={13} mb={.75}>Total TTC</Typography><Typography fontSize={24} fontWeight={750}>{total === null ? '—' : formatValue(total, 'amount')} {currency}</Typography></Box>
      </Paper>
      {overrun && <Alert severity="warning">Cette dépense dépasse le disponible du poste. Une confirmation sera nécessaire lors de la validation.</Alert>}
      {receipts}
    </Stack>
    <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: 24 }}>
      <Paper variant="outlined" sx={card}>
        <Typography sx={caption}>CHANTIER</Typography><Typography fontWeight={700} mb={1.5}>{String(line?.project_name || 'Sélectionnez un poste budgétaire')}</Typography>
        <Typography sx={caption}>POSTE · DEVISE</Typography><Typography fontWeight={700} mb={1.5}>{line ? `${line.label} · ${currency}` : '—'}</Typography>
        <Typography sx={caption}>DISPONIBLE AVANT CETTE DÉPENSE</Typography><Typography fontWeight={750} fontSize={26}>{line ? formatValue(line.available, 'amount') : '—'}</Typography>
        <Typography fontSize={13} color="text.secondary" mt={.5}>Après cette dépense : <Box component="span" fontWeight={700} color={overrun ? 'error.main' : '#202936'}>{after === null ? '—' : formatValue(after, 'amount')} {currency}</Box></Typography>
        <Typography fontSize={11} color="text.secondary" mt={1}>Le disponible tient compte des dépenses soumises, validées et payées.</Typography>
      </Paper>
      <Paper variant="outlined" sx={card}>
        <Typography sx={caption} mb={1}>CYCLE</Typography>
        <Stack direction="row" spacing={.5} alignItems="center" flexWrap="wrap" useFlexGap>{[['Brouillon', '#e8edf3', '#475467'], ['Soumis', '#fff2cc', '#925500'], ['Validé', '#dcfce7', '#197443'], ['Payé', '#dcfce7', '#197443']].map(([label, bg, color], index) => <Stack key={label} direction="row" alignItems="center" spacing={.5}>{index > 0 && <Typography color="text.secondary">›</Typography>}<Chip size="small" label={label} sx={{ height: 23, bgcolor: bg, color, fontSize: 11, fontWeight: 700 }} /></Stack>)}</Stack>
      </Paper>
    </Stack>
  </Box>;
}
