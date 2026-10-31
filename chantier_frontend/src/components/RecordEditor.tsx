import { ExpenseReceipts, Receipt } from './ExpenseReceipts';
import { InvoiceAttachment } from './InvoiceAttachment';
import { ExpensePageLayout } from './ExpensePageLayout';
import { Chip } from '@mui/material';
import { FormTextField as TextField } from './FormTextField';
import { FormEvent, useEffect, useState } from "react";
import { Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, Stack, Tab, Tabs, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection, FieldInfo, fieldLabel, Metadata, notifyChange, recordTitle, statusLabels, versionHeaders } from "../api/workspace";
import { ResourceConfig, resourceByModel } from "../resources";
import { useWorkspace } from "../state/workspace";
import { formFieldOrder, formHints, orderLineTotal, expenseLinesTotal, relationMatches, visibleFormField } from "../api/workflows";
import { RolePermissions } from "./RolePermissions";
import { formatValue } from "../api/workspace";
import { useAuth } from "../state/auth";
import { ExpenseDetails, ExpenseDetailsView } from "./ExpenseDetails";
import { BusinessFormLayout, businessDialogSx } from "./BusinessFormLayout";
import { Navigate, useLocation } from "react-router-dom";

export function RecordEditor(props: Parameters<typeof MetadataRecordEditor>[0]) {
  const location = useLocation();
  if (props.resource.model === 'progress.dailyreport') {
    const query = new URLSearchParams(props.defaults?.project ? { project: String(props.defaults.project) } : {});
    return props.open ? <Navigate to={props.record ? `/progress/${props.record.id}/modifier` : `/progress/nouveau?${query}`} state={{ returnTo: location.pathname + location.search }} /> : null;
  }
  if (props.resource.model === 'budget.expense' && !props.page) {
    const query = new URLSearchParams(Object.entries(props.defaults || {}).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)]));
    return props.open ? <Navigate to={props.record ? `/budget/expenses/${props.record.id}/modifier` : `/budget/expenses/nouveau?${query}`} state={{ returnTo: location.pathname + location.search }} /> : null;
  }
  if (props.resource.model === 'workforce.worker' && !props.page) {
    return props.open ? <Navigate to={props.record ? `/workforce/${props.record.id}/modifier` : '/workforce/nouveau'} /> : null;
  }
  if (props.resource.model === 'workforce.timeentry' && !props.record && !props.defaults?.worker && !props.defaults?.task && !props.fixedFields?.includes('worker')) {
    const query = new URLSearchParams({ ...(props.defaults?.project ? { project: String(props.defaults.project) } : {}), ...(props.defaults?.work_date ? { date: String(props.defaults.work_date) } : {}) });
    return props.open ? <Navigate to={`/workforce/pointage?${query}`} /> : null;
  }
  return <MetadataRecordEditor {...props} />;
}

