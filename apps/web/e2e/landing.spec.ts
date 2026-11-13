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
