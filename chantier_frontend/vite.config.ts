import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@mui/x-data-grid")) return "data-grid";
          if (id.includes("@mui") || id.includes("@emotion")) return "material";
          return "vendor";
        },
      },
    },
  },
  server: {
    cors: false,
    port: 5175,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  preview: { cors: false, proxy: { "/api": "http://127.0.0.1:8000" } },
});
