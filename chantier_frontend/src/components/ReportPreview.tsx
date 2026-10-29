import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { downloadFile, errorMessage } from "../api/workspace";

export function ReportPreview({ record }: { record: ApiRecord }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [content, setContent] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [sections, setSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState("summary");
  const sectionLabels: Record<string, string> = { summary: "Synthèse", planning: "Planning et avancement", finances: "Situation financière", safety: "Qualité et sécurité", observations: "Observations et décisions" };
  const extension = String(record.result_file ?? "").split("?")[0].split(".").pop();
  const filename = `rapport-${record.id}.${["pdf", "json", "html"].includes(extension ?? "") ? extension : "pdf"}`;
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setContent(""); setPdfUrl(""); setSections([]); setError(""); setReady(false); setLegacy(false);
    if (record.status !== "completed") return () => controller.abort();
    api.get<Blob>(`/reports/runs/${record.id}/download/`, { responseType: "blob", signal: controller.signal })
      .then(async ({ data }) => {
        const signature = await data.slice(0, 5).text();
        if (signature === "%PDF-") {
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
          setPdfUrl(objectUrl); return;
        }
        const html = await data.text();
        if (controller.signal.aborted) return;
        setLegacy(!html.trimStart().toLowerCase().startsWith("<!doctype html>"));
        setContent(html);
      }).catch((err) => { if (!controller.signal.aborted) setError(errorMessage(err)); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [record.id, record.version, record.status]);

  if (record.status === "failed") return <Alert severity="error">La génération a échoué. Relancez le rapport depuis son modèle.</Alert>;
  if (record.status !== "completed") return <Paper variant="outlined" sx={{ p: 3 }}><Typography mb={2}>Génération du rapport en cours…</Typography><LinearProgress /></Paper>;
  return <Stack spacing={2}>
    <Stack direction="row" gap={1} flexWrap="wrap">
      <Button variant="contained" startIcon={<PrintOutlinedIcon />} disabled={!ready || legacy} onClick={() => {
        if (pdfUrl) { window.open(pdfUrl, "_blank", "noopener,noreferrer"); return; }
        try { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }
        catch { setError("Téléchargez le rapport et ouvrez-le dans votre navigateur pour l’imprimer."); }
      }}>{pdfUrl ? "Ouvrir / imprimer le PDF" : "Imprimer / PDF"}</Button>
      <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={async () => {
        try { await downloadFile(`/reports/runs/${record.id}/download/`, filename); }
        catch (err) { setError(errorMessage(err)); }
      }}>Télécharger le rapport</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {!content && !pdfUrl && !error && <LinearProgress />}
    {legacy && <Alert severity="info">Ce rapport a été généré dans l’ancien format JSON. Générez un nouveau rapport depuis le modèle pour obtenir la présentation imprimable.</Alert>}
    {(content || pdfUrl) && !legacy && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: sections.length ? "220px minmax(0, 1fr)" : "1fr" }, gap: 2, alignItems: "start" }}>
      {sections.length > 0 && <Paper component="nav" aria-label="Sommaire du rapport" variant="outlined" sx={{ p: 2, position: { lg: "sticky" }, top: 100 }}>
        <Typography variant="overline" color="text.secondary">SOMMAIRE</Typography>
        <Stack direction={{ xs: "row", lg: "column" }} gap={.5} sx={{ overflowX: "auto" }}>
          {sections.map((section) => <Button key={section} size="small" variant={activeSection === section ? "contained" : "text"} sx={{ justifyContent: "flex-start", textAlign: "left", flexShrink: 0 }} onClick={() => {
            setActiveSection(section);
            frame.current?.contentDocument?.querySelector(`[data-report-section="${section}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}>{sectionLabels[section] ?? section}</Button>)}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", lg: "block" }, mt: 2 }}>Pour plusieurs chantiers, chaque rubrique mène au premier chantier du rapport.</Typography>
      </Paper>}
      <Box sx={{ bgcolor: "#e9eeeb", p: { xs: .5, sm: 2 }, borderRadius: 1, minWidth: 0 }}>
        <Box component="iframe" ref={frame} title="Rapport de chantier" src={pdfUrl || undefined} srcDoc={pdfUrl ? undefined : content} sandbox={pdfUrl ? undefined : "allow-same-origin allow-modals"} onLoad={() => {
          setReady(true);
          if (pdfUrl) return;
          setSections([...new Set(Array.from(frame.current?.contentDocument?.querySelectorAll("[data-report-section]") ?? []).map((item) => item.getAttribute("data-report-section") ?? "").filter(Boolean))]);
        }} sx={{ display: "block", width: "100%", height: "80vh", border: 0, bgcolor: "white", boxShadow: "0 4px 24px #153b2614" }} />
      </Box>
    </Box>}
  </Stack>;
}
