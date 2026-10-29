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
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

export type BusinessAction = {
  label: string;
  endpoint: string;
  permission: string;
  field?: string;
  choices?: Array<[string, string]>;
  visible?: (record: Record<string, unknown>) => boolean;
  download?: boolean;
  comment?: boolean;
  payload?: Record<string, unknown>;
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
  tabLabel?: string;
  showInTabs?: boolean;
  platformWrite?: boolean;
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
    ['code', 'name', 'subcontractor_name'], 'Organisez les corps de métier de chaque chantier.', { projectScoped: true, navigation: false, showInTabs: true }),
  make('Planning', 'tâche', '/planning', '/planning/tasks/', 'planning.task', 'planning', <AssignmentIcon />,
    ['name', 'status', 'progress_percent', 'planned_start_date', 'planned_end_date'], 'Coordonnez les tâches et les échéances.',
    { projectScoped: true, actions: [{ label: 'Actualiser l’avancement', endpoint: 'update-progress', permission: 'update', field: 'progress_percent' }] }),
  make('Budget & dépenses', 'budget', '/budget', '/budget/budgets/', 'budget.budget', 'budget', <PaidIcon />,
    ['project', 'currency'], 'Préparez les postes de chaque chantier et suivez les dépenses validées.',
    { projectScoped: true, tabLabel: 'Budgets' }),
  make('Ressources', 'matériau', '/resources', '/resources/materials/', 'resources.material', 'resources', <InventoryIcon />,
    ['reference', 'name', 'unit', 'unit_price', 'currency'], 'Votre catalogue de matériaux et vos approvisionnements.', { tabLabel: 'Matériaux' }),
  make('Personnel', 'collaborateur', '/workforce', '/workforce/workers/', 'workforce.worker', 'workforce', <BadgeIcon />,
    ['first_name', 'last_name', 'job_title', 'hourly_rate', 'currency'], 'Les équipes qui font avancer vos chantiers.', { tabLabel: 'Collaborateurs' }),
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
    { projectScoped: true, tabLabel: 'Incidents', actions: [{ label: 'Clôturer l’incident', endpoint: 'close', permission: 'update', visible: (row) => row.status !== 'closed' }] }),
  make('Documents', 'document', '/documents', '/documents/documents/', 'documents.document', 'documents', <FolderIcon />,
    ['title', 'status', 'updated_at'], 'Centralisez les plans, versions et validations.', { projectScoped: true,
      actions: [{ label: 'Approuver', endpoint: 'approve', permission: 'validate', visible: (row) => row.status !== 'approved' }] }),
  make('Notifications', 'notification', '/notifications', '/notifications/notifications/', 'notifications.notification', 'notifications', <NotificationsIcon />,
    ['title', 'body', 'read_at'], 'Retrouvez les informations qui nécessitent votre attention.', { readOnly: true,
      actions: [{ label: 'Marquer comme lue', endpoint: 'mark-read', permission: 'update', visible: (row) => !row.read_at }] }),
  make('Rapports', 'modèle de rapport', '/reports', '/reports/templates/', 'reports.reporttemplate', 'reports', <DescriptionIcon />,
    ['code', 'name'], 'Générez et téléchargez vos synthèses de pilotage.',
    { tabLabel: 'Modèles', actions: [{ label: 'Générer un rapport', endpoint: 'run', permission: 'create' }] }),
  make('Synchronisation', 'mutation', '/sync', '/sync/mutations/', 'sync.syncmutation', 'sync', <SyncIcon />,
    ['resource_type', 'operation', 'status', 'created_at'], 'Contrôlez les changements transmis depuis le terrain.',
    { readOnly: true, immutable: true, actions: [
      { label: 'Appliquer', endpoint: 'mark-applied', permission: 'update', visible: (row) => row.status !== 'applied' },
      { label: 'Signaler un échec', endpoint: 'mark-failed', permission: 'update', comment: true, visible: (row) => row.status !== 'applied' },
    ] }),
  make('Administration', 'rôle', '/administration', '/auth/roles/', 'accounts.role', 'administration', <SettingsOutlinedIcon />,
    ['name', 'code'], 'Gérez les rôles, les accès et la traçabilité de votre entreprise.', { tabLabel: 'Rôles' }),
];

