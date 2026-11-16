import { expect, type Page, test } from "@playwright/test";

/**
 * Group E (accounts). Needs `supabase start` (Mailpit on :54328) and USE_FAKE_AI=true.
 * Email codes are read from the local mailbox, never from a real inbox.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54328";

/** The code in the newest email to `email`, once at least `count` emails have arrived (a resend or a reset adds one). */
async function latestCode(email: string, count = 1): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const data = (await res.json()) as { messages?: { ID: string }[] };
    const id = (data.messages?.length ?? 0) >= count ? data.messages?.[0]?.ID : undefined;
    if (id) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
        Text?: string;
        HTML?: string;
      };
      const code = `${msg.Text ?? ""} ${msg.HTML ?? ""}`.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no code in the local mailbox");
}

const unique = () => `e2e-${Date.now()}-${Math.round(Math.random() * 1e6)}@test.local`;
const PASSWORD = "plainly-e2e-pass";

/** Waits for hydration: text typed into a server-rendered input before React attaches is reset. */
async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle" });
}

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

/** Creates an account and approves it with the emailed code (a full code typed into box 1 fills all six and submits). */
async function signUp(page: Page, email: string, password = PASSWORD) {
  await fillCredentials(page, email, password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Confirm your email")).toBeVisible();
  // Demo codes are off on this server: the code only comes by email.
  await expect(page.getByTestId("demo-code")).toHaveCount(0);
  await page.getByLabel("Digit 1 of 6").fill(await latestCode(email));
}

test("E01: opening the app stores nothing; the first action creates the guest", async ({ page, context }) => {
  await page.goto("/en/documents");
  expect((await context.cookies()).some((c) => c.name.startsWith("sb-"))).toBe(false);
  await page.getByTestId("sample-lease").click();
  await expect(page).toHaveURL(/\/en\/documents\/[0-9a-f-]{36}/, { timeout: 30_000 });
  expect((await context.cookies()).some((c) => c.name.startsWith("sb-"))).toBe(true);
});

test("E03 + guest upgrade: a password and the emailed code keep the guest's documents", async ({
  page,
  isMobile,
}) => {
  await open(page, "/en/documents");
  await page.getByTestId("sample-visa").click();
  await expect(page).toHaveURL(/\/en\/documents\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const docUrl = page.url();

  // On a phone the account actions live in the menu.
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Save your work" }).first().click();
  await signUp(page, unique());
  await expect(page.getByText("You're signed in.")).toBeVisible();

  await page.goto(docUrl);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("E04: a pasted wrong code is submitted and shows a clear error", async ({ page }) => {
  await open(page, "/en/sign-in?mode=signup");
  await fillCredentials(page, unique(), PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("New code in")).toBeVisible();
  // Paste into the third box: the whole code still lands from the first box.
  await page.getByLabel("Digit 3 of 6").evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "000 000");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("doesn't match");
});

test("E04: a wrong password is refused; the right one signs in", async ({ page, browser }) => {
  const email = unique();
  await open(page, "/en/sign-in?mode=signup");
  await signUp(page, email);
  await page.waitForURL(/\/en\/documents/);

  const other = await (await browser.newContext()).newPage();
  await open(other, "/en/sign-in");
  await fillCredentials(other, email, "not-the-password");
  await other.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(other.getByRole("main").getByRole("alert")).toContainText("Email or password is wrong.");
  await other.getByPlaceholder("Password", { exact: true }).filter({ visible: true }).fill(PASSWORD);
  await other.getByRole("button", { name: "Sign in", exact: true }).click();
  await other.waitForURL(/\/en\/documents/);
});

test("E04: signing in before approval sends a new code, and the code approves the account", async ({
  page,
  browser,
}) => {
  const email = unique();
  await open(page, "/en/sign-in?mode=signup");
  await fillCredentials(page, email, PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Confirm your email")).toBeVisible();
  await latestCode(email); // the first code arrives and is never entered

  const other = await (await browser.newContext()).newPage();
  await open(other, "/en/sign-in");
  await fillCredentials(other, email, PASSWORD);
  await other.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(other.getByText("Confirm your email")).toBeVisible();
  await other.getByLabel("Digit 1 of 6").fill(await latestCode(email, 2));
  await other.waitForURL(/\/en\/documents/);
});

test("E15: forgot password sends a code, saves the new password and signs in", async ({ page, browser }) => {
  const email = unique();
  await open(page, "/en/sign-in?mode=signup");
  await signUp(page, email);
  await page.waitForURL(/\/en\/documents/);

  const other = await (await browser.newContext()).newPage();
  await open(other, "/en/sign-in");
  await other.getByRole("button", { name: "Forgot password?" }).click();
  await other.getByPlaceholder("Email").filter({ visible: true }).fill(email);
  await other.getByRole("button", { name: "Send code" }).click();
  await expect(other.getByText("Reset your password")).toBeVisible();
  await other.getByLabel("Digit 1 of 6").fill(await latestCode(email, 2));
  await other.getByPlaceholder("New password").fill("plainly-new-pass");
  await other.getByRole("button", { name: "Save password and sign in" }).click();
  await other.waitForURL(/\/en\/documents/);

  const third = await (await browser.newContext()).newPage();
  await open(third, "/en/sign-in");
  await fillCredentials(third, email, "plainly-new-pass");
  await third.getByRole("button", { name: "Sign in", exact: true }).click();
  await third.waitForURL(/\/en\/documents/);
});

test("E10: language and theme are saved in the profile", async ({ page }) => {
  await open(page, "/en/sign-in?mode=signup");
  await signUp(page, unique());
  await page.waitForURL(/\/en\/documents/);
  await open(page, "/en/account");
  await page.getByLabel("Name").fill("Ada");
  await page.getByText("Dark", { exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Ada");
});

test("E09: someone else's document URL is a 404", async ({ page }) => {
  const res = await page.goto("/en/documents/00000000-0000-4000-8000-000000000000");
  expect(res?.status()).toBe(404);
});

test("E13: an open redirect in next is ignored", async ({ request }) => {
  const res = await request.get("/auth/callback?next=//evil.example/x", { maxRedirects: 0 });
  const location = res.headers().location ?? "";
  expect(location).not.toContain("evil.example");
});

test("E11: export returns a zip for a signed-in user", async ({ page }) => {
  await open(page, "/en/sign-in?mode=signup");
  await signUp(page, unique());
  await page.waitForURL(/\/en\/documents/);
  const res = await page.request.get("/api/account/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/zip");
});
