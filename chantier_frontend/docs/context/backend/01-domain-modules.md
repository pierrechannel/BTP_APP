# Modules Django et responsabilites

## `accounts`

Responsabilites:

- tenants, utilisateurs, roles et appartenances;
- invitation par email;
- authentification JWT, refresh token, blacklist;
- 2FA TOTP configurable;
- audit des connexions et changements de droits;
- profils utilisateur: langue, fuseau horaire, devise preferee, photo;
- appareils mobiles declares.

Entites principales:

- `Tenant`
- `User`
- `Role`
- `Membership`
- `ProjectMembership`
- `AuditLog`
- `Device`

## `projects`

Responsabilites:

- creation et cycle de vie des chantiers;
- lots;
- parties prenantes;
- affectation des utilisateurs aux chantiers;
- archivage lecture seule.

Entites principales:

- `Project`
- `Lot`
- `Stakeholder`
- `ProjectStatusHistory`

Statuts chantier:

- `study`
- `preparation`
- `in_progress`
- `suspended`
- `handover`
- `closed`

## `planning`

Responsabilites:

- WBS, taches, sous-taches, jalons;
- dependances FS, SS, FF, SF avec lag/lead;
- detection des cycles;
- calendriers de travail;
- lignes de base;
- alertes de retard et conflits de ressources.

Entites principales:

- `Task`
- `Milestone`
- `TaskDependency`
- `Calendar`
- `Baseline`

## `budget`

Responsabilites:

- budget par chantier, lot et categorie;
- depenses avec workflow de validation;
- factures emises et recues;
- avenants;
- multi-devise et taux de change dates;
- indicateurs budget initial, revise, engage, realise, RAD, EAC;
- exports comptables.

Entites principales:

- `Budget`
- `BudgetLine`
- `Expense`
- `Invoice`
- `Amendment`
- `ExchangeRate`

Regle importante: les montants valides sont immuables; toute correction passe par une ecriture rectificative tracee.

## `resources`

Responsabilites:

- catalogue materiaux;
- fournisseurs;
- demandes d'achat et bons de commande;
- receptions;
- stocks par chantier ou depot;
- mouvements de stock;
- seuils d'alerte.

Entites principales:

- `Material`
- `Supplier`
- `PurchaseOrder`
- `PurchaseOrderLine`
- `StockLocation`
- `StockMovement`

## `workforce`

Responsabilites:

- salaries et intervenants;
- pointage quotidien par chantier et tache;
- validation/verrouillage des periodes;
- habilitations et certifications;
- affectations et detection de conflits;
- cout de main-d'oeuvre;
- export paie.

Entites principales:

- `Worker`
- `TimeEntry`
- `Certification`
- `WorkerCertification`
- `Assignment`

## `equipment`

Responsabilites:

- inventaire du materiel et engins;
- affectations aux chantiers;
- maintenance preventive et corrective;
- controles reglementaires;
- heures et compteurs d'utilisation;
- imputation des couts au budget.

Entites principales:

- `Equipment`
- `EquipmentAssignment`
- `MaintenancePlan`
- `MaintenanceRecord`
- `UsageLog`

## `progress`

Responsabilites:

- rapports journaliers;
- avancement des taches;
- photos horodatees et geolocalisees;
- reserves et non-conformites;
- preuves de levee;
- export PDF.

Entites principales:

- `DailyReport`
- `ProgressUpdate`
- `Photo`
- `Snag`

## `qhse`

Responsabilites:

- incidents et accidents;
- presque accidents;
- actions correctives;
- inspections et checklists;
- PPSPS;
- alertes sur echeances.

Entites principales:

- `Incident`
- `CorrectiveAction`
- `InspectionTemplate`
- `Inspection`
- `InspectionItem`
- `Ppsps`

## `documents`

Responsabilites:

- arborescence documentaire;
- documents et versions;
- statuts de validation;
- droits d'acces;
- workflows d'approbation;
- URL signees apres controle d'acces;
- analyse antivirus.

Entites principales:

- `Folder`
- `Document`
- `DocumentVersion`
- `DocumentAcl`
- `ApprovalWorkflow`

## `notifications`

Responsabilites:

- notifications utilisateur;
- preferences de canal;
- messagerie temps reel;
- WebSockets par chantier et utilisateur;
- emails, push mobile et notifications internes.

Entites principales:

- `Notification`
- `NotificationPreference`
- `Channel`
- `Message`

## `reports`

Responsabilites:

- modeles de rapports;
- executions de rapports;
- snapshots KPI;
- exports PDF, CSV et XLSX.

Entites principales:

- `ReportTemplate`
- `ReportRun`
- `KpiSnapshot`

## `sync`

Responsabilites:

- pull/push mobile offline-first;
- idempotence par UUID client et `Idempotency-Key`;
- curseurs de modification;
- resolution de conflits;
- journal de synchronisation.

Cette app orchestre les autres modules; elle ne doit pas dupliquer leur logique metier.
