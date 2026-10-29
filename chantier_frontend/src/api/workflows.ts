import { ApiRecord } from "./types";

export type RelatedWorkflow = { model: string; field: string; label?: string };
const relation = (model: string, field: string, label?: string): RelatedWorkflow => ({ model, field, label });
const workflows: Record<string, RelatedWorkflow[]> = {
  "projects.project": [relation("projects.lot", "project"), relation("planning.task", "project"), relation("budget.budget", "project"), relation("resources.purchaseorder", "project"), relation("workforce.assignment", "project"), relation("equipment.equipmentassignment", "project"), relation("projects.stakeholder", "project"), relation("progress.dailyreport", "project"), relation("documents.folder", "project")],
  "planning.task": [relation("planning.taskdependency", "predecessor", "Tâches suivantes"), relation("planning.taskdependency", "successor", "Prérequis"), relation("progress.progressupdate", "task"), relation("workforce.assignment", "task"), relation("progress.photo", "task"), relation("progress.snag", "task")],
  "budget.budget": [relation("budget.budgetline", "budget")],
  "budget.budgetline": [relation("budget.expense", "budget_line")],
  "resources.supplier": [relation("resources.purchaseorder", "supplier")],
  "resources.material": [relation("resources.stockmovement", "material"), relation("resources.purchaseorderline", "material")],
  "workforce.worker": [relation("workforce.timeentry", "worker"), relation("workforce.assignment", "worker"), relation("workforce.workercertification", "worker")],
  "workforce.certification": [relation("workforce.workercertification", "certification")],
  "equipment.equipment": [relation("equipment.equipmentassignment", "equipment"), relation("equipment.usagelog", "equipment"), relation("equipment.maintenanceplan", "equipment"), relation("equipment.maintenancerecord", "equipment")],
  "equipment.maintenanceplan": [relation("equipment.maintenancerecord", "maintenance_plan")],
  "progress.dailyreport": [relation("progress.photo", "daily_report")],
  "qhse.incident": [relation("qhse.correctiveaction", "incident")],
  "qhse.inspectiontemplate": [relation("qhse.inspection", "template")],
  "documents.folder": [relation("documents.document", "folder"), relation("documents.folder", "parent", "Sous-dossiers")],
  "documents.document": [relation("documents.documentversion", "document"), relation("documents.approvalworkflow", "document"), relation("documents.documentacl", "document")],
  "reports.reporttemplate": [relation("reports.reportrun", "template")],
  "accounts.role": [relation("accounts.membership", "role")],
};
export const relatedWorkflows = (model: string) => workflows[model] ?? [];

export function isRecordLocked(model: string, record: ApiRecord) {
  return (model === "resources.purchaseorder" && record.status !== "draft")
    || (model === "resources.purchaseorderline" && record.order_status !== "draft")
    || (["budget.expense", "budget.invoice", "progress.dailyreport"].includes(model) && ["validated", "paid"].includes(String(record.status)))
    || (model === "workforce.timeentry" && Boolean(record.is_validated))
    || (model === "qhse.inspection" && record.status === "completed")
    || (model === "documents.approvalworkflow" && record.status !== "pending");
}
export const isDeletionLocked = (model: string, record: ApiRecord) =>
  (model === "resources.purchaseorder" && record.status !== "draft")
  || (model === "resources.purchaseorderline" && record.order_status !== "draft")
  || (["budget.expense", "budget.invoice"].includes(model) && ["validated", "paid"].includes(String(record.status)))
  || (model === "workforce.timeentry" && Boolean(record.is_validated));

export function visibleFormField(model: string, name: string, values: Record<string, unknown>) {
  if (model === "resources.stockmovement") {
    if (name === "source_location") return ["out", "transfer"].includes(String(values.movement_type));
    if (name === "target_location") return ["in", "transfer", "adjustment"].includes(String(values.movement_type));
  }
  if (model === "documents.documentacl") {
    if (name === "user") return !values.role;
    if (name === "role") return !values.user;
  }
  return true;
}

