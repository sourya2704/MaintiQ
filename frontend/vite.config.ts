import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
  },
  // three.js is only pulled in by the lazily loaded 3D scenes, so it lands in its own chunk.
  build: { chunkSizeWarningLimit: 1500 },
});
