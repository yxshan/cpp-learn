import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { singleDompurifyPlugin } from "./vite-plugin-single-dompurify.ts";

const apiUrl = process.env["CPP_LEARN_API_URL"] ?? "http://127.0.0.1:4173";

export default defineConfig({
  plugins: [singleDompurifyPlugin(), react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      // `changeOrigin: false` keeps the browser's `Host` header, which is what
      // lets the API server verify that a state-changing request came from the
      // origin it is serving. Vite's string shorthand would rewrite the header
      // to the API address and every mutation would be refused.
      "/api": { target: apiUrl, changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
