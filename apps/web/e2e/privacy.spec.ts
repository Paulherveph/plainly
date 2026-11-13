import { expect, test } from "@playwright/test";

test("delete everything removes the guest's documents", async ({ page }) => {
  await page.goto("/en/documents");
  await page.getByTestId("sample-offer").click();
  await expect(page.getByTestId("analysis-status").filter({ visible: true })).toHaveText("Analysis ready", {
    timeout: 30_000,
  });

  await page.goto("/en/privacy");
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Yes, delete everything" }).click();
  await expect(page.getByText("Everything was deleted.")).toBeVisible();

  await page.goto("/en/documents");
  await expect(page.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
  await page.goto("/en/deadlines");
  await expect(page.getByRole("heading", { name: "No deadlines yet" })).toBeVisible();
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/en");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("API routes reject bad input and other users' documents", async ({ request }) => {
  expect((await request.post("/api/analysis", { data: { documentId: "nope", locale: "en" } })).status()).toBe(
    400,
  );
  const res = await request.post("/api/analysis", {
    data: { documentId: "00000000-0000-4000-8000-000000000000", locale: "en" },
  });
  expect([401, 404]).toContain(res.status());
  expect((await request.get("/api/cron/expire")).status()).toBe(401);
});
