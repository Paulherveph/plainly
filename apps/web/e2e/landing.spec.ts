import { expect, test } from "@playwright/test";

test("landing: one click from 'Try a sample' to a streamed analysis", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paperwork, in plain language.");
  await page.getByTestId("try-sample").first().click();
  await page.waitForURL(/\/en\/documents\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("analysis-status").filter({ visible: true })).toHaveText("Analysis ready", {
    timeout: 30_000,
  });
});

test("landing is translated and the locale switch keeps the page", async ({ page, isMobile }) => {
  test.skip(isMobile, "the locale switch lives in the mobile menu");
  await page.goto("/en/privacy");
  await page.getByRole("button", { name: "中文" }).click();
  await page.waitForURL(/\/zh\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("隐私说明，简单直白");
});

test("router prefetches never create a guest, real navigations do", async ({ request }) => {
  const hasSession = async () =>
    (await request.storageState()).cookies.some((c) => c.name.includes("auth-token"));

  // What the landing header's <Link> prefetch sends. Next adds its own _rsc redirect, then serves the shell.
  const prefetch = await request.get("/en/documents", {
    headers: { "sec-fetch-mode": "cors", rsc: "1", "next-router-prefetch": "1" },
  });
  expect(prefetch.status()).toBeLessThan(500);
  expect(await hasSession()).toBe(false);

  await request.get("/en/documents", { headers: { "sec-fetch-mode": "navigate" }, maxRedirects: 0 });
  expect(await hasSession()).toBe(true);
});