const subDescriptions: Record<string, string> = {
  'projects.stakeholder': 'Retrouvez les contacts et les intervenants de chaque chantier.',
  'planning.taskdependency': 'Reliez les tâches pour organiser leurs prérequis et leurs décalages.',
  'budget.budget': 'Définissez l’enveloppe de chaque chantier et consultez son disponible.',
  'budget.budgetline': 'Répartissez le budget par poste et retrouvez les dépenses associées.',
  'budget.invoice': 'Préparez, validez et suivez le paiement des factures fournisseurs.',
  'budget.amendment': 'Consignez les avenants et les ajustements du marché.',
  'budget.exchangerate': 'Conservez vos taux de référence. Aucune conversion automatique n’est effectuée.',
  'resources.supplier': 'Centralisez les coordonnées des fournisseurs et retrouvez leurs commandes.',
  'resources.stocklocation': 'Organisez les lieux de stockage et leur rattachement aux chantiers.',
  'resources.stockmovement': 'Enregistrez les entrées, sorties et transferts dans un registre immuable.',
  'workforce.timeentry': 'Saisissez les heures par collaborateur et par journée, puis validez les pointages.',
  'workforce.assignment': 'Planifiez la présence de vos collaborateurs sur les chantiers et les tâches.',
  'workforce.certification': 'Définissez le catalogue des habilitations de votre entreprise.',
  'workforce.workercertification': 'Attribuez les habilitations et vérifiez leurs dates de validité.',
  'equipment.equipmentassignment': 'Affectez le matériel aux chantiers sur une période définie.',
  'equipment.maintenanceplan': 'Planifiez les entretiens et leurs prochaines échéances.',
  'equipment.maintenancerecord': 'Conservez les interventions réalisées et leurs coûts.',
  'equipment.usagelog': 'Relevez les heures d’utilisation et les compteurs du matériel.',
  'progress.photo': 'Ajoutez les photos du terrain et rattachez-les aux tâches ou au journal.',
  'progress.progressupdate': 'Consignez les relevés d’avancement et les observations du terrain.',
  'progress.snag': 'Suivez les réserves, leurs responsables et leur résolution.',
  'qhse.correctiveaction': 'Suivez les actions engagées à la suite des incidents.',
  'qhse.inspection': 'Effectuez les contrôles, complétez la checklist et clôturez l’inspection.',
  'qhse.inspectiontemplate': 'Préparez les points de contrôle réutilisables de vos inspections.',
  'qhse.ppsps': 'Conservez le plan de sécurité et de protection de la santé de chaque chantier.',
  'documents.folder': 'Classez vos documents dans les dossiers de chaque chantier.',
  'documents.documentversion': 'Déposez les nouvelles versions et identifiez les fichiers de référence.',
  'documents.approvalworkflow': 'Adressez les demandes aux réviseurs et suivez leurs décisions.',
  'documents.documentacl': 'Gérez les droits de consultation, de modification et d’approbation.',
  'notifications.message': 'Conservez les messages de vos équipes et leur contexte chantier.',
  'notifications.channel': 'Organisez les espaces de collaboration de votre entreprise.',
  'notifications.notificationpreference': 'Choisissez les canaux de notification pour chaque type d’événement.',
  'reports.reportrun': 'Suivez les générations et téléchargez les rapports terminés.',
  'reports.kpisnapshot': 'Conservez les mesures de vos indicateurs à une date donnée.',
  'accounts.membership': 'Attribuez les rôles aux membres de votre entreprise.',
  'accounts.user': 'Consultez les comptes. Leur modification est réservée à la plateforme.',
  'accounts.auditlog': 'Retrouvez les opérations enregistrées et leur auteur.',
  'accounts.device': 'Retrouvez les appareils enregistrés et leur dernière activité.',
};
const sub = (group: string, label: string, singular: string, suffix: string, endpoint: string, model: string,
  columns: string[], extra: Partial<ResourceConfig> = {}) => {
  const root = resources.find((resource) => resource.group === group)!;
  return make(label, singular, `${root.path}/${suffix}`, endpoint, `${group}.${model}`, group, root.icon, columns,
    subDescriptions[extra.model ?? `${group}.${model}`] ?? root.description, { navigation: false, ...extra });
};
export const allResources: ResourceConfig[] = [...resources,
  sub('projects', 'Intervenants', 'intervenant', 'stakeholders', '/projects/stakeholders/', 'stakeholder', ['name', 'stakeholder_type', 'email', 'phone'], { projectScoped: true }),
  sub('planning', 'Dépendances', 'dépendance', 'dependencies', '/planning/dependencies/', 'taskdependency', ['predecessor', 'successor', 'dependency_type', 'lag_days'], { projectScoped: true }),
  sub('budget', 'Dépenses', 'dépense', 'expenses', '/budget/expenses/', 'expense', ['supplier_name', 'date', 'status', 'amount_including_tax', 'currency'], { projectScoped: true, actions: [validate] }),
  sub('budget', 'Lignes budgétaires', 'poste budgétaire', 'lines', '/budget/budget-lines/', 'budgetline', ['label', 'project_name', 'lot', 'category', 'amount', 'spent', 'remaining', 'currency'], { projectScoped: true }),
  sub('budget', 'Factures', 'facture', 'invoices', '/budget/invoices/', 'invoice', ['invoice_number', 'supplier_name', 'status', 'amount_including_tax', 'currency'], { projectScoped: true,
    actions: [validate, { label: 'Marquer comme payée', endpoint: 'pay', permission: 'validate', visible: (row) => row.status === 'validated' }] }),
  sub('budget', 'Avenants', 'avenant', 'amendments', '/budget/amendments/', 'amendment', ['reference', 'project', 'amount', 'currency', 'approved_at'], { projectScoped: true }),
  sub('budget', 'Taux de change', 'taux de change', 'exchange-rates', '/budget/exchange-rates/', 'exchangerate', ['base_currency', 'target_currency', 'rate', 'rate_date']),
  sub('resources', 'Fournisseurs', 'fournisseur', 'suppliers', '/resources/suppliers/', 'supplier', ['name', 'email', 'phone']),
  sub('resources', 'Commandes', 'bon de commande', 'orders', '/resources/purchase-orders/', 'purchaseorder', ['order_number', 'supplier', 'project', 'status', 'ordered_at'], { projectScoped: true,
    description: 'Préparez vos bons de commande, ajoutez leurs matériaux et suivez leur réception.', actions: [
      { label: 'Marquer comme envoyée', endpoint: 'transition-status', permission: 'update', payload: { to_status: 'sent' }, visible: (row) => row.status === 'draft' },
      { label: 'Actualiser le suivi de réception', endpoint: 'transition-status', permission: 'update', field: 'to_status', choices: [['partially_received', 'Réception partielle déclarée'], ['received', 'Réception complète déclarée']], visible: (row) => ['sent', 'partially_received'].includes(String(row.status)) },
      { label: 'Annuler la commande', endpoint: 'transition-status', permission: 'update', payload: { to_status: 'cancelled' }, visible: (row) => ['draft', 'sent'].includes(String(row.status)) },
    ] }),
  sub('resources', 'Lignes de commande', 'ligne de commande', 'order-lines', '/resources/purchase-order-lines/', 'purchaseorderline', ['purchase_order', 'material', 'quantity', 'unit_price', 'currency'], { projectScoped: true,
    showInTabs: false,
    description: 'Consultez les matériaux commandés. Pour compléter un bon, ouvrez sa fiche et ajoutez une ligne.' }),
  sub('resources', 'Dépôts', 'dépôt', 'locations', '/resources/stock-locations/', 'stocklocation', ['name', 'code', 'project'], { projectScoped: true }),
  sub('resources', 'Mouvements de stock', 'mouvement', 'movements', '/resources/stock-movements/', 'stockmovement', ['material', 'movement_type', 'quantity', 'movement_date'], { immutable: true }),
  sub('workforce', 'Pointages', 'pointage', 'time-entries', '/workforce/time-entries/', 'timeentry', ['worker', 'work_date', 'normal_hours', 'overtime_hours', 'is_validated'], { projectScoped: true, actions: [validate] }),
  sub('workforce', 'Affectations', 'affectation', 'assignments', '/workforce/assignments/', 'assignment', ['worker', 'project', 'start_date', 'end_date', 'role'], { projectScoped: true }),
  sub('workforce', 'Habilitations', 'habilitation', 'certifications', '/workforce/certifications/', 'certification', ['code', 'name', 'description']),
  sub('workforce', 'Habilitations du personnel', 'habilitation du personnel', 'worker-certifications', '/workforce/worker-certifications/', 'workercertification', ['worker', 'certification', 'issued_at', 'expires_at']),
  sub('equipment', 'Affectations', 'affectation', 'assignments', '/equipment/assignments/', 'equipmentassignment', ['equipment', 'project', 'start_date', 'end_date'], { projectScoped: true }),
  sub('equipment', 'Plans de maintenance', 'plan de maintenance', 'maintenance-plans', '/equipment/maintenance-plans/', 'maintenanceplan', ['name', 'equipment', 'next_due_date']),
  sub('equipment', 'Entretiens', 'entretien', 'maintenance', '/equipment/maintenance-records/', 'maintenancerecord', ['equipment', 'performed_at', 'description', 'cost', 'currency']),
  sub('equipment', 'Utilisation', 'relevé d’utilisation', 'usage', '/equipment/usage-logs/', 'usagelog', ['equipment', 'project', 'usage_date', 'hours', 'counter_value'], { projectScoped: true }),
  sub('progress', 'Photos', 'photo', 'photos', '/progress/photos/', 'photo', ['project', 'task', 'daily_report', 'taken_at'], { projectScoped: true,
    actions: [{ label: 'Télécharger la photo', endpoint: 'download', permission: 'read', download: true }] }),
  sub('progress', 'Relevés d’avancement', 'relevé', 'updates', '/progress/progress-updates/', 'progressupdate', ['task', 'update_date', 'progress_percent', 'notes'], { projectScoped: true }),
  sub('progress', 'Réserves', 'réserve', 'snags', '/progress/snags/', 'snag', ['title', 'status', 'due_date', 'responsible_name'], { projectScoped: true,
    actions: [{ label: 'Résoudre', endpoint: 'resolve', permission: 'update', visible: (row) => !['resolved', 'closed'].includes(String(row.status)) }] }),
  sub('qhse', 'Actions correctives', 'action corrective', 'actions', '/qhse/corrective-actions/', 'correctiveaction', ['title', 'due_date', 'completed_at'], { projectScoped: true,
    actions: [{ label: 'Terminer', endpoint: 'complete', permission: 'update', visible: (row) => !row.completed_at }] }),
  sub('qhse', 'Inspections', 'inspection', 'inspections', '/qhse/inspections/', 'inspection', ['project', 'inspection_date', 'status', 'score'], { projectScoped: true,
    actions: [{ label: 'Terminer l’inspection', endpoint: 'complete', permission: 'update', visible: (row) => row.status !== 'completed' }] }),
  sub('qhse', 'Modèles d’inspection', 'modèle', 'templates', '/qhse/inspection-templates/', 'inspectiontemplate', ['code', 'name']),
  sub('qhse', 'PPSPS', 'plan de sécurité', 'ppsps', '/qhse/ppsps/', 'ppsps', ['project', 'reference', 'approved_at'], { projectScoped: true }),
  sub('documents', 'Dossiers', 'dossier', 'folders', '/documents/folders/', 'folder', ['name', 'project', 'parent'], { projectScoped: true }),
  sub('documents', 'Versions', 'version', 'versions', '/documents/versions/', 'documentversion', ['original_name', 'version_label', 'is_current', 'size'], { projectScoped: true,
    actions: [{ label: 'Télécharger', endpoint: 'download', permission: 'read', download: true },
      { label: 'Définir comme courante', endpoint: 'mark-current', permission: 'update', visible: (row) => !row.is_current }] }),
  sub('documents', 'Approbations', 'demande d’approbation', 'approvals', '/documents/approval-workflows/', 'approvalworkflow', ['document', 'reviewer', 'status', 'decided_at'], { projectScoped: true,
    actions: [{ label: 'Approuver', endpoint: 'approve', permission: 'validate', comment: true, visible: (row) => row.status === 'pending' },
      { label: 'Refuser', endpoint: 'reject', permission: 'validate', comment: true, visible: (row) => row.status === 'pending' }] }),
  sub('documents', 'Partages', 'autorisation de partage', 'sharing', '/documents/acls/', 'documentacl', ['document', 'user', 'role', 'permission'], { projectScoped: true }),
  sub('notifications', 'Messages', 'message', 'messages', '/notifications/messages/', 'message', ['project', 'sender', 'body', 'created_at'], { projectScoped: true }),
  sub('notifications', 'Canaux', 'canal', 'channels', '/notifications/channels/', 'channel', ['name', 'project', 'description'], { projectScoped: true }),
  sub('notifications', 'Préférences', 'préférence', 'preferences', '/notifications/preferences/', 'notificationpreference', ['user', 'event_type', 'email_enabled', 'push_enabled', 'in_app_enabled']),
  sub('reports', 'Rapports générés', 'rapport', 'runs', '/reports/runs/', 'reportrun', ['template', 'status', 'created_at'], { readOnly: true,
    actions: [{ label: 'Télécharger', endpoint: 'download', permission: 'read', download: true, visible: (row) => row.status === 'completed' }] }),
  sub('reports', 'Indicateurs', 'indicateur', 'indicators', '/reports/kpi-snapshots/', 'kpisnapshot', ['project', 'snapshot_date', 'code', 'value', 'unit'], { projectScoped: true }),
  sub('administration', 'Membres', 'adhésion', 'memberships', '/auth/memberships/', 'membership', ['user', 'role', 'is_active'], { model: 'accounts.membership' }),
  sub('administration', 'Comptes', 'compte', 'users', '/auth/users/', 'user', ['first_name', 'last_name', 'email', 'is_active'], { model: 'accounts.user', platformWrite: true }),
  sub('administration', 'Journal d’audit', 'événement', 'audit', '/auth/audit-logs/', 'auditlog', ['created_at', 'user', 'action', 'resource_type'], { model: 'accounts.auditlog', readOnly: true }),
  sub('administration', 'Appareils', 'appareil', 'devices', '/auth/devices/', 'device', ['name', 'user', 'platform', 'last_seen_at', 'is_active'], { model: 'accounts.device' }),
];
export const resourceByPath = Object.fromEntries(allResources.map((resource) => [resource.path, resource])) as Record<string, ResourceConfig>;
export const resourceByModel = Object.fromEntries(allResources.map((resource) => [resource.model, resource])) as Record<string, ResourceConfig>;
