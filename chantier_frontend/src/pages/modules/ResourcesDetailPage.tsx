import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function ResourcesDetailPage() {
  const { record, loading, error } = useDetailRecord("/resources/materials/", "la ressource");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "name", "reference")} subtitle="Detail ressource" backTo="/resources" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Materiau">
              <FieldGrid
                fields={[
                  ["Reference", record.reference],
                  ["Nom", record.name],
                  ["Unite", record.unit],
                  ["Categorie", record.category],
                ]}
              />
            </DetailCard>
            <DetailCard title="Prix">
              <FieldGrid fields={[["Prix unitaire", record.unit_price], ["Devise", record.currency]]} />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
