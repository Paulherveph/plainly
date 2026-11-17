import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("E16: the account activity graph counts today's explained document", async ({ page }) => {
  await signUp(page, "activity");
  // Inside <main>: while the page streams, Next keeps a hidden copy of the content outside it.
  const main = page.getByRole("main");
  await page.goto("/en/account");
  await expect(main.getByText("Your activity shows here")).toBeVisible();

  await page.goto("/en/documents");
  // A click that lands before hydration only focuses the tab, so click until it is selected.
  const paste = page.getByRole("tab", { name: "Paste text" });
  await expect(async () => {
    await paste.click();
    await expect(paste).toHaveAttribute("aria-selected", "true", { timeout: 1_000 });
  }).toPass();
  await page
    .getByLabel("Document text")
    .fill(`Notice. ${"The tenant must pay the rent before the fifth day of each month. ".repeat(8)}`);
  await page.getByRole("button", { name: "Explain this text" }).click();
  await page.waitForURL(/\/en\/documents\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(
    page.getByTestId("analysis-status").filter({ visible: true }).filter({ hasText: "Analysis ready" }),
  ).toBeVisible({ timeout: 30_000 });

  await page.goto("/en/account");
  const today = new Date().toISOString().slice(0, 10);
  await expect(main.getByTestId("activity-graph").locator(`[data-day="${today}"]`)).toHaveAttribute(
    "data-level",
    "4",
  );
  await expect(main.getByText("1 document · 0 questions")).toBeVisible();
  await expect(main.getByTestId("activity-graph")).toHaveAccessibleName("1 action in the last year");
});
