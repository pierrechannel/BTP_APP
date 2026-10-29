import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Link, Typography } from "@mui/material";
import { api } from "../api/client";
import { fetchCollection, recordTitle } from "../api/workspace";
import { resourceByModel } from "../resources";
import { useAuth } from "../state/auth";
import { useWorkspace } from "../state/workspace";
import { ApiRecord } from "../api/types";

const cache = new Map<string, Promise<string>>();
const directories = new Map<string, Promise<ApiRecord[]>>();
const clear = () => { cache.clear(); directories.clear(); };
window.addEventListener("chantier:data-changed", clear);
window.addEventListener("chantier:logout", clear);

export function RelatedValue({ model, id }: { model: string; id: unknown }) {
  const { tenantId } = useAuth();
  const { can } = useWorkspace();
  const [label, setLabel] = useState("…");
  const resource = resourceByModel[model];
  useEffect(() => {
    if (!id) { setLabel("—"); return; }
    let active = true;
    const key = `${tenantId}:${model}:${id}`;
    if (!cache.has(key)) {
      const directoryKey = `${tenantId}:${model}`;
      if (["accounts.user", "accounts.role"].includes(model) && !directories.has(directoryKey)) {
        directories.set(directoryKey, fetchCollection(model === "accounts.user" ? "/auth/directory/" : "/auth/role-directory/"));
      }
      const request = ["accounts.user", "accounts.role"].includes(model)
        ? directories.get(directoryKey)!.then((rows) => recordTitle(rows.find((row) => String(row.id) === String(id)) ?? { name: "Élément indisponible" }))
        : resource ? api.get(`${resource.endpoint}${id}/`).then(({ data }) => recordTitle(data))
          : Promise.resolve("Élément associé");
      cache.set(key, request.catch(() => "Élément indisponible"));
    }
    cache.get(key)!.then((value) => { if (active) setLabel(value); });
    return () => { active = false; };
  }, [model, id, tenantId]);
  return resource && id && can(resource.group) ? <Link component={RouterLink} to={`${resource.path}/${id}`} underline="hover" onClick={(event) => event.stopPropagation()} noWrap>{label}</Link>
    : <Typography variant="body2" noWrap>{label}</Typography>;
}
