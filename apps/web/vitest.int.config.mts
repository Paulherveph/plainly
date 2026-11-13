import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Integration tests against local Supabase (`supabase start`). Reads .env.local for the keys. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./evals/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.int.test.ts"],
    environment: "node",
    testTimeout: 60_000,
  },
});
