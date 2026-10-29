import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { ApiRecord } from "../api/types";
import { FieldInfo, fieldLabel, formatValue, recordTitle } from "../api/workspace";
import { ResourceConfig } from "../resources";
import { RelatedValue } from "./RelatedValue";
import { StatusBadge } from "./StatusBadge";

export function RecordQuickView({ record, resource, fields, onClose }: {
  record: ApiRecord | null; resource: ResourceConfig; fields: Record<string, FieldInfo>; onClose: () => void;
}) {
  return <Dialog open={Boolean(record)} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="quick-record-title">
    <DialogTitle id="quick-record-title" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
      <Box minWidth={0}><Typography component="span" fontWeight={700}>Détail · {resource.singular}</Typography><Typography variant="caption" sx={{ display: "block", color: "#cfdfd0", mt: .5 }}>{record ? recordTitle(record) : ""}</Typography></Box>
      <IconButton onClick={onClose} size="small" aria-label="Fermer le détail" sx={{ color: "inherit" }}><CloseIcon fontSize="small" /></IconButton>
    </DialogTitle>
    <DialogContent><Box component="dl" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, m: 0 }}>
      {record && Object.entries(record).filter(([name, value]) => !["id", "tenant", "deleted_at", "version", "created_by", "updated_by", "file", "image", "result_file", "checksum", "push_token"].includes(name) && value !== null && value !== "").map(([name, value]) => <Box key={name} sx={{ minWidth: 0, ...(typeof value === "object" || ["body", "description", "work_done"].includes(name) ? { gridColumn: "1 / -1" } : {}) }}>
        <Typography component="dt" variant="caption" color="text.secondary" mb={.5}>{fieldLabel(name)}</Typography>
        <Box component="dd" m={0} sx={{ overflowWrap: "anywhere" }}>{fields[name]?.related_model ? <RelatedValue model={fields[name].related_model!} id={value} /> : ["status", "state"].includes(name) ? <StatusBadge value={value} /> : <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", ...(typeof value === "object" ? { bgcolor: "#f3f7f1", p: 1.5, borderRadius: 1, fontFamily: "monospace", fontSize: 12 } : {}) }}>{formatValue(value, name)}</Typography>}</Box>
      </Box>)}
    </Box></DialogContent>
    <DialogActions><Button onClick={onClose}>Fermer</Button>{record && <Button component={RouterLink} to={`${resource.path}/${record.id}`} variant="contained">Ouvrir la fiche complète</Button>}</DialogActions>
  </Dialog>;
}
