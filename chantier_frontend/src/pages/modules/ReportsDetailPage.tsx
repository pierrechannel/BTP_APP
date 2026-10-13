import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function ReportsDetailPage() {
  const { record, loading, error } = useDetailRecord("/reports/templates/", "le rapport");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "name", "code")} subtitle="Modele de rapport" backTo="/reports" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Modele">
              <FieldGrid fields={[["Code", record.code], ["Nom", record.name], ["Type", record.report_type], ["Actif", record.is_active]]} />
            </DetailCard>
            <DetailCard title="Configuration">
              <FieldGrid fields={[["Parametres", record.parameters], ["Cree le", record.created_at], ["Mis a jour le", record.updated_at]]} />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
