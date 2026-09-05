import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import {
  assertProductionApiBaseUrl,
  resolveApiBaseUrl,
} from "./src/api/apiBaseUrl";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["API_", "VITE_"]);
  const apiUrl = resolveApiBaseUrl({
    API_URL: process.env.API_URL || env.API_URL,
    VITE_API_URL: process.env.VITE_API_URL || env.VITE_API_URL,
  });
  if (mode === "production") {
    assertProductionApiBaseUrl(apiUrl);
  }

  return {
    // Bake API_URL at build time so Vercel can store it as Config without a VITE_ prefix.
    define: {
      "import.meta.env.API_URL": JSON.stringify(apiUrl),
    },
    server: {
      host: "::",
      port: 5173,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
