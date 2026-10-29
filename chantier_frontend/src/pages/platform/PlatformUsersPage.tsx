import { useState } from "react";
import { Alert, Button, Stack } from "@mui/material";
import { ApiRecord } from "../../api/types";
import { PlatformUserAccess } from "../../platform/PlatformUserAccess";

import { PlatformTable } from "../../platform/PlatformTable";

export function PlatformUsersPage() {
  const [access, setAccess] = useState<{ user: ApiRecord; refresh: () => void } | null>(null);
  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Gérez les comptes et leurs accès aux entreprises. La désactivation d’un compte s’applique à toutes ses entreprises ; suspendre un accès ne concerne qu’une entreprise.
      </Alert>
      <PlatformTable
        title="Utilisateurs"
        subtitle="Comptes de la plateforme et accès par entreprise."
        endpoint="/auth/platform/users/"
        tenantScoped
        columns={["email", "username", "first_name", "last_name", "memberships_count", "is_superuser", "is_active"]}
        rowActions={(user, refresh) => <Button size="small" onClick={() => setAccess({ user, refresh })}>Accès entreprises</Button>}
        editableFields={[
          { name: "email", label: "Adresse e-mail", type: "email", required: true, maxLength: 254 },
          { name: "username", label: "Identifiant", required: true, maxLength: 150 },
          { name: "first_name", label: "Prénom", maxLength: 150 },
          { name: "last_name", label: "Nom", maxLength: 150 },
          { name: "password", label: "Mot de passe", type: "password", required: true },
          { name: "is_active", label: "Compte actif", type: "boolean", default: true },
        ]}
      />
      {access && <PlatformUserAccess user={access.user} onClose={() => setAccess(null)} onSaved={access.refresh} />}
    </Stack>
  );
}
