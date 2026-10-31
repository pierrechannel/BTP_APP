import { FormTextField as TextField } from './FormTextField';
import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Paper, Stack, Typography } from "@mui/material";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { downloadFile, errorMessage, fetchCollection } from "../api/workspace";

export function DocumentPreview({ record, isVersion = false, revision, modalOnly = false, onClose }: { record: ApiRecord; isVersion?: boolean; revision: number; modalOnly?: boolean; onClose?: () => void }) {
  const [versions, setVersions] = useState<ApiRecord[]>([]);
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(modalOnly);
  const [preview, setPreview] = useState<{ url: string; kind: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const version = versions.find((item) => String(item.id) === selected);

  useEffect(() => { setOpen(modalOnly); }, [record.id, modalOnly]);
  const close = () => { setOpen(false); onClose?.(); };

  useEffect(() => {
    const controller = new AbortController();
    setVersions([]); setSelected(""); setError(""); setLoading(true); setPreview(null);
    const request = isVersion ? Promise.resolve([record]) : fetchCollection("/documents/versions/", { document: record.id }, controller.signal);
    request.then((rows) => {
      if (controller.signal.aborted) return;
      setVersions(rows);
      setSelected(String((rows.find((item) => item.is_current) ?? rows[0])?.id ?? ""));
    }).catch((err) => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [record.id, record.version, isVersion, revision]);

  useEffect(() => {
    if (!selected || !open) return;
    const controller = new AbortController();
    let objectUrl = "";
    setPreview(null); setError(""); setLoading(true);
    api.get<Blob>(`/documents/versions/${selected}/download/`, { responseType: "blob", signal: controller.signal })
      .then(async ({ data }) => {
        const mime = data.type.split(";")[0];
        const name = String(version?.original_name ?? "").toLowerCase();
        const kind = mime === "application/pdf" || (mime === "application/octet-stream" && name.endsWith(".pdf")) ? "pdf"
          : ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"].includes(mime) ? "image"
          : ["text/plain", "text/csv", "application/json"].includes(mime) ? "text" : "unsupported";
        const text = kind === "text" ? await data.slice(0, 500000).text() : "";
        if (controller.signal.aborted) return;
        if (kind === "pdf" || kind === "image") objectUrl = URL.createObjectURL(kind === "pdf" ? new Blob([data], { type: "application/pdf" }) : data);
        setPreview({ url: objectUrl, kind, text });
      }).catch((err) => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [selected, version?.version, revision, open]);

  return <>
    {!modalOnly && <Paper variant="outlined" sx={{ p: 2 }}>
    <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap" mb={2}>
      <Typography variant="h6">Visualisation du document</Typography>
      <Button variant="contained" disabled={!version} onClick={() => setOpen(true)}>Visualiser</Button>
      {!isVersion && versions.length > 0 && <TextField select size="small" label="Version" value={selected} onChange={(event) => setSelected(event.target.value)} sx={{ minWidth: 220 }}>
        {versions.map((item) => <MenuItem key={item.id} value={String(item.id)}>{String(item.version_label)} — {String(item.original_name)}{item.is_current ? " (courante)" : ""}</MenuItem>)}
      </TextField>}
      {version && <Button onClick={async () => {
        try { await downloadFile(`/documents/versions/${selected}/download/`, String(version.original_name ?? "document")); }
        catch (err) { setError(errorMessage(err)); }
      }}>Télécharger</Button>}
    </Stack>
    {!open && loading && <LinearProgress />}
    {!open && error && <Alert severity="error">{error}</Alert>}
    {!loading && !error && !versions.length && <Alert severity="info">Ajoutez une version dans les données associées pour visualiser ce document.</Alert>}
    </Paper>}
    <Dialog open={open} onClose={close} fullWidth maxWidth="xl" aria-labelledby="document-preview-title">
      <DialogTitle id="document-preview-title">{String(version?.original_name ?? "Visualisation du document")}</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 240 }}>
    {modalOnly && !isVersion && versions.length > 0 && <TextField select fullWidth size="small" label="Version" value={selected} onChange={(event) => setSelected(event.target.value)} sx={{ mb: 2 }}>
      {versions.map((item) => <MenuItem key={item.id} value={String(item.id)}>{String(item.version_label)} — {String(item.original_name)}{item.is_current ? " (courante)" : ""}</MenuItem>)}
    </TextField>}
    {loading && <LinearProgress />}
    {error && <Alert severity="error">{error}</Alert>}
    {!loading && !error && !versions.length && <Alert severity="info">Ce document ne contient aucune version à visualiser.</Alert>}
    {!loading && preview?.kind === "pdf" && <Box component="iframe" title={String(version?.original_name ?? "Document PDF")} src={preview.url} sx={{ width: "100%", height: "70vh", border: 0 }} />}
    {!loading && preview?.kind === "image" && <Box component="img" alt={String(version?.original_name ?? "Document")} src={preview.url} sx={{ display: "block", maxWidth: "100%", maxHeight: "70vh", mx: "auto", objectFit: "contain" }} />}
    {!loading && preview?.kind === "text" && <Box component="pre" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "70vh", overflow: "auto" }}>{preview.text}</Box>}
    {!loading && preview?.kind === "unsupported" && <Alert severity="info">Ce format ne permet pas un aperçu dans le navigateur. Téléchargez le fichier pour le consulter.</Alert>}
      </DialogContent>
      <DialogActions>
        {version && <Button onClick={async () => {
          try { await downloadFile(`/documents/versions/${selected}/download/`, String(version.original_name ?? "document")); }
          catch (err) { setError(errorMessage(err)); }
        }}>Télécharger</Button>}
        <Button onClick={close}>Fermer</Button>
      </DialogActions>
    </Dialog>
  </>;
}
