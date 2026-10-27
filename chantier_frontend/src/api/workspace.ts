import axios from "axios";
import { api } from "./client";
import { ApiRecord, Paginated } from "./types";

export type FieldInfo = {
  type: string; required?: boolean; read_only?: boolean; label?: string; allow_null?: boolean;
  choices?: Array<{ value: string | number; display_name: string }>;
  related_model?: string; default?: unknown; multiline?: boolean;
  max_length?: number; min_value?: number; max_value?: number;
};
export type Metadata = { fields?: Record<string, FieldInfo>; actions?: { POST?: Record<string, FieldInfo>; PUT?: Record<string, FieldInfo> } };

export function pageEndpoint(next: string) {
  const base = new URL(api.defaults.baseURL ?? "/api/v1", window.location.origin);
  const url = new URL(next, base);
  if (!url.pathname.startsWith(`${base.pathname.replace(/\/$/, "")}/`)) throw new Error("Pagination invalide.");
  return url.pathname.slice(base.pathname.replace(/\/$/, "").length) + url.search;
}

export async function fetchCollection(endpoint: string, params: Record<string, unknown> = {}, signal?: AbortSignal) {
  const records: ApiRecord[] = [];
  let next: string | null = endpoint;
  const seen = new Set<string>();
  while (next) {
    if (seen.has(next)) throw new Error("Pagination circulaire.");
    seen.add(next);
    const response: { data: Paginated<ApiRecord> | ApiRecord[] } = await api.get(next, {
      params: records.length ? undefined : params, signal,
    });
    if (Array.isArray(response.data)) return response.data;
    records.push(...response.data.results);
    next = response.data.next ? pageEndpoint(response.data.next) : null;
  }
  return records;
}

export function errorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error.message : "Une erreur est survenue.";
  if (!error.response) return "Le serveur est injoignable. Vérifiez que le backend est démarré.";
  if (error.response.status === 401) return "Votre session a expiré. Reconnectez-vous.";
  if (error.response.status === 403) return "Votre rôle ne permet pas cette opération.";
  if (error.response.status === 409) return "Ces données ont changé. Actualisez la fiche avant de recommencer.";
  const data = error.response.data;
  if (typeof data === "string") return "Le serveur a rencontré une erreur. Réessayez dans un instant.";
  if (data?.detail) return String(data.detail);
  return Object.entries(data ?? {}).map(([key, value]) => `${fieldLabel(key)} : ${Array.isArray(value) ? value.join(" ") : String(value)}`).join(" · ") || "Impossible de terminer cette opération.";
}

