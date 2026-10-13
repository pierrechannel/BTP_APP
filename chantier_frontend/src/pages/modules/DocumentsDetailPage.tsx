import { Stack } from "@mui/material";

import { asTitle, DetailCard, DetailHeader, DetailState, FieldGrid, useDetailRecord } from "./detailTools";

export function DocumentsDetailPage() {
  const { record, loading, error } = useDetailRecord("/documents/documents/", "le document");

  return (
    <Stack spacing={3}>
      <DetailHeader title={asTitle(record, "title", "name")} subtitle="Document GED" backTo="/documents" />
      <DetailState loading={loading} error={error}>
        {record && (
          <>
            <DetailCard title="Document">
              <FieldGrid
                fields={[
                  ["Titre", record.title],
                  ["Statut", record.status],
                  ["Version", record.version],
                  ["Type", record.document_type],
                ]}
              />
            </DetailCard>
            <DetailCard title="Classement">
              <FieldGrid
                fields={[
                  ["Dossier", record.folder],
                  ["Fichier", record.file],
                  ["Cree le", record.created_at],
                  ["Mis a jour le", record.updated_at],
                ]}
              />
            </DetailCard>
          </>
        )}
      </DetailState>
    </Stack>
  );
}
