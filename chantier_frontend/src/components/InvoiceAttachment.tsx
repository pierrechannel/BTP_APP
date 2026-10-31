import { ApiRecord } from '../api/types';
import { ExpenseReceipts } from './ExpenseReceipts';

export function InvoiceAttachment({ invoice }: { invoice: ApiRecord }) {
  return <ExpenseReceipts title="Fichier de la facture" description="Consultez ou téléchargez le document original de la facture."
    downloadUrl={`/budget/invoices/${invoice.id}/file/download/`}
    receipts={invoice.has_file ? [{ id: String(invoice.id), original_name: String(invoice.original_name), size: Number(invoice.file_size) }] : []} />;
}
