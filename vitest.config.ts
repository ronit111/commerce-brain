import { defineConfig } from "vitest/config";
import path from "path";

// The agent code imports via the "@/..." alias (matching tsconfig paths). Vitest
// doesn't read tsconfig paths on its own, so mirror the single alias here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
