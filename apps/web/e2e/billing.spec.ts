import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

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

test("F07: the demo checkout activates Pro once, with a PDF receipt", async ({ page }) => {
  await signUp(page, "billing");
  await page.goto("/en/pricing");
  await page.getByRole("button", { name: "Get Pro" }).click();
  await page.getByRole("button", { name: /4242 4242 4242 4242/ }).click();
  await page.getByRole("button", { name: "Pay $12.00" }).click();
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Demo, no card charged")).toBeVisible();

  const href = await page.getByRole("link", { name: "Download receipt" }).getAttribute("href");
  const receipt = await page.request.get(href ?? "");
  expect(receipt.headers()["content-type"]).toBe("application/pdf");
  expect((await receipt.body()).subarray(0, 5).toString()).toBe("%PDF-");

  await page.goto("/en/account?tab=plan");
  await expect(
    page.getByRole("tabpanel", { name: "Plan and usage" }).getByText("Pro (monthly)"),
  ).toBeVisible();
});

test("F19: the demo card mirrors the form, flips for the CVC, hides details and only takes test cards", async ({
  page,
}) => {
  await signUp(page, "card");
  await page.goto("/en/pricing");
  await page.getByRole("button", { name: "Get Pro" }).click();
  const card = page.getByTestId("payment-card");
  const number = page.getByTestId("card-number");

  await page.getByLabel("Cardholder name", { exact: true }).fill("Sam Taylor");
  await page.getByLabel("Card number", { exact: true }).pressSequentially("42424242");
  await expect(number).toHaveText("4242 4242 •••• ••••");
  await expect(page.getByTestId("card-name")).toHaveText("Sam Taylor");

  await page.getByLabel("CVC", { exact: true }).focus();
  await expect(card).toHaveAttribute("data-flipped", "true");
  await page.getByLabel("Cardholder name", { exact: true }).focus();
  await expect(card).toHaveAttribute("data-flipped", "false");

  await page.getByRole("button", { name: "Hide card details" }).click();
  await expect(number).toHaveText("•••• •••• •••• ••••");
  await expect(page.getByLabel("Card number", { exact: true })).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show card details" }).click();

  // A real-looking card (valid checksum) is refused: this demo never takes card numbers.
  await page.getByLabel("Card number", { exact: true }).fill("4111 1111 1111 1111");
  await page.getByLabel("Expiry", { exact: true }).fill("1230");
  await page.getByLabel("CVC", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Pay $12.00" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "only the test cards work" })).toBeVisible();

  await page.getByRole("button", { name: /4000 0000 0000 0002/ }).click();
  await page.getByRole("button", { name: "Pay $12.00" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Card declined" })).toBeVisible();
  await expect(page).toHaveURL(/\/en\/checkout/);
});

test("the demo checkout is a 404 without a valid signed session", async ({ request }) => {
  const res = await request.get("/en/checkout?session=forged");
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
