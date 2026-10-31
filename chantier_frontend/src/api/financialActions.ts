import { api } from './client';

export async function financialAction(endpoint: string, body: Record<string, unknown>, headers: Record<string, string | undefined>) {
  try { return await api.post(endpoint, body, { headers }); }
  catch (error) {
    const data = (error as { response?: { data?: { code?: string } } }).response?.data;
    if (data?.code === 'budget_overrun' && window.confirm('Cette dépense dépasse le disponible du poste. Autoriser le dépassement et valider ?')) {
      return api.post(endpoint, { ...body, allow_overrun: true }, { headers });
    }
    throw error;
  }
}