export function relationMatches(name: string, row: ApiRecord, values: Record<string, unknown>) {
  const parents: Record<string, string[]> = {
    task: ["project"], lot: ["project"], daily_report: ["project"],
    budget_line: ["budget"], maintenance_plan: ["equipment"], parent: ["project"],
  };
  return (parents[name] ?? []).every((key) => !values[key] || !row[key] || String(row[key]) === String(values[key]));
}

// Quantity (3 decimals) × unit price (2 decimals), summed before rounding.
// Keep currency groups separate and avoid binary floating-point money arithmetic.
function scaled(value: unknown, places: number): bigint {
  const text = String(value ?? "0");
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error("Quantité et prix doivent être positifs ou nuls.");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > places && /[1-9]/.test(fraction.slice(places))) throw new Error("Précision du montant invalide.");
  return BigInt(whole + fraction.slice(0, places).padEnd(places, "0"));
}
function money(value: bigint) {
  const cents = (value + 500n) / 1000n;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}
export const orderLineTotal = (line: Record<string, unknown>) => money(scaled(line.quantity, 3) * scaled(line.unit_price, 2));
export function orderTotals(lines: Record<string, unknown>[]) {
  const totals = new Map<string, bigint>();
  for (const line of lines) {
    const currency = String(line.currency ?? "BIF");
    totals.set(currency, (totals.get(currency) ?? 0n) + scaled(line.quantity, 3) * scaled(line.unit_price, 2));
  }
  return [...totals].map(([currency, total]) => ({ currency, total: money(total) }));
}

export const formHints: Record<string, string> = {
  "resources.purchaseorder": "Créez le bon de commande, puis ajoutez ses lignes depuis sa fiche. Le statut de commande ne modifie pas le stock.",
  "resources.purchaseorderline": "Choisissez un matériau, sa quantité et son prix. Le total de la ligne est calculé automatiquement.",
  "resources.stockmovement": "Choisissez une entrée, une sortie ou un transfert. Un mouvement enregistré est définitif ; une correction utilise un mouvement inverse.",
  "workforce.timeentry": "Le cumul des heures normales et supplémentaires d’un collaborateur est limité à 24 h par jour, sur tous les chantiers.",
  "workforce.workercertification": "La date d’expiration doit être égale ou postérieure à la délivrance. Sans expiration, l’habilitation reste valable après sa délivrance.",
  "documents.documentacl": "Partagez avec un utilisateur ou avec un rôle. Sélectionnez un seul destinataire et le niveau d’accès souhaité.",
  "notifications.notificationpreference": "Ces préférences sont enregistrées. La réception d’e-mails ou de notifications push dépend des services de diffusion configurés.",
  "notifications.channel": "Les canaux organisent la collaboration ; la messagerie en temps réel n’est pas encore disponible.",
};

const formOrders: Record<string, string[]> = {
  "budget.budgetline": ["budget", "label", "category", "lot", "amount", "currency"],
  "resources.purchaseorder": ["order_number", "project", "supplier", "ordered_at", "status"],
  "resources.purchaseorderline": ["purchase_order", "material", "quantity", "unit_price", "currency"],
  "resources.stockmovement": ["movement_type", "material", "quantity", "movement_date", "source_location", "target_location", "notes"],
  "workforce.worker": ["first_name", "last_name", "job_title", "hourly_rate", "currency"],
  "workforce.timeentry": ["worker", "project", "task", "work_date", "normal_hours", "overtime_hours"],
  "workforce.workercertification": ["worker", "certification", "issued_at", "expires_at"],
  "documents.documentversion": ["document", "version_label", "file", "original_name", "is_current"],
  "documents.documentacl": ["document", "permission", "user", "role"],
};
export function formFieldOrder(model: string, name: string) {
  const order = formOrders[model];
  if (!order) return 0;
  const index = order.indexOf(name);
  return index < 0 ? order.length : index;
}
