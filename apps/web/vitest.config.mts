import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@messages": fileURLToPath(new URL("./messages", import.meta.url)),
      "server-only": fileURLToPath(new URL("./evals/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "evals/**/*.test.ts"],
    // *.int.test.ts need local Supabase: `pnpm test:int` (vitest.int.config.mts).
    exclude: ["node_modules", ".next", "e2e", "**/*.int.test.ts"],
    environment: "node",
  },
});
