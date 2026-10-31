import { FormTextField as TextField } from './FormTextField';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, CircularProgress, Dialog, DialogContent, IconButton, InputAdornment, List, ListItemButton, ListItemText, Tooltip, Typography } from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import { api } from "../api/client";
import { ApiRecord, Paginated } from "../api/types";
import { recordTitle } from "../api/workspace";
import { resources, ResourceConfig } from "../resources";
import { useWorkspace } from "../state/workspace";
export function GlobalSearch() {
  const navigate = useNavigate();
  const { can, projectId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ resource: ResourceConfig; record: ApiRecord }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key === "k") { event.preventDefault(); setOpen(true); } };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, []);
  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError("");
    const timeout = setTimeout(async () => {
      const responses = await Promise.allSettled(resources.filter((resource) => can(resource.group)).map(async (resource) => {
        const { data } = await api.get<Paginated<ApiRecord>>(resource.endpoint, { signal: controller.signal,
          params: { search: query.trim(), ...(resource.projectScoped && projectId ? { project: projectId } : {}) } });
        return data.results.slice(0, 4).map((record) => ({ resource, record }));
      }));
      if (controller.signal.aborted) return;
      setResults(responses.flatMap((result) => result.status === "fulfilled" ? result.value : []));
      if (responses.some((result) => result.status === "rejected")) setError("Certains modules n’ont pas pu être consultés.");
      setLoading(false);
    }, 350);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [open, query, projectId, can]);
  return <><Tooltip title="Rechercher (Ctrl K)"><IconButton aria-label="Recherche globale" onClick={() => setOpen(true)}><SearchOutlinedIcon /></IconButton></Tooltip>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogContent sx={{ p: 3 }}>
      <TextField autoFocus fullWidth placeholder="Un chantier, une tâche, un document…" value={query} onChange={(event) => setQuery(event.target.value)} inputProps={{ "aria-label": "Recherche globale" }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlinedIcon /></InputAdornment>, endAdornment: loading ? <CircularProgress size={18} /> : null }} />
      {error && <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert>}
      <List sx={{ mt: 2, maxHeight: 420, overflowY: "auto" }}>{results.map(({ resource, record }) => <ListItemButton key={`${resource.path}-${record.id}`} sx={{ borderRadius: 2 }} onClick={() => { setOpen(false); navigate(`${resource.path}/${record.id}`); }}>
        <Box sx={{ color: "primary.main", mr: 2 }}>{resource.icon}</Box><ListItemText primary={recordTitle(record)} secondary={resource.label} /></ListItemButton>)}</List>
      {!loading && !results.length && <Typography color="text.secondary" align="center" sx={{ py: 4 }}>{query.trim().length < 2 ? "Saisissez au moins deux caractères." : "Aucun résultat pour cette recherche."}</Typography>}
    </DialogContent></Dialog></>;
}
