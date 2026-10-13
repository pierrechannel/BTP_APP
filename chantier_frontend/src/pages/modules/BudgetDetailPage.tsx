import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function BudgetDetailPage() {
  const { record, loading, error } = useDetailRecord("/budget/expenses/", "la depense");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "supplier_name", "reference")} subtitle="Detail budget" backTo="/budget" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Depense">
              <FieldGrid
                fields={[
                  ["Fournisseur", record.supplier_name],
                  ["Date", record.date],
                  ["Statut", record.status],
                  ["Categorie", record.category],
                ]}
              />
            </DetailCard>
            <DetailCard title="Montants">
              <FieldGrid
                fields={[
                  ["Montant HT", record.amount_excluding_tax],
                  ["Montant TTC", record.amount_including_tax],
                  ["Taxe", record.tax_amount],
                  ["Devise", record.currency],
                ]}
              />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
