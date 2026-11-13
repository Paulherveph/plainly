import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      USE_FAKE_AI: "true",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      // Fake billing: the simulator page is allowed under `next start` for E2E only.
      BILLING_PROVIDER: "fake",
      ALLOW_FAKE_BILLING: "true",
      BILLING_WEBHOOK_SECRET: "e2e-fake-billing-secret-0123456789",
    },
  },
});
