import { ReactNode, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
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
import DashboardIcon from "@mui/icons-material/Dashboard";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

import { GlobalSearch } from "../components/GlobalSearch";
import { NotificationCenter } from "../components/NotificationCenter";
import { ProjectSelector } from "../components/ProjectSelector";
import { resources } from "../resources";
import { useAuth } from "../state/auth";

const drawerWidth = 264;

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, tenantId, setTenantId, logout, refreshMe } = useAuth();

  useEffect(() => {
    if (!user) {
      refreshMe().catch(() => logout());
    }
  }, [user, refreshMe, logout]);

  const drawerContent = (
    <Stack sx={{ height: "100%" }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5">Chantier</Typography>
        <Typography variant="body2" color="text.secondary">
          Administration
        </Typography>
      </Box>
      <Divider />
      <List sx={{ px: 1, flexGrow: 1, overflowY: "auto" }}>
        <ListItemButton
          component={RouterLink}
          to="/"
          selected={location.pathname === "/"}
          onClick={() => setMobileOpen(false)}
          sx={{ borderRadius: 1, minHeight: 44 }}
        >
          <ListItemIcon>
            <DashboardIcon />
          </ListItemIcon>
          <ListItemText primary="Dashboard" />
        </ListItemButton>
        {resources.map((resource) => (
          <ListItemButton
            key={resource.path}
            component={RouterLink}
            to={resource.path}
            selected={location.pathname === resource.path}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 1, minHeight: 44 }}
          >
            <ListItemIcon>{resource.icon}</ListItemIcon>
            <ListItemText primary={resource.label} />
          </ListItemButton>
        ))}
        <Divider sx={{ my: 1 }} />
        <ListItemButton
          component={RouterLink}
          to="/platform"
          selected={location.pathname.startsWith("/platform")}
          onClick={() => setMobileOpen(false)}
          sx={{ borderRadius: 1, minHeight: 44 }}
        >
          <ListItemIcon>
            <AdminPanelSettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Superadmin" />
        </ListItemButton>
      </List>
      <Box sx={{ p: 2 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}
        >
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
        <Toolbar
          sx={{
            gap: { xs: 1, sm: 2 },
            minHeight: { xs: 64, sm: 72 },
            px: { xs: 1.5, sm: 3 },
          }}
        >
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              Chantier Admin
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              Pilotage backend BTP
            </Typography>
          </Box>
          <GlobalSearch />
          <FormControl
            size="small"
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              minWidth: { sm: 180, lg: 220 },
              maxWidth: { sm: 220, lg: 260 },
            }}
          >
            <InputLabel>Tenant</InputLabel>
            <Select
              label="Tenant"
              value={tenantId ?? ""}
              onChange={(event) => setTenantId(event.target.value)}
            >
              {(user?.memberships ?? []).map((membership) => (
                <MenuItem key={membership.tenant.id} value={membership.tenant.id}>
                  {membership.tenant.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ProjectSelector />
          <NotificationCenter />
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
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" },
          }}
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
        {children}
      </Box>
    </Box>
  );
}
