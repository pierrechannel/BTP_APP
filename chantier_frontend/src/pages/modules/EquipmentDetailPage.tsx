import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function EquipmentDetailPage() {
  const { record, loading, error } = useDetailRecord("/equipment/equipment/", "le materiel");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "name", "serial_number")} subtitle="Fiche materiel" backTo="/equipment" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Materiel">
              <FieldGrid
                fields={[
                  ["Nom", record.name],
                  ["Type", record.equipment_type],
                  ["Numero serie", record.serial_number],
                  ["Etat", record.state],
                ]}
              />
            </DetailCard>
            <DetailCard title="Exploitation">
              <FieldGrid fields={[["Cout journalier", record.daily_cost], ["Localisation", record.location], ["Projet", record.project]]} />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
