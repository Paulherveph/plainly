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

test("a visitor who clicks 'Upload a document' lands in the app with a working session", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Upload a document" }).first().click();
  await page.waitForURL(/\/en\/documents$/);
  await expect(page.getByRole("heading", { name: "Your documents" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0); // not Next's route announcer
  await page.getByTestId("sample-lease").click(); // needs a guest session
  await page.waitForURL(/\/en\/documents\/[0-9a-f-]{36}$/);
});

test("the landing page does not prefetch app pages (each prefetch would create its own guest)", async ({
  page,
}) => {
  const prefetched: string[] = [];
  page.on("request", (r) => {
    if (/\/(documents|deadlines)(\?|$)/.test(r.url()) && r.url().includes("_rsc")) prefetched.push(r.url());
  });
  await page.goto("/en");
  await page.waitForLoadState("networkidle");
  expect(prefetched).toEqual([]);
});

test("H11: the use-case hub links six documents to Plainly and stays still with reduced motion", async ({
  browser,
}) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion });
    await page.goto("/en");
    const hub = page.locator("section[aria-labelledby=uses-title]");
    await hub.scrollIntoViewIfNeeded();
    await expect(hub.getByRole("link")).toHaveCount(6);
    await expect(hub.getByRole("link", { name: "Visa: open a sample" })).toHaveAttribute(
      "href",
      "/en/documents/try?sample=visa",
    );
    await expect(hub.locator(".uc-live")).toBeVisible({ visible: reducedMotion === "no-preference" });
    await page.close();
  }
});
