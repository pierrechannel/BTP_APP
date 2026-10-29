import { ReactNode, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";

import { platformMenu } from "../platform/platformResources";
import { useAuth } from "../state/auth";
import { fetchCollection } from "../api/workspace";
import { ApiRecord } from "../api/types";

const drawerWidth = 280;

export function PlatformLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, tenantId, setTenantId, logout } = useAuth();
  const [tenants, setTenants] = useState<ApiRecord[]>([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("chantier:data-changed", refresh);
    return () => window.removeEventListener("chantier:data-changed", refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCollection("/auth/platform/tenants/", {}, controller.signal).then(setTenants).catch(() => {});
    return () => controller.abort();
  }, [revision]);

  const drawerContent = (
    <Stack sx={{ height: "100%" }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5">Superadmin</Typography>
        <Typography variant="body2" color="text.secondary">
          Plateforme Chantier
        </Typography>
      </Box>
      <Divider />
      <List sx={{ px: 1, flexGrow: 1, overflowY: "auto" }}>
        {platformMenu.filter((item) => item.path !== "/platform/billing").map((item) => (
          <ListItemButton
            key={item.path}
            component={RouterLink}
            to={item.path}
            selected={location.pathname === item.path}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 1, minHeight: 44 }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
          {user?.email}
        </Typography>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 64, sm: 72 }, px: { xs: 1.5, sm: 3 } }}>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu plateforme">
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              Console plateforme
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: "none", sm: "block" } }}>
              Gestion globale des tenants, utilisateurs et operations systeme
            </Typography>
          </Box>
          <Select size="small" value={tenantId ?? ""} onChange={(event) => setTenantId(event.target.value)} displayEmpty
            inputProps={{ "aria-label": "Entreprise à administrer" }} sx={{ maxWidth: { xs: 140, sm: 220 }, fontSize: 12 }}>
            <MenuItem value="" disabled>Choisir une entreprise</MenuItem>
            {tenants.map((tenant) => <MenuItem key={tenant.id} value={String(tenant.id)}>{String(tenant.name)}{tenant.is_active ? "" : " (inactive)"}</MenuItem>)}
          </Select>
          <Button
            component={RouterLink}
            to="/"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            sx={{ minWidth: { xs: 40, sm: 128 }, px: { xs: 1, sm: 2 } }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              Chantier
            </Box>
          </Button>
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={logout}
            sx={{ minWidth: { xs: 40, sm: 120 }, px: { xs: 1, sm: 2 } }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              Deconnexion
            </Box>
          </Button>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: drawerWidth } }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              borderRight: 1,
              borderColor: "divider",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          ml: { xs: 0, md: `${drawerWidth}px` },
          pt: { xs: 10, sm: 11 },
          px: { xs: 1.5, sm: 3 },
          pb: 4,
          maxWidth: "100vw",
        }}
      >
        <Box key={tenantId}>{children}</Box>
      </Box>
    </Box>
  );
}
