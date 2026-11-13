/**
 * Captures real screenshots of every Plainly screen for the videos, the install section and the README.
 * Run against a dev server with the fake AI:  BASE=http://localhost:3200 node assets/media/capture.ts
 * Output: assets/media/screenshots/{desktop,mobile}/{dark,light}/NN-name.webp (+ PNG masters in raw/, gitignored).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { type Browser, chromium, type Page } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3200";
const ONLY = process.env.ONLY; // e.g. "desktop-dark"
const OUT = "assets/media/screenshots";

const devices = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
} as const;
type Device = keyof typeof devices;
type Theme = "dark" | "light";

async function shot(page: Page, device: Device, theme: Theme, name: string, fullPage = false) {
  const dir = `${OUT}/${device}/${theme}`;
  mkdirSync(`${OUT}/raw/${device}/${theme}`, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const png = `${OUT}/raw/${device}/${theme}/${name}.png`;
  // Hide the Next.js dev badge so it never shows up in marketing shots.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: png, fullPage, animations: "disabled", caret: "hide" });
  // WebP caps at 16383 px per side; long full-page shots are scaled to fit.
  const fit = ["-vf", "scale=w='if(gt(ih,16000),-2,iw)':h='min(ih,16000)'"];
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-i",
    png,
    ...fit,
    "-quality",
    "88",
    `${dir}/${name}.webp`,
  ]);
  console.log("  ", device, theme, name);
}

const ready = (page: Page) =>
  page
    .getByTestId("analysis-status")
    .filter({ visible: true })
    .filter({ hasText: "Analysis ready" })
    .waitFor({ timeout: 30_000 });

async function run(browser: Browser, device: Device, theme: Theme) {
  const ctx = await browser.newContext({ ...devices[device], colorScheme: theme, locale: "en-GB" });
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
  const page = await ctx.newPage();
  const s = (name: string, full = false) => shot(page, device, theme, name, full);

  // Landing: hero with the live orb, then the rest with reduced motion so scroll reveals are settled.
  await page.goto(`${BASE}/en`, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  await s("01-landing-hero");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [id, name] of [
    ["how-title", "02-landing-how"],
    ["feat-title", "03-landing-features"],
    ["install-title", "04-landing-install"],
  ] as const) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: "start" }), id);
    await page.evaluate(() => window.scrollBy(0, -90));
    await s(name);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await s("05-landing-full", true);

  await page.goto(`${BASE}/en/documents`, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Your documents" }).waitFor();
  await s("06-documents-empty");

  await page.getByTestId("sample-lease").click();
  await page.waitForURL(/\/en\/documents\/[0-9a-f-]{36}$/);
  await page.waitForTimeout(700);
  await s("07-analysis-streaming");
  await ready(page);
  await s("08-analysis-ready");
  await s("09-analysis-full", true);

  await page
    .getByRole("button", { name: /Page 1: security deposit of €1,700/ })
    .first()
    .click();
  await page.getByText("Quote found in the document").waitFor();
  await s("10-citation-sheet");
  await page.keyboard.press("Escape");

  const input = page.getByLabel("Ask about this document…");
  await input.fill("Can I keep animals?");
  await input.press("Enter");
  await page
    .getByTestId("chat-answer")
    .filter({ visible: true })
    .last()
    .getByText("prior written consent")
    .first()
    .waitFor({ timeout: 15_000 });
  await page
    .getByTestId("chat-answer")
    .filter({ visible: true })
    .last()
    .getByRole("button", { name: /^Page 2:/ })
    .waitFor();
  await page.waitForTimeout(800);
  await input.fill("Is a parking space included?");
  await input.press("Enter");
  await page.getByTestId("chat-refusal").filter({ visible: true }).last().waitFor({ timeout: 15_000 });
  await page
    .getByTestId("chat-refusal")
    .filter({ visible: true })
    .last()
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  await s("11-chat");

  await page.goto(`${BASE}/en/deadlines`, { waitUntil: "load" });
  await page.getByTestId("deadline").first().waitFor();
  await s("12-deadlines");

  await page.goto(`${BASE}/en/documents`, { waitUntil: "load" });
  await page
    .getByRole("link", { name: /Residential lease/i })
    .first()
    .waitFor();
  await page.getByText("Library", { exact: false }).last().scrollIntoViewIfNeeded();
  await s("13-documents-library");

  await page.goto(`${BASE}/en/privacy`, { waitUntil: "load" });
  await s("14-privacy");

  if (device === "desktop") {
    await page.getByRole("button", { name: "Save your work" }).click();
    await page.getByRole("dialog").waitFor();
    await s("15-sign-in");
    await page.keyboard.press("Escape");
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator("#mobile-menu").waitFor();
    await s("15-menu");
    await page.getByRole("button", { name: "Close menu" }).click();
  }

  await page.goto(`${BASE}/en/nothing-here`, { waitUntil: "load" });
  await s("16-not-found");
  await ctx.close();
}

const browser = await chromium.launch();
for (const device of ["desktop", "mobile"] as const) {
  for (const theme of ["dark", "light"] as const) {
    if (ONLY && ONLY !== `${device}-${theme}`) continue;
    console.log(device, theme);
    await run(browser, device, theme).catch(async (e) => {
      for (const ctx of browser.contexts())
        for (const pg of ctx.pages()) await pg.screenshot({ path: `${OUT}/raw/failed.png` });
      throw e;
    });
  }
}
await browser.close();
