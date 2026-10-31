import { FormTextField as TextField } from './FormTextField';
import { useEffect, useState } from "react";
import { Alert, Autocomplete, Box, MenuItem} from "@mui/material";
import { fetchCollection, FieldInfo, fieldLabel, recordTitle, statusLabels } from "../api/workspace";
import { ApiRecord } from "../api/types";
import { resourceByModel } from "../resources";

export function ResourceFilters({ names, fields, values, onChange }: {
  names: string[]; fields: Record<string, FieldInfo>; values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  const [options, setOptions] = useState<Record<string, ApiRecord[]>>({});
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController(); setFailed([]);
    Promise.allSettled(names.filter((name) => fields[name]?.related_model).map(async (name) => {
      const model = fields[name].related_model!;
      const endpoint = model === "accounts.user" ? "/auth/directory/" : model === "accounts.role" ? "/auth/role-directory/" : resourceByModel[model]?.endpoint;
      if (!endpoint) throw new Error(name);
      try { return [name, await fetchCollection(endpoint, {}, controller.signal)] as const; }
      catch { throw new Error(name); }
    })).then((results) => {
      if (controller.signal.aborted) return;
      setOptions(Object.fromEntries(results.filter((item): item is PromiseFulfilledResult<readonly [string, ApiRecord[]]> => item.status === "fulfilled").map((item) => item.value)));
      setFailed(results.filter((item): item is PromiseRejectedResult => item.status === "rejected").map((item) => item.reason.message));
    });
    return () => controller.abort();
  }, [names.join(","), fields]);
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2, pt: 2 }}>
    {failed.length > 0 && <Alert severity="warning" sx={{ gridColumn: "1 / -1" }}>Filtres indisponibles : {failed.map(fieldLabel).join(", ")}.</Alert>}
    {names.map((name) => {
      const field = fields[name]; if (!field) return null;
      if (field.related_model) return <Autocomplete key={name} options={options[name] ?? []} getOptionLabel={recordTitle} isOptionEqualToValue={(a, b) => a.id === b.id}
        value={(options[name] ?? []).find((row) => String(row.id) === values[name]) ?? null} onChange={(_, row) => onChange(name, row ? String(row.id) : "")} disabled={failed.includes(name)} renderInput={(props) => <TextField {...props} size="small" label={fieldLabel(name)} />} />;
      if (field.type === "boolean" || field.choices?.length) return <TextField key={name} select size="small" label={fieldLabel(name)} value={values[name] ?? ""} onChange={(event) => onChange(name, event.target.value)}>
        <MenuItem value="">Tous</MenuItem>{field.type === "boolean" ? [<MenuItem key="true" value="true">Oui</MenuItem>, <MenuItem key="false" value="false">Non</MenuItem>] : field.choices?.map((item) => <MenuItem key={item.value} value={item.value}>{statusLabels[String(item.value)] ?? item.display_name}</MenuItem>)}
      </TextField>;
      return <TextField key={name} size="small" label={fieldLabel(name)} type={field.type === "date" ? "date" : "text"} InputLabelProps={{ shrink: true }} value={values[name] ?? ""} onChange={(event) => onChange(name, event.target.value)} />;
    })}
  </Box>;
}
