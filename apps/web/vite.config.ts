import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiUrl = process.env["CPP_LEARN_API_URL"] ?? "http://127.0.0.1:4173";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": apiUrl,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
