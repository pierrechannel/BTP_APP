# Contexte pour Claude — module Rapports uniquement

Tu interviens sur le module Rapports d’une application de gestion de chantiers BTP. Le module comporte un tableau de bord analytique et des rapports générés, consultables sur une page dédiée. Les graphiques utilisent les données de l’API ; ils ne sont pas des données de démonstration.

## 1. Architecture

- Backend : Django et Django REST Framework, application `chantier_backend/apps/reports/`.
- Frontend : React, TypeScript, Material UI, React Router, Axios.
- API : préfixe `/api/v1/reports/`.
- Authentification : JWT `Authorization: Bearer <accessToken>` et entreprise active `X-Tenant-ID: <UUID>`.
- Chaque requête doit respecter l’isolation des entreprises. Les contrôles serveur font autorité.

## 2. Backend : fichiers à lire

| Fichier | Responsabilité |
|---|---|
| `chantier_backend/apps/reports/models.py` | Modèles `ReportTemplate`, `ReportRun`, `KpiSnapshot` |
| `chantier_backend/apps/reports/serializers.py` | Contrats API et validation des écritures |
| `chantier_backend/apps/reports/views.py` | CRUD, synthèse analytique, génération, téléchargement |
| `chantier_backend/apps/reports/urls.py` | Routes DRF |
| `chantier_backend/apps/reports/analytics.py` | KPI, séries mensuelles, finances et tableau des chantiers |
| `chantier_backend/apps/reports/services.py` | Validation des paramètres et lancement de la génération |
| `chantier_backend/apps/reports/tasks.py` | Tâche Celery de génération du rapport |
| `chantier_backend/apps/reports/pdf.py` | Génération du PDF A4 avec ReportLab Platypus, tableaux, graphique et pagination |
| `chantier_backend/apps/reports/templates/reports/summary.html` | Ancienne présentation HTML, conservée mais non utilisée pour les nouveaux PDF |

### Modèles

- `ReportTemplate` : nom, code, `definition` JSON. Le code interne est généré automatiquement via `apps/common/identifiers.py` et le modèle de base. Actuellement, `definition` ne sélectionne pas de mise en page : tous les modèles utilisent `build_report_pdf()`.
- `ReportRun` : modèle associé, statut (`pending`, `completed`, `failed`), paramètres, fichier résultat. Le rapport généré représente les données au moment de sa génération.
- `KpiSnapshot` : chantier optionnel, date, code d’indicateur, valeur, unité et métadonnées. Ces indicateurs saisis ne sont pas utilisés pour calculer les cartes du tableau de bord ; celles-ci sont calculées à partir des données métier.
- Les modèles héritent notamment de `tenant`, UUID, horodatages, `deleted_at` et `version`.

### Endpoints

Les chemins ci-dessous sont relatifs à `/api/v1/reports/`.

| Méthode et route | Usage |
|---|---|
| `GET /templates/` | Liste des modèles |
| `POST /templates/` | Création d’un modèle |
| `GET /templates/summary/` | Données du tableau de bord analytique |
| `POST /templates/<uuid>/run/` | Génération d’un rapport |
| `GET /runs/` | Historique paginé des générations |
| `GET /runs/<uuid>/` | État et métadonnées d’une génération |
| `GET /runs/<uuid>/download/` | Téléchargement authentifié du fichier résultat |
| `/kpi-snapshots/` | CRUD des indicateurs enregistrés |

Les modèles disposent aussi des routes de détail DRF. `ReportRunSerializer` refuse la modification d’une génération existante. Les permissions du module sont gérées par les classes communes ; `summary` et `download` correspondent à `read`, `run` à `create`.

### Attention : deux conventions de filtre chantier

Pour l’analytique, `project` est l’**UUID** du chantier dans la query string :

```http
GET /api/v1/reports/templates/summary/?project=<uuid>&start_date=2026-10-01&end_date=2026-10-31
```

Pour la génération, `parameters.project` est le **code** du chantier :

```json
{
  "parameters": {
    "project": "PRJ-...",
    "start_date": "2026-10-01",
    "end_date": "2026-10-31",
    "observations": "Décisions et points à suivre."
  }
}
```

