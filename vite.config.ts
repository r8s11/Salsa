import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.md"],
  server: {
    proxy: {
      "/api/ics": {
        target: "https://golatindance.com",
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, "http://x");
          const city = url.searchParams.get("city") ?? "boston";
          return `/events/category/${encodeURIComponent(
            city
          )}/?post_type=tribe_events&ical=1&eventDisplay=list`;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
