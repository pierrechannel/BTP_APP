import { useEffect, useState } from "react";
import { Alert, Box, LinearProgress, Paper, Typography } from "@mui/material";
import { api } from "../api/client";
import { errorMessage } from "../api/workspace";
import { ApiRecord } from "../api/types";

export function PhotoPreview({ record }: { record: ApiRecord }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = "";
    setUrl(""); setError("");
    api.get(`/progress/photos/${record.id}/download/`, { responseType: "blob", signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
      }).catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [record.id, record.version]);
  return <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="h6" mb={2}>Photo du chantier</Typography>
    {error ? <Alert severity="error">{error}</Alert> : !url ? <LinearProgress /> : <Box component="img" src={url} alt="Photo du chantier" sx={{ display: "block", width: "100%", maxHeight: 540, objectFit: "contain", borderRadius: 1 }} />}
  </Paper>;
}
