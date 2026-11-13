import { expect, test } from "@playwright/test";

test("dated actions become deadlines: overdue state, mark done, .ics export", async ({ page }) => {
  test.setTimeout(90_000); // two full analyses
  await page.goto("/en/documents");
  await page.getByTestId("sample-visa").click();
  await expect(page.getByTestId("analysis-status").filter({ visible: true })).toHaveText("Analysis ready", {
    timeout: 30_000,
  });
  await page.goto("/en/documents");
  await page.getByTestId("sample-lease").click();
  await expect(page.getByTestId("analysis-status").filter({ visible: true })).toHaveText("Analysis ready", {
    timeout: 30_000,
  });

  await page.goto("/en/deadlines");
  const rows = page.getByTestId("deadline");
  await expect(rows.first()).toBeVisible();
  // soonest first; the lease signature date (5 Nov 2026) is overdue
  await expect(page.getByRole("region", { name: "Overdue" })).toContainText("Sign and return the lease");
  await expect(page.getByRole("region", { name: "Upcoming" })).toContainText("Book an appointment and apply");

  // mark done -> leaves the open list, shows under "All"
  await page
    .getByRole("checkbox", { name: /Sign and return the lease/ })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "Overdue" })).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("region", { name: "Done" })).toContainText("Sign and return the lease");

  // export all as .ics
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export all (.ics)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("plainly-deadlines.ics");
  const body = await (await file.createReadStream()).toArray();
  const ics = Buffer.concat(body).toString("utf8");
  expect(ics).toContain("DTSTART;VALUE=DATE:20261215");
  expect(ics).not.toContain("Sign and return the lease");
});
