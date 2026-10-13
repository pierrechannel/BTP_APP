import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function PlanningDetailPage() {
  const { record, loading, error } = useDetailRecord("/planning/tasks/", "la tache");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "name")} subtitle="Detail planning" backTo="/planning" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Tache">
              <FieldGrid
                fields={[
                  ["Nom", record.name],
                  ["Statut", record.status],
                  ["Avancement", record.progress_percent],
                  ["Priorite", record.priority],
                ]}
              />
            </DetailCard>
            <DetailCard title="Dates et dependances">
              <FieldGrid
                fields={[
                  ["Debut prevu", record.planned_start_date],
                  ["Fin prevue", record.planned_end_date],
                  ["Debut reel", record.actual_start_date],
                  ["Fin reelle", record.actual_end_date],
                  ["Description", record.description],
                ]}
              />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
