import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, Chip, Divider, LinearProgress, MenuItem, Paper, Skeleton, Stack, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import { api } from "../api/client";
import { ApiRecord, Paginated } from "../api/types";
import { errorMessage, fetchCollection, formatValue, notifyChange } from "../api/workspace";
import { useWorkspace } from "../state/workspace";
import { resourceByModel } from "../resources";
import { ReportPreview } from "../components/ReportPreview";
import { RecordEditor } from "../components/RecordEditor";
import { StatusBadge } from "../components/StatusBadge";
import { ReportsDashboard } from "../components/ReportsDashboard";

const DEFAULT_REPORT_TITLE = "Rapport de chantier";
const OBSERVATIONS_MAX = 5000;
const POLL_INTERVAL_MS = 3000;

const pad = (value: number) => String(value).padStart(2, "0");
const toIsoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Raccourcis de période : dates locales au format AAAA-MM-JJ, bornes incluses. */
const PERIOD_PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "Ce mois", range: () => { const now = new Date(); return [toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), toIsoDate(now)]; } },
  { label: "30 derniers jours", range: () => { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - 29); return [toIsoDate(start), toIsoDate(now)]; } },
  { label: "Cette année", range: () => { const now = new Date(); return [toIsoDate(new Date(now.getFullYear(), 0, 1)), toIsoDate(now)]; } },
];

/** Périmètre d'origine d'une édition déjà générée (lecture seule). */
function RunScope({ params, projectName }: { params: Record<string, string>; projectName?: string }) {
  const projectLabel = params.project ? `Chantier : ${projectName ?? params.project}` : "Tous les chantiers";
  const periodLabel = params.start_date || params.end_date
    ? `Période : ${params.start_date ? `du ${params.start_date}` : "depuis l’origine"}${params.end_date ? ` au ${params.end_date}` : " à ce jour"}`
    : "Sans limite de période";
  return <Stack direction="row" gap={1} flexWrap="wrap" aria-label="Périmètre de l’édition affichée">
    <Chip size="small" variant="outlined" label={projectLabel} />
    <Chip size="small" variant="outlined" label={periodLabel} />
  </Stack>;
}

