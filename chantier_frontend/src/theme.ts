import { createTheme } from "@mui/material";
export const theme = createTheme({
  palette: {
    mode: "light", primary: { main: "#17644d", light: "#e8f3ed", dark: "#104835" },
    secondary: { main: "#ea8c42" }, background: { default: "#f5f6f3", paper: "#ffffff" },
    text: { primary: "#1c2d29", secondary: "#71807a" }, divider: "#e5eae5",
    success: { main: "#277c56" }, warning: { main: "#b97822" }, error: { main: "#c34d4d" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Segoe UI", "Inter", sans-serif', fontSize: 14,
    h4: { fontWeight: 750, fontSize: "1.8rem", letterSpacing: "-.055rem" },
    h5: { fontWeight: 700, letterSpacing: "-.03rem" }, h6: { fontWeight: 650, fontSize: "1.05rem" },
    overline: { fontSize: ".66rem", fontWeight: 700, letterSpacing: ".13em" },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 8, padding: "9px 18px" }, outlined: { borderColor: "#dce4dd" } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" }, outlined: { borderColor: "#e5eae5" } } },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8, backgroundColor: "#fff" } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    MuiTableCell: { styleOverrides: { head: { fontSize: 12, color: "#71807a", background: "#f9faf8" } } },
  },
});
