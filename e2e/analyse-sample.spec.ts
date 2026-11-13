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

test("the preview shows the uploaded file and toggles to the extracted text", async ({
  page,
  isMobile,
  playwright,
}) => {
  test.skip(isMobile, "the desktop aside is enough; the mobile sheet renders the same component");
  await page.goto("/en/documents");
  await page.getByTestId("sample-lease").click();
  await page.waitForURL(/\/en\/documents\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop();
  const src = `/api/documents/${id}/original`;

  const preview = page.getByRole("complementary", { name: "Document preview" });
  await expect(preview.locator("iframe")).toHaveAttribute("src", `${src}#view=FitH`);
  await expect(preview.locator("article[data-page]").first()).toBeHidden();

  await preview.getByRole("button", { name: "Show extracted text" }).click();
  await expect(preview.getByText("Extracted text")).toBeVisible();
  await expect(preview.locator("article[data-page]").first()).toContainText("RESIDENTIAL LEASE");
  await expect(preview.locator("iframe")).toBeHidden();

  await preview.getByRole("button", { name: "Show original file" }).click();
  await expect(preview.locator("iframe")).toBeVisible();

  // owner gets the file, framable by our pages only; a stranger gets nothing
  const res = await page.request.get(src);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect(res.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(res.headers()["cache-control"]).toContain("no-store");
  const stranger = await playwright.request.newContext({ baseURL: page.url() });
  expect((await stranger.get(src)).status()).toBe(401);
  await stranger.dispose();
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
