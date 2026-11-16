/**
 * Records the README walkthrough: every public screen and the main features, in one take.
 * Run against a production build with the fake AI (instant, deterministic):
 *   cd apps/web && USE_FAKE_AI=true pnpm build && USE_FAKE_AI=true pnpm start --port 3100
 *   BASE=http://localhost:3100 node assets/media/walkthrough.ts
 * Output: assets/media/walkthrough/walkthrough.{mp4,webp}
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { chromium, type Locator, type Page } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = "assets/media/walkthrough";
const RAW = `${OUT}/raw`;
const SIZE = { width: 1440, height: 900 };

/** A visible cursor with a click ring, so viewers can follow what happens. */
const CURSOR = `
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.id = "__cursor";
    c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;" +
      "background:rgba(255,255,255,.92);box-shadow:0 0 0 2px rgba(124,92,255,.9),0 4px 14px rgba(0,0,0,.35);" +
      "pointer-events:none;z-index:2147483647;transition:transform .12s ease;transform:translate(-100px,-100px)";
    document.documentElement.appendChild(c);
    let x = -100, y = -100;
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; c.style.transform = "translate(" + x + "px," + y + "px)"; }, true);
    addEventListener("mousedown", () => { c.style.transform = "translate(" + x + "px," + y + "px) scale(.7)"; }, true);
    addEventListener("mouseup", () => { c.style.transform = "translate(" + x + "px," + y + "px)"; }, true);
    const s = document.createElement("style");
    s.textContent = "nextjs-portal{display:none!important}";
    document.head.appendChild(s);
  });
`;

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);
let mouse = { x: SIZE.width / 2, y: SIZE.height / 2 };

async function moveTo(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("target not visible");
  mouse = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(mouse.x, mouse.y, { steps: 25 });
  await pause(page, 250);
}

async function click(page: Page, target: Locator) {
  await moveTo(page, target);
  await page.mouse.down();
  await page.mouse.up();
}

/** Smooth scroll by `px`. The browser animates it; wheel events would wait on every WebGL frame. */
async function scroll(page: Page, px: number, ms = 1600) {
  await page.evaluate((top) => window.scrollBy({ top, behavior: "smooth" }), px);
  await pause(page, ms);
}

async function type(page: Page, target: Locator, text: string) {
  await click(page, target);
  await target.pressSequentially(text, { delay: 45 });
  await pause(page, 300);
  await target.press("Enter");
}

const visible = (l: Locator) => l.filter({ visible: true });

async function record(page: Page) {
  // 1. Landing
  await page.goto(`${BASE}/en`, { waitUntil: "load" });
  await page.mouse.move(mouse.x, mouse.y);
  await pause(page, 3000);
  await scroll(page, 900);
  await pause(page, 1200);
  await scroll(page, 900);
  await pause(page, 1200);
  await scroll(page, 1000);
  await pause(page, 1000);

  // 2. Pricing
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(page, 700);
  await click(page, visible(page.getByRole("link", { name: "Pricing" })).first());
  await page.waitForURL(/\/pricing$/);
  await pause(page, 1800);
  await scroll(page, 500, 1000);
  await pause(page, 1200);

  // 3. Documents → a sample, analysed live
  await page.goto(`${BASE}/en/documents`, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Your documents" }).waitFor();
  await pause(page, 1300);
  await click(page, page.getByTestId("sample-lease"));
  await page.waitForURL(/\/en\/documents\/[0-9a-f-]{36}$/);
  await visible(page.getByTestId("analysis-status"))
    .filter({ hasText: "Analysis ready" })
    .waitFor({ timeout: 30_000 });
  await pause(page, 1500);
  await scroll(page, 600, 1400);
  await pause(page, 1200);

  // 4. A quote, checked at its source
  await click(page, page.getByRole("button", { name: /Page 1: security deposit of €1,700/ }).first());
  await page.getByText("Quote found in the document").waitFor();
  await pause(page, 1600);
  await click(page, page.getByRole("button", { name: "Show on page 1" }));
  await pause(page, 2200);

  // 5. Chat: a grounded answer, then a refusal
  const input = visible(page.getByLabel("Ask about this document…")).first();
  await type(page, input, "Can I keep animals?");
  await visible(page.getByTestId("chat-answer"))
    .last()
    .getByRole("button", { name: /^Page 2:/ })
    .waitFor({ timeout: 15_000 });
  await pause(page, 1800);
  await type(page, input, "Is a parking space included?");
  await visible(page.getByTestId("chat-refusal")).last().waitFor({ timeout: 15_000 });
  await pause(page, 2200);

  // 6. Deadlines and calendar export
  await page.goto(`${BASE}/en/deadlines`, { waitUntil: "load" });
  await page.getByTestId("deadline").first().waitFor();
  await pause(page, 1200);
  await moveTo(page, visible(page.getByText(/Export all/)).first());
  await pause(page, 1500);

  // 7. Library, in three languages
  await page.goto(`${BASE}/en/documents`, { waitUntil: "load" });
  await pause(page, 1200);
  await click(page, visible(page.locator("button[lang=fr]")).first());
  await page.waitForURL(/\/fr\/documents$/);
  await pause(page, 1600);
  await click(page, visible(page.locator("button[lang=zh]")).first());
  await page.waitForURL(/\/zh\/documents$/);
  await pause(page, 1600);
  await click(page, visible(page.locator("button[lang=en]")).first());
  await page.waitForURL(/\/en\/documents$/);
  await pause(page, 800);

  // 8. Privacy, then sign in
  await page.goto(`${BASE}/en/privacy`, { waitUntil: "load" });
  await pause(page, 1200);
  await scroll(page, 600, 1200);
  await pause(page, 600);
  await page.goto(`${BASE}/en/sign-in`, { waitUntil: "load" });
  await pause(page, 2500);
}

mkdirSync(RAW, { recursive: true });
for (const f of readdirSync(RAW)) rmSync(`${RAW}/${f}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: SIZE,
  colorScheme: "dark",
  locale: "en-GB",
  recordVideo: { dir: RAW, size: SIZE },
});
await ctx.addInitScript(() => localStorage.setItem("theme", "dark"));
await ctx.addInitScript(CURSOR);
const started = Date.now();
const page = await ctx.newPage();
let lead = 0;
page.once("load", () => {
  lead = (Date.now() - started) / 1000;
});
await record(page);
await ctx.close();
await browser.close();

const webm = `${RAW}/${readdirSync(RAW).find((f) => f.endsWith(".webm"))}`;
const trim = ["-ss", (lead + 0.3).toFixed(2)];
const ff = (args: string[]) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
ff([
  ...trim,
  "-i",
  webm,
  "-c:v",
  "libx264",
  "-crf",
  "20",
  "-preset",
  "slow",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-an",
  `${OUT}/walkthrough.mp4`,
]);
ff([
  ...trim,
  "-i",
  webm,
  "-vf",
  // Under 5 MB so it loads inline on GitHub; the MP4 is the full-quality version.
  "fps=6,scale=760:-2:flags=lanczos",
  "-c:v",
  "libwebp",
  "-quality",
  "50",
  "-compression_level",
  "4",
  "-loop",
  "0",
  "-an",
  `${OUT}/walkthrough.webp`,
]);
console.log("done", OUT);
