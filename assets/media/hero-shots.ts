/**
 * Screenshots of the landing hero at the six S1 widths, with the live orb, into docs/gate-reports/S1/.
 * Run against a production build:  BASE=http://localhost:3102 node assets/media/hero-shots.ts
 * Uses the machine's real GPU (ANGLE flags), so the live orb runs without any spoofing.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3102";
const OUT = "docs/gate-reports/S1";
mkdirSync(OUT, { recursive: true });

const sizes = [
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
] as const;

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu"],
});
const only = process.env.ONLY?.split(",").map(Number); // e.g. ONLY=1440,390
for (const [width, height] of sizes.filter(([w]) => !only || only.includes(w))) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${BASE}/en`);
  await page.waitForSelector('[data-testid="hero-orb"]:not([data-tier="static"]) canvas', {
    timeout: 90_000,
  });
  await page.waitForTimeout(8000); // the orb's intro takes a few seconds on a software renderer
  await page.screenshot({ path: `${OUT}/${width}-fold.png`, timeout: 180_000 });
  if (width === 390 || width === 1440) {
    // Sections reveal as they scroll into view; walk the page so the full-page shot shows them.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 150));
      }
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: `${OUT}/${width}-full.png`, fullPage: true, timeout: 180_000 });
  }
  await context.close();
}
await browser.close();
