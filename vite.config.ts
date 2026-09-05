import { copyFileSync, existsSync } from "node:fs";
import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { componentTagger } from "lovable-tagger";
import {
  assertProductionApiBaseUrl,
  resolveApiBaseUrl,
} from "./src/api/apiBaseUrl";

function spaFallbackHtmlPlugin(): Plugin {
  return {
    name: "spa-fallback-html",
    closeBundle() {
      const indexHtml = path.resolve(__dirname, "dist/index.html");
      const fallbackHtml = path.resolve(__dirname, "dist/404.html");
      if (existsSync(indexHtml)) {
        copyFileSync(indexHtml, fallbackHtml);
      }
    },
  };
}

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
    plugins: [
      react(),
      spaFallbackHtmlPlugin(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
