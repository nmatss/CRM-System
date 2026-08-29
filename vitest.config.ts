import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    // Playwright owns everything under e2e/; vitest must never pick it up.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          include: ["client/src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          include: ["server/**/*.{test,spec}.{ts,tsx}"],
          environment: "node",
          setupFiles: ["./vitest.setup.ts", "./vitest.global-setup.ts"],
          // Backend suites open process-wide SQLite modules and must not share a database concurrently.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: path.resolve(__dirname, "./coverage"),
      include: ["client/src/**/*.{ts,tsx}", "server/**/*.ts"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/test/**",
        "**/__tests__/**",
        "vite.config.ts",
        "vitest.config.ts",
        "vitest.setup.ts",
        "server/index.ts",
      ],
      // Progressive ratchet: kept just below the measured value so a real
      // regression fails CI while normal work does not flake.
      thresholds: {
        statements: 29,
        branches: 23,
        functions: 21,
        lines: 29,
      },
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
      "@": path.resolve(__dirname, "./client/src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
});
