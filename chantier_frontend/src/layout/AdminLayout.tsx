import { ReactNode, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { AppBar, Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, MenuItem,
  Select, Stack, Toolbar, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import ConstructionIcon from "@mui/icons-material/Construction";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import { GlobalSearch } from "../components/GlobalSearch";
import { NotificationCenter } from "../components/NotificationCenter";
import { ProjectSelector } from "../components/ProjectSelector";
import { resources } from "../resources";
import { useAuth } from "../state/auth";
import { useWorkspace } from "../state/workspace";

const drawerWidth = 252;
const sections = [
  { label: "OPÉRATIONS", paths: ["/projects", "/lots", "/planning", "/progress"] },
  { label: "GESTION", paths: ["/budget", "/resources", "/workforce", "/equipment"] },
  { label: "SUIVI & COLLABORATION", paths: ["/qhse", "/documents", "/reports", "/notifications", "/sync"] },
  { label: "ENTREPRISE", paths: ["/administration"] },
];
export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, tenantId, setTenantId, logout } = useAuth();
  const { can, error } = useWorkspace();
  const name = user?.first_name || "Bienvenue";
  const itemStyle = { mx: 1.5, my: .3, px: 1.5, minHeight: 42, borderRadius: 1.5,
    color: "#adbdb5", '& .MuiListItemIcon-root': { color: "inherit", minWidth: 36, '& svg': { fontSize: 20 } },
    '& .MuiListItemText-primary': { fontSize: 13, fontWeight: 500 },
    '&.Mui-selected': { bgcolor: "#27493d", color: "#fff", boxShadow: "inset 3px 0 #ec994f", '&:hover': { bgcolor: "#315344" } },
    '&:hover': { bgcolor: "#203b30", color: "#fff" } };
  const drawer = <Stack sx={{ height: "100%", bgcolor: "#152e25", color: "white" }}>
    <Stack direction="row" alignItems="center" gap={1.2} sx={{ px: 3, pt: 3.5, pb: 3 }}>
      <Box sx={{ bgcolor: "#ea9c55", color: "#152e25", p: .8, borderRadius: 1.5, display: "flex" }}><ConstructionIcon /></Box>
      <Box><Typography sx={{ fontWeight: 800, fontSize: 21, letterSpacing: ".09em", lineHeight: 1.1 }}>CHANTIER<span style={{ color: "#ea9c55" }}>.</span></Typography>
        <Typography sx={{ fontSize: 9, color: "#8ea99a", letterSpacing: ".21em", mt: .6 }}>CONSTRUIRE ENSEMBLE</Typography></Box>
    </Stack>
    <List disablePadding sx={{ flex: 1, overflowY: "auto", pb: 2 }}>
      <ListItemButton component={RouterLink} to="/" selected={location.pathname === "/"} onClick={() => setMobileOpen(false)} sx={itemStyle}>
        <ListItemIcon><DashboardOutlinedIcon /></ListItemIcon><ListItemText primary="Vue d’ensemble" />
      </ListItemButton>
      {sections.map((section) => {
        const items = resources.filter((resource) => section.paths.includes(resource.path) && (can(resource.group) || can(resource.group, "create")));
        return items.length ? <Box key={section.label} mt={2.5}><Typography sx={{ px: 3, mb: 1, fontSize: 9, fontWeight: 600, letterSpacing: ".15em", color: "#738f7e" }}>{section.label}</Typography>
          {items.map((resource) => <ListItemButton key={resource.path} component={RouterLink} to={resource.path}
            selected={location.pathname === resource.path || location.pathname.startsWith(resource.path + "/")} onClick={() => setMobileOpen(false)} sx={itemStyle}>
            <ListItemIcon>{resource.icon}</ListItemIcon><ListItemText primary={resource.label} /></ListItemButton>)}</Box> : null;
      })}
      {user?.is_superuser && <Box mt={2}><Divider sx={{ borderColor: "#2b4437", mx: 3, mb: 2 }} /><ListItemButton component={RouterLink} to="/platform" sx={itemStyle}>
        <ListItemIcon><AdminPanelSettingsOutlinedIcon /></ListItemIcon><ListItemText primary="Administration plateforme" /></ListItemButton></Box>}
    </List>
    <Box sx={{ p: 2, borderTop: "1px solid #2a4335" }}>
      <Typography sx={{ color: "#8ea99a", fontSize: 10, mb: 1 }}>ENTREPRISE</Typography>
      <Select size="small" value={tenantId ?? ""} onChange={(event) => setTenantId(event.target.value)} fullWidth inputProps={{ "aria-label": "Entreprise active" }}
        sx={{ bgcolor: "#203d30", color: "white", fontSize: 12, '& .MuiSelect-icon': { color: "#8ea99a" }, '& fieldset': { borderColor: "#345040" } }}>
        {(user?.memberships ?? []).filter((item) => item.is_active && item.tenant.is_active).map((item) => <MenuItem key={item.id} value={item.tenant.id}>{item.tenant.name}</MenuItem>)}
      </Select>
    </Box>
  </Stack>;
  return <Box sx={{ minHeight: "100vh" }}>
    <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider", width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, bgcolor: "rgba(255,255,255,.94)", backdropFilter: "blur(12px)" }}>
      <Toolbar sx={{ gap: { xs: 1, lg: 2 }, px: { xs: 2, lg: 4 }, minHeight: "76px !important" }}>
        {!isDesktop && <IconButton aria-label="Ouvrir le menu" onClick={() => setMobileOpen(true)}><MenuIcon /></IconButton>}
        <Box sx={{ flex: 1, minWidth: 0, display: { xs: "none", sm: "block" } }}><Typography variant="body2" fontWeight={600}>Votre espace de travail</Typography>
          <Typography variant="caption" color="text.secondary">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Bujumbura" }).format(new Date())}</Typography></Box>
        <ProjectSelector /><GlobalSearch /><NotificationCenter />
        <Divider orientation="vertical" flexItem sx={{ my: 2, display: { xs: "none", lg: "block" } }} />
        <Avatar sx={{ width: 34, height: 34, bgcolor: "#e7eee6", color: "primary.main", fontSize: 13, fontWeight: 700 }}>{name.slice(0, 1).toUpperCase()}{user?.last_name?.slice(0, 1)}</Avatar>
        <Tooltip title="Se déconnecter"><IconButton aria-label="Se déconnecter" onClick={logout} size="small"><LogoutIcon fontSize="small" /></IconButton></Tooltip>
      </Toolbar>
    </AppBar>
    <Box component="nav" aria-label="Navigation principale">
      <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: "block", md: "none" }, '& .MuiDrawer-paper': { width: drawerWidth, border: 0 } }}>{drawer}</Drawer>
      <Drawer variant="permanent" sx={{ display: { xs: "none", md: "block" }, '& .MuiDrawer-paper': { width: drawerWidth, border: 0 } }}>{drawer}</Drawer>
    </Box>
    <Box component="main" sx={{ ml: { md: `${drawerWidth}px` }, pt: "108px", px: { xs: 2, sm: 3, lg: 4 }, pb: 5, minWidth: 0 }}>
      <Box sx={{ maxWidth: 1600, mx: "auto" }} key={tenantId}>{error && <Typography color="error" mb={2}>{error}</Typography>}{children}</Box>
    </Box>
  </Box>;
}
