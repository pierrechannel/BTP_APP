import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useMediaQuery, useTheme } from "@mui/material";
import { QuickOrderLine } from "./QuickOrderLine";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection, formatValue, notifyChange, versionHeaders } from "../api/workspace";
import { orderLineTotal, orderTotals } from "../api/workflows";
import { resourceByModel } from "../resources";
import { useWorkspace } from "../state/workspace";
import { RecordEditor } from "./RecordEditor";
import { RelatedValue } from "./RelatedValue";

export function PurchaseOrderLines({ order, revision }: { order: ApiRecord; revision: number }) {
  const resource = resourceByModel["resources.purchaseorderline"];
  const { can } = useWorkspace();
  const desktop = useMediaQuery(useTheme().breakpoints.up("md"));
  const editable = order.status === "draft";
  const [quick, setQuick] = useState(false);
  const [rows, setRows] = useState<ApiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [localRevision, setRevision] = useState(0);
  const [editing, setEditing] = useState<ApiRecord | true | null>(null);
  const [deleting, setDeleting] = useState<ApiRecord | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    fetchCollection(resource.endpoint, { purchase_order: order.id }, controller.signal)
      .then(setRows).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [order.id, revision, localRevision]);
  let totals: ReturnType<typeof orderTotals> = [];
  let totalsError = "";
  try { totals = orderTotals(rows); } catch { totalsError = "Certaines lignes ont une quantité ou un prix invalide. Corrigez-les pour obtenir un total fiable."; }
  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError("");
    try {
      await api.delete(`${resource.endpoint}${deleting.id}/`, { headers: versionHeaders(deleting) });
      notifyChange(); setDeleting(null); setRevision((value) => value + 1); setMessage("La ligne a été supprimée.");
    } catch (error) { setError(errorMessage(error)); setDeleting(null); }
    finally { setBusy(false); }
  };
  return <Paper variant="outlined" sx={{ overflow: "hidden" }}>
    <Stack direction={{ xs: "column", sm: "row" }} gap={2} justifyContent="space-between" alignItems={{ sm: "center" }} p={{ xs: 2, sm: 3 }}>
      <Box><Typography variant="h6">Lignes de commande {!loading && <Chip size="small" label={rows.length} sx={{ ml: 1 }} />}</Typography>
        <Typography variant="body2" color="text.secondary" mt={.5}>Matériaux, quantités et prix de ce bon de commande.</Typography></Box>
      {editable && can("resources", "create") && <Button variant="contained" startIcon={<AddIcon />} onClick={() => desktop ? setQuick(true) : setEditing(true)}>Ajouter une ligne</Button>}
    </Stack>
    <Divider />{loading && <LinearProgress />}
    {!editable && <Alert severity="info">Les lignes sont verrouillées après l’envoi ou la finalisation de la commande.</Alert>}
    {editable && quick && desktop && <QuickOrderLine order={order} onClose={() => setQuick(false)} onSaved={() => { setRevision((value) => value + 1); setMessage("La ligne de commande a été enregistrée."); }} />}
    {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
    {error && <Alert severity="error" action={<Button onClick={() => setRevision((value) => value + 1)}>Réessayer</Button>}>{error}</Alert>}
    {totalsError && <Alert severity="warning">{totalsError}</Alert>}
    {!loading && !error && !rows.length ? <Stack spacing={1} alignItems="center" p={5} textAlign="center">
      <Typography fontWeight={600}>Ce bon de commande n’a pas encore de lignes</Typography>
      <Typography color="text.secondary" variant="body2">Ajoutez les matériaux à commander. La commande est déjà sélectionnée dans le formulaire.</Typography>
    </Stack> : <><Stack sx={{ display: { xs: "flex", sm: "none" }, p: 2 }} spacing={2}>
      {rows.map((line) => <Paper key={line.id} variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} gap={1}>
          <Box minWidth={0}><RelatedValue model="resources.material" id={line.material} /></Box>
          <Stack direction="row" gap={.5}>
            {editable && can("resources", "update") && <Button size="small" onClick={() => setEditing(line)}>Modifier</Button>}
            {editable && can("resources", "delete") && <Button size="small" color="error" aria-label="Supprimer la ligne" sx={{ minWidth: 40 }} onClick={() => setDeleting(line)}><DeleteOutlineIcon fontSize="small" /></Button>}
          </Stack>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          <Box><Typography variant="caption" color="text.secondary">Quantité</Typography><Typography variant="body2">{Number(line.quantity).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} {String(line.unit ?? "")}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Prix unitaire</Typography><Typography variant="body2">{formatValue(line.unit_price, "unit_price")} {String(line.currency)}</Typography></Box>
          <Box sx={{ gridColumn: "1 / -1", pt: 1, borderTop: 1, borderColor: "divider" }}><Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Total</Typography><Typography variant="body2" fontWeight={700}>{totalsError ? "—" : `${formatValue(orderLineTotal(line), "amount")} ${line.currency}`}</Typography></Stack></Box>
        </Box>
      </Paper>)}
    </Stack><TableContainer sx={{ display: { xs: "none", sm: "block" } }}><Table size="small" aria-label="Lignes de ce bon de commande" sx={{ minWidth: 640 }}>
      <TableHead><TableRow>{["Matériau", "Unité", "Quantité", "Prix unitaire", "Total", "Actions"].map((label) => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{rows.map((line) => <TableRow key={line.id} hover>
        <TableCell><RelatedValue model="resources.material" id={line.material} /></TableCell>
        <TableCell>{String(line.unit ?? "—")}</TableCell>
        <TableCell>{Number(line.quantity).toLocaleString("fr-FR", { maximumFractionDigits: 3 })}</TableCell>
        <TableCell>{formatValue(line.unit_price, "unit_price")} {String(line.currency)}</TableCell>
        <TableCell sx={{ fontWeight: 700 }}>{totalsError ? "—" : `${formatValue(orderLineTotal(line), "amount")} ${line.currency}`}</TableCell>
        <TableCell><Stack direction="row" spacing={.5}>
          {editable && can("resources", "update") && <Button size="small" aria-label="Modifier la ligne" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(line)}>Modifier</Button>}
          {editable && can("resources", "delete") && <Button size="small" color="error" aria-label="Supprimer la ligne" onClick={() => setDeleting(line)}><DeleteOutlineIcon fontSize="small" /></Button>}
          {!can("resources", "update") && <Button component={RouterLink} to={`${resource.path}/${line.id}`}>Ouvrir</Button>}
        </Stack></TableCell>
      </TableRow>)}</TableBody>
    </Table></TableContainer></>}
    {totals.length > 0 && <Stack direction="row" gap={2} flexWrap="wrap" justifyContent="flex-end" sx={{ p: 3, bgcolor: "#f6f9f5", borderTop: 1, borderColor: "divider" }}>
      {totals.map((item) => <Box key={item.currency} minWidth={160}><Typography variant="caption" color="text.secondary">Total des lignes · {item.currency}</Typography><Typography variant="h5">{formatValue(item.total, "amount")} <Typography component="span" variant="body2">{item.currency}</Typography></Typography></Box>)}
    </Stack>}
    <Box p={2}><Typography variant="caption" color="text.secondary" component="p">Les devises sont totalisées séparément. Les réceptions en stock sont enregistrées dans les mouvements de stock.</Typography><Button size="small" component={RouterLink} to="/resources/movements" sx={{ px: 0, mt: .5 }}>Ouvrir les mouvements de stock</Button></Box>
    <RecordEditor resource={resource} record={editing && editing !== true ? editing : undefined} open={Boolean(editing)} defaults={{ purchase_order: order.id }} fixedFields={["purchase_order"]} compact allowRepeat onClose={() => setEditing(null)} onSaved={() => { setRevision((value) => value + 1); setMessage("La ligne de commande a été enregistrée."); }} />
    <Dialog open={Boolean(deleting)} onClose={busy ? undefined : () => setDeleting(null)} fullWidth maxWidth="xs">
      <DialogTitle>Supprimer cette ligne ?</DialogTitle><DialogContent>Le total du bon de commande sera recalculé.</DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setDeleting(null)}>Annuler</Button><Button disabled={busy} color="error" variant="contained" onClick={remove}>Supprimer</Button></DialogActions>
    </Dialog>
  </Paper>;
}
