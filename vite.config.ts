import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.md"],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      // Agent-tooling directories: not app code, and their tests use Node's
      // built-in node:test runner, which vitest can't bundle.
      ".claude/**",
      ".agents/**",
    ],
  },
});
