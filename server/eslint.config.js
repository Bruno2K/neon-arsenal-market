import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.ts", "server/src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: [
      "src/**/__tests__/**/*.ts",
      "src/**/*.test.ts",
      "server/src/**/__tests__/**/*.ts",
      "server/src/**/*.test.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "src/shared/middlewares/authenticate.ts",
      "server/src/shared/middlewares/authenticate.ts",
    ],
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
);
