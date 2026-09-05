import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["./vitest.setup.ts", "./vitest.integration.setup.ts"],
    include: ["src/**/*.integration.test.ts"],
    // One shared PostgreSQL database is reset with TRUNCATE ... CASCADE.
    // Parallel files would wipe in-flight rows of sibling files. Unit tests
    // keep the default file parallelism.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
