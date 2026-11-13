import { expect, test } from "@playwright/test";

test("chat answers from the document with a quote, and refuses what isn't there", async ({
  page,
  isMobile,
}) => {
  await page.goto("/en/documents");
  await page.getByTestId("sample-lease").click();
  await expect(page.getByTestId("analysis-status").filter({ visible: true })).toHaveText("Analysis ready", {
    timeout: 30_000,
  });

  const input = page.getByLabel("Ask about this document…");
  await input.fill("Can I keep animals?");
  await input.press("Enter");
  const answer = page.getByTestId("chat-answer").last();
  await expect(answer).toContainText("prior written consent", { timeout: 15_000 });
  const chip = answer.getByRole("button", { name: /^Page 2:/ });
  await expect(chip).toBeVisible();

  await chip.click();
  const mark = page.locator("mark[data-hl]").filter({ hasText: "prior written consent" });
  await expect(isMobile ? mark.last() : mark.first()).toBeVisible();
  if (isMobile) await page.keyboard.press("Escape");

  await input.fill("Is a parking space included?");
  await input.press("Enter");
  await expect(page.getByTestId("chat-refusal")).toHaveText("I can't find that in this document.", {
    timeout: 15_000,
  });

  // history is restored from the database
  await page.reload();
  const visible = (id: string) => page.getByTestId(id).filter({ visible: true });
  await expect(visible("chat-refusal")).toBeVisible();
  await expect(visible("chat-answer").first()).toContainText("prior written consent");
});
