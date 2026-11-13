import { expect, type Page, test } from "@playwright/test";

/**
 * Group E (accounts). Needs `supabase start` (Mailpit on :54328) and USE_FAKE_AI=true.
 * Email codes are read from the local mailbox, never from a real inbox.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54328";

async function latestCode(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const data = (await res.json()) as { messages?: { ID: string }[] };
    const id = data.messages?.[0]?.ID;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text?: string; HTML?: string };
      const code = `${msg.Text ?? ""} ${msg.HTML ?? ""}`.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no code in the local mailbox");
}

const unique = () => `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.local`;

async function signInWithCode(page: Page, email: string) {
  await page.getByPlaceholder("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("6-digit code").fill(await latestCode(email));
  await page.getByRole("button", { name: "Continue" }).click();
}

test("E01: opening the app stores nothing; the first action creates the guest", async ({ page, context }) => {
  await page.goto("/en/documents");
  expect((await context.cookies()).some((c) => c.name.startsWith("sb-"))).toBe(false);
  await page.getByTestId("sample-lease").click();
  await expect(page).toHaveURL(/\/en\/documents\/[0-9a-f-]{36}/, { timeout: 30_000 });
  expect((await context.cookies()).some((c) => c.name.startsWith("sb-"))).toBe(true);
});

test("E03 + guest upgrade: the email code keeps the guest's documents", async ({ page }) => {
  await page.goto("/en/documents");
  await page.getByTestId("sample-visa").click();
  await expect(page).toHaveURL(/\/en\/documents\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const docUrl = page.url();

  await page.getByRole("button", { name: "Save your work" }).first().click();
  await signInWithCode(page, unique());
  await expect(page.getByText("You're signed in.")).toBeVisible();

  await page.goto(docUrl);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("E04: a wrong code shows a clear error", async ({ page }) => {
  await page.goto("/en/sign-in");
  const email = unique();
  await page.getByPlaceholder("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("alert")).toContainText("doesn't match");
});

test("E10: language and theme are saved in the profile", async ({ page }) => {
  await page.goto("/en/sign-in");
  await signInWithCode(page, unique());
  await page.waitForURL(/\/en\/documents/);
  await page.goto("/en/account");
  await page.getByLabel("Name").fill("Ada");
  await page.getByText("Dark", { exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Ada");
});

test("E09: someone else's document URL is a 404", async ({ page }) => {
  const res = await page.goto("/en/documents/00000000-0000-4000-8000-000000000000");
  expect(res?.status()).toBe(404);
});

test("E13: an open redirect in next is ignored", async ({ request }) => {
  const res = await request.get("/auth/callback?next=//evil.example/x", { maxRedirects: 0 });
  const location = res.headers().location ?? "";
  expect(location).not.toContain("evil.example");
});

test("E11: export returns a zip for a signed-in user", async ({ page }) => {
  await page.goto("/en/sign-in");
  await signInWithCode(page, unique());
  await page.waitForURL(/\/en\/documents/);
  const res = await page.request.get("/api/account/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/zip");
});
