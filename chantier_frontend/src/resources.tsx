import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentIcon from "@mui/icons-material/Assignment";
import BadgeIcon from "@mui/icons-material/Badge";
import BuildIcon from "@mui/icons-material/Build";
import ConstructionIcon from "@mui/icons-material/Construction";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import InventoryIcon from "@mui/icons-material/Inventory";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PaidIcon from "@mui/icons-material/Paid";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import SecurityIcon from "@mui/icons-material/Security";
import SyncIcon from "@mui/icons-material/Sync";

export type BusinessAction = {
  label: string;
  endpoint: string;
  permission: string;
  field?: string;
  choices?: Array<[string, string]>;
  visible?: (record: Record<string, unknown>) => boolean;
  download?: boolean;
};

export type ResourceConfig = {
  label: string;
  singular: string;
  description: string;
  path: string;
  endpoint: string;
  model: string;
  group: string;
  icon: JSX.Element;
  columns: string[];
  detailTitleField?: string;
  projectScoped?: boolean;
  readOnly?: boolean;
  immutable?: boolean;
  navigation?: boolean;
  actions?: BusinessAction[];
};

const make = (label: string, singular: string, path: string, endpoint: string, model: string,
  group: string, icon: JSX.Element, columns: string[], description: string,
  extra: Partial<ResourceConfig> = {}): ResourceConfig => ({
    label, singular, path, endpoint, model, group, icon, columns, description,
    detailTitleField: columns.find((field) => ['name', 'title', 'code', 'reference'].includes(field)) ?? columns[0],
    ...extra,
  });
const validate: BusinessAction = { label: 'Valider', endpoint: 'validate', permission: 'validate',
  visible: (row) => !['validated', 'paid'].includes(String(row.status)) && !row.is_validated };

export const resources: ResourceConfig[] = [
  make('Chantiers', 'chantier', '/projects', '/projects/', 'projects.project', 'projects', <ConstructionIcon />,
    ['code', 'name', 'client_name', 'status', 'planned_end_date'], 'Vos projets, du démarrage à la réception.', { actions: [
      { label: 'Changer le statut', endpoint: 'transition-status', permission: 'update', field: 'to_status' },
    ] }),
  make('Lots', 'lot', '/lots', '/projects/lots/', 'projects.lot', 'projects', <AccountTreeIcon />,
    ['code', 'name', 'subcontractor_name'], 'Organisez les corps de métier de chaque chantier.', { projectScoped: true }),
  make('Planning', 'tâche', '/planning', '/planning/tasks/', 'planning.task', 'planning', <AssignmentIcon />,
    ['name', 'status', 'progress_percent', 'planned_start_date', 'planned_end_date'], 'Coordonnez les tâches et les échéances.',
    { projectScoped: true, actions: [{ label: 'Actualiser l’avancement', endpoint: 'update-progress', permission: 'update', field: 'progress_percent' }] }),
  make('Budget', 'dépense', '/budget', '/budget/expenses/', 'budget.expense', 'budget', <PaidIcon />,
    ['supplier_name', 'date', 'status', 'amount_including_tax', 'currency'], 'Suivez les dépenses et maîtrisez vos engagements.',
    { projectScoped: true, actions: [validate] }),
  make('Ressources', 'matériau', '/resources', '/resources/materials/', 'resources.material', 'resources', <InventoryIcon />,
    ['reference', 'name', 'unit', 'unit_price', 'currency'], 'Votre catalogue de matériaux et vos approvisionnements.'),
  make('Personnel', 'collaborateur', '/workforce', '/workforce/workers/', 'workforce.worker', 'workforce', <BadgeIcon />,
    ['first_name', 'last_name', 'job_title', 'hourly_rate', 'currency'], 'Les équipes qui font avancer vos chantiers.'),
  make('Matériel', 'équipement', '/equipment', '/equipment/equipment/', 'equipment.equipment', 'equipment', <BuildIcon />,
    ['name', 'equipment_type', 'serial_number', 'state', 'daily_cost'], 'Disponibilité, affectations et entretien des équipements.',
    { actions: [{ label: 'Changer l’état', endpoint: 'update-state', permission: 'update', field: 'state',
      choices: [['operationnel', 'Opérationnel'], ['maintenance', 'En maintenance'], ['en_panne', 'En panne'], ['hors_service', 'Hors service']] }] }),
  make('Journal de chantier', 'rapport journalier', '/progress', '/progress/daily-reports/', 'progress.dailyreport', 'progress', <QueryStatsIcon />,
    ['report_date', 'weather', 'status', 'work_done'], 'Consignez les travaux réalisés et les difficultés du terrain.',
    { projectScoped: true, actions: [
      { label: 'Soumettre', endpoint: 'submit', permission: 'update', visible: (row) => row.status === 'draft' },
      { ...validate, visible: (row) => row.status === 'submitted' },
    ] }),
  make('Qualité & sécurité', 'incident', '/qhse', '/qhse/incidents/', 'qhse.incident', 'qhse', <SecurityIcon />,
    ['title', 'status', 'occurred_at', 'description'], 'Signalez les incidents et suivez les actions correctives.',
    { projectScoped: true, actions: [{ label: 'Clôturer l’incident', endpoint: 'close', permission: 'update', visible: (row) => row.status !== 'closed' }] }),
  make('Documents', 'document', '/documents', '/documents/documents/', 'documents.document', 'documents', <FolderIcon />,
    ['title', 'status', 'updated_at'], 'Centralisez les plans, versions et validations.', { projectScoped: true,
      actions: [{ label: 'Approuver', endpoint: 'approve', permission: 'validate', visible: (row) => row.status !== 'approved' }] }),
  make('Notifications', 'notification', '/notifications', '/notifications/notifications/', 'notifications.notification', 'notifications', <NotificationsIcon />,
    ['title', 'body', 'read_at'], 'Retrouvez les informations qui nécessitent votre attention.', { readOnly: true,
      actions: [{ label: 'Marquer comme lue', endpoint: 'mark-read', permission: 'update', visible: (row) => !row.read_at }] }),
  make('Rapports', 'modèle de rapport', '/reports', '/reports/templates/', 'reports.reporttemplate', 'reports', <DescriptionIcon />,
    ['code', 'name'], 'Générez et téléchargez vos synthèses de pilotage.',
    { actions: [{ label: 'Générer un rapport', endpoint: 'run', permission: 'create' }] }),
  make('Synchronisation', 'mutation', '/sync', '/sync/mutations/', 'sync.syncmutation', 'sync', <SyncIcon />,
    ['resource_type', 'operation', 'status', 'created_at'], 'Contrôlez les changements transmis depuis le terrain.',
    { readOnly: true, immutable: true, actions: [{ label: 'Appliquer', endpoint: 'mark-applied', permission: 'update', visible: (row) => row.status !== 'applied' }] }),
];

