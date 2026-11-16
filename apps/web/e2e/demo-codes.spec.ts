import { expect, type Page, test } from "@playwright/test";

/**
 * Demo codes (docs/TEST_ACCOUNTS.md). Runs only in the "demo" project, against a server with DEMO_SHOW_CODES=true:
 * the sign-up code appears in a toast with a Copy button instead of an email.
 */
const PASSWORD = "plainly-demo-pass";
const unique = () => `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
const codeInToast = (page: Page) => page.getByTestId("demo-code");

async function fillCredentials(page: Page, email: string, password: string) {
  const emailField = page.getByPlaceholder("Email").filter({ visible: true });
  const passwordField = page.getByPlaceholder("Password", { exact: true }).filter({ visible: true });
  // A fill that lands just before hydration can be wiped: retry until both values stick.
  await expect(async () => {
    await emailField.fill(email);
    await passwordField.fill(password);
    await page.waitForTimeout(300);
    await expect(emailField).toHaveValue(email, { timeout: 100 });
    await expect(passwordField).toHaveValue(password, { timeout: 100 });
  }).toPass({ timeout: 15_000 });
}

async function startSignUp(page: Page, email: string, password = PASSWORD) {
  await page.goto("/en/sign-in?mode=signup", { waitUntil: "networkidle" });
  await fillCredentials(page, email, password);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function readCode(page: Page, not?: string): Promise<string> {
  await expect(codeInToast(page)).toHaveText(/^\d{6}$/);
  if (not) await expect(codeInToast(page)).not.toHaveText(not);
  return ((await codeInToast(page).textContent()) ?? "").trim();
}

async function enterCode(page: Page, code: string) {
  await page.getByLabel("Digit 1 of 6").fill(code);
  await expect(page.getByText("You're signed in.")).toBeVisible();
}

test("D1: sign-up shows the code; Copy puts it on the clipboard and closes the toast", async ({ page }) => {
  await startSignUp(page, unique());
  await expect(page.getByText("Confirm your email")).toBeVisible();
  await expect(page.getByText("is in the message below")).toBeVisible();
  const code = await readCode(page);
  await page.getByRole("button", { name: "Copy" }).click();
  await expect(codeInToast(page)).toHaveCount(0);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await enterCode(page, code);
});

test("D2: after closing the toast, a new code is one click away and the new code works", async ({ page }) => {
  await startSignUp(page, unique());
  const first = await readCode(page);
  await page.getByRole("button", { name: "Close toast" }).click();
  await expect(codeInToast(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Send a new code" }).click();
  const second = await readCode(page, first);
  await enterCode(page, second);
});

test("D3: signing in to an account that was never confirmed shows a code", async ({ page }) => {
  const email = unique();
  await startSignUp(page, email);
  await readCode(page);
  await page.goto("/en/sign-in", { waitUntil: "networkidle" });
  await fillCredentials(page, email, PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await enterCode(page, await readCode(page));
});

test("D4: no code for an email that is already confirmed, or for the wrong password", async ({
  page,
  browser,
}) => {
  const confirmed = unique();
  await startSignUp(page, confirmed);
  await enterCode(page, await readCode(page));
  const pending = unique();
  await startSignUp(page, pending);
  await readCode(page);

  const stranger = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const other = await stranger.newPage();
  for (const [email, password] of [
    [confirmed, PASSWORD],
    [pending, "someone-else-pass"],
  ] as const) {
    await startSignUp(other, email, password);
    await expect(other.getByRole("main").getByRole("alert")).toContainText("already has an account");
    await expect(codeInToast(other)).toHaveCount(0);
  }
  await stranger.close();
});

test("D5: a guest signs up in the dialog with Copy and paste, and keeps the document", async ({ page }) => {
  await page.goto("/en/documents");
  await page.getByTestId("sample-lease").click();
  await expect(page).toHaveURL(/\/en\/documents\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const docUrl = page.url();
  await page.getByRole("button", { name: "Save your work" }).first().click();
  await fillCredentials(page, unique(), PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await readCode(page);
  // The toast sits outside the modal: clicking Copy must work and must not close the dialog.
  await page.getByRole("button", { name: "Copy" }).click();
  await expect(codeInToast(page)).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Save your work" })).toBeVisible();
  await page.getByLabel("Digit 1 of 6").focus();
  await page.keyboard.press("ControlOrMeta+V");
  await expect(page.getByText("We added your document to your account.")).toBeVisible();
  const res = await page.goto(docUrl);
  expect(res?.status()).toBe(200);
});

test("D6: a password reset never shows a code", async ({ page }) => {
  const email = unique();
  await startSignUp(page, email);
  await enterCode(page, await readCode(page));
  await page.context().clearCookies();
  await page.goto("/en/sign-in", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByPlaceholder("Email").filter({ visible: true }).fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("Reset your password")).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(codeInToast(page)).toHaveCount(0);
});
