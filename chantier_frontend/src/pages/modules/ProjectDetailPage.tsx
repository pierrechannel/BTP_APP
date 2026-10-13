import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function ProjectDetailPage() {
  const { record, loading, error } = useDetailRecord("/projects/", "le chantier");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "name", "code")} subtitle="Fiche chantier" backTo="/projects" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Identite du chantier">
              <FieldGrid
                fields={[
                  ["Code", record.code],
                  ["Nom", record.name],
                  ["Client", record.client_name],
                  ["Type de travaux", record.work_type],
                  ["Statut", record.status],
                  ["Devise", record.currency],
                ]}
              />
            </DetailCard>
            <DetailCard title="Planning et budget">
              <FieldGrid
                fields={[
                  ["Debut prevu", record.planned_start_date],
                  ["Fin prevue", record.planned_end_date],
                  ["Montant contrat", record.contract_amount],
                  ["Adresse", record.address],
                ]}
              />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
