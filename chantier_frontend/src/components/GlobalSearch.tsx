import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { api } from "../api/client";
import { ApiRecord, Paginated } from "../api/types";
import { resources, ResourceConfig } from "../resources";

type SearchResult = {
  resource: ResourceConfig;
  record: ApiRecord;
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const needle = query.trim();
    if (!needle) return;

    setLoading(true);
    try {
      const responses = await Promise.all(
        resources.slice(0, 8).map(async (resource) => {
          const response = await api.get<Paginated<ApiRecord>>(resource.endpoint, {
            params: { search: needle },
          });
          return response.data.results.slice(0, 4).map((record) => ({ resource, record }));
        }),
      );
      setResults(responses.flat());
    } finally {
      setLoading(false);
    }
  };

  const goToResult = (result: SearchResult) => {
    setOpen(false);
    navigate(`${result.resource.path}/${result.record.id}`);
  };

  return (
    <>
      <TextField
        size="small"
        placeholder="Recherche globale"
        onFocus={() => setOpen(true)}
        sx={{ display: { xs: "none", lg: "block" }, width: 280 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
      />
      <IconButton onClick={() => setOpen(true)} sx={{ display: { xs: "inline-flex", lg: "none" } }}>
        <SearchIcon />
      </IconButton>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogContent>
          <Box component="form" onSubmit={runSearch}>
            <TextField
              autoFocus
              fullWidth
              label="Recherche globale"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <List sx={{ mt: 2, maxHeight: 420, overflowY: "auto" }}>
            {results.map((result) => (
              <ListItemButton
                key={`${result.resource.path}-${result.record.id}`}
                onClick={() => goToResult(result)}
              >
                <ListItemText
                  primary={String(
                    result.record[result.resource.detailTitleField ?? "name"] ??
                      result.record.name ??
                      result.record.title ??
                      result.record.code ??
                      result.record.id,
                  )}
                  secondary={result.resource.label}
                />
              </ListItemButton>
            ))}
            {!loading && results.length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                Lance une recherche pour parcourir les modules.
              </Typography>
            )}
            {loading && (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                Recherche en cours...
              </Typography>
            )}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
}
