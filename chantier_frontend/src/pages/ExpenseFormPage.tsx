import { useEffect, useState } from 'react';
import { Alert, CircularProgress, Stack } from '@mui/material';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { ApiRecord } from '../api/types';
import { errorMessage } from '../api/workspace';
import { RecordEditor } from '../components/RecordEditor';
import { resourceByModel } from '../resources';
import { useWorkspace } from '../state/workspace';

export function ExpenseFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const origin = (location.state as { returnTo?: string } | null)?.returnTo;
  const returnTo = origin?.startsWith('/budget') && !origin.startsWith('//') ? origin : id ? `/budget/expenses/${id}` : '/budget/expenses';
  const { can } = useWorkspace();
  const [record, setRecord] = useState<ApiRecord>();
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const allowed = can('budget', id ? 'update' : 'create');
  useEffect(() => {
    setRecord(undefined); setError(''); setLoading(Boolean(id));
    if (!id || !allowed) return;
    const controller = new AbortController();
    api.get<ApiRecord>(`/budget/expenses/${id}/`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setRecord(data); })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, allowed]);
  if (!allowed) return <Alert severity="info">Votre rôle ne permet pas cette action.</Alert>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (loading || (id && !record)) return <Stack alignItems="center" py={6}><CircularProgress /></Stack>;
  if (record && ['validated', 'paid', 'submitted', 'rejected'].includes(String(record.status))) return <Alert severity="info">Cette dépense doit être en brouillon pour être modifiée.</Alert>;
  const defaults: Record<string, string> = { date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Bujumbura', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), ...Object.fromEntries(params.entries()) };
  return <RecordEditor key={id || 'new'} resource={resourceByModel['budget.expense']} record={record} defaults={defaults} open page
    fixedFields={defaults.budget_line ? ['budget_line', 'currency'] : ['currency']}
    onClose={() => navigate(returnTo)}
    onSaved={() => {}} />;
}
