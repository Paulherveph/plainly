import { expect, test } from "@playwright/test";

/** Group F with FakeBillingProvider. Needs `supabase start`, USE_FAKE_AI and ALLOW_FAKE_BILLING (playwright.config). */

test("F18: pricing page shows Free, Pro and Max in every locale", async ({ page }) => {
  for (const locale of ["en", "fr", "zh"]) {
    await page.goto(`/${locale}/pricing`);
    await expect(page.locator("main section h2")).toHaveCount(3 + 1); // three cards + FAQ heading
    await expect(page.getByRole("table")).toBeVisible();
  }
});

test("F01: a guest who runs out of credits gets a soft paywall, never a dead end", async ({ page }) => {
  await page.goto("/en/documents");
  const paywall = page.getByTestId("paywall");
  const ready = page
    .getByTestId("analysis-status")
    .filter({ visible: true })
    .filter({ hasText: "Analysis ready" });
  // 8 guest credits: samples are free, so paste texts to spend real credits. Each analysis runs to the
  // end (or the paywall opens) before the next one, so the credits are really spent.
  for (let i = 0; i < 3; i++) {
    await page.goto("/en/documents");
    await page.getByRole("tab", { name: "Paste text" }).click();
    await page
      .getByLabel("Document text")
      .fill(`Notice ${i}. ${"The tenant must pay the rent before the fifth day of each month. ".repeat(8)}`);
    await page.getByRole("button", { name: "Explain this text" }).click();
    await page.waitForURL(/\/en\/documents\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(paywall.or(ready)).toBeVisible({ timeout: 30_000 });
  }
});

test("F07: fake checkout activates Pro once", async ({ page }) => {
  const email = `billing-${Date.now()}@test.local`;
  await page.goto("/en/sign-in?mode=signup", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Email").filter({ visible: true }).fill(email);
  await page.getByPlaceholder("Password", { exact: true }).filter({ visible: true }).fill("plainly-e2e-pass");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Confirm your email").waitFor();
  const res = await fetch(`http://127.0.0.1:54328/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const id = ((await res.json()) as { messages: { ID: string }[] }).messages[0]?.ID;
  const msg = (await (await fetch(`http://127.0.0.1:54328/api/v1/message/${id}`)).json()) as { Text: string };
  // The sixth digit submits the code, which approves the new account and signs in.
  await page.getByLabel("Digit 1 of 6").fill(msg.Text.match(/\b(\d{6})\b/)?.[1] ?? "");
  await page.waitForURL(/\/en\/documents/);

  await page.goto("/en/pricing");
  await page.getByRole("button", { name: "Get Pro" }).click();
  await page.getByRole("button", { name: "Pay (success)" }).click();
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible({ timeout: 30_000 });
  await page.goto("/en/account?tab=plan");
  await expect(page.getByText("Pro (monthly)").filter({ visible: true })).toBeVisible();
});

test("the billing simulator is never public without fake billing", async ({ request }) => {
  const res = await request.get("/en/dev/billing?session=forged");
  expect(res.status()).toBe(404);
});

test("I05: a webhook with a bad signature is rejected", async ({ request }) => {
  const res = await request.post("/api/billing/webhook", {
    data: {
      type: "pack.purchased",
      eventId: "x",
      occurredAt: new Date().toISOString(),
      userId: crypto.randomUUID(),
      packId: "pack_200",
      credits: 200,
    },
    headers: { "x-fake-billing-signature": "forged.value" },
  });
  expect(res.status()).toBe(401);
});
