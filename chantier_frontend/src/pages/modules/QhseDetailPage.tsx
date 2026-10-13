import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function QhseDetailPage() {
  const { record, loading, error } = useDetailRecord("/qhse/incidents/", "l'incident QHSE");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "title")} subtitle="Incident QHSE" backTo="/qhse" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Incident">
              <FieldGrid
                fields={[
                  ["Titre", record.title],
                  ["Statut", record.status],
                  ["Date", record.occurred_at],
                  ["Gravite", record.severity],
                ]}
              />
            </DetailCard>
            <DetailCard title="Description et actions">
              <FieldGrid fields={[["Description", record.description], ["Actions", record.corrective_actions], ["Projet", record.project]]} />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
