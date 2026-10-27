import { FormEvent, useEffect, useState } from "react";
import { Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection, FieldInfo, fieldLabel, Metadata, notifyChange, recordTitle, statusLabels, versionHeaders } from "../api/workspace";
import { ResourceConfig, resourceByModel } from "../resources";
import { useWorkspace } from "../state/workspace";

export function RecordEditor({ resource, record, open, onClose, onSaved, defaults = {} }: {
  resource: ResourceConfig; record?: ApiRecord; open: boolean; onClose: () => void;
  onSaved: (record: ApiRecord) => void; defaults?: Record<string, unknown>;
}) {
  const { projectId } = useWorkspace();
  const [fields, setFields] = useState<Record<string, FieldInfo>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [relations, setRelations] = useState<Record<string, ApiRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lookupsFailed, setLookupsFailed] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setFieldErrors({}); setLookupsFailed([]); setRelations({});
    const endpoint = record ? `${resource.endpoint}${record.id}/` : resource.endpoint;
    api.options<Metadata>(endpoint, { signal: controller.signal }).then(async ({ data }) => {
      const info = data.actions?.[record ? "PUT" : "POST"];
      if (!info) throw new Error("Ce formulaire n’est pas disponible pour votre rôle.");
      const editable = Object.fromEntries(Object.entries(info).filter(([name, field]) => !field.read_only && name !== "definition"));
      setFields(editable);
      setValues(Object.fromEntries(Object.entries(editable).map(([name, field]) => {
        let value: unknown = record?.[name] ?? defaults[name] ?? field.default ?? (name === "project" ? projectId : "");
        if (name === "client_mutation_id" && !value) value = crypto.randomUUID();
        if (name === "status" && record && resource.model === "projects.project") value = undefined;
        if (field.type === "json") value = name === "items" && Array.isArray(value)
          ? value.map((item) => typeof item === "string" ? item : item.label).join("\n")
          : typeof value === "object" ? JSON.stringify(value, null, 2) : value || (name === "items" ? "" : "{}");
        if (field.type === "datetime" && value) value = String(value).slice(0, 16);
        if (field.type === "file upload" || field.type === "image upload") value = null;
        return [name, value];
      })));
      const results = await Promise.allSettled(Object.entries(editable).filter(([, field]) => field.related_model).map(async ([name, field]) => {
        const related = resourceByModel[field.related_model!];
        const endpoint = field.related_model === "accounts.user" ? "/auth/directory/"
          : field.related_model === "accounts.role" ? "/auth/roles/"
            : field.related_model === "accounts.device" ? "/auth/devices/" : related?.endpoint;
        if (!endpoint) throw new Error(name);
        try {
          const rows = await fetchCollection(endpoint, related?.projectScoped && projectId ? { project: projectId } : {}, controller.signal);
          return [name, rows.filter((row) => !(field.related_model === resource.model && record && row.id === record.id))] as const;
        } catch { throw new Error(name); }
      }));
      if (!controller.signal.aborted) {
        setRelations(Object.fromEntries(results.filter((result): result is PromiseFulfilledResult<readonly [string, ApiRecord[]]> => result.status === "fulfilled").map((result) => result.value)));
        setLookupsFailed(results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => result.reason.message));
      }
    }).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, resource.endpoint, record?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setFieldErrors({});
    try {
      const payload: Record<string, unknown> = {};
      for (const [name, field] of Object.entries(fields)) {
        if (record && name === "status" && resource.model === "projects.project") continue;
        const value = values[name];
        if (value instanceof File) { payload[name] = value; continue; }
        if (["file upload", "image upload"].includes(field.type)) continue;
        if (value === "" || value === undefined || value === null) {
          if (record && field.allow_null) payload[name] = null;
          else if (record && !field.related_model && field.type === "string") payload[name] = "";
          continue;
        }
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
      notifyChange(); onSaved(response.data); onClose();
    } catch (error) {
      setError(errorMessage(error));
      const data = (error as { response?: { data?: Record<string, unknown> } }).response?.data;
      if (data) setFieldErrors(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? value.join(" ") : String(value)])));
    } finally { setSaving(false); }
  };
  const update = (name: string, value: unknown) => setValues((current) => ({ ...current, [name]: value }));

  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
    <Box component="form" onSubmit={submit}>
      <DialogTitle sx={{ pb: 1 }}>{record ? "Modifier" : "Créer"} · {resource.singular}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Les champs marqués d’un astérisque sont obligatoires.</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {lookupsFailed.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>Certaines listes sont indisponibles : {lookupsFailed.map(fieldLabel).join(", ")}. Vérifiez vos accès et réessayez.</Alert>}
        {loading ? <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack> :
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
            {Object.entries(fields).filter(([name]) => !(record && name === "status" && resource.model === "projects.project") && !["mime_type", "size", "checksum"].includes(name)).map(([name, field]) => {
              const common = { label: name === "items" ? "Points de contrôle (un par ligne)" : fieldLabel(name), required: !record && field.required, error: Boolean(fieldErrors[name]), helperText: fieldErrors[name], fullWidth: true, size: "small" as const };
              const value = values[name] ?? "";
              if (field.related_model) return <Autocomplete key={name} options={relations[name] ?? []}
                value={(relations[name] ?? []).find((row) => String(row.id) === String(value)) ?? null}
                getOptionLabel={recordTitle} isOptionEqualToValue={(a, b) => a.id === b.id}
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
              return <TextField key={name} {...common} type={type} value={value} multiline={multiline} minRows={multiline ? 3 : undefined}
                sx={multiline ? { gridColumn: "1 / -1" } : undefined} onChange={(event) => update(name, event.target.value)}
                InputLabelProps={{ shrink: true }} inputProps={{ maxLength: field.max_length, min: field.min_value, max: field.max_value, step: field.type === "integer" ? 1 : "any" }} />;
            })}
          </Box>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}><Button onClick={onClose} disabled={saving}>Annuler</Button>
        <Button variant="contained" type="submit" disabled={loading || saving || !Object.keys(fields).length}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </DialogActions>
    </Box>
  </Dialog>;
}
