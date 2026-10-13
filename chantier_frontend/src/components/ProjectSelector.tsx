import { useEffect, useState } from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

import { api } from "../api/client";
import { ApiRecord, Paginated } from "../api/types";

export function ProjectSelector() {
  const [projects, setProjects] = useState<ApiRecord[]>([]);
  const [projectId, setProjectId] = useState(localStorage.getItem("chantier.projectId") ?? "");

  useEffect(() => {
    api
      .get<Paginated<ApiRecord>>("/projects/")
      .then((response) => {
        setProjects(response.data.results);
        if (!projectId && response.data.results.length > 0) {
          const firstId = String(response.data.results[0].id);
          setProjectId(firstId);
          localStorage.setItem("chantier.projectId", firstId);
        }
      })
      .catch(() => setProjects([]));
  }, [projectId]);

  return (
    <FormControl size="small" sx={{ minWidth: { xs: 132, sm: 220 }, maxWidth: { xs: 160, sm: 260 } }}>
      <InputLabel>Chantier</InputLabel>
      <Select
        label="Chantier"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          localStorage.setItem("chantier.projectId", event.target.value);
        }}
      >
        {projects.map((project) => (
          <MenuItem key={String(project.id)} value={String(project.id)}>
            {String(project.name ?? project.code ?? project.id)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
