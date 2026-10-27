# Contrats API backend

## Prefixe et versionnement

Toutes les routes publiques v1 utilisent:

```text
/api/v1/
```

Les changements compatibles ajoutent des champs ou endpoints. Les ruptures de contrat doivent attendre une nouvelle version majeure.

## Authentification

Endpoints attendus:

```text
POST /api/v1/auth/token/
POST /api/v1/auth/token/refresh/
POST /api/v1/auth/token/blacklist/
POST /api/v1/auth/password/reset/
POST /api/v1/auth/password/reset/confirm/
GET  /api/v1/auth/me/
```

Le JWT doit porter l'identite utilisateur. Le tenant courant est resolu par contexte explicite:

- header `X-Tenant-ID`, ou
- claim de contexte apres selection tenant, ou
- endpoint de changement de contexte.

La strategie definitive doit etre formalisee en ADR.

## Conventions REST

- JSON par defaut.
- Dates en ISO 8601.
- Pagination curseur ou `limit`.
- Filtres par query params.
- Tri par query param `ordering`.
- Erreurs unifiees.
- Idempotence sur creations critiques via `Idempotency-Key`.
- Reponse `404` plutot que fuite d'existence pour une ressource d'un autre tenant.

Format d'erreur:

```json
{
  "code": "permission_denied",
  "message": "Action non autorisee.",
  "details": {}
}
```

## Endpoints par module

Exemples de base:

```text
/api/v1/tenants/
/api/v1/users/
/api/v1/roles/
/api/v1/projects/
/api/v1/projects/{project_id}/lots/
/api/v1/planning/tasks/
/api/v1/planning/dependencies/
/api/v1/budget/expenses/
/api/v1/budget/invoices/
/api/v1/resources/materials/
/api/v1/resources/purchase-orders/
/api/v1/workforce/workers/
/api/v1/workforce/time-entries/
/api/v1/equipment/equipment/
/api/v1/progress/daily-reports/
/api/v1/progress/photos/
/api/v1/qhse/incidents/
/api/v1/documents/documents/
/api/v1/notifications/
/api/v1/reports/
```

## WebSockets

Prefixe:

```text
/ws/v1/
```

Canaux attendus:

- utilisateur: notifications personnelles;
- chantier: messages, alertes et activite chantier;
- systeme tenant: evenements administratifs.

Chaque connexion WebSocket doit authentifier l'utilisateur et verifier son appartenance au tenant et au chantier cible.

## Synchronisation mobile

Endpoints attendus:

```text
POST /api/v1/sync/pull
POST /api/v1/sync/push
```

`pull` recoit un curseur et retourne les changements accessibles par tenant, chantier et utilisateur.

`push` recoit des mutations creees hors-ligne avec UUID client. Le backend doit:

- valider permissions et tenant;
- appliquer l'idempotence;
- detecter les conflits via `version` ou `updated_at`;
- retourner le statut de chaque mutation;
- fournir une erreur actionnable en cas de conflit.

## Exports et imports

Formats:

- CSV;
- XLSX;
- PDF/A pour rapports;
- JSON pour API et portabilite.

Les imports doivent produire un rapport d'erreurs ligne par ligne, sans appliquer partiellement des donnees invalides sauf workflow explicitement prevu.

## Documentation API

Utiliser `drf-spectacular` pour generer:

- schema OpenAPI 3;
- documentation interactive;
- types client frontend si possible.

Chaque endpoint doit declarer:

- permissions;
- filtres;
- payloads;
- erreurs metier;
- exemples de reponse pour les flux critiques.
