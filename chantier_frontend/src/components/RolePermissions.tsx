import { Box, Checkbox, FormControlLabel, Paper, Stack, Typography } from "@mui/material";
import { resources } from "../resources";

const actions = [["read", "Consulter"], ["create", "Créer"], ["update", "Modifier"], ["delete", "Supprimer"], ["validate", "Valider"]];
export function RolePermissions({ value, onChange, readOnly = false }: { value: string; onChange: (value: string) => void; readOnly?: boolean }) {
  let permissions: Record<string, string[]> = {};
  try {
    const parsed = JSON.parse(value || "{}");
    permissions = Object.fromEntries(Object.entries(parsed ?? {}).filter(([, values]) => Array.isArray(values)).map(([key, values]) => [key, (values as unknown[]).filter((item): item is string => typeof item === "string")]));
  } catch { /* Show an empty matrix until corrected. */ }
  const groups = [...resources.filter((item, index) => item.group !== "administration" && resources.findIndex((other) => other.group === item.group) === index), { group: "accounts", label: "Appareils connectés" }];
  const toggle = (group: string, action: string, checked: boolean) => {
    // Expand CRUD and wildcard grants before changing a single permission.
    const normalized: Record<string, string[]> = {};
    for (const item of groups) {
      const existing = [...(permissions[item.group] ?? []), ...(permissions["*"] ?? [])];
      normalized[item.group] = [...new Set(existing.flatMap((permission) => permission === "crud" ? ["read", "create", "update", "delete"] : [permission]))];
    }
    for (const [key, values] of Object.entries(permissions)) if (key !== "*" && !normalized[key]) normalized[key] = values;
    const allowed = new Set(normalized[group] ?? []);
    if (checked) allowed.add(action); else allowed.delete(action);
    normalized[group] = [...allowed];
    onChange(JSON.stringify(normalized));
  };
  return <Box sx={{ gridColumn: "1 / -1" }}><Typography variant="subtitle2" mb={1}>Autorisations par module</Typography>
    <Typography variant="body2" color="text.secondary" mb={2}>La validation est un droit distinct. Les rôles et adhésions sont réservés aux administrateurs de l’entreprise.</Typography>
    <Stack spacing={1}>{groups.map((item) => {
      const allowed = [...(permissions[item.group] ?? []), ...(permissions["*"] ?? [])];
      return <Paper key={item.group} variant="outlined" sx={{ px: 2, py: 1 }}><Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }}>
        <Typography variant="body2" fontWeight={600} minWidth={150}>{item.label}</Typography><Stack direction="row" flexWrap="wrap">
          {actions.map(([action, label]) => <FormControlLabel key={action} sx={{ mr: 1 }} control={<Checkbox size="small" disabled={readOnly} checked={allowed.includes(action) || (allowed.includes("crud") && action !== "validate")} onChange={(_, checked) => toggle(item.group, action, checked)} inputProps={{ "aria-label": `${item.label} : ${label}` }} />} label={<Typography variant="caption">{label}</Typography>} />)}
          {item.group === "documents" && <FormControlLabel control={<Checkbox size="small" disabled={readOnly} checked={allowed.includes("read_shared")} onChange={(_, checked) => toggle(item.group, "read_shared", checked)} />} label={<Typography variant="caption">Accès aux documents partagés</Typography>} />}
        </Stack>
      </Stack></Paper>;
    })}</Stack>
  </Box>;
}