Ces paramètres sont facultatifs. Sans chantier, le périmètre couvre les chantiers non supprimés de l’entreprise active. Sans dates, aucune borne temporelle n’est appliquée. Les dates doivent être valides et ordonnées. Les observations sont limitées à 5 000 caractères. Un code chantier inexistant est refusé lors de la génération.

### Réponse analytique

`analytics.py` renvoie :

```text
as_of             date de situation
kpis              projects, tasks, completed, progress, overdue, open_incidents
statuses[]        status, count
finances[]        currency, planned, spent, remaining
monthly_expenses[] month, currency, amount
projects[]        id, name, code, status, tasks, completed, progress,
                  overdue, incidents, open_incidents
```

Règles de calcul à préserver :

- Les données appartiennent au tenant actif ; les ressources supprimées logiquement sont exclues.
- L’avancement est la moyenne simple des pourcentages des tâches retenues.
- Une tâche en retard a une échéance antérieure à aujourd’hui et n’est ni terminée ni annulée.
- La période retient les tâches dont le planning chevauche ses bornes ; une date de tâche absente ne bloque pas le filtre correspondant.
- Les dépenses sont filtrées par leur date et leur statut : uniquement `validated` et `paid`, montants TTC.
- Les incidents sont filtrés par leur date de survenue. Les bornes journalières utilisent `Africa/Bujumbura`. Un incident ouvert n’est pas clôturé.
- Les budgets prévus représentent les enveloppes totales, sans filtre de période. Le solde affiché vaut budget total moins dépenses de la période : ce n’est pas nécessairement le disponible cumulé depuis le début du chantier.
- Ne jamais additionner différentes devises ni effectuer de conversion implicite.
- Les dépenses mensuelles sont regroupées par mois et par devise. Les mois sans dépense ne figurent pas dans la série actuelle.

### Génération d’un document

1. La vue appelle `enqueue_report_run()`.
2. Le service valide les paramètres et crée un `ReportRun` en attente.
3. Si `REPORTS_ASYNC` est désactivé, la génération s’exécute immédiatement. Sinon, elle est envoyée à Celery après validation de la transaction.
4. `generate_report()` rassemble les tâches, finances, incidents et actions correctives, puis appelle `build_report_pdf()` dans `pdf.py`.
5. ReportLab construit un PDF A4 en mémoire avec polices embarquées, tableau de synthèse, graphique d’avancement, tableaux multipages et pied de page numéroté. Le fichier `.pdf` est enregistré dans `result_file`, le statut devient `completed` et la version augmente. Une erreur de génération ou d’envoi au worker peut produire `failed`.
6. Le téléchargement passe par l’endpoint authentifié, pas par une URL publique du stockage.

Les anciens fichiers `.json` et `.html` ne sont pas transformés automatiquement. Il faut générer une nouvelle édition pour obtenir un PDF. ReportLab figure dans `requirements.txt` ; pypdf est une dépendance de test dans `requirements.dev.txt`.

## 3. Frontend : fichiers à lire

| Fichier | Responsabilité |
|---|---|
| `chantier_frontend/src/App.tsx` | Aiguillage vers la page spécialisée Rapports |
| `chantier_frontend/src/pages/ReportsPage.tsx` | Filtres, génération, observations, historique, chargement d’un rapport |
| `chantier_frontend/src/components/ReportsDashboard.tsx` | KPI, graphiques et tableaux analytiques |
| `chantier_frontend/src/components/ReportPreview.tsx` | Lecture du document, sommaire, impression et téléchargement |
| `chantier_frontend/src/resources.tsx` | Configuration des ressources Rapports |
| `chantier_frontend/src/api/client.ts` | Client Axios, JWT, tenant et renouvellement de session |
| `chantier_frontend/src/api/workspace.ts` | Pagination, téléchargement et gestion des erreurs |
| `chantier_frontend/src/state/workspace.tsx` | Chantiers disponibles et vérification des permissions UI |

### Routes et interface

