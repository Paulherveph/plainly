import { expect, type Page, test } from "@playwright/test";

/** Next keeps recently visited routes mounted but hidden; assert on what the user sees. */
const status = (page: Page) => page.getByTestId("analysis-status").filter({ visible: true });

test("a guest analyses a sample and checks a quote at its source", async ({ page, isMobile }) => {
  await page.goto("/en/documents");
  await expect(page.getByRole("heading", { name: "Your documents" })).toBeVisible();

  await page.getByTestId("sample-lease").click();
  await page.waitForURL(/\/en\/documents\/[0-9a-f-]{36}$/);

  // streams in, then verifies
  await expect(page.getByTestId("summary-text")).toContainText("12-month lease");
  await expect(status(page)).toHaveText("Analysis ready", { timeout: 30_000 });

  // the invented "parking" claim is dropped by quote verification
  await expect(page.getByTestId("dropped")).toContainText("1 claim was removed");
  await expect(page.getByTestId("section-facts")).not.toContainText("Parking");
  await expect(page.getByTestId("section-actions")).toContainText("Overdue");

  // citation -> source sheet -> highlighted in the preview
  await page
    .getByRole("button", { name: /Page 1: security deposit of €1,700/ })
    .first()
    .click();
  await expect(page.getByText("Quote found in the document")).toBeVisible();
  await page.getByRole("button", { name: "Show on page 1" }).click();
  const mark = page.locator("mark[data-hl]").filter({ hasText: "security deposit" });
  await expect(isMobile ? mark.last() : mark.first()).toBeVisible();

  // cached on reload: no second analysis, same result
  await page.reload();
  await expect(status(page)).toHaveText("Analysis ready");
});

test("the output language switch re-explains in French", async ({ page }) => {
  await page.goto("/en/documents");
  await page.getByTestId("sample-offer").click();
  await expect(status(page)).toHaveText("Analysis ready", { timeout: 30_000 });
  await page.getByRole("link", { name: "FR", exact: true }).click();
  await expect(page.getByTestId("summary-text")).toContainText("Nordlys vous propose", { timeout: 30_000 });
});

test("unsupported files are rejected with a clear message", async ({ page }) => {
  await page.goto("/en/documents");
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "notes.docx", mimeType: "application/msword", buffer: Buffer.from("x") });
  await expect(page.getByRole("tabpanel", { name: "Upload" }).getByRole("alert")).toContainText(
    "isn't supported",
  );
});