const labels: Record<string, string> = {
  name: "Nom", title: "Titre", code: "Code", reference: "Référence", description: "Description", status: "Statut",
  project: "Chantier", lot: "Lot", parent: "Élément parent", client_name: "Maître d’ouvrage", address: "Adresse",
  planned_start_date: "Début prévu", planned_end_date: "Fin prévue", work_type: "Type de travaux", contract_amount: "Montant du marché",
  currency: "Devise", default_currency: "Devise", progress_percent: "Avancement", supplier_name: "Fournisseur", supplier: "Fournisseur",
  lots_count: "Nombre de lots",
  date: "Date", amount: "Montant", amount_excluding_tax: "Montant HT", tax_amount: "Taxes", amount_including_tax: "Montant TTC",
  budget: "Budget", budget_line: "Ligne budgétaire", category: "Catégorie", label: "Libellé", unit: "Unité", unit_price: "Prix unitaire",
  first_name: "Prénom", last_name: "Nom", job_title: "Métier", hourly_rate: "Taux horaire", equipment_type: "Type de matériel",
  serial_number: "N° de série", state: "État", daily_cost: "Coût journalier", report_date: "Date du rapport", weather: "Météo",
  work_done: "Travaux réalisés", difficulties: "Difficultés rencontrées", occurred_at: "Date de l’incident", folder: "Dossier",
  body: "Message", read_at: "Lu le", created_at: "Créé le", updated_at: "Mis à jour le", resource_type: "Ressource", resource_id: "Identifiant de la ressource",
  operation: "Opération", client_mutation_id: "Identifiant de mutation", payload: "Données à synchroniser", error: "Erreur",
  predecessor: "Tâche précédente", successor: "Tâche suivante", dependency_type: "Type de dépendance", lag_days: "Décalage (jours)",
  subcontractor_name: "Sous-traitant", stakeholder_type: "Type d’intervenant", email: "Adresse e-mail", phone: "Téléphone", notes: "Notes",
  worker: "Collaborateur", work_date: "Date de pointage", normal_hours: "Heures normales", overtime_hours: "Heures supplémentaires",
  is_validated: "Validé", task: "Tâche", start_date: "Date de début", end_date: "Date de fin", role: "Fonction",
  equipment: "Équipement", next_due_date: "Prochaine échéance", interval_days: "Intervalle (jours)", interval_hours: "Intervalle (heures)",
  maintenance_plan: "Plan de maintenance", performed_at: "Date d’intervention", cost: "Coût", due_date: "Échéance", completed_at: "Terminé le",
  incident: "Incident", responsible_name: "Responsable", resolved_at: "Résolu le", template: "Modèle", inspection: "Inspection",
  inspection_date: "Date d’inspection", score: "Score", items: "Points de contrôle", document: "Document", version_label: "Indice de version",
  file: "Fichier", original_name: "Nom du fichier", mime_type: "Type de fichier", size: "Taille", checksum: "Empreinte", is_current: "Version courante",
  reviewer: "Réviseur", requested_by: "Demandeur", decided_at: "Décidé le", comment: "Commentaire", definition: "Configuration du rapport",
  parameters: "Paramètres", result_file: "Fichier généré", user: "Utilisateur", device: "Appareil", version: "Version", quantity: "Quantité",
  material: "Matériau", source_location: "Dépôt de départ", target_location: "Dépôt de destination", movement_type: "Type de mouvement",
  movement_date: "Date du mouvement", order_number: "N° de commande", ordered_at: "Commandée le", purchase_order: "Commande",
  invoice_number: "N° de facture", issue_date: "Date d’émission", country: "Pays", latitude: "Latitude", longitude: "Longitude",
};
export const fieldLabel = (name: string) => labels[name] ?? name.replaceAll("_", " ");
export const statusLabels: Record<string, string> = {
  study: "À l’étude", preparation: "Préparation", in_progress: "En cours", suspended: "Suspendu", handover: "Réception", closed: "Clôturé",
  todo: "À faire", blocked: "Bloqué", done: "Terminé", cancelled: "Annulé", draft: "Brouillon", submitted: "À valider", validated: "Validé",
  paid: "Payé", rejected: "Refusé", approved: "Approuvé", refused: "Refusé", review: "En révision", obsolete: "Obsolète", pending: "En attente",
  completed: "Terminé", failed: "En échec", applied: "Appliqué", declared: "Déclaré", actions: "Actions en cours", open: "Ouvert", resolved: "Résolu",
  operationnel: "Opérationnel", maintenance: "En maintenance", en_panne: "En panne", hors_service: "Hors service",
  create: "Création", update: "Modification", upsert: "Création ou modification", delete: "Suppression", in: "Entrée", out: "Sortie", transfer: "Transfert",
};
export const recordTitle = (row: Record<string, unknown>) => String(row.name ?? row.title ?? row.label ?? row.original_name
  ?? ([row.first_name, row.last_name].filter(Boolean).join(" ") || row.code || row.reference || row.order_number || row.invoice_number || row.email || row.id));
export function formatValue(value: unknown, field = ""): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (field === "size") return `${(Number(value) / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`;
  if (field === "progress_percent") return `${value} %`;
  if (["status", "state", "operation", "movement_type"].includes(field)) return statusLabels[String(value)] ?? String(value);
  if (/date|_at$/.test(field) && !Number.isNaN(Date.parse(String(value)))) return new Intl.DateTimeFormat("fr-FR").format(new Date(String(value)));
  if (/amount|cost|price|rate|hours/.test(field) && Number.isFinite(Number(value))) return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
export const versionHeaders = (record: ApiRecord) => record.version ? { "If-Match": `"${record.version}"` } : {};
export const notifyChange = () => window.dispatchEvent(new Event("chantier:data-changed"));

export async function downloadFile(endpoint: string, filename: string) {
  const response = await api.get(endpoint, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