export function ReportsPage({ detail = false }: { detail?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, projectId, can } = useWorkspace();
  const [templates, setTemplates] = useState<ApiRecord[]>([]);
  const [history, setHistory] = useState<ApiRecord[]>([]);
  const [run, setRun] = useState<ApiRecord | null>(null);
  const [template, setTemplate] = useState("");
  const [project, setProject] = useState(projectId ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [observations, setObservations] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [revision, setRevision] = useState(0);
  const [documentOptions, setDocumentOptions] = useState(false);
  const syncedKey = useRef("");

  const templateName = useMemo(() => {
    const names = new Map(templates.map((item) => [String(item.id), String(item.name)]));
    return (templateId: unknown) => names.get(String(templateId)) ?? DEFAULT_REPORT_TITLE;
  }, [templates]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    Promise.all([
      fetchCollection("/reports/templates/", {}, controller.signal),
      api.get<Paginated<ApiRecord>>("/reports/runs/", { signal: controller.signal }),
    ]).then(([models, runs]) => {
      setTemplates(models); setHistory(runs.data.results);
      setTemplate((current) => current || String(models[0]?.id ?? ""));
    }).catch((err) => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!detail || !id) { setRun(null); return; }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // On ne vide l'aperçu que si l'on change de rapport : une actualisation ne doit pas le faire clignoter.
    setRun((current) => (current && String(current.id) === id ? current : null));
    setError("");
    const load = async () => {
      try {
        const { data } = await api.get<ApiRecord>(`/reports/runs/${id}/`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setRun(data);
        if (data.status === "pending") timer = setTimeout(load, POLL_INTERVAL_MS);
      } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err)); }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [detail, id, revision]);

  // Recopie le périmètre de l'édition affichée dans le formulaire, une seule fois par édition
  // (et à nouveau quand la liste des chantiers devient disponible), sans écraser les saisies en cours.
  useEffect(() => {
    if (!run) return;
    const key = `${run.id}:${projects.length ? "p" : ""}`;
    if (syncedKey.current === key) return;
    syncedKey.current = key;
    const params = (run.parameters ?? {}) as Record<string, string>;
    setTemplate(String(run.template));
    setProject(String(projects.find((item) => item.code === params.project)?.id ?? ""));
    setStartDate(params.start_date ?? ""); setEndDate(params.end_date ?? ""); setObservations(params.observations ?? "");
  }, [run, projects]);

  const generate = async () => {
    setGenerating(true); setError("");
    try {
      const selected = projects.find((item) => String(item.id) === project);
      const parameters = { ...(selected ? { project: selected.code } : {}), ...(startDate ? { start_date: startDate } : {}), ...(endDate ? { end_date: endDate } : {}), ...(observations.trim() ? { observations: observations.trim() } : {}) };
      const { data } = await api.post<ApiRecord>(`/reports/templates/${template}/run/`, { parameters });
      notifyChange(); navigate(`/reports/runs/${data.id}`);
    } catch (err) { setError(errorMessage(err)); }
    finally { setGenerating(false); }
  };

  const applyPreset = (range: () => [string, string]) => { const [start, end] = range(); setStartDate(start); setEndDate(end); };
  const resetFilters = () => { setProject(""); setStartDate(""); setEndDate(""); };

  const invalidPeriod = Boolean(startDate && endDate && endDate < startDate);
  const hasFilters = Boolean(project || startDate || endDate);
  const showDocumentFields = detail || documentOptions;
  const runParams = (run?.parameters ?? {}) as Record<string, string>;
  const runProjectName = projects.find((item) => item.code === runParams.project)?.name;
  const reportTitle = templateName(run?.template);

  return <Stack spacing={3}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
      <Box><Typography variant="overline" color="primary.main">PILOTAGE DES CHANTIERS</Typography>
        <Typography variant="h4" component="h1">{detail ? reportTitle : "Rapports et analyses"}</Typography>
        <Typography variant="body2" color="text.secondary" mt={1}>Une synthèse claire pour suivre les travaux, les finances et la sécurité.</Typography></Box>
      <Stack direction="row" gap={1}>
        {detail && <Button component={RouterLink} to="/reports" startIcon={<ArrowBackIcon />}>Rapports</Button>}
        <Button aria-label="Actualiser les rapports" startIcon={<RefreshIcon />} onClick={() => setRevision((value) => value + 1)}>Actualiser</Button>
      </Stack>
    </Stack>

    {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setRevision((value) => value + 1)}>Réessayer</Button>}>{error}</Alert>}

    <Paper variant="outlined" component="form" onSubmit={(event) => { event.preventDefault(); if (!generating && !invalidPeriod && template) void generate(); }} sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} gap={2}>
        <Box><Typography variant="h6" component="h2">{detail ? "Préparer une nouvelle édition" : "Périmètre du tableau de bord"}</Typography><Typography variant="body2" color="text.secondary">Choisissez le périmètre et la période à présenter.</Typography></Box>
        {can("reports", "create") && <Button size="small" onClick={() => setEditingTemplate(true)}>Nouveau modèle</Button>}
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: showDocumentFields ? "1.2fr 1.2fr 1fr 1fr" : "2fr 1fr 1fr" }, gap: 2 }}>
        {showDocumentFields && <TextField select required label="Modèle de rapport" size="small" value={template} onChange={(event) => setTemplate(event.target.value)} disabled={loading || generating}>
          {templates.map((item) => <MenuItem key={item.id} value={String(item.id)}>{String(item.name)}</MenuItem>)}
        </TextField>}
        <TextField select label="Chantier" size="small" value={project} onChange={(event) => setProject(event.target.value)} disabled={generating}>
          <MenuItem value="">Tous les chantiers</MenuItem>{projects.map((item) => <MenuItem key={item.id} value={String(item.id)}>{String(item.name)}</MenuItem>)}
        </TextField>
        <TextField label="Du" type="date" size="small" value={startDate} onChange={(event) => setStartDate(event.target.value)} InputLabelProps={{ shrink: true }} disabled={generating} />
        <TextField label="Au" type="date" size="small" value={endDate} onChange={(event) => setEndDate(event.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: startDate || undefined }} error={invalidPeriod} helperText={invalidPeriod ? "La fin doit suivre le début." : undefined} disabled={generating} />
      </Box>

      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" mt={2}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Période rapide</Typography>
        {PERIOD_PRESETS.map((preset) => <Chip key={preset.label} size="small" variant="outlined" clickable label={preset.label} onClick={() => applyPreset(preset.range)} disabled={generating} />)}
        {hasFilters && <Button size="small" startIcon={<FilterAltOffOutlinedIcon />} onClick={resetFilters} disabled={generating}>Réinitialiser les filtres</Button>}
      </Stack>

      {showDocumentFields && <TextField label="Observations et décisions" placeholder="Faits marquants, points à surveiller, décisions à suivre…" multiline minRows={2} fullWidth value={observations} onChange={(event) => setObservations(event.target.value)} inputProps={{ maxLength: OBSERVATIONS_MAX }} helperText={`${observations.length} / ${OBSERVATIONS_MAX}`} FormHelperTextProps={{ sx: { textAlign: "right" } }} sx={{ mt: 2 }} disabled={generating} />}

      <Stack direction={{ xs: "column", sm: "row" }} gap={2} alignItems={{ sm: "center" }} justifyContent="space-between" mt={2}>
        <Typography variant="caption" color="text.secondary">{detail ? "Les filtres seront appliqués à la nouvelle édition. Le rapport affiché conserve son périmètre d’origine." : "Les KPI, graphiques et tableaux se mettent à jour selon les filtres."}</Typography>
        <Stack direction="row" gap={1} justifyContent="flex-end">
          {!detail && <Button startIcon={<TuneIcon />} onClick={() => setDocumentOptions((value) => !value)} aria-expanded={documentOptions}>Options du document</Button>}
          {can("reports", "create") && <Button type="submit" variant="contained" startIcon={<AutoAwesomeOutlinedIcon />} disabled={!template || generating || invalidPeriod} sx={{ whiteSpace: "nowrap" }}>{generating ? "Génération…" : "Générer le rapport"}</Button>}
        </Stack>
      </Stack>
      {generating && <LinearProgress sx={{ mt: 2 }} aria-label="Génération du rapport en cours" />}
      {!loading && !templates.length && <Alert severity="info" sx={{ mt: 2 }}>Créez un modèle pour générer votre premier rapport.</Alert>}
    </Paper>

    {!detail && <ReportsDashboard project={project} startDate={startDate} endDate={endDate} revision={revision} onProjectSelect={setProject} />}

    {detail ? run ? <>
      <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center"><StatusBadge value={run.status} /><Typography variant="body2" color="text.secondary">Édition du {formatValue(run.created_at, "created_at")}</Typography><Chip size="small" variant="outlined" label={`Réf. ${String(run.id).slice(0, 8).toUpperCase()}`} /></Stack>
      <RunScope params={runParams} projectName={runProjectName ? String(runProjectName) : undefined} />
      {run.status === "pending" && <Alert severity="info" icon={false}><Typography variant="body2" mb={1}>Le rapport est en cours de génération. Cette page se met à jour automatiquement.</Typography><LinearProgress /></Alert>}
      {run.status === "failed" && <Alert severity="error">La génération a échoué. Vérifiez le périmètre puis générez une nouvelle édition avec le formulaire ci-dessus.</Alert>}
      {run.status === "completed" && <ReportPreview record={run} />}
    </> : !error && <Skeleton variant="rounded" height={500} /> : <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}><Typography variant="h6" component="h2">Derniers rapports</Typography><Button component={RouterLink} to="/reports/runs">Tout l’historique</Button></Stack>
      {loading ? <Skeleton height={180} /> : !history.length ? <Box textAlign="center" py={5}><DescriptionOutlinedIcon sx={{ fontSize: 48, color: "text.secondary" }} /><Typography mt={1}>Votre premier rapport commence ici.</Typography><Typography variant="body2" color="text.secondary">Choisissez un chantier puis générez sa synthèse.</Typography></Box> : <Stack divider={<Divider />}>
        {history.slice(0, 8).map((item) => <Stack key={item.id} direction={{ xs: "column", sm: "row" }} gap={2} py={2} alignItems={{ sm: "center" }}>
          <DescriptionOutlinedIcon color="primary" /><Box flex={1}><Typography fontWeight={600}>{templateName(item.template)}</Typography><Typography variant="caption" color="text.secondary">{formatValue(item.created_at, "created_at")}</Typography></Box><StatusBadge value={item.status} /><Button component={RouterLink} to={`/reports/runs/${item.id}`}>Ouvrir le rapport</Button>
        </Stack>)}
      </Stack>}
    </Paper>}

    <RecordEditor resource={resourceByModel["reports.reporttemplate"]} open={editingTemplate} onClose={() => setEditingTemplate(false)} onSaved={(item) => { setTemplate(String(item.id)); setRevision((value) => value + 1); }} />
  </Stack>;
}