import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Divider,
  IconButton,
  List,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";

import { api } from "../api/client";
import { ApiRecord, Paginated } from "../api/types";

export function NotificationCenter() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<ApiRecord[]>([]);

  const load = () => {
    api
      .get<Paginated<ApiRecord>>("/notifications/notifications/")
      .then((response) => setNotifications(response.data.results))
      .catch(() => setNotifications([]));
  };

  useEffect(() => {
    load();
  }, []);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  return (
    <>
      <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="Notifications">
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { width: { xs: 320, sm: 420 }, maxWidth: "calc(100vw - 24px)" } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Notifications
          </Typography>
        </Box>
        <Divider />
        <List dense disablePadding sx={{ maxHeight: 360, overflowY: "auto" }}>
          {notifications.length === 0 && (
            <MenuItem disabled>
              <ListItemText primary="Aucune notification" />
            </MenuItem>
          )}
          {notifications.slice(0, 8).map((notification) => (
            <MenuItem key={String(notification.id)} onClick={() => setAnchorEl(null)}>
              <ListItemText
                primary={String(notification.title ?? "Notification")}
                secondary={String(notification.body ?? "")}
                primaryTypographyProps={{ fontWeight: notification.read_at ? 500 : 800 }}
              />
            </MenuItem>
          ))}
        </List>
      </Menu>
    </>
  );
}