function MetadataRecordEditor({ resource, record, open, onClose, onSaved, defaults = {}, fixedFields = [], compact = false, allowRepeat = false, page = false }: {
  resource: ResourceConfig; record?: ApiRecord; open: boolean; onClose: () => void;
  onSaved: (record: ApiRecord) => void; defaults?: Record<string, unknown>; fixedFields?: string[];
  compact?: boolean; allowRepeat?: boolean; page?: boolean;
}) {
  const { projectId, can } = useWorkspace();
  const expenseForm = resource.model === "budget.expense";
  const timeForm = resource.model === "workforce.timeentry";
  const businessForm = expenseForm || timeForm;
  const { refreshMe } = useAuth();
  const [fields, setFields] = useState<Record<string, FieldInfo>>({});
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [relations, setRelations] = useState<Record<string, ApiRecord[]>>({});
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lookupsFailed, setLookupsFailed] = useState<string[]>([]);
  const [formTab, setFormTab] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [removedReceipts, setRemovedReceipts] = useState<string[]>([]);
  const canReadSuppliers = can('resources', 'read');
  useEffect(() => {
    if (!open || !expenseForm || !canReadSuppliers) return;
    const controller = new AbortController();
    fetchCollection('/resources/suppliers/', {}, controller.signal)
      .then(rows => { if (!controller.signal.aborted) setSupplierNames([...new Set(rows.map(row => String(row.name || '')).filter(Boolean))]); })
      .catch(() => { if (!controller.signal.aborted) setSupplierNames([]); });
    return () => controller.abort();
  }, [open, expenseForm, canReadSuppliers]);
  const close = () => { if (!dirty || window.confirm('Abandonner les modifications du formulaire ?')) onClose(); };
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setDirty(false); setReceiptFiles([]); setRemovedReceipts([]); setLoading(true); setError(""); setFieldErrors({}); setLookupsFailed([]); setRelations({}); setFormTab(0);
    const endpoint = record ? `${resource.endpoint}${record.id}/` : resource.endpoint;
    api.options<Metadata>(endpoint, { signal: controller.signal }).then(async ({ data }) => {
      const info = data.actions?.[record ? "PUT" : "POST"];
      if (!info) throw new Error("Ce formulaire n’est pas disponible pour votre rôle.");
      const editable = Object.fromEntries(Object.entries(info).filter(([name, field]) => !field.read_only && !["definition", "receipt_files", "removed_receipts"].includes(name))
        .sort(([a], [b]) => formFieldOrder(resource.model, a) - formFieldOrder(resource.model, b)));
      setFields(editable);
      setValues(Object.fromEntries(Object.entries(editable).map(([name, field]) => {
        let value: unknown = record?.[name] ?? defaults[name] ?? field.default ?? (name === "project" ? projectId : "");
        if (name === "client_mutation_id" && !value) value = crypto.randomUUID();
        if (name === "status" && record && resource.model === "projects.project") value = undefined;
        if (field.type === "json" && name === 'details' && resource.model === 'budget.expense' && !value) value = [];
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
      const effectiveProject = defaults.project ?? record?.project ?? (expenseForm ? undefined : projectId);
      const results = await Promise.allSettled(Object.entries(editable).filter(([name, field]) => field.related_model && (!fixedFields.includes(name) || (expenseForm && name === 'budget_line'))).map(async ([name, field]) => {
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
        if (expenseForm) {
          const selected = loaded.budget_line?.find(row => String(row.id) === String(record?.budget_line ?? defaults.budget_line));
          if (selected) setValues(current => ({ ...current, currency: selected.currency, project: selected.project }));
        }
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
      if (resource.model === 'budget.expense' && Array.isArray(payload.details) && payload.details.length) {
        payload.amount_excluding_tax = expenseLinesTotal(payload.details);
      }
      if (expenseForm) {
        if (receiptFiles.length) payload.receipt_files = receiptFiles;
        if (removedReceipts.length) payload.removed_receipts = removedReceipts;
      }
      const hasFiles = receiptFiles.length > 0 || Object.values(payload).some((value) => value instanceof File);
      const body = hasFiles ? Object.entries(payload).reduce((form, [key, value]) => {
        if (key === 'receipt_files') (value as File[]).forEach(file => form.append(key, file));
        else if (key === 'removed_receipts') (value as string[]).forEach(id => form.append(key, id));
        else if (value !== null) form.append(key, value instanceof File ? value : fields[key]?.type === 'json' ? JSON.stringify(value) : String(value));
        return form;
      }, new FormData()) : payload;
      const headers = { ...(record ? versionHeaders(record) : {}), ...(hasFiles ? { "Content-Type": "multipart/form-data" } : {}) };
      const response = record ? await api.patch<ApiRecord>(`${resource.endpoint}${record.id}/`, body, { headers })
        : await api.post<ApiRecord>(resource.endpoint, body, { headers });
      if (resource.group === "administration") await refreshMe().catch(() => {});
      setDirty(false); notifyChange(); onSaved(response.data);
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
    setDirty(true);
    const next = { ...current, [name]: value };
    if (resource.model === 'budget.expense' && name === 'details') {
      const rows = JSON.parse(String(value || '[]'));
      if (Array.isArray(rows)) { try { next.amount_excluding_tax = expenseLinesTotal(rows); } catch { next.amount_excluding_tax = ''; } }
    }
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
      next.currency = line?.currency ?? ""; next.project = line?.project ?? ""; next.invoice = "";
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

  const renderField = (name: string, field: FieldInfo) => {
    const stockRequired = resource.model === "resources.stockmovement" && ["source_location", "target_location"].includes(name);
    const common = { label: expenseForm && name === "invoice" ? "Facture liée (facultatif)" : name === "items" ? "Points de contrôle (un par ligne)" : fieldLabel(name), required: stockRequired || (!record && field.required), error: Boolean(fieldErrors[name]), helperText: fieldErrors[name], placeholder: expenseForm && name === 'supplier_name' ? 'Rechercher un fournisseur' : expenseForm && name === 'invoice' ? 'Choisir une facture du même chantier' : undefined, fullWidth: true, size: "small" as const };
    const value = values[name] ?? "";
    if (resource.model === 'budget.invoice' && name === 'file') return <Box key={name} sx={{ gridColumn: '1 / -1', p: 2.5, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
      <Typography fontWeight={700} mb={1}>Fichier de la facture</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>Joignez le PDF ou une photo de la facture. PDF, JPG, PNG ou WebP, 10 Mo maximum.</Typography>
      {Boolean(record?.has_file) && <Box mb={2}><InvoiceAttachment invoice={record!} /></Box>}
      <Button component="label" variant="outlined" disabled={saving}>{record?.has_file ? 'Remplacer le fichier' : 'Choisir un fichier'}<input hidden type="file" aria-label="Fichier de la facture" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={saving} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (!file) return;
        if (file.size > 10 * 1024 * 1024 || !/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) { setFieldErrors(current => ({ ...current, file: 'Choisissez un PDF ou une image de 10 Mo maximum.' })); return; }
        setFieldErrors(current => ({ ...current, file: '' })); update(name, file);
      }} /></Button>
      {value instanceof File && <Stack direction="row" gap={1} alignItems="center" mt={1}><Typography variant="body2">{value.name} · À enregistrer</Typography><Button disabled={saving} onClick={() => update(name, null)}>Annuler le choix</Button></Stack>}
      {fieldErrors.file && <Typography color="error" mt={1}>{fieldErrors.file}</Typography>}
    </Box>;
    if (expenseForm && name === 'supplier_name') return <Autocomplete key={name} freeSolo options={supplierNames} inputValue={String(value)} disabled={saving}
      onInputChange={(_, text) => update(name, text)} renderInput={params => <TextField {...params} {...common} />} />;
    if (name === 'details' && resource.model === 'budget.expense') return <ExpenseDetails key={name} compact={page} disabled={saving} value={String(value)} onChange={(value) => update(name, value)} />;
    if (name === "permissions" && resource.model === "accounts.role") return <RolePermissions key={name} value={String(value)} onChange={(value) => update(name, value)} />;
    if (field.related_model) return <Autocomplete key={name} options={(relations[name] ?? []).filter((row) => relationMatches(name, row, values) && (resource.model !== 'progress.photo' || name !== 'daily_report' || row.status === 'draft') && (!expenseForm || name !== 'invoice' || (['draft', 'validated'].includes(String(row.status)) && row.project === values.project && row.currency === values.currency)))}
      value={(relations[name] ?? []).find((row) => String(row.id) === String(value)) ?? null}
      getOptionLabel={recordTitle} isOptionEqualToValue={(a, b) => a.id === b.id} disabled={saving || fixedFields.includes(name) || lookupsFailed.includes(name)}
      onChange={(_, row) => update(name, row?.id ?? "")}
      noOptionsText="Aucun élément disponible" renderInput={(params) => <TextField {...params} {...common} />} />;
    if (field.type === "boolean") return <FormControlLabel key={name} control={<Checkbox checked={Boolean(value)} onChange={(_, checked) => update(name, checked)} />} label={fieldLabel(name)} />;
    if (["file upload", "image upload"].includes(field.type)) return <Box key={name} sx={{ gridColumn: resource.model === 'workforce.worker' && name.startsWith('identity_document_') ? { xs: '1 / -1', sm: name === 'identity_document_front' ? '1' : '2' } : '1 / -1', minWidth: 0, p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2, '& input[type="file"]': { maxWidth: '100%' } }}>
      <Typography variant="subtitle2" gutterBottom>{fieldLabel(name)}</Typography>
      {resource.model === 'workforce.worker' && name.startsWith('identity_document_') && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Ajoutez une copie de la pièce d’identité (PDF ou image).{Boolean(record?.[name]) && ' Un document est déjà enregistré ; sélectionnez un fichier pour le remplacer.'}</Typography>}
      <input aria-label={fieldLabel(name)} type="file" accept={resource.model === 'workforce.worker' && name.startsWith('identity_document_') ? '.pdf,.jpg,.jpeg,.png,.webp' : undefined} disabled={saving} required={!record && field.required} onChange={(event) => {
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
    return <TextField key={name} {...common} required={common.required && !(resource.model === 'budget.expense' && name === 'amount_excluding_tax' && String(values.details ?? '[]').length > 2)} type={type} value={value} multiline={multiline} minRows={multiline ? 3 : undefined} disabled={saving || (name === "currency" && ["budget.budgetline", "budget.expense"].includes(resource.model))}
      sx={multiline ? { gridColumn: "1 / -1" } : undefined} onChange={(event) => update(name, event.target.value)}
      InputProps={{ readOnly: expenseForm && name === 'amount_excluding_tax' && String(values.details ?? '[]').length > 2 }}
      InputLabelProps={{ shrink: true }} inputProps={{ maxLength: field.max_length, min: field.min_value, max: field.max_value, step: field.type === "integer" ? 1 : "any" }} />;
  };
  const controls = Object.fromEntries(Object.entries(fields).filter(([name]) => (!fixedFields.includes(name) || (expenseForm && page && name === 'budget_line')) && visibleFormField(resource.model, name, values) && !(record && name === "status" && resource.model === "projects.project") && !["mime_type", "size", "checksum"].includes(name)).map(([name, field]) => [name, renderField(name, field)]));

  if (expenseForm && page) return <Box component="form" onSubmit={submit} sx={{ color: '#202936', bgcolor: '#f4f5f7', borderRadius: 2, p: { xs: 2, md: 3 }, '& .MuiInputLabel-root': { position: 'static', transform: 'none', fontSize: 13, fontWeight: 500, color: '#202936', mb: .75, maxWidth: '100%' }, '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }, '& .MuiOutlinedInput-root': { bgcolor: '#fff', fontSize: 14, borderRadius: 1, minHeight: 44 }, '& .MuiButton-root': { textTransform: 'none' } }}>
    <Button type="button" disabled={saving} onClick={close} sx={{ p: 0, mb: 1, color: '#667085', fontSize: 13 }}>‹ Retour aux dépenses</Button>
    <Stack direction="row" gap={1.5} alignItems="center" mb={1.5}><Typography component="h1" fontSize={{ xs: 20, md: 22 }} fontWeight={750}>{record ? 'Modifier la dépense' : 'Nouvelle dépense'}</Typography><Chip size="small" label="Brouillon" sx={{ bgcolor: '#e8edf3', color: '#475467', height: 23, fontSize: 11, fontWeight: 700 }} /></Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {lookupsFailed.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>Listes indisponibles : {lookupsFailed.map(fieldLabel).join(', ')}.</Alert>}
    {loading ? <Stack alignItems="center" py={6}><CircularProgress /></Stack> : <ExpensePageLayout controls={controls} values={values} relations={relations} receipts={<ExpenseReceipts expenseId={record?.id ? String(record.id) : undefined} receipts={(record?.receipts || []) as Receipt[]} files={receiptFiles} removed={removedReceipts} disabled={saving} onFiles={files => { setReceiptFiles(files); setDirty(true); }} onRemoved={ids => { setRemovedReceipts(ids); setDirty(true); }} />} />}
    <Stack direction="row" gap={1.5} justifyContent="flex-end" mt={2.5} flexWrap="wrap"><Button variant="outlined" disabled={saving} onClick={close}>Annuler</Button><Button variant="contained" type="submit" disabled={loading || saving || !Object.keys(fields).length} sx={{ bgcolor: '#216e58', '&:hover': { bgcolor: '#195844' } }}>{saving ? 'Enregistrement…' : record ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'}</Button></Stack>
  </Box>;
  const content = (
    <Box component="form" onSubmit={submit} sx={{ display: "flex", flexDirection: "column", minHeight: 0, maxHeight: page ? undefined : "90dvh" }} onInvalidCapture={(event) => {
      event.preventDefault(); setFormTab(0); setError("Veuillez compléter les champs obligatoires et vérifier les valeurs saisies.");
      const input = event.target as HTMLInputElement; setTimeout(() => input.focus(), 0);
    }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, ...(businessForm ? { px: 3.5, py: 2.5, borderBottom: '1px solid #e2e5e9' } : {}) }}>
        {businessForm ? <Box><Typography component="span" display="block" fontSize={20} fontWeight={750}>{expenseForm ? (record ? 'Modifier la dépense' : 'Nouvelle dépense') : 'Pointage du personnel'}</Typography><Typography component="span" display="block" fontSize={13} color="#66707d" mt={.35}>{expenseForm ? `${record ? statusLabels[String(record.status)] ?? 'Dépense' : 'Brouillon'} · Renseignez les postes et montants de la dépense` : 'Renseignez les heures du collaborateur pour la journée'}</Typography></Box> : <span>{record ? "Modifier" : "Créer"} · {resource.singular}</span>}{page ? <Button type="button" disabled={saving} onClick={close}>Retour</Button> : <IconButton type="button" aria-label="Fermer le formulaire" disabled={saving} onClick={close} size="small" sx={{ color: "inherit" }}><CloseIcon fontSize="small" /></IconButton>}
      </DialogTitle>
      <DialogContent sx={{ overflowY: "auto", minHeight: 0, ...(businessForm ? { px: { xs: 2, sm: 3.5 }, py: '24px !important', minHeight: { sm: 420 } } : {}) }}>
        {!compact && !businessForm && <Tabs value={formTab} onChange={(_, value) => setFormTab(value)} aria-label="Étapes du formulaire" sx={{ mb: 2.5 }}><Tab label="Informations" id="record-form-information" aria-controls="record-form-fields" /><Tab label="Récapitulatif" id="record-form-summary" aria-controls="record-form-review" disabled={loading} /></Tabs>}
        {!businessForm && <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Les champs marqués d’un astérisque sont obligatoires.</Typography>}
        {!businessForm && formHints[resource.model] && <Alert severity="info" sx={{ mb: 2 }}>{formHints[resource.model]}</Alert>}
        {fixedFields.length > 0 && <Typography variant="caption" color="primary.main" component="p" mb={2}>Cet élément est rattaché à la fiche ouverte.</Typography>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {lookupsFailed.length > 0 && <Alert severity="warning" sx={{ mb: 2 }}>Certaines listes sont indisponibles : {lookupsFailed.map(fieldLabel).join(", ")}. Vérifiez vos accès et réessayez.</Alert>}
        {loading ? <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack> :
          <Box id="record-form-fields" role={businessForm ? undefined : 'tabpanel'} aria-labelledby={businessForm ? undefined : 'record-form-information'} hidden={formTab !== 0} sx={{ display: formTab === 0 ? "grid" : "none", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
            {businessForm ? <Box sx={{ gridColumn: "1 / -1" }}><BusinessFormLayout model={resource.model} controls={controls} values={values} relations={relations} /></Box> : Object.values(controls)}
          </Box>}
        {!loading && formTab === 1 && <Box id="record-form-review" role="tabpanel" aria-labelledby="record-form-summary" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          {Object.entries(fields).filter(([name]) => !fixedFields.includes(name) && visibleFormField(resource.model, name, values) && !["mime_type", "size", "checksum"].includes(name)).map(([name, field]) => {
            const value = values[name];
            if (name === 'details' && resource.model === 'budget.expense') return <Box key={name} sx={{ gridColumn: '1 / -1' }}><ExpenseDetailsView rows={JSON.parse(String(value || '[]'))} /></Box>;
            const related = field.related_model ? relations[name]?.find((row) => String(row.id) === String(value)) : undefined;
            const label = related ? recordTitle(related) : value instanceof File ? value.name : field.type === "json" ? "Données structurées renseignées" : formatValue(value, name);
            return <Box key={name} sx={{ p: 1.5, bgcolor: "#f3f7f1", borderRadius: 1, minWidth: 0 }}><Typography variant="caption" color="text.secondary">{fieldLabel(name)}</Typography><Typography variant="body2" sx={{ mt: .5, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{label}</Typography></Box>;
          })}
        </Box>}
        {!loading && linePreview && <PaperTotal value={linePreview} />}
      </DialogContent>
      <DialogActions sx={{ flexShrink: 0, ...(businessForm ? { px: 3.5, py: 2, bgcolor: '#f9fafb', borderTop: '1px solid #e2e5e9', flexWrap: 'wrap', gap: 1 } : {}) }}><Button onClick={close} disabled={saving} sx={businessForm ? { mr: 'auto', color: '#626c78' } : undefined}>Annuler</Button>
        {timeForm && <Typography fontSize={12} color="#66707d" sx={{ mr: 1 }}>{values.worker ? '1 collaborateur renseigné' : 'Aucun collaborateur sélectionné'}</Typography>}
        {allowRepeat && !record && <Button type="submit" data-continue="true" disabled={loading || saving} variant="outlined">Enregistrer et ajouter une autre</Button>}
        <Button variant="contained" type="submit" disabled={loading || saving || !Object.keys(fields).length}>{saving ? "Enregistrement…" : expenseForm ? (record ? 'Enregistrer les modifications' : 'Enregistrer le brouillon') : timeForm ? 'Enregistrer le pointage' : "Enregistrer"}</Button>
      </DialogActions>
    </Box>
  );
  if (page) return <Box sx={{ ...(businessForm ? businessDialogSx : {}), width: '100%', maxWidth: '100%', m: 0, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', '& .MuiDialogTitle-root': { px: 3, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }, '& .MuiDialogContent-root': { p: 3, overflow: 'visible' }, '& .MuiDialogActions-root': { p: 2.5, bgcolor: '#f9fafb', borderTop: '1px solid', borderColor: 'divider' } }}>{content}</Box>;
  return <Dialog open={open} onClose={saving ? undefined : close} fullWidth maxWidth={businessForm ? false : compact ? "sm" : "md"} PaperProps={businessForm ? { sx: businessDialogSx } : undefined} sx={businessForm ? { '& .MuiBackdrop-root': { bgcolor: 'rgba(35,45,60,.24)', backdropFilter: 'none' } } : undefined}>{content}</Dialog>;
}

function PaperTotal({ value }: { value: string }) {
  return <Box sx={{ mt: 3, p: 2, bgcolor: "#edf5f1", borderRadius: 2 }}><Typography variant="caption" color="text.secondary">Total de la ligne</Typography><Typography variant="h6">{value}</Typography></Box>;
}
