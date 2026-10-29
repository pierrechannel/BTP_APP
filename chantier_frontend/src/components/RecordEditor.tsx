import { FormEvent, useEffect, useState } from "react";
import { Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection, FieldInfo, fieldLabel, Metadata, notifyChange, recordTitle, statusLabels, versionHeaders } from "../api/workspace";
import { ResourceConfig, resourceByModel } from "../resources";
import { useWorkspace } from "../state/workspace";
import { formFieldOrder, formHints, orderLineTotal, relationMatches, visibleFormField } from "../api/workflows";
import { RolePermissions } from "./RolePermissions";
import { formatValue } from "../api/workspace";
import { useAuth } from "../state/auth";

export function RecordEditor({ resource, record, open, onClose, onSaved, defaults = {}, fixedFields = [], compact = false, allowRepeat = false }: {
  resource: ResourceConfig; record?: ApiRecord; open: boolean; onClose: () => void;
  onSaved: (record: ApiRecord) => void; defaults?: Record<string, unknown>; fixedFields?: string[];
  compact?: boolean; allowRepeat?: boolean;
}) {
  const { projectId } = useWorkspace();
  const { refreshMe } = useAuth();
  const [fields, setFields] = useState<Record<string, FieldInfo>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [relations, setRelations] = useState<Record<string, ApiRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lookupsFailed, setLookupsFailed] = useState<string[]>([]);
  const [formTab, setFormTab] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setFieldErrors({}); setLookupsFailed([]); setRelations({}); setFormTab(0);
    const endpoint = record ? `${resource.endpoint}${record.id}/` : resource.endpoint;
    api.options<Metadata>(endpoint, { signal: controller.signal }).then(async ({ data }) => {
      const info = data.actions?.[record ? "PUT" : "POST"];
      if (!info) throw new Error("Ce formulaire n’est pas disponible pour votre rôle.");
      const editable = Object.fromEntries(Object.entries(info).filter(([name, field]) => !field.read_only && name !== "definition")
        .sort(([a], [b]) => formFieldOrder(resource.model, a) - formFieldOrder(resource.model, b)));
      setFields(editable);
      setValues(Object.fromEntries(Object.entries(editable).map(([name, field]) => {
        let value: unknown = record?.[name] ?? defaults[name] ?? field.default ?? (name === "project" ? projectId : "");
        if (name === "client_mutation_id" && !value) value = crypto.randomUUID();
        if (name === "status" && record && resource.model === "projects.project") value = undefined;
        if (field.type === "json") value = name === "items" && Array.isArray(value)
          ? value.map((item) => typeof item === "string" ? item : item.label).join("\n")
          : typeof value === "object" ? JSON.stringify(value, null, 2) : value || (name === "items" ? "" : "{}");
        if (field.type === "datetime" && value) {
          const date = new Date(String(value));
          value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
        if (field.type === "file upload" || field.type === "image upload") value = null;
        return [name, value];
      })));
      const effectiveProject = defaults.project ?? record?.project ?? projectId;
      const results = await Promise.allSettled(Object.entries(editable).filter(([name, field]) => field.related_model && !fixedFields.includes(name)).map(async ([name, field]) => {
        const related = resourceByModel[field.related_model!];
        const endpoint = field.related_model === "accounts.user" ? "/auth/directory/"
          : field.related_model === "accounts.role" ? "/auth/role-directory/"
            : field.related_model === "accounts.device" ? "/auth/devices/" : related?.endpoint;
        if (!endpoint) throw new Error(name);
        try {
          const rows = await fetchCollection(endpoint, related?.projectScoped && effectiveProject ? { project: effectiveProject } : {}, controller.signal);
          return [name, rows.filter((row) => !(field.related_model === resource.model && record && row.id === record.id))] as const;
        } catch { throw new Error(name); }
      }));
      if (!controller.signal.aborted) {
        const loaded = Object.fromEntries(results.filter((result): result is PromiseFulfilledResult<readonly [string, ApiRecord[]]> => result.status === "fulfilled").map((result) => result.value));
        setRelations(loaded);
        if (resource.model === "budget.budgetline") {
          const selected = loaded.budget?.find((row) => String(row.id) === String(record?.budget ?? defaults.budget));
          if (selected) setValues((current) => ({ ...current, currency: selected.currency, project: selected.project }));
        }
        setLookupsFailed(results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason.message));
      }
    }).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, resource.endpoint, record?.id]);

  const submit = async (event: FormEvent) => {
    const repeat = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-continue") === "true";
    event.preventDefault(); setSaving(true); setError(""); setFieldErrors({});
    try {
      const payload: Record<string, unknown> = {};
      for (const [name, field] of Object.entries(fields)) {
        if (record && name === "status" && resource.model === "projects.project") continue;
        let value = values[name];
        if (!visibleFormField(resource.model, name, values)) value = null;
        if (value instanceof File) { payload[name] = value; continue; }
        if (["file upload", "image upload"].includes(field.type)) continue;
        if (value === "" || value === undefined || value === null) {
          if (field.allow_null && (record || !visibleFormField(resource.model, name, values))) payload[name] = null;
          else if (record && !field.related_model && field.type === "string") payload[name] = "";
          continue;
        }
        if (resource.model === "resources.purchaseorderline" && name === "quantity" && Number(value) <= 0) throw new Error("La quantité doit être strictement positive.");
        if (resource.model === "resources.purchaseorderline" && name === "unit_price" && Number(value) < 0) throw new Error("Le prix unitaire ne peut pas être négatif.");
        if (field.type === "json") {
          try { payload[name] = name === "items" ? String(value).split("\n").map((item) => item.trim()).filter(Boolean) : JSON.parse(String(value)); }
          catch { throw new Error(`${fieldLabel(name)} : le format JSON est invalide.`); }
        } else if (field.type === "integer" || field.type === "float") payload[name] = Number(value);
        else if (field.type === "datetime") payload[name] = new Date(String(value)).toISOString();
        else payload[name] = value;
      }
      if (payload.file instanceof File) {
        payload.original_name ??= payload.file.name;
        payload.mime_type = payload.file.type;
        payload.size = payload.file.size;
      }
      const hasFiles = Object.values(payload).some((value) => value instanceof File);
      const body = hasFiles ? Object.entries(payload).reduce((form, [key, value]) => {
        if (value !== null) form.append(key, value instanceof File ? value : String(value));
        return form;
      }, new FormData()) : payload;
      const headers = { ...(record ? versionHeaders(record) : {}), ...(hasFiles ? { "Content-Type": "multipart/form-data" } : {}) };
      const response = record ? await api.patch<ApiRecord>(`${resource.endpoint}${record.id}/`, body, { headers })
        : await api.post<ApiRecord>(resource.endpoint, body, { headers });
      if (resource.group === "administration") await refreshMe().catch(() => {});
      notifyChange(); onSaved(response.data);
      if (repeat && !record) {
        setValues((current) => ({ ...current, ...(resource.model === "resources.purchaseorderline" ? { material: "", quantity: "", unit_price: "" } : { label: "", amount: "" }) }));
        setFormTab(0);
      } else onClose();
    } catch (error) {
      setError(errorMessage(error));
      const data = (error as { response?: { data?: Record<string, unknown> } }).response?.data;
      if (data) setFieldErrors(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value.join(" ") : String(value)])));
    } finally { setSaving(false); }
  };
  const update = (name: string, value: unknown) => setValues((current) => {
    const next = { ...current, [name]: value };
    const dependencies: Record<string, string[]> = { project: ["task", "lot", "daily_report", "parent"], equipment: ["maintenance_plan"] };
    for (const dependent of dependencies[name] ?? []) if (!fixedFields.includes(dependent)) next[dependent] = "";
    if (name === "material" && resource.model === "resources.purchaseorderline" && !record) {
      const material = relations.material?.find((row) => String(row.id) === String(value));
      if (material?.unit_price != null) next.unit_price = material.unit_price;
      if (material?.currency) next.currency = material.currency;
    }
    if (name === "budget" && resource.model === "budget.budgetline") {
      const budget = relations.budget?.find((row) => String(row.id) === String(value));
      next.currency = budget?.currency ?? ""; next.project = budget?.project ?? ""; next.lot = "";
    }
    if (name === "budget_line" && resource.model === "budget.expense") {
      const line = relations.budget_line?.find((row) => String(row.id) === String(value));
      next.currency = line?.currency ?? "";
    }
    if (name === "movement_type") {
      if (value === "out") next.target_location = "";
      if (value === "in" || value === "adjustment") next.source_location = "";
    }
    return next;
  });
  let linePreview = "";
  if (resource.model === "resources.purchaseorderline" && values.quantity && values.unit_price !== "") {
    try { linePreview = `${formatValue(orderLineTotal(values), "amount")} ${values.currency ?? "BIF"}`; } catch { /* Invalid values are reported by validation. */ }
  }

  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth={compact ? "sm" : "md"}>
    <Box component="form" onSubmit={submit} sx={{ display: "flex", flexDirection: "column", minHeight: 0, maxHeight: "90dvh" }} onInvalidCapture={(event) => {
      event.preventDefault(); setFormTab(0); setError("Veuillez compléter les champs obligatoires et vérifier les valeurs saisies.");
      const input = event.target as HTMLInputElement; setTimeout(() => input.focus(), 0);
    }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span>{record ? "Modifier" : "Créer"} · {resource.singular}</span><IconButton type="button" aria-label="Fermer le formulaire" disabled={saving} onClick={onClose} size="small" sx={{ color: "inherit" }}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ overflowY: "auto", minHeight: 0 }}>
        {!compact && <Tabs value={formTab} onChange={(_, value) => setFormTab(value)} aria-label="Étapes du formulaire" sx={{ mb: 2.5 }}><Tab label="Informations" id="record-form-information" aria-controls="record-form-fields" /><Tab label="Récapitulatif" id="record-form-summary" aria-controls="record-form-review" disabled={loading} /></Tabs>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Les champs marqués d’un astérisque sont obligatoires.</Typography>
        {formHints[resource.model] && <Alert severity="info" sx={{ mb: 2 }}>{formHints[resource.model]}</Alert>}
        {fixedFields.length > 0 && <Typography variant="caption" color="primary.main" component="p" mb={2}>Cet élément est rattaché à la fiche ouverte.</Typography>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {lookupsFailed.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>Certaines listes sont indisponibles : {lookupsFailed.map(fieldLabel).join(", ")}. Vérifiez vos accès et réessayez.</Alert>}
        {loading ? <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack> :
          <Box id="record-form-fields" role="tabpanel" aria-labelledby="record-form-information" hidden={formTab !== 0} sx={{ display: formTab === 0 ? "grid" : "none", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
            {Object.entries(fields).filter(([name]) => !fixedFields.includes(name) && visibleFormField(resource.model, name, values) && !(record && name === "status" && resource.model === "projects.project") && !["mime_type", "size", "checksum"].includes(name)).map(([name, field]) => {
              const stockRequired = resource.model === "resources.stockmovement" && ["source_location", "target_location"].includes(name);
              const common = { label: name === "items" ? "Points de contrôle (un par ligne)" : fieldLabel(name), required: stockRequired || (!record && field.required), error: Boolean(fieldErrors[name]), helperText: fieldErrors[name], fullWidth: true, size: "small" as const };
              const value = values[name] ?? "";
              if (name === "permissions" && resource.model === "accounts.role") return <RolePermissions key={name} value={String(value)} onChange={(value) => update(name, value)} />;
              if (field.related_model) return <Autocomplete key={name} options={(relations[name] ?? []).filter((row) => relationMatches(name, row, values))}
                value={(relations[name] ?? []).find((row) => String(row.id) === String(value)) ?? null}
                getOptionLabel={recordTitle} isOptionEqualToValue={(a, b) => a.id === b.id} disabled={saving || lookupsFailed.includes(name)}
                onChange={(_, row) => update(name, row?.id ?? "")}
                noOptionsText="Aucun élément disponible" renderInput={(params) => <TextField {...params} {...common} />} />;
              if (field.type === "boolean") return <FormControlLabel key={name} control={<Checkbox checked={Boolean(value)} onChange={(_, checked) => update(name, checked)} />} label={fieldLabel(name)} />;
              if (["file upload", "image upload"].includes(field.type)) return <Box key={name} sx={{ gridColumn: "1 / -1", p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>{fieldLabel(name)}</Typography>
                <input aria-label={fieldLabel(name)} type="file" required={!record && field.required} onChange={(event) => {
                  const file = event.target.files?.[0]; update(name, file);
                  if (file && name === "file") update("original_name", file.name);
                }} />{fieldErrors[name] && <Typography color="error">{fieldErrors[name]}</Typography>}
              </Box>;
              if (field.choices?.length) return <TextField key={name} {...common} select value={value} onChange={(event) => update(name, event.target.value)}>
                {!field.required && <MenuItem value="">Aucun</MenuItem>}
                {field.choices.map((choice) => <MenuItem key={choice.value} value={choice.value}>{statusLabels[String(choice.value)] ?? choice.display_name}</MenuItem>)}
              </TextField>;
              const multiline = field.multiline || field.type === "json";
              const type = field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local"
                : ["integer", "decimal", "float"].includes(field.type) ? "number" : field.type === "email" ? "email" : "text";
              return <TextField key={name} {...common} type={type} value={value} multiline={multiline} minRows={multiline ? 3 : undefined} disabled={name === "currency" && ["budget.budgetline", "budget.expense"].includes(resource.model)}
                sx={multiline ? { gridColumn: "1 / -1" } : undefined} onChange={(event) => update(name, event.target.value)}
                InputLabelProps={{ shrink: true }} inputProps={{ maxLength: field.max_length, min: field.min_value, max: field.max_value, step: field.type === "integer" ? 1 : "any" }} />;
            })}
          </Box>}
        {!loading && formTab === 1 && <Box id="record-form-review" role="tabpanel" aria-labelledby="record-form-summary" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          {Object.entries(fields).filter(([name]) => !fixedFields.includes(name) && visibleFormField(resource.model, name, values) && !["mime_type", "size", "checksum"].includes(name)).map(([name, field]) => {
            const value = values[name];
            const related = field.related_model ? relations[name]?.find((row) => String(row.id) === String(value)) : undefined;
            const label = related ? recordTitle(related) : value instanceof File ? value.name : field.type === "json" ? "Données structurées renseignées" : formatValue(value, name);
            return <Box key={name} sx={{ p: 1.5, bgcolor: "#f3f7f1", borderRadius: 1, minWidth: 0 }}><Typography variant="caption" color="text.secondary">{fieldLabel(name)}</Typography><Typography variant="body2" sx={{ mt: .5, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{label}</Typography></Box>;
          })}
        </Box>}
        {!loading && linePreview && <PaperTotal value={linePreview} />}
      </DialogContent>
      <DialogActions sx={{ flexShrink: 0 }}><Button onClick={onClose} disabled={saving}>Annuler</Button>
        {allowRepeat && !record && <Button type="submit" data-continue="true" disabled={loading || saving} variant="outlined">Enregistrer et ajouter une autre</Button>}
        <Button variant="contained" type="submit" disabled={loading || saving || !Object.keys(fields).length}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </DialogActions>
    </Box>
  </Dialog>;
}

function PaperTotal({ value }: { value: string }) {
  return <Box sx={{ mt: 3, p: 2, bgcolor: "#edf5f1", borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Total de la ligne</Typography><Typography variant="h6">{value}</Typography></Box>;
}
