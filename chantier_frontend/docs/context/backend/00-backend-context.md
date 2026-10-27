# Contexte backend Django

## Mission

Construire le backend de "Chantier", une plateforme SaaS multi-tenant pour PME du BTP au Burundi et, plus largement, en contexte francophone. Le backend doit fournir une source de verite unique pour les chantiers et exposer une API fiable aux clients web React et mobile React Native.

## Perimetre backend

Le backend couvre:

- authentification, utilisateurs, roles, tenants et audit;
- gestion des chantiers, lots et parties prenantes;
- planification des taches et dependances;
- budgets, depenses, factures, avenants et devises;
- ressources, fournisseurs, achats et stocks;
- personnel, pointage, habilitations et affectations;
- materiel, maintenance et affectations;
- avancement, rapports journaliers, photos et reserves;
- QHSE, incidents, inspections et actions correctives;
- gestion documentaire et versionnement;
- notifications, messagerie et WebSockets;
- reporting, KPIs et exports;
- endpoints de synchronisation mobile offline-first.

Hors perimetre v1:

- comptabilite generale et paie complete;
- BIM natif;
- signature electronique qualifiee;
- marketplace fournisseurs.

## Organisation recommandee

Monorepo cible:

```text
chantier_backend/
  config/
  apps/
    accounts/
    projects/
    planning/
    budget/
    resources/
    workforce/
    equipment/
    progress/
    qhse/
    documents/
    notifications/
    reports/
    sync/
  common/
  tests/
```

Chaque app Django doit rester autonome:

- `models.py` ou package `models/`
- `serializers.py`
- `views.py` / `viewsets.py`
- `services.py` ou package `services/`
- `permissions.py`
- `selectors.py` pour les requetes de lecture complexes
- `filters.py`
- `urls.py`
- `tests/`

## Conventions de conception

- Preferer les UUID comme cles primaires pour supporter la creation hors-ligne mobile.
- Ajouter aux modeles metier: `tenant`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `version`.
- Utiliser une suppression logique pour les donnees metier, sauf donnees techniques temporaires.
- Mettre les invariants dans les services et les contraintes critiques en base.
- Garder les vues DRF minces: validation serializer, appel service, reponse.
- Documenter tous les endpoints dans OpenAPI.

## Decisions d'architecture a formaliser en ADR

- Strategie multi-tenant definitive: colonne `tenant_id` v1, evolution possible vers schemas ou bases dediees.
- Stockage des tokens cote web: cookie HttpOnly ou memoire.
- Strategie de synchronisation mobile et resolution de conflits.
- Moteur Gantt: calcul serveur, bibliotheque tierce ou hybride.
- Generation PDF: WeasyPrint ou Playwright/Chromium.
- Regles de conversion, arrondi et conservation des taux de change.
