import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy API + health to the backend so the browser can use same-origin relative
// paths (`/api/...`). SSE endpoints (files/events, chat message) stream cleanly
// through Vite's proxy in dev.
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/health": { target: apiTarget, changeOrigin: true },
    },
  },
});
