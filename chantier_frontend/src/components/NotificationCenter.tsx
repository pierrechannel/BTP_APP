import { useEffect, useState } from "react";
import { Alert, Badge, Box, Button, Divider, IconButton, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../api/client";
import { ApiRecord } from "../api/types";
import { errorMessage, fetchCollection, versionHeaders } from "../api/workspace";
import { useWorkspace } from "../state/workspace";
export function NotificationCenter() {
  const { can } = useWorkspace();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [records, setRecords] = useState<ApiRecord[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!can("notifications")) return;
    const controller = new AbortController();
    fetchCollection("/notifications/notifications/", {}, controller.signal).then(setRecords)
      .catch((error) => { if (!controller.signal.aborted) setError(errorMessage(error)); });
    return () => controller.abort();
  }, [anchor, can]);
  if (!can("notifications")) return null;
  const markRead = async (record: ApiRecord) => {
    if (record.read_at || !can("notifications", "update")) return;
    try {
      const { data } = await api.post(`/notifications/notifications/${record.id}/mark-read/`, {}, { headers: versionHeaders(record) });
      setRecords((rows) => rows.map((row) => row.id === record.id ? data : row)); setError("");
    } catch (error) { setError(errorMessage(error)); }
  };
  return <><IconButton aria-label="Notifications" onClick={(event) => setAnchor(event.currentTarget)}><Badge badgeContent={records.filter((record) => !record.read_at).length} max={99} color="error"><NotificationsOutlinedIcon /></Badge></IconButton>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} PaperProps={{ sx: { width: 370, maxWidth: "calc(100vw - 24px)" } }}>
      <Box px={2} py={1.5}><Typography fontWeight={700}>Notifications</Typography></Box><Divider />
      {error && <Alert severity="error">{error}</Alert>}
      {!records.length && <Typography color="text.secondary" p={3}>Vous êtes à jour.</Typography>}
      {records.slice(0, 8).map((record) => <MenuItem key={record.id} onClick={() => markRead(record)} sx={{ py: 1.5, whiteSpace: "normal" }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: record.read_at ? "transparent" : "secondary.main", mr: 1.5 }} />
        <ListItemText primary={String(record.title)} secondary={String(record.body ?? "")} primaryTypographyProps={{ fontWeight: record.read_at ? 400 : 600, fontSize: 13 }} />
      </MenuItem>)}
      <Box p={1}><Button component={RouterLink} to="/notifications" fullWidth onClick={() => setAnchor(null)}>Toutes les notifications</Button></Box>
    </Menu></>;
}
