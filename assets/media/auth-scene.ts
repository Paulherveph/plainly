/**
 * Renders the static auth-scene posters (apps/web/public/images/auth-scene-{signin,signup}.webp) from the live
 * scene, frozen at the "clean sheet" moment with `?scene=<seconds>`. Used for reduced motion, save-data and
 * weak devices. Run against a running app:  BASE=http://localhost:3000 node assets/media/auth-scene.ts
 * Headless Chromium has only a software renderer, which the page rejects, so the script reports a GPU name.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "apps/web/public/images";
const RAW = "assets/media/screenshots/raw/auth-scene";
mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });

// The glowing line is at its peak at these times (see auth-scene-timeline.ts).
const SHOTS = [
  { variant: "signin", query: "?scene=5.85" },
  { variant: "signup", query: "?mode=signup&scene=5" },
] as const;

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
await context.addInitScript(() => {
  const get = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function (p: number) {
    return p === 0x9246 ? "ANGLE (Capture GPU)" : get.call(this, p);
  };
});
const page = await context.newPage();
for (const shot of SHOTS) {
  await page.goto(`${BASE}/en/sign-in${shot.query}`);
  const canvas = page.locator('[data-testid="auth-scene-canvas"] canvas');
  await canvas.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500); // fade-in
  const png = `${RAW}/${shot.variant}.png`;
  await canvas.screenshot({ path: png });
  const webp = `${OUT}/auth-scene-${shot.variant}.webp`;
  execFileSync("magick", [png, "-resize", "800x", "-define", "webp:method=6", "-quality", "70", webp]);
  const kb = statSync(webp).size / 1024;
  if (kb > 60) throw new Error(`${webp} is ${kb.toFixed(0)} KB, over the 60 KB budget`);
  console.log(`${webp}  ${kb.toFixed(1)} KB`);
}
await browser.close();
