import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function ProgressDetailPage() {
  const { record, loading, error } = useDetailRecord("/progress/daily-reports/", "le rapport journalier");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "report_date", "title")} subtitle="Rapport journalier" backTo="/progress" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Journal de chantier">
              <FieldGrid
                fields={[
                  ["Date", record.report_date],
                  ["Meteo", record.weather],
                  ["Statut", record.status],
                  ["Travaux realises", record.work_done],
                ]}
              />
            </DetailCard>
            <DetailCard title="Observations">
              <FieldGrid
                fields={[
                  ["Blocages", record.blockers],
                  ["Commentaires", record.comments],
                  ["Created at", record.created_at],
                  ["Updated at", record.updated_at],
                ]}
              />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
