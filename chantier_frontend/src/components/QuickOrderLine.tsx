import { FormEvent, useEffect, useState } from "react";
import { Alert, Autocomplete, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection, formatValue, notifyChange, recordTitle } from "../api/workspace";
import { orderLineTotal } from "../api/workflows";

export function QuickOrderLine({ order, onClose, onSaved }: { order: ApiRecord; onClose: () => void; onSaved: () => void }) {
  const [materials, setMaterials] = useState<ApiRecord[]>([]);
  const [material, setMaterial] = useState<ApiRecord | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("BIF");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetchCollection("/resources/materials/", {}, controller.signal).then(setMaterials)
      .catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  let total = "—";
  try { if (quantity && price) total = formatValue(orderLineTotal({ quantity, unit_price: price }), "amount"); } catch { /* API validation also checks decimals. */ }
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !material) return;
    const again = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-continue") === "true";
    setBusy(true); setError("");
    try {
      await api.post("/resources/purchase-order-lines/", { purchase_order: order.id, material: material.id, quantity, unit_price: price, currency });
      notifyChange(); onSaved();
      if (again) { setMaterial(null); setQuantity(""); setPrice(""); }
      else onClose();
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <Box component="form" onSubmit={save} sx={{ p: 2, bgcolor: "#f3f7f1", borderBottom: 1, borderColor: "divider" }}>
    <Typography variant="subtitle2" mb={2}>Ajouter un matériau à cette commande</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 1.5 }}>
      <Autocomplete options={materials} loading={loading} disabled={busy || loading} value={material} getOptionLabel={recordTitle} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_, row) => { setMaterial(row); setPrice(String(row?.unit_price ?? "")); setCurrency(String(row?.currency ?? "BIF")); }} renderInput={(props) => <TextField {...props} label="Matériau" size="small" required helperText={material?.unit ? `Unité : ${material.unit}` : ""} />} />
      <TextField label="Quantité" size="small" type="number" required value={quantity} disabled={busy} onChange={(event) => setQuantity(event.target.value)} inputProps={{ min: .001, step: .001 }} />
      <TextField label="Prix unitaire" size="small" type="number" required value={price} disabled={busy} onChange={(event) => setPrice(event.target.value)} inputProps={{ min: 0, step: .01 }} />
      <TextField label="Devise" size="small" required value={currency} disabled={busy} onChange={(event) => setCurrency(event.target.value.toUpperCase())} inputProps={{ maxLength: 3, minLength: 3 }} />
    </Box>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} mt={2} flexWrap="wrap"><Typography variant="body2">Total : <strong>{total} {currency}</strong></Typography><Stack direction="row" gap={1}>
      <Button disabled={busy} onClick={onClose}>Annuler</Button><Button type="submit" data-continue="true" disabled={busy || !material} variant="outlined">Ajouter et continuer</Button><Button type="submit" disabled={busy || !material} variant="contained">Ajouter la ligne</Button>
    </Stack></Stack>
  </Box>;
}
