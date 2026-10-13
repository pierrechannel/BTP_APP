import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";

import { useAuth } from "../state/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("admin@chantier.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch {
      setError("Connexion impossible. Verifie le backend, l'email et le mot de passe.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        bgcolor: "background.default",
        px: 2,
        py: 4,
      }}
    >
      <Container maxWidth="xs">
        <Paper sx={{ p: { xs: 2.5, sm: 4 }, border: 1, borderColor: "divider" }} elevation={0}>
          <Stack spacing={3} component="form" onSubmit={handleSubmit}>
            <Box>
              <Typography variant="h4" sx={{ fontSize: { xs: 28, sm: 34 } }}>
                Chantier Admin
              </Typography>
              <Typography color="text.secondary">
                Connecte-toi au backend Django.
              </Typography>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={<LoginIcon />}
              disabled={loading}
              fullWidth
            >
              Se connecter
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
