import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Alert, Box, Button, IconButton, InputAdornment, Paper, Stack, TextField, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ConstructionIcon from "@mui/icons-material/Construction";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useAuth } from "../state/auth";
import { errorMessage } from "../api/workspace";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? "admin@chantier.local" : "");
  const [password, setPassword] = useState(import.meta.env.DEV ? "ChangeMe123!" : "");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    try { await login(email.trim(), password); navigate("/", { replace: true }); }
    catch (error) { setError(axios.isAxiosError(error) && error.response?.status === 401 ? "L’adresse e-mail ou le mot de passe est incorrect." : errorMessage(error)); }
  };
  return <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" } }}>
    <Box sx={{ bgcolor: "#152e25", color: "#fff", p: { xs: 4, lg: 8 }, display: { xs: "none", md: "flex" }, flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <Stack direction="row" spacing={1.5} alignItems="center"><ConstructionIcon sx={{ color: "#e9a15c" }} /><Typography sx={{ fontWeight: 800, letterSpacing: ".16em", fontSize: 22 }}>CHANTIER<span style={{ color: "#e9a15c" }}>.</span></Typography></Stack>
      <Box sx={{ my: "auto", py: 7, position: "relative", zIndex: 1 }}><Typography variant="overline" sx={{ color: "#9eb5a2" }}>DU TERRAIN AU PILOTAGE</Typography>
        <Typography sx={{ fontSize: { md: 42, lg: 56 }, fontWeight: 650, lineHeight: 1.12, letterSpacing: "-.055em", mt: 2 }}>Les bons outils.<br />Les bonnes décisions.<br /><span style={{ color: "#e9a15c" }}>De solides projets.</span></Typography>
        <Typography sx={{ color: "#acbfb0", maxWidth: 400, mt: 3, lineHeight: 1.8 }}>Planifiez les travaux, coordonnez vos équipes et gardez une vue claire sur chacun de vos chantiers.</Typography>
        <Stack spacing={2} mt={5}>{["Un espace pour toute votre équipe", "Les informations du terrain centralisées", "Des décisions appuyées sur vos données"].map((label) => <Stack key={label} direction="row" spacing={1.5} alignItems="center"><CheckCircleOutlineIcon sx={{ color: "#77a883", fontSize: 20 }} /><Typography variant="body2" color="#cfdbd1">{label}</Typography></Stack>)}</Stack>
      </Box>
      <Box aria-hidden sx={{ position: "absolute", width: 480, height: 480, border: "1px solid #38523c", transform: "rotate(30deg)", right: -260, bottom: -220, '&:before': { content: '""', position: "absolute", inset: 40, border: "1px solid #38523c" } }} />
      <Typography variant="caption" color="#8ba18e">CHANTIER · Gestion de projets BTP</Typography>
    </Box>
    <Box sx={{ display: "grid", placeItems: "center", px: { xs: 3, sm: 6 }, py: 6, bgcolor: "#f8f9f5" }}>
      <Paper elevation={0} sx={{ width: "100%", maxWidth: 410, bgcolor: "transparent" }}>
        <Typography variant="overline" color="primary.main">BIENVENUE SUR CHANTIER</Typography><Typography variant="h4" sx={{ fontSize: 32, mt: 1 }}>Heureux de vous retrouver.</Typography>
        <Typography color="text.secondary" mt={1.5} mb={4}>Connectez-vous à votre espace de travail.</Typography>
        <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Adresse e-mail" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required fullWidth />
          <TextField label="Mot de passe" type={visible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required fullWidth
            InputProps={{ endAdornment: <InputAdornment position="end"><IconButton aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setVisible(!visible)} edge="end">{visible ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}</IconButton></InputAdornment> }} />
          <Button type="submit" variant="contained" size="large" disabled={loading} endIcon={<ArrowForwardIcon />} sx={{ py: 1.6 }}>{loading ? "Connexion en cours…" : "Se connecter"}</Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 4, lineHeight: 1.8 }}>Vous n’avez pas encore d’accès ? Contactez l’administrateur de votre entreprise.</Typography>
      </Paper>
    </Box>
  </Box>;
}
