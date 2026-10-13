# Tests, qualite et livraison backend

## Definition of Done backend

Une exigence backend est terminee quand:

- code relu et fusionne;
- migrations generees, reversibles et testees;
- tests unitaires et integration API passants;
- permissions et isolation tenant testees;
- documentation OpenAPI mise a jour;
- logs/audit ajoutes pour les actions sensibles;
- traductions FR/EN prevues pour les messages utilisateur;
- pas de logique metier critique dans les vues.

## Tests requis

Backend:

- `pytest`;
- `pytest-django`;
- DRF `APIClient`;
- tests Channels pour WebSockets;
- tests Celery pour taches asynchrones;
- tests de permissions par role;
- tests d'isolation tenant systematiques.

Objectif de couverture: 80% minimum sur backend, avec priorite a la logique metier et aux permissions.

## Scenarios d'acceptation prioritaires

Isolation multi-tenant:

- Etant donne deux tenants A et B, quand un utilisateur de A appelle un detail projet de B, alors l'API repond `404` et journalise la tentative.

Autorisations:

- Etant donne un role Client, quand il tente de creer une depense, alors l'API repond `403`.

Planning:

- Etant donne une chaine A -> B -> C, quand l'utilisateur cree C -> A, alors le systeme refuse la dependance circulaire.

Multi-devise:

- Etant donne une depense en devise differente de la devise tenant, quand elle est validee, alors le montant original, le taux applique et le montant converti sont conserves.

Documents:

- Etant donne un document indice A, quand une nouvelle version est deposee, alors l'indice B devient courant et l'indice A reste consultable/restaurable selon permissions.

Offline mobile:

- Etant donne des mutations creees hors-ligne, quand le mobile synchronise, alors le backend applique les mutations idempotentes, signale les conflits et evite les doublons.

## Qualite de code

Outils recommandes:

- Ruff;
- Black;
- isort;
- mypy;
- django-stubs;
- Bandit;
- pip-audit ou outil equivalent;
- pre-commit.

Regles:

- services metier typables et testables;
- serializers pour validation d'entree/sortie;
- selectors pour lectures complexes;
- pas de requetes non filtrees par tenant;
- pas de `float` pour argent;
- pas de fichiers servis sans controle d'acces;
- pas de logs contenant secrets, tokens ou donnees personnelles en clair.

## CI/CD

Pipeline attendu:

```text
lint -> typecheck -> tests -> migrations check -> security scan -> build image -> deploy staging -> approval production
```

Environnements:

- developpement local avec Docker Compose;
- staging proche production;
- production avec sauvegardes et rollback.

## Observabilite

Prevoir:

- logs JSON;
- correlation id par requete;
- tenant id dans les logs techniques;
- metriques latence, erreurs, files Celery, cache, connexions WebSocket;
- Sentry ou equivalent;
- dashboards d'exploitation;
- alertes sur erreurs et saturation.

## Sauvegarde et disponibilite

Objectifs SRS:

- RPO cible: 15 minutes;
- RTO cible: 4 heures;
- sauvegardes PostgreSQL completes quotidiennes;
- archivage WAL continu;
- sauvegardes S3 versionnees;
- health checks pour API, workers, Redis, base de donnees et stockage.

## Livraison par phases

Phase 0 - Socle:

- monorepo;
- Docker;
- CI/CD;
- auth;
- roles;
- audit;
- multi-tenant;
- i18n.

Phase 1 - MVP:

- projets;
- planning de base;
- rapports journaliers;
- photos;
- GED simple;
- notifications.

Phase 2 - Pilotage:

- budget;
- personnel et pointage;
- ressources;
- reporting.

Phase 3 - Terrain et securite:

- QHSE;
- materiel;
- messagerie temps reel.

Phase 4 - Mobile:

- endpoints sync;
- offline-first;
- resolution de conflits.

Phase 5 - Industrialisation:

- performance;
- pentest;
- SSO;
- API publique;
- integrations.
