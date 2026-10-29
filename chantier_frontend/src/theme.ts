import { createTheme } from "@mui/material";
export const theme = createTheme({
  palette: {
    mode: "light", primary: { main: "#16532f", light: "#e3eee0", dark: "#103d24" },
    secondary: { main: "#ea8c42" }, background: { default: "#f6f6f1", paper: "#ffffff" },
    text: { primary: "#103d24", secondary: "#647566" }, divider: "#e5eae0",
    success: { main: "#277c56" }, warning: { main: "#b97822" }, error: { main: "#c34d4d" },
  },
  shape: { borderRadius: 8 },
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
    MuiTabs: { styleOverrides: { root: { minHeight: 42, background: "#f3f7f1", borderRadius: 6, padding: 4 }, indicator: { display: "none" } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600, fontSize: 12, minHeight: 34, borderRadius: 5, padding: "7px 14px", marginRight: 4, "&.Mui-selected": { color: "#fff", background: "#16532f" } } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 8, overflow: "hidden", maxHeight: "90dvh" }, root: { "& .MuiBackdrop-root": { backgroundColor: "rgba(16,61,36,.35)", backdropFilter: "blur(5px)" } } } },
    MuiDialogTitle: { styleOverrides: { root: { background: "#103d24", color: "#fff", fontSize: 15, fontWeight: 700, padding: "16px 24px" } } },
    MuiDialogContent: { styleOverrides: { root: { padding: "24px", "&.MuiDialogContent-root": { paddingTop: 24 } } } },
    MuiDialogActions: { styleOverrides: { root: { padding: "14px 24px", background: "#f3f7f1", borderTop: "1px solid #e5eae0", gap: 8 } } },
    MuiTableCell: { styleOverrides: { head: { fontSize: 11, fontWeight: 700, color: "#fff", background: "#16532f", padding: "12px 16px" }, body: { fontSize: 12, padding: "12px 16px", borderColor: "#edf1eb" } } },
    MuiTableRow: { styleOverrides: { root: { "&:nth-of-type(even)": { background: "#f7faf5" }, "&.MuiTableRow-hover:hover": { background: "#eaf2e6" } } } },
  },
});
