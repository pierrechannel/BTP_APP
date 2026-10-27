import { FormControl, MenuItem, Select } from "@mui/material";
import { useWorkspace } from "../state/workspace";
export function ProjectSelector() {
  const { projects, projectId, setProjectId, loading, can } = useWorkspace();
  if (!can("projects")) return null;
  return <FormControl size="small" sx={{ minWidth: { xs: 145, sm: 210 }, maxWidth: 270 }}>
    <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} displayEmpty disabled={loading}
      inputProps={{ "aria-label": "Chantier actif" }} sx={{ fontSize: 13 }}>
      <MenuItem value="">Tous les chantiers</MenuItem>
      {projects.map((project) => <MenuItem key={project.id} value={String(project.id)}>{String(project.name)}</MenuItem>)}
    </Select>
  </FormControl>;
}
