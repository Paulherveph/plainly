import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** A second server on the same build with demo codes on (docs/TEST_ACCOUNTS.md), for e2e/demo-codes.spec.ts only. */
const DEMO_PORT = 3101;
const DEMO_SPEC = /demo-codes\.spec\.ts/;

const serverEnv = {
  USE_FAKE_AI: "true",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  // Fake billing: the simulator page is allowed under `next start` for E2E only.
  BILLING_PROVIDER: "fake",
  ALLOW_FAKE_BILLING: "true",
  BILLING_WEBHOOK_SECRET: "e2e-fake-billing-secret-0123456789",
};

// Starts once the first server answers, so it never races `pnpm build`.
const waitForMainServer = `node -e "const go=()=>fetch('http://localhost:${PORT}/en').then(()=>process.exit(0),()=>setTimeout(go,1000));go()"`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: DEMO_SPEC },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: DEMO_SPEC },
    {
      name: "demo",
      testMatch: DEMO_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://localhost:${DEMO_PORT}`,
        permissions: ["clipboard-read", "clipboard-write"],
      },
    },
  ],
  webServer: [
    {
      command: `pnpm build && pnpm start --port ${PORT}`,
      url: `http://localhost:${PORT}/en`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: serverEnv,
    },
    {
      command: `${waitForMainServer} && pnpm start --port ${DEMO_PORT}`,
      url: `http://localhost:${DEMO_PORT}/en`,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...serverEnv,
        DEMO_SHOW_CODES: "true",
        // Lets a guest's documents follow it into the new account (E06).
        GUEST_MERGE_SECRET: "e2e-guest-merge-secret-0123456789abcdef",
      },
    },
  ],
});
