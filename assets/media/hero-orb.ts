/**
 * Renders the static hero-orb fallback (apps/web/public/images/hero-orb-{dark,light}.webp) from the live orb.
 * Run against a production build:  BASE=http://localhost:3102 node assets/media/hero-orb.ts
 * Headless Chromium has only a software renderer, which the page rejects, so the script reports a GPU name.
 * The glow and the edge mask are drawn by the component, so the capture keeps only the particles, on transparency.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3102";
const OUT = "apps/web/public/images";
const RAW = "assets/media/screenshots/raw/hero-orb";
mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
for (const theme of ["dark", "light"] as const) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1700 }, deviceScaleFactor: 1 });
  await context.addInitScript((t) => {
    localStorage.setItem("theme", t);
    const get = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (p: number) {
      return p === 0x9246 ? "ANGLE (Capture GPU)" : get.call(this, p);
    };
  }, theme);
  const page = await context.newPage();
  await page.goto(`${BASE}/en`);
  await page.waitForSelector('[data-testid="hero-orb"][data-tier="high"]', { timeout: 60_000 });
  await page.waitForSelector('[data-testid="hero-orb"] canvas');
  await page.addStyleTag({
    content: `html,body{background:transparent!important}
      body *{visibility:hidden!important}
      [data-testid=hero-orb],[data-testid=hero-orb] canvas{visibility:visible!important}
      [data-testid=hero-orb]>div:first-child{display:none!important}
      [data-testid=hero-orb]>div:last-child{mask-image:none!important}
      section>div[aria-hidden]{display:none!important}`,
  });
  await page.waitForTimeout(6000); // let the intro finish
  const png = `${RAW}/${theme}.png`;
  const box = await page.getByTestId("hero-orb").boundingBox(); // a clip, because the live canvas is never "stable"
  if (!box) throw new Error("hero orb not found");
  await page.screenshot({ path: png, omitBackground: true, clip: box, timeout: 180_000 });
  execFileSync("magick", [
    png,
    "-resize",
    "512x512",
    "-define",
    "webp:alpha-quality=60",
    "-define",
    "webp:method=6",
    "-quality",
    "60",
    `${OUT}/hero-orb-${theme}.webp`,
  ]); // under 60 KB
  await context.close();
}
await browser.close();
