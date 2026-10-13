import { createTheme } from "@mui/material";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#165D59" },
    secondary: { main: "#B7791F" },
    background: { default: "#F6F7F8", paper: "#FFFFFF" },
    success: { main: "#2E7D32" },
    warning: { main: "#ED6C02" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: ["Inter", "Segoe UI", "Arial", "sans-serif"].join(","),
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
  },
});
