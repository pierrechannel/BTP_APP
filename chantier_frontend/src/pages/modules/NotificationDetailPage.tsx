import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function NotificationDetailPage() {
  const { record, loading, error } = useDetailRecord("/notifications/notifications/", "la notification");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "title")} subtitle="Notification" backTo="/notifications" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Message">
              <FieldGrid fields={[["Titre", record.title], ["Message", record.body], ["Lu le", record.read_at]]} />
            </DetailCard>
            <DetailCard title="Contexte">
              <FieldGrid fields={[["Type", record.notification_type], ["Objet", record.object_id], ["Cree le", record.created_at]]} />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
