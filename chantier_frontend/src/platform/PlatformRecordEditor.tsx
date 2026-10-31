import { FormTextField as TextField } from '../components/FormTextField';
import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch} from "@mui/material";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, notifyChange } from "../api/workspace";

export type PlatformField = { name: string; label: string; type?: "text" | "email" | "password" | "boolean"; required?: boolean; default?: string | boolean; maxLength?: number };

export function PlatformRecordEditor({ title, endpoint, fields, record, open, onClose, onSaved }: { title: string; endpoint: string; fields: PlatformField[]; record?: ApiRecord; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(fields.map((field) => [field.name, field.type === "password" ? "" : record?.[field.name] ?? field.default ?? (field.type === "boolean" ? true : "")])));
    setError("");
  }, [open, record]);
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <Box component="form" onSubmit={async (event) => {
      event.preventDefault(); setSaving(true); setError("");
      try {
        const payload = Object.fromEntries(fields.filter((field) => field.type !== "password" || values[field.name]).map((field) => [field.name, typeof values[field.name] === "string" && field.type !== "password" ? String(values[field.name]).trim() : values[field.name]]));
        if (record) await api.patch(`${endpoint}${record.id}/`, payload); else await api.post(endpoint, payload);
        notifyChange(); onSaved(); onClose();
      } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
    }}>
      <DialogTitle>{record ? "Modifier" : "Créer"} · {title}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: "grid", gap: 2 }}>
          {fields.map((field) => field.type === "boolean" ? <FormControlLabel key={field.name} label={field.label} control={<Switch checked={Boolean(values[field.name])} disabled={saving} onChange={(_, checked) => setValues((current) => ({ ...current, [field.name]: checked }))} />} /> : <TextField key={field.name} fullWidth label={field.label} type={field.type ?? "text"} value={values[field.name] ?? ""} required={field.required && !(record && field.type === "password")} disabled={saving} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} inputProps={{ maxLength: field.maxLength }} autoComplete={field.type === "password" ? "new-password" : "off"} helperText={field.type === "password" && record ? "Laisser vide pour conserver le mot de passe actuel." : undefined} />)}
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={onClose} disabled={saving}>Annuler</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></DialogActions>
    </Box>
  </Dialog>;
}
