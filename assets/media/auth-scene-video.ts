/**
 * Records 10 s of the live auth scene (both variants) for the README and the portfolio. Not used by the app.
 * Playwright video capture of the real page, then ffmpeg crops the media card and encodes H.264.
 * Run against a running app:  BASE=http://localhost:3000 node assets/media/auth-scene-video.ts
 * Uses the machine's GPU (60 fps); SwiftShader only reaches about 30 fps and the motion stutters.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "assets/video-src";
const TMP = "assets/media/screenshots/raw/auth-scene-video";
const SECONDS = 10;
const VIEWPORT = { width: 1440, height: 900 };
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const even = (n: number) => Math.floor(n / 2) * 2;

const browser = await chromium.launch({
  args: ["--use-angle=vulkan", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan"],
});
for (const variant of ["signin", "signup"] as const) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: TMP, size: VIEWPORT },
  });
  const started = Date.now();
  await context.addInitScript(() => {
    const get = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (p: number) {
      return p === 0x9246 ? "ANGLE (Capture GPU)" : get.call(this, p);
    };
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/sign-in${variant === "signup" ? "?mode=signup" : ""}`);
  // The clip is the scene alone: no page overlay (logo, tagline) and no dev-server indicator.
  await page.addStyleTag({
    content: '[data-testid="auth-scene"] ~ div, nextjs-portal { display: none !important; }',
  });
  await page.locator('[data-testid="auth-scene-canvas"] canvas').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800); // canvas fade-in
  const offset = (Date.now() - started) / 1000;
  const box = await page.getByTestId("auth-scene").boundingBox();
  if (!box) throw new Error("auth scene not found");
  await page.waitForTimeout((SECONDS + 1.5) * 1000); // the recording ends slightly before the context closes
  const video = page.video();
  await context.close();
  const webm = await video?.path();
  if (!webm) throw new Error("no video recorded");

  const mp4 = `${OUT}/auth-scene-${variant}.mp4`;
  const crop = `crop=${even(box.width)}:${even(box.height)}:${Math.round(box.x)}:${Math.round(box.y)}`;
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-ss",
    offset.toFixed(2),
    "-i",
    webm,
    "-t",
    String(SECONDS),
    "-vf",
    `${crop},fps=30`,
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-preset",
    "slow",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    mp4,
  ]);
  console.log(mp4);
}
await browser.close();
rmSync(TMP, { recursive: true, force: true });
