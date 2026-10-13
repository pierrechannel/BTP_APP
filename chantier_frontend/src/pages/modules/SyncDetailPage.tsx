import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function SyncDetailPage() {
  const { record, loading, error } = useDetailRecord("/sync/mutations/", "la mutation sync");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "resource_type", "operation")} subtitle="Synchronisation offline" backTo="/sync" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Mutation">
              <FieldGrid
                fields={[
                  ["Ressource", record.resource_type],
                  ["Operation", record.operation],
                  ["Statut", record.status],
                  ["Objet", record.object_id],
                ]}
              />
            </DetailCard>
            <DetailCard title="Payload et erreurs">
              <FieldGrid fields={[["Payload", record.payload], ["Erreur", record.error_message], ["Cree le", record.created_at]]} />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
