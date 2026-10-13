import { Alert, Stack } from "@mui/material";

import { PlatformTable } from "../../platform/PlatformTable";

export function PlatformUsersPage() {
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        La liste des utilisateurs depend du tenant selectionne dans l'espace Chantier, car l'API applique le contexte tenant.
      </Alert>
      <PlatformTable
        title="Utilisateurs"
        subtitle="Comptes rattaches au tenant courant."
        endpoint="/auth/users/"
        columns={["email", "username", "first_name", "last_name", "language", "timezone", "preferred_currency", "is_active"]}
      />
    </Stack>
  );
}
