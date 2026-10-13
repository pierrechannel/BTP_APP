import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function LotDetailPage() {
  const { record, loading, error } = useDetailRecord("/projects/lots/", "le lot");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "name", "code")} subtitle="Detail lot" backTo="/lots" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Lot">
              <FieldGrid
                fields={[
                  ["Code", record.code],
                  ["Nom", record.name],
                  ["Sous-traitant", record.subcontractor_name],
                  ["Statut", record.status],
                ]}
              />
            </DetailCard>
            <DetailCard title="Description">
              <FieldGrid fields={[["Description", record.description], ["Projet", record.project]]} />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
