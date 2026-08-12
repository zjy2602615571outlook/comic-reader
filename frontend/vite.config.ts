import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During local dev, /api is proxied to the backend on port 9002.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:9002",
      "/health": "http://127.0.0.1:9002",
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
  },
});