const sub = (group: string, label: string, singular: string, suffix: string, endpoint: string, model: string,
  columns: string[], extra: Partial<ResourceConfig> = {}) => {
  const root = resources.find((resource) => resource.group === group)!;
  return make(label, singular, `${root.path}/${suffix}`, endpoint, `${group}.${model}`, group, root.icon, columns,
    root.description, { navigation: false, ...extra });
};
export const allResources: ResourceConfig[] = [...resources,
  sub('projects', 'Intervenants', 'intervenant', 'stakeholders', '/projects/stakeholders/', 'stakeholder', ['name', 'stakeholder_type', 'email', 'phone'], { projectScoped: true }),
  sub('planning', 'Dépendances', 'dépendance', 'dependencies', '/planning/dependencies/', 'taskdependency', ['predecessor', 'successor', 'dependency_type', 'lag_days'], { projectScoped: true }),
  sub('budget', 'Budgets', 'budget', 'budgets', '/budget/budgets/', 'budget', ['project', 'currency'], { projectScoped: true }),
  sub('budget', 'Lignes budgétaires', 'ligne budgétaire', 'lines', '/budget/budget-lines/', 'budgetline', ['label', 'category', 'amount', 'currency'], { projectScoped: true }),
  sub('budget', 'Factures', 'facture', 'invoices', '/budget/invoices/', 'invoice', ['invoice_number', 'supplier_name', 'status', 'amount_including_tax', 'currency'], { projectScoped: true,
    actions: [validate, { label: 'Marquer comme payée', endpoint: 'pay', permission: 'validate', visible: (row) => row.status === 'validated' }] }),
  sub('resources', 'Fournisseurs', 'fournisseur', 'suppliers', '/resources/suppliers/', 'supplier', ['name', 'email', 'phone']),
  sub('resources', 'Commandes', 'commande', 'orders', '/resources/purchase-orders/', 'purchaseorder', ['order_number', 'status', 'ordered_at'], { projectScoped: true }),
  sub('resources', 'Lignes de commande', 'ligne de commande', 'order-lines', '/resources/purchase-order-lines/', 'purchaseorderline', ['material', 'quantity', 'unit_price', 'currency'], { projectScoped: true }),
  sub('resources', 'Dépôts', 'dépôt', 'locations', '/resources/stock-locations/', 'stocklocation', ['name', 'code', 'project'], { projectScoped: true }),
  sub('resources', 'Mouvements de stock', 'mouvement', 'movements', '/resources/stock-movements/', 'stockmovement', ['material', 'movement_type', 'quantity', 'movement_date'], { immutable: true }),
  sub('workforce', 'Pointages', 'pointage', 'time-entries', '/workforce/time-entries/', 'timeentry', ['worker', 'work_date', 'normal_hours', 'overtime_hours', 'is_validated'], { projectScoped: true, actions: [validate] }),
  sub('workforce', 'Affectations', 'affectation', 'assignments', '/workforce/assignments/', 'assignment', ['worker', 'project', 'start_date', 'end_date', 'role'], { projectScoped: true }),
  sub('workforce', 'Habilitations', 'habilitation', 'certifications', '/workforce/certifications/', 'certification', ['code', 'name', 'description']),
  sub('equipment', 'Affectations', 'affectation', 'assignments', '/equipment/assignments/', 'equipmentassignment', ['equipment', 'project', 'start_date', 'end_date'], { projectScoped: true }),
  sub('equipment', 'Plans de maintenance', 'plan de maintenance', 'maintenance-plans', '/equipment/maintenance-plans/', 'maintenanceplan', ['name', 'equipment', 'next_due_date']),
  sub('equipment', 'Entretiens', 'entretien', 'maintenance', '/equipment/maintenance-records/', 'maintenancerecord', ['equipment', 'performed_at', 'description', 'cost', 'currency']),
  sub('progress', 'Réserves', 'réserve', 'snags', '/progress/snags/', 'snag', ['title', 'status', 'due_date', 'responsible_name'], { projectScoped: true,
    actions: [{ label: 'Résoudre', endpoint: 'resolve', permission: 'update', visible: (row) => !['resolved', 'closed'].includes(String(row.status)) }] }),
  sub('qhse', 'Actions correctives', 'action corrective', 'actions', '/qhse/corrective-actions/', 'correctiveaction', ['title', 'due_date', 'completed_at'], { projectScoped: true,
    actions: [{ label: 'Terminer', endpoint: 'complete', permission: 'update', visible: (row) => !row.completed_at }] }),
  sub('qhse', 'Inspections', 'inspection', 'inspections', '/qhse/inspections/', 'inspection', ['project', 'inspection_date', 'status', 'score'], { projectScoped: true,
    actions: [{ label: 'Terminer l’inspection', endpoint: 'complete', permission: 'update', visible: (row) => row.status !== 'completed' }] }),
  sub('qhse', 'Modèles d’inspection', 'modèle', 'templates', '/qhse/inspection-templates/', 'inspectiontemplate', ['code', 'name']),
  sub('documents', 'Dossiers', 'dossier', 'folders', '/documents/folders/', 'folder', ['name', 'project', 'parent'], { projectScoped: true }),
  sub('documents', 'Versions', 'version', 'versions', '/documents/versions/', 'documentversion', ['original_name', 'version_label', 'is_current', 'size'], { projectScoped: true,
    actions: [{ label: 'Télécharger', endpoint: 'download', permission: 'read', download: true },
      { label: 'Définir comme courante', endpoint: 'mark-current', permission: 'update', visible: (row) => !row.is_current }] }),
  sub('documents', 'Approbations', 'demande d’approbation', 'approvals', '/documents/approval-workflows/', 'approvalworkflow', ['document', 'reviewer', 'status', 'decided_at'], { projectScoped: true,
    actions: [{ label: 'Approuver', endpoint: 'approve', permission: 'validate', visible: (row) => row.status === 'pending' },
      { label: 'Refuser', endpoint: 'reject', permission: 'validate', visible: (row) => row.status === 'pending' }] }),
  sub('reports', 'Rapports générés', 'rapport', 'runs', '/reports/runs/', 'reportrun', ['template', 'status', 'created_at'], { readOnly: true,
    actions: [{ label: 'Télécharger', endpoint: 'download', permission: 'read', download: true, visible: (row) => row.status === 'completed' }] }),
];
export const resourceByPath = Object.fromEntries(allResources.map((resource) => [resource.path, resource])) as Record<string, ResourceConfig>;
export const resourceByModel = Object.fromEntries(allResources.map((resource) => [resource.model, resource])) as Record<string, ResourceConfig>;
