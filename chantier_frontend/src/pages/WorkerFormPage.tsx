import { useEffect, useState } from 'react';
import { Alert, CircularProgress, Stack } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { ApiRecord } from '../api/types';
import { errorMessage } from '../api/workspace';
import { RecordEditor } from '../components/RecordEditor';
import { resourceByModel } from '../resources';
import { useWorkspace } from '../state/workspace';

export function WorkerFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useWorkspace();
  const [record, setRecord] = useState<ApiRecord>();
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const allowed = can('workforce', id ? 'update' : 'create');
  useEffect(() => {
    setRecord(undefined); setError(''); setLoading(Boolean(id));
    if (!id || !allowed) return;
    const controller = new AbortController();
    api.get<ApiRecord>(`/workforce/workers/${id}/`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setRecord(data); })
      .catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, allowed]);
  const close = () => navigate(id ? `/workforce/${id}` : '/workforce');
  if (!allowed) return <Alert severity="info">Votre rôle ne permet pas cette action.</Alert>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (loading || (id && !record)) return <Stack alignItems="center" py={6}><CircularProgress /></Stack>;
  return <RecordEditor key={id || 'new'} resource={resourceByModel['workforce.worker']} record={record} open page onClose={close} onSaved={() => {}} />;
}
