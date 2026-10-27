import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Link, Typography } from "@mui/material";
import { api } from "../api/client";
import { fetchCollection, recordTitle } from "../api/workspace";
import { resourceByModel } from "../resources";
import { useAuth } from "../state/auth";

const cache = new Map<string, Promise<string>>();
window.addEventListener("chantier:data-changed", () => cache.clear());
window.addEventListener("chantier:logout", () => cache.clear());

export function RelatedValue({ model, id }: { model: string; id: unknown }) {
  const { tenantId } = useAuth();
  const [label, setLabel] = useState("…");
  const resource = resourceByModel[model];
  useEffect(() => {
    if (!id) { setLabel("—"); return; }
    let active = true;
    const key = `${tenantId}:${model}:${id}`;
    if (!cache.has(key)) {
      const request = model === "accounts.user"
        ? fetchCollection("/auth/directory/").then((rows) => recordTitle(rows.find((row) => String(row.id) === String(id)) ?? { name: "Utilisateur indisponible" }))
        : resource ? api.get(`${resource.endpoint}${id}/`).then(({ data }) => recordTitle(data))
          : Promise.resolve("Élément associé");
      cache.set(key, request.catch(() => "Élément indisponible"));
    }
    cache.get(key)!.then((value) => { if (active) setLabel(value); });
    return () => { active = false; };
  }, [model, id, tenantId]);
  return resource && id ? <Link component={RouterLink} to={`${resource.path}/${id}`} underline="hover" onClick={(event) => event.stopPropagation()} noWrap>{label}</Link>
    : <Typography variant="body2" noWrap>{label}</Typography>;
}
