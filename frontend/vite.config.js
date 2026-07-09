import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy /api vers le backend FastAPI pendant le dev (npm run dev).
// En production, le backend sert directement le build (voir server.py).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
