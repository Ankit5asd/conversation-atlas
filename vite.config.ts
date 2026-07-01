/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Browser-only static app. No backend, no server state.
export default defineConfig({
  plugins: [react()],
  build: { target: "es2020", outDir: "dist" },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
