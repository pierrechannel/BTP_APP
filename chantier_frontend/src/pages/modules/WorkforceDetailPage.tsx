import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function WorkforceDetailPage() {
  const { record, loading, error } = useDetailRecord("/workforce/workers/", "le personnel");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "last_name", "first_name")} subtitle="Fiche personnel" backTo="/workforce" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Identite">
              <FieldGrid
                fields={[
                  ["Prenom", record.first_name],
                  ["Nom", record.last_name],
                  ["Poste", record.job_title],
                  ["Telephone", record.phone],
                ]}
              />
            </DetailCard>
            <DetailCard title="Pointage et cout">
              <FieldGrid fields={[["Taux horaire", record.hourly_rate], ["Devise", record.currency], ["Statut", record.status]]} />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
