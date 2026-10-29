import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import { ApiRecord } from "../api/types";
import { FieldInfo, fieldLabel, formatValue } from "../api/workspace";
import { RelatedValue } from "./RelatedValue";
import { RolePermissions } from "./RolePermissions";
import { StatusBadge } from "./StatusBadge";

const hidden = new Set(["id", "tenant", "deleted_at", "created_by", "updated_by", "version", "created_at", "updated_at", "file", "image", "result_file", "checksum", "push_token"]);
const sections = [
  { key: "identity", label: "Informations générales", icon: <InfoOutlinedIcon fontSize="small" /> },
  { key: "relations", label: "Rattachements et intervenants", icon: <AccountTreeOutlinedIcon fontSize="small" /> },
  { key: "finance", label: "Montants et quantités", icon: <PaymentsOutlinedIcon fontSize="small" /> },
  { key: "dates", label: "Dates et échéances", icon: <EventOutlinedIcon fontSize="small" /> },
  { key: "notes", label: "Notes et informations complémentaires", icon: <NotesOutlinedIcon fontSize="small" /> },
];

function group(name: string, value: unknown, field?: FieldInfo) {
  if (field?.related_model) return "relations";
  if (typeof value === "object" || ["description", "notes", "body", "work_done", "difficulties", "comment"].includes(name)) return "notes";
  if (/date|_at$/.test(name)) return "dates";
  if (/amount|cost|price|rate|hours|quantity|currency|counter_value|score|progress_percent/.test(name)) return "finance";
  return "identity";
}

export function DetailInformation({ record, model, fields }: { record: ApiRecord; model: string; fields: Record<string, FieldInfo> }) {
  const entries = Object.entries(record).filter(([name, value]) => !hidden.has(name) && value !== null && value !== undefined && value !== "");
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2, alignItems: "start" }}>
    {sections.map((section) => {
      const values = entries.filter(([name, value]) => group(name, value, fields[name]) === section.key);
      if (!values.length) return null;
      return <Paper key={section.key} variant="outlined" component="section" aria-label={section.label} sx={{ overflow: "hidden", ...(section.key === "notes" ? { gridColumn: "1 / -1" } : {}) }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2.5, py: 1.75, bgcolor: "#f3f7f1", color: "primary.main" }}>{section.icon}<Typography variant="subtitle2" fontWeight={700}>{section.label}</Typography></Stack><Divider />
        <Box component="dl" sx={{ m: 0, p: 2.5, display: "grid", gridTemplateColumns: section.key === "notes" ? "1fr" : { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
          {values.map(([name, value]) => <Box key={name} minWidth={0}>
            <Typography component="dt" variant="caption" color="text.secondary" mb={.75}>{fieldLabel(name)}</Typography>
            <Box component="dd" m={0} sx={{ overflowWrap: "anywhere" }}>
              {name === "permissions" && model === "accounts.role" ? <RolePermissions value={JSON.stringify(value)} onChange={() => {}} readOnly />
                : fields[name]?.related_model ? <RelatedValue model={fields[name].related_model!} id={value} />
                : ["status", "state"].includes(name) ? <StatusBadge value={value} />
                : name === "items" && Array.isArray(value) ? <Stack spacing={1}>{value.map((item, index) => <Typography variant="body2" key={index}>{index + 1}. {typeof item === "string" ? item : String(item?.label ?? "")}</Typography>)}</Stack>
                : <Typography variant="body2" fontWeight={section.key === "notes" ? 400 : 600} sx={{ whiteSpace: "pre-wrap", ...(typeof value === "object" ? { fontFamily: "monospace", fontSize: 12, bgcolor: "#f7faf5", p: 1.5, borderRadius: 1 } : {}) }}>{formatValue(value, name)}</Typography>}
            </Box>
          </Box>)}
        </Box>
      </Paper>;
    })}
  </Box>;
}

export function RecordTracking({ record }: { record: ApiRecord }) {
  const names = ["created_at", "updated_at", "created_by", "updated_by", "version"].filter((name) => record[name] !== null && record[name] !== undefined);
  return <Paper variant="outlined" component="section" sx={{ p: 2.5 }}><Typography variant="subtitle2" fontWeight={700} mb={2}>Suivi de la fiche</Typography>
    {!names.length && <Typography variant="body2" color="text.secondary">Aucune information de suivi disponible pour cette fiche.</Typography>}
    <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
      {names.map((name) => <Box key={name}>
        <Typography component="dt" variant="caption" color="text.secondary" mb={.75}>{name === "created_by" ? "Créé par" : name === "updated_by" ? "Modifié par" : fieldLabel(name)}</Typography>
        <Box component="dd" m={0}>{name.endsWith("_by") ? <RelatedValue model="accounts.user" id={record[name]} /> : <Typography variant="body2" fontWeight={600}>{name.endsWith("_at") && !Number.isNaN(Date.parse(String(record[name]))) ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(String(record[name]))) : formatValue(record[name], name)}</Typography>}</Box>
      </Box>)}
    </Box>
  </Paper>;
}
