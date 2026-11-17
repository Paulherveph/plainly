import type { Page } from "@playwright/test";

/** Creates a confirmed account through the real sign-up form and the code from Mailpit, then signs in. */
export async function signUp(page: Page, prefix: string): Promise<string> {
  const email = `${prefix}-${Date.now()}@test.local`;
  await page.goto("/en/sign-in?mode=signup", { waitUntil: "networkidle" });
  await page.getByPlaceholder("Email").filter({ visible: true }).fill(email);
  await page.getByPlaceholder("Password", { exact: true }).filter({ visible: true }).fill("plainly-e2e-pass");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Confirm your email").waitFor();
  const res = await fetch(`http://127.0.0.1:54328/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const id = ((await res.json()) as { messages: { ID: string }[] }).messages[0]?.ID;
  const msg = (await (await fetch(`http://127.0.0.1:54328/api/v1/message/${id}`)).json()) as { Text: string };
  // The sixth digit submits the code, which approves the new account and signs in.
  await page.getByLabel("Digit 1 of 6").fill(msg.Text.match(/\b(\d{6})\b/)?.[1] ?? "");
  await page.waitForURL(/\/en\/documents/);
  return email;
}
