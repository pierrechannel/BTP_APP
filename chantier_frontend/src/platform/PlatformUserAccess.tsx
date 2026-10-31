import { FormTextField as TextField } from '../components/FormTextField';
import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Stack, Typography } from "@mui/material";
import { ApiRecord } from "../api/types";
import { api } from "../api/client";
import { errorMessage, fetchCollection, notifyChange } from "../api/workspace";

export function PlatformUserAccess({ user, onClose, onSaved }: { user: ApiRecord; onClose: () => void; onSaved: () => void }) {
  const [tenants, setTenants] = useState<ApiRecord[]>([]);
  const [memberships, setMemberships] = useState<ApiRecord[]>([]);
  const [roles, setRoles] = useState<ApiRecord[]>([]);
  const [tenant, setTenant] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    Promise.all([fetchCollection("/auth/platform/tenants/", {}, controller.signal), fetchCollection("/auth/platform/memberships/", { user: user.id }, controller.signal)])
      .then(([companies, access]) => { setTenants(companies); setMemberships(access); })
      .catch((err) => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id, revision]);
  useEffect(() => {
    setRoles([]); setRole("");
    if (!tenant) return;
    const controller = new AbortController();
    fetchCollection("/auth/platform/roles/", { tenant }, controller.signal).then((items) => {
      setRoles(items);
      const existing = memberships.find((item) => String(item.tenant) === tenant);
      setRole(String(existing?.role ?? items[0]?.id ?? ""));
    }).catch((err) => { if (!controller.signal.aborted) setError(errorMessage(err)); });
    return () => controller.abort();
  }, [tenant, memberships]);
  const saved = () => { notifyChange(); setRevision((value) => value + 1); onSaved(); setMessage("Accès enregistré."); };
  return <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>Accès aux entreprises · {String(user.email)}</DialogTitle>
    <DialogContent dividers>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {Boolean(user.is_superuser) && <Alert severity="info" sx={{ mb: 2 }}>Ce compte superadministrateur dispose déjà d’un accès global à la plateforme.</Alert>}
      <Stack spacing={2} divider={<Divider />} mb={3}>
        {memberships.map((item) => <Stack key={item.id} direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Box><Typography fontWeight={600}>{String(item.tenant_name)}</Typography><Typography variant="body2" color="text.secondary">{String(item.role_name)} · {item.is_active ? "Actif" : "Suspendu"}</Typography></Box>
          <Button size="small" disabled={saving || loading} onClick={async () => {
            setSaving(true); setError("");
            try { await api.patch(`/auth/platform/memberships/${item.id}/`, { is_active: !item.is_active }); saved(); }
            catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
          }}>{item.is_active ? "Suspendre" : "Réactiver"}</Button>
        </Stack>)}
        {!loading && !memberships.length && <Typography color="text.secondary">Aucun accès à une entreprise.</Typography>}
      </Stack>
      <Typography variant="subtitle2" mb={2}>Attribuer ou modifier un rôle</Typography>
      <Stack spacing={2}>
        <TextField select label="Entreprise" value={tenant} disabled={loading || saving} onChange={(event) => setTenant(event.target.value)}>
          {tenants.map((item) => <MenuItem key={item.id} value={String(item.id)}>{String(item.name)}{item.is_active ? "" : " (inactive)"}</MenuItem>)}
        </TextField>
        <TextField select label="Rôle" value={role} disabled={!tenant || saving || !roles.length} onChange={(event) => setRole(event.target.value)}>
          {roles.map((item) => <MenuItem key={item.id} value={String(item.id)}>{String(item.name)}</MenuItem>)}
        </TextField>
        {tenant && !loading && !roles.length && <Typography variant="caption" color="text.secondary">Aucun rôle disponible. Les rôles se gèrent dans l’administration de l’entreprise.</Typography>}
      </Stack>
    </DialogContent>
    <DialogActions><Button disabled={saving} onClick={onClose}>Fermer</Button><Button variant="contained" disabled={!role || !tenant || loading || saving} onClick={async () => {
      setSaving(true); setError(""); setMessage("");
      try {
        const existing = memberships.find((item) => String(item.tenant) === tenant);
        if (existing) await api.patch(`/auth/platform/memberships/${existing.id}/`, { role, is_active: true });
        else await api.post("/auth/platform/memberships/", { user: user.id, tenant, role, is_active: true });
        saved();
      } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
    }}>{saving ? "Enregistrement…" : "Enregistrer l’accès"}</Button></DialogActions>
  </Dialog>;
}