- `/reports` : page « Rapports et analyses », avec filtres de chantier et de période, KPI, graphiques, tableaux et derniers rapports.
- `/reports/runs` : historique complet via la liste générique des ressources.
- `/reports/runs/<uuid>` : page dédiée à une édition générée, avec aperçu et préparation d’une nouvelle édition.
- Les autres ressources du module, notamment les indicateurs, conservent leurs routes génériques définies dans `resources.tsx`.

`ReportsPage` utilise les chantiers du contexte de travail. « Options du document » affiche le modèle et les observations sur la page principale. La génération convertit l’UUID du chantier sélectionné en son code avant l’envoi au backend. L’historique principal montre au maximum huit éléments de la première page API.

### Tableau de bord

`ReportsDashboard` appelle `/reports/templates/summary/` avec un délai de 250 ms après changement des filtres et annule les requêtes obsolètes.

Il affiche :

- Quatre cartes : avancement moyen, tâches terminées, tâches en retard et incidents ouverts.
- Un graphique de répartition des tâches par statut, avec barres Material UI.
- Un histogramme SVG des dépenses mensuelles, avec sélection de devise.
- Un tableau financier : budget prévu, dépenses, solde et consommation du budget.
- Un tableau comparatif des chantiers, avec progression, retards et incidents ouverts.
- « Analyser » applique le chantier de la ligne au filtre ; « Fiche » ouvre le chantier.

Les graphiques sont construits en React/SVG, sans bibliothèque de graphiques supplémentaire. Les états de chargement, d’erreur et d’absence de données sont prévus. Les tableaux et graphiques larges défilent horizontalement sur petit écran.

### Consultation du document

- Après génération, la navigation mène à `/reports/runs/<uuid>`.
- Tant que le statut est `pending`, `ReportsPage` vérifie l’état toutes les trois secondes.
- `ReportPreview` récupère le fichier en Blob par l’endpoint de téléchargement authentifié et détecte la signature `%PDF-`.
- Le PDF est affiché dans le lecteur natif du navigateur via une URL Blob, libérée au démontage du composant.
- « Ouvrir / imprimer le PDF » ouvre le PDF dans un nouvel onglet ; le téléchargement fournit directement le fichier produit par Django.
- Les anciens HTML conservent l’aperçu en iframe `srcDoc` avec sandbox sans scripts et le sommaire fondé sur les attributs `data-report-section`. Les anciens JSON restent téléchargeables avec un message invitant à générer une nouvelle édition.
- Modifier les filtres ne modifie pas le document déjà généré ; une nouvelle génération crée une nouvelle édition.

## 4. Flux à comprendre

```text
Filtres de ReportsPage
  → ReportsDashboard
  → GET templates/summary/ (UUID chantier, dates)
  → analytics.py → données métier filtrées par tenant
  → KPI + graphiques + tableaux

Bouton Générer
  → POST templates/<id>/run/ (code chantier, dates, observations)
  → services.py → tasks.py → pdf.py / ReportLab → fichier PDF
  → ReportRun completed
  → page /reports/runs/<id> → ReportPreview
  → consultation, impression/PDF ou téléchargement
```

## 5. Tests et précautions de modification

Les tests backend du module se trouvent dans `tests/test_regressions.py`, notamment ceux dont le nom contient `report`. Ils couvrent signature PDF, extraction du contenu avec pypdf, pagination, téléchargement authentifié, textes littéraux, isolation tenant, permissions analytiques, filtres, devises et observations.

Depuis la racine, sous PowerShell :

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_regressions.py -k report -q
```

Depuis `chantier_frontend` :

```powershell
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
npm test
```

Préserve l’isolation tenant, les contrôles de permissions, les montants par devise et l’échappement des textes transmis aux Paragraph de ReportLab. Les calculs analytiques et ceux du document sont actuellement dans deux fichiers distincts (`analytics.py` et `tasks.py`) : toute modification d’une règle commune doit être répercutée et testée dans les deux parcours.

Le workspace contient aussi des modifications sur d’autres modules. Limite les changements à la demande concernant les rapports et conserve le travail existant.
